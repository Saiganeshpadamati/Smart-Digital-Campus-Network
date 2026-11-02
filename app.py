"""
Smart Digital Campus Network - Flask Backend & GNS3 API Gateway
Serves static web files, proxies GNS3 server API calls, and provides an AI Assistant endpoint.
"""

import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from requests.auth import HTTPBasicAuth

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
logger = logging.getLogger(__name__)

# Base static folder
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/static')
CORS(app)

# GNS3 Server Configuration
raw_gns3_url = os.environ.get('GNS3_URL', os.environ.get('GNS3_SERVER_URL', 'http://127.0.0.1:3080/v2')).rstrip('/')
GNS3_SERVER_URL = raw_gns3_url if raw_gns3_url.endswith('/v2') else f"{raw_gns3_url}/v2"
GNS3_USER = os.environ.get('GNS3_USER', None)
GNS3_PASSWORD = os.environ.get('GNS3_PASSWORD', None)

def get_gns3_auth():
    if GNS3_USER and GNS3_PASSWORD:
        return HTTPBasicAuth(GNS3_USER, GNS3_PASSWORD)
    return None

# ==============================================================================
# GNS3 API Endpoints (Backend Proxy)
# ==============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Checks if the backend is running and whether the GNS3 server is reachable.
    """
    auth = get_gns3_auth()
    gns3_reachable = False
    gns3_version = None
    error_msg = None

    try:
        resp = requests.get(f"{GNS3_SERVER_URL}/version", auth=auth, timeout=2.5)
        if resp.status_code == 200:
            gns3_reachable = True
            data = resp.json()
            gns3_version = data.get('version', '2.x')
        else:
            error_msg = f"GNS3 returned HTTP {resp.status_code}: {resp.text}"
    except requests.exceptions.ConnectionError:
        error_msg = f"Connection refused. GNS3 server is not running at {GNS3_SERVER_URL}"
    except requests.exceptions.Timeout:
        error_msg = f"Connection timed out while reaching GNS3 server at {GNS3_SERVER_URL}"
    except Exception as e:
        error_msg = str(e)

    return jsonify({
        'status': 'online',
        'backend': 'Smart Campus Network API v1.0',
        'gns3_reachable': gns3_reachable,
        'gns3_url': GNS3_SERVER_URL,
        'gns3_version': gns3_version,
        'error': error_msg
    })

@app.route('/api/projects', methods=['GET'])
def list_projects():
    """
    Lists all projects configured in the GNS3 server.
    Returns: [{ name, project_id, status }, ...]
    """
    auth = get_gns3_auth()
    try:
        resp = requests.get(f"{GNS3_SERVER_URL}/projects", auth=auth, timeout=4)
        if resp.status_code == 200:
            projects = resp.json()
            simplified = [
                {
                    'name': p.get('name', 'Unnamed Project'),
                    'project_id': p.get('project_id', ''),
                    'status': p.get('status', 'opened' if p.get('auto_start') else 'closed'),
                    'filename': p.get('filename', '')
                }
                for p in projects
            ]
            return jsonify(simplified)
        else:
            return jsonify({
                'error': f"GNS3 server returned status {resp.status_code}",
                'details': resp.text,
                'gns3_reachable': False
            }), resp.status_code
    except requests.exceptions.RequestException as e:
        logger.warning(f"Could not reach GNS3 server at {GNS3_SERVER_URL}: {e}")
        return jsonify({
            'error': f"GNS3 server unreachable at {GNS3_SERVER_URL}",
            'gns3_reachable': False,
            'projects': []
        }), 503

@app.route('/api/nodes/<project_id>', methods=['GET'])
def list_nodes(project_id):
    """
    Lists all nodes within a specific GNS3 project.
    Returns: [{ name, node_type, status, node_id }, ...]
    """
    auth = get_gns3_auth()
    try:
        resp = requests.get(f"{GNS3_SERVER_URL}/projects/{project_id}/nodes", auth=auth, timeout=4)
        if resp.status_code == 200:
            nodes = resp.json()
            simplified = [
                {
                    'node_id': n.get('node_id', ''),
                    'name': n.get('name', 'Unknown Node'),
                    'node_type': n.get('node_type', 'unknown'),
                    'status': n.get('status', 'stopped')  # 'started', 'stopped', 'suspended'
                }
                for n in nodes
            ]
            return jsonify(simplified)
        elif resp.status_code == 404:
            return jsonify({'error': f"Project ID '{project_id}' not found in GNS3"}), 404
        else:
            return jsonify({'error': f"GNS3 error {resp.status_code}: {resp.text}"}), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f"Failed to connect to GNS3 server: {str(e)}",
            'gns3_reachable': False
        }), 503

@app.route('/api/nodes/<project_id>/<node_id>/<action>', methods=['POST'])
def control_node(project_id, node_id, action):
    """
    Controls a node in GNS3: action can be 'start', 'stop', or 'reload'.
    """
    action = action.lower()
    if action not in ['start', 'stop', 'reload', 'suspend']:
        return jsonify({'error': f"Invalid action '{action}'. Permitted actions: start, stop, reload, suspend"}), 400

    auth = get_gns3_auth()
    try:
        url = f"{GNS3_SERVER_URL}/projects/{project_id}/nodes/{node_id}/{action}"
        resp = requests.post(url, auth=auth, json={}, timeout=6)
        
        if resp.status_code in [200, 201, 204]:
            try:
                res_data = resp.json()
            except Exception:
                res_data = {'action': action, 'status': 'success'}
            return jsonify({
                'success': True,
                'action': action,
                'node_id': node_id,
                'result': res_data
            })
        elif resp.status_code == 404:
            return jsonify({'error': f"Node '{node_id}' or Project '{project_id}' not found in GNS3"}), 404
        else:
            return jsonify({'error': f"GNS3 error {resp.status_code}: {resp.text}"}), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f"Failed to reach GNS3 server: {str(e)}", 'gns3_reachable': False}), 503

# ==============================================================================
# AI Assistant Knowledge Engine & Chat Endpoint
# ==============================================================================

CAMPUS_KNOWLEDGE = {
    "project": {
        "name": "Smart Digital Campus Network Redesign",
        "scale": "5,000 Concurrent Students & Staff across Smart Classrooms, IoT Labs, AI Cameras, and Data Center",
        "simulation": "Simulated and validated end-to-end in GNS3 with Cisco IOS and VyOS routers/switches.",
        "goals": ["High Availability (99.99%)", "Zero-Trust Subnet Isolation", "Sub-second HSRP Failover", "AI-Powered Anomaly Detection"]
    },
    "vlans": [
        {"id": 10, "name": "Academic", "subnet": "10.10.0.0/24", "gateway": "10.10.0.1", "active_core": "Core1", "purpose": "Faculty, lecture hall smart podiums, departmental desktops"},
        {"id": 20, "name": "Admin/ERP", "subnet": "10.20.0.0/24", "gateway": "10.20.0.1", "active_core": "Core1", "purpose": "Finance, administration, registrar, and institutional ERP management"},
        {"id": 30, "name": "Student Wi-Fi", "subnet": "10.30.0.0/20", "gateway": "10.30.0.1", "active_core": "Core2", "purpose": "Campus-wide BYOD and high-density student Wi-Fi 6 APs (4,094 usable IPs)"},
        {"id": 40, "name": "IoT Labs", "subnet": "10.40.0.0/24", "gateway": "10.40.0.1", "active_core": "Core1", "purpose": "Smart energy meters, environmental sensors, robotics testbeds"},
        {"id": 50, "name": "Online Exam", "subnet": "10.50.0.0/24", "gateway": "10.50.0.1", "active_core": "Core2", "purpose": "Secure isolated CBT examination terminals locked exclusively to Exam Server (10.70.0.12)"},
        {"id": 60, "name": "CCTV / AI", "subnet": "10.60.0.0/24", "gateway": "10.60.0.1", "active_core": "Core1", "purpose": "AI surveillance cameras streaming exclusively to campus NVR/AI analytics server"},
        {"id": 70, "name": "Servers", "subnet": "10.70.0.0/24", "gateway": "10.70.0.1", "active_core": "Core2", "purpose": "Enterprise Data Center: Campus Web Server (10.70.0.10), ERP DB (10.70.0.11), Exam Server (10.70.0.12), CCTV NVR (10.70.0.15)"}
    ],
    "security_rules": {
        "VLAN 30 (Students)": "Permitted: HTTP (80), HTTPS (443), and ICMP ping to Server VLAN (10.70.0.0/24) + full Internet WAN access. Blocked: All internal subnets (VLAN 10, 20, 40, 50, 60).",
        "VLAN 40 (IoT Labs)": "Permitted: Outbound HTTPS (443) and MQTT (8883) to Server VLAN + outbound Internet. Blocked: Direct communication with student/admin subnets and unapproved server ports.",
        "VLAN 60 (CCTV / AI)": "Permitted: Local streaming to Server VLAN (10.70.0.0/24) for AI video processing and NVR storage. STRICTLY BLOCKED from Internet WAN (air-gapped from web).",
        "VLAN 50 (Online Exam)": "Permitted: HTTPS connection ONLY to Exam-Server at 10.70.0.12. STRICTLY BLOCKED from public Internet and all other VLANs to prevent cheating and test leakage.",
        "VLAN 20 (Admin/ERP)": "Full administrative access with stateful firewall inspection, SSH/HTTPS network management, and ERP database query rights."
    },
    "redundancy": {
        "core_setup": "Dual Core Architecture (Core1 and Core2) operating HSRP/VRRP with shared virtual IPs ending in .1.",
        "active_distribution": "Core1 is ACTIVE for VLANs 10, 20, 40, 60 (Core2 is STANDBY). Core2 is ACTIVE for VLANs 30, 50, 70 (Core1 is STANDBY).",
        "failover_speed": "< 1.5 seconds automated failover with preemptive tracking. If Core1 fails, Core2 immediately assumes gateway routing for all VLANs.",
        "routing_protocol": "OSPF Area 0 configured across Core and Distribution layers with dual 10Gbps cross-chassis links."
    },
    "ai_threat_detection": {
        "methodology": "Hybrid dual-tier inspection: Rule-based Heuristics (instant ACL violation checks) + Statistical Z-Score Anomaly Scoring on traffic volume (bytes/sec, packets/sec).",
        "monitored_anomalies": [
            "Port Scanning from Student VLAN against Server VLAN (e.g. probing >20 ports in 5 seconds).",
            "Lateral Movement attempts by Student hosts targeting Admin/ERP VLAN (10.20.0.x).",
            "IoT Device Volumetric Flood / Botnet Exfiltration (>50,000 pps burst).",
            "Exam Terminal Outbound Leakage attempts reaching external public IPs."
        ],
        "remediation": "Automated generation of dynamic Cisco/VyOS ACL rules with one-click quarantine blocklist execution."
    }
}

SYSTEM_PROMPT = """You are the AI Assistant for the 'Smart Digital Campus Network' project.
You have complete knowledge of this college network redesign designed for 5,000 students and simulated in GNS3.

Key Architecture Facts:
- VLAN 10 (Academic): 10.10.0.0/24, Gateway 10.10.0.1, Active Core: Core1
- VLAN 20 (Admin/ERP): 10.20.0.0/24, Gateway 10.20.0.1, Active Core: Core1
- VLAN 30 (Student Wi-Fi): 10.30.0.0/20, Gateway 10.30.0.1, Active Core: Core2 (4,094 host capacity)
- VLAN 40 (IoT Labs): 10.40.0.0/24, Gateway 10.40.0.1, Active Core: Core1
- VLAN 50 (Online Exam): 10.50.0.0/24, Gateway 10.50.0.1, Active Core: Core2 (Strictly restricted to Exam Server 10.70.0.12; NO Internet)
- VLAN 60 (CCTV/AI): 10.60.0.0/24, Gateway 10.60.0.1, Active Core: Core1 (Streams to Server VLAN only; NO Internet)
- VLAN 70 (Servers): 10.70.0.0/24, Gateway 10.70.0.1, Active Core: Core2 (Hosts Web 10.70.0.10, ERP 10.70.0.11, Exam 10.70.0.12, NVR 10.70.0.15)

Security & ACL Policies:
- Students: Can reach HTTP/HTTPS/ping on Server VLAN + Internet. Blocked from all other internal VLANs.
- IoT: Only ports 443 and 8883 (MQTT) to Servers + Internet. Blocked from other subnets.
- CCTV/AI: Server access only for AI storage. Absolutely NO Internet access.
- Online Exam: Exam Server (10.70.0.12) access only. Absolutely NO Internet access.
- Admin: Full network and ERP server access.

Reliability:
- Dual Core routers (Core1 and Core2) running HSRP/VRRP with shared virtual IPs ending in .1.
- Core1 is active for VLANs 10, 20, 40, 60. Core2 is active for VLANs 30, 50, 70.
- OSPF Area 0 routing, dual redundant 10Gbps links, sub-1.5s failover.

AI Threat Detection:
- Statistical Z-score + Rule-based heuristic scoring (0-100 risk).
- Identifies port scans, student-to-admin lateral moves, IoT DDoS floods, and exam air-gap breaches.
- Auto-generates ACL mitigation rules.

Instructions:
1. Answer questions clearly, accurately, and professionally.
2. Provide CLI snippets (Cisco IOS / VyOS) or exact IP/VLAN numbers when helpful.
3. If a question is outside the scope of this campus network project, politely state that you specialize only in this Smart Campus Network architecture.
"""

def generate_local_response(user_query):
    query = user_query.lower()

    # VLAN questions
    if any(k in query for k in ["vlan 10", "academic"]):
        return ("**VLAN 10 (Academic)** is allocated subnet `10.10.0.0/24` with default gateway `10.10.0.1`.\n\n"
                "- **Active Core:** Core1 (Core2 is Standby)\n"
                "- **Purpose:** Serves faculty offices, smart classroom podiums, and academic department PCs.\n"
                "- **Access:** Full Internet connectivity and access to Campus Servers (`10.70.0.0/24`).")

    if any(k in query for k in ["vlan 20", "admin", "erp"]):
        return ("**VLAN 20 (Admin/ERP)** is allocated subnet `10.20.0.0/24` with default gateway `10.20.0.1`.\n\n"
                "- **Active Core:** Core1 (Core2 is Standby)\n"
                "- **Purpose:** Hosts administrative workstations, finance, admissions, and ERP management.\n"
                "- **Security:** Full access to all subnets with stateful inspection; isolated from student and IoT traffic.")

    if any(k in query for k in ["vlan 30", "student", "wi-fi", "wifi"]):
        return ("**VLAN 30 (Student Wi-Fi)** uses subnet `10.30.0.0/20` with default gateway `10.30.0.1`.\n\n"
                "- **Active Core:** Core2 (Core1 is Standby)\n"
                "- **Host Capacity:** 4,094 usable IP addresses (`10.30.0.2` to `10.30.15.254`) tailored for 5,000 BYOD students.\n"
                "- **Security ACL:** Permitted HTTP (80), HTTPS (443), and ICMP ping to Server VLAN (`10.70.0.0/24`) + full Internet. Strictly denied access to VLANs 10, 20, 40, 50, and 60.")

    if any(k in query for k in ["vlan 40", "iot", "sensor"]):
        return ("**VLAN 40 (IoT Labs)** is configured with subnet `10.40.0.0/24` and gateway `10.40.0.1`.\n\n"
                "- **Active Core:** Core1 (Core2 Standby)\n"
                "- **Rules:** Only ports 443 (HTTPS) and 8883 (Secure MQTT) permitted to the Server VLAN, plus outbound Internet for cloud sync. Blocked from student and admin subnets.")

    if any(k in query for k in ["vlan 50", "exam", "test", "cbt"]):
        return ("**VLAN 50 (Online Exam)** is an air-gapped subnet `10.50.0.0/24` (Gateway: `10.50.0.1`).\n\n"
                "- **Active Core:** Core2 (Core1 Standby)\n"
                "- **Strict Policy:** Devices in VLAN 50 are permitted to communicate **ONLY** with the Exam-Server (`10.70.0.12`).\n"
                "- **Internet Status:** 🚫 **NO Internet Access** (all outbound WAN traffic is dropped to prevent cheating and test leakages).")

    if any(k in query for k in ["vlan 60", "cctv", "camera", "surveillance"]):
        return ("**VLAN 60 (CCTV / AI)** is configured with subnet `10.60.0.0/24` (Gateway: `10.60.0.1`).\n\n"
                "- **Active Core:** Core1 (Core2 Standby)\n"
                "- **Security Policy:** Cameras stream exclusively to the Campus AI Video NVR (`10.70.0.15` in VLAN 70).\n"
                "- **Internet Access:** 🚫 **NO Internet Access**. Completely air-gapped from the public web to eliminate camera botnet infections and unauthorized video interception.")

    if any(k in query for k in ["vlan 70", "server", "data center", "datacenter"]):
        return ("**VLAN 70 (Servers)** hosts the central data center on `10.70.0.0/24` (Gateway: `10.70.0.1`, Active on Core2).\n\n"
                "**Key Server IPs:**\n"
                "- `10.70.0.10`: Campus Web Portal & LMS\n"
                "- `10.70.0.11`: ERP Database Server\n"
                "- `10.70.0.12`: Online Exam Server\n"
                "- `10.70.0.15`: AI CCTV Video Management / NVR")

    if any(k in query for k in ["failover", "redundancy", "hsrp", "vrrp", "ospf", "core1", "core2"]):
        return ("**High Availability & Redundancy Architecture:**\n\n"
                "1. **Dual Core Routers:** Core1 and Core2 provide active/standby gateway redundancy via HSRP/VRRP with shared `.1` virtual IPs.\n"
                "2. **Active Load Balancing:**\n"
                "   - Core1 is Active for VLANs **10, 20, 40, 60**\n"
                "   - Core2 is Active for VLANs **30, 50, 70**\n"
                "3. **Dynamic Routing:** OSPF Area 0 runs across Core and Distribution layers over redundant 10 Gbps links.\n"
                "4. **Failover Time:** In the event of a Core1 failure, Core2 automatically assumes all gateway duties in **< 1.5 seconds** with zero session loss.")

    if any(k in query for k in ["threat", "ai detection", "anomaly", "z-score", "scoring"]):
        return ("**AI Threat Detection Engine Mechanics:**\n\n"
                "- **Telemetry:** Analyzes live network flows (Src IP, Dst IP, Port, Bytes, Packets/Sec).\n"
                "- **Detection Layers:**\n"
                "  1. *Rule-Based Heuristic:* Instant triggers on unauthorized subnet access (e.g. Student -> Admin) or forbidden internet access (Exam/CCTV -> WAN).\n"
                "  2. *Statistical Z-Score Engine:* Flags volumetric deviations (DDoS bursts, abnormal packet rates) when $Z = (x - \\mu) / \\sigma > 3.0$.\n"
                "- **Output:** Computes risk score (0-100), outputs human-readable explanation, and generates one-click dynamic ACL block rules.")

    if any(k in query for k in ["test", "verification", "ping", "show command", "gns3"]):
        return ("**Verification & Test Plan:**\n\n"
                "1. **Inter-VLAN ACL Test:** Student host (`10.30.2.10`) pings Admin PC (`10.20.0.15`) -> **Expected: Destination Host Unreachable / Denied**.\n"
                "2. **Exam Isolation Test:** Exam PC (`10.50.0.5`) pings Google DNS (`8.8.8.8`) -> **Expected: Request Timed Out (Blocked by ACL)**.\n"
                "3. **Server Access Test:** Student host pings Web Server (`10.70.0.10`) -> **Expected: Reply received (0% loss)**.\n"
                "4. **HSRP Status Check:** `show standby brief` on Core1 & Core2 confirms active/standby state per VLAN.\n"
                "5. **OSPF Neighbor Check:** `show ip ospf neighbor` shows FULL/BDR adjacency across core links.")

    if any(k in query for k in ["budget", "cost", "scalability", "hardware", "scale"]):
        return ("**Budget & Scalability Summary:**\n\n"
                "- **Total Hardware Budget:** Approx. $38,500 (2x Cisco 3850 Core Switches, 1x Distribution Switch, 3x Access Switches, 1x Edge Router).\n"
                "- **Scale Capacity:** Designed to expand to 10,000+ endpoints simply by provisioning additional Wi-Fi 6 APs and upgrading the dual core uplink to 40 Gbps.\n"
                "- **Software Cost:** $0 extra for routing simulation via open GNS3 / VyOS virtual images.")

    # General Fallback
    return ("I can help with questions about the **Smart Digital Campus Network** redesign!\n\n"
            "You can ask me about:\n"
            "- **VLAN Schemes & IP allocations** (e.g. *'What is the subnet for Student Wi-Fi?'*)\n"
            "- **Security ACL policies** (e.g. *'Why is CCTV blocked from the internet?'*)\n"
            "- **Redundancy & HSRP Failover** (e.g. *'How does Core1/Core2 failover work?'*)\n"
            "- **AI Threat Detection** (e.g. *'How does the Z-score anomaly detector work?'*)\n"
            "- **Testing & Verification** (e.g. *'Show GNS3 test commands'*)\n\n"
            "*Ask any question about the network architecture!*")

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    try:
        data = request.get_json() or {}
        message = data.get('message', '').strip()
        history = data.get('history', [])

        if not message:
            return jsonify({'error': 'Message cannot be empty'}), 400

        # Check for Gemini or OpenAI API keys in environment variables
        gemini_key = os.environ.get('GEMINI_API_KEY')
        openai_key = os.environ.get('OPENAI_API_KEY')

        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\nUser Question: {message}"}]}
                    ]
                }
                resp = requests.post(url, json=payload, timeout=10)
                if resp.status_code == 200:
                    result = resp.json()
                    answer = result['candidates'][0]['content']['parts'][0]['text']
                    return jsonify({'response': answer, 'source': 'gemini-llm'})
            except Exception as e:
                logger.warning(f"Gemini API error, falling back to local engine: {e}")

        elif openai_key:
            try:
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
                messages = [{"role": "system", "content": SYSTEM_PROMPT}]
                for h in history[-4:]:
                    messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
                messages.append({"role": "user", "content": message})
                
                resp = requests.post(url, headers=headers, json={"model": "gpt-3.5-turbo", "messages": messages, "max_tokens": 500}, timeout=10)
                if resp.status_code == 200:
                    result = resp.json()
                    answer = result['choices'][0]['message']['content']
                    return jsonify({'response': answer, 'source': 'openai-llm'})
            except Exception as e:
                logger.warning(f"OpenAI API error, falling back to local engine: {e}")

        # Intelligent Built-in Local Knowledge Response
        local_answer = generate_local_response(message)
        return jsonify({'response': local_answer, 'source': 'knowledge-engine'})

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({'error': str(e)}), 500

# ==============================================================================
# Static File Routing
# ==============================================================================

@app.route('/')
def serve_index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(STATIC_DIR, path)):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, 'index.html')

def find_available_port(preferred_port=5000, fallbacks=(5500, 8080, 3000)):
    import socket
    if 'PORT' in os.environ:
        return int(os.environ['PORT'])
    for p in [preferred_port, *fallbacks]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', p))
                return p
            except OSError:
                continue
    return 5500

if __name__ == '__main__':
    port = find_available_port(5000)
    print("=" * 70)
    print(" Smart Digital Campus Network - Backend Server")
    print(f" Web Interface: http://localhost:{port}")
    print(f" GNS3 Gateway:  {GNS3_SERVER_URL}")
    print("=" * 70)
    app.run(host='0.0.0.0', port=port, debug=True)

