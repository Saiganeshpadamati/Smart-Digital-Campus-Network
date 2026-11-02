/**
 * Smart Digital Campus Network - AI Campus Assistant Chat Controller
 * Communicates with Flask backend /api/chat with intelligent local client-side fallback
 */

class CampusAIAssistant {
  constructor() {
    this.chatHistoryEl = document.getElementById('chatHistory');
    this.chatInputEl = document.getElementById('chatInput');
    this.sendBtnEl = document.getElementById('sendChatBtn');
    this.floatingTriggerEl = document.getElementById('floatingChatTrigger');
    this.floatingModalEl = document.getElementById('floatingChatModal');
    this.floatingCloseBtn = document.getElementById('closeFloatingChat');
    this.messages = [];

    this.localKnowledge = {
      vlans: [
        { id: 10, name: "Academic", subnet: "10.10.0.0/24", gw: "10.10.0.1", core: "Core1" },
        { id: 20, name: "Admin/ERP", subnet: "10.20.0.0/24", gw: "10.20.0.1", core: "Core1" },
        { id: 30, name: "Student Wi-Fi", subnet: "10.30.0.0/20", gw: "10.30.0.1", core: "Core2", hosts: "4094 usable IPs" },
        { id: 40, name: "IoT Labs", subnet: "10.40.0.0/24", gw: "10.40.0.1", core: "Core1" },
        { id: 50, name: "Online Exam", subnet: "10.50.0.0/24", gw: "10.50.0.1", core: "Core2" },
        { id: 60, name: "CCTV/AI", subnet: "10.60.0.0/24", gw: "10.60.0.1", core: "Core1" },
        { id: 70, name: "Servers", subnet: "10.70.0.0/24", gw: "10.70.0.1", core: "Core2" }
      ]
    };

    this.init();
  }

  init() {
    if (!this.chatHistoryEl) return;

    // Send button click
    if (this.sendBtnEl) {
      this.sendBtnEl.addEventListener('click', () => this.handleSendMessage());
    }

    // Input Enter Key
    if (this.chatInputEl) {
      this.chatInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Quick Prompt Chips
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const text = e.target.textContent.trim().replace(/^"|"$/g, '');
        if (this.chatInputEl) {
          this.chatInputEl.value = text;
          this.handleSendMessage();
        }
      });
    });

    // Floating Modal Trigger
    if (this.floatingTriggerEl) {
      this.floatingTriggerEl.addEventListener('click', () => {
        const assistantSection = document.getElementById('ai-assistant');
        if (assistantSection) {
          assistantSection.scrollIntoView({ behavior: 'smooth' });
          if (this.chatInputEl) this.chatInputEl.focus();
        }
      });
    }
  }

  async handleSendMessage() {
    const text = this.chatInputEl.value.trim();
    if (!text) return;

    // Clear input
    this.chatInputEl.value = '';

    // Render User Message
    this.appendMessage('user', text);

    // Render Typing Indicator
    const typingId = this.appendTypingIndicator();

    try {
      // Attempt to query Flask Backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: this.messages })
      });

      this.removeTypingIndicator(typingId);

      if (response.ok) {
        const data = await response.json();
        this.appendMessage('bot', data.response);
      } else {
        // Fallback to local client response
        const fallbackText = this.getLocalAnswer(text);
        this.appendMessage('bot', fallbackText);
      }
    } catch (err) {
      // Network error (e.g. static file without server) -> Use local intelligent matcher
      this.removeTypingIndicator(typingId);
      const fallbackText = this.getLocalAnswer(text);
      this.appendMessage('bot', fallbackText);
    }
  }

  getLocalAnswer(query) {
    const q = query.toLowerCase();

    if (q.includes('vlan 10') || q.includes('academic')) {
      return `**VLAN 10 (Academic):**\n- **Subnet:** \`10.10.0.0/24\` (Gateway: \`10.10.0.1\`)\n- **Active Core:** Core1 Router\n- **Purpose:** Connects smart classroom lecturer podiums, departmental desktops, and faculty workstations with access to Server VLAN and Internet.`;
    }

    if (q.includes('vlan 20') || q.includes('admin') || q.includes('erp')) {
      return `**VLAN 20 (Admin/ERP):**\n- **Subnet:** \`10.20.0.0/24\` (Gateway: \`10.20.0.1\`)\n- **Active Core:** Core1 Router\n- **Access:** Full administrative privileges, ERP Database access (\`10.70.0.11\`), and secure SSH management. Isolated from student and IoT subnets.`;
    }

    if (q.includes('vlan 30') || q.includes('student') || q.includes('wifi') || q.includes('wi-fi')) {
      return `**VLAN 30 (Student Wi-Fi):**\n- **Subnet:** \`10.30.0.0/20\` (Gateway: \`10.30.0.1\`)\n- **Active Core:** Core2 Router\n- **Capacity:** 4,094 usable IPs to handle 5,000 BYOD students seamlessly.\n- **Security Rules:** Permitted HTTP (80), HTTPS (443), and ping to Campus Server VLAN (\`10.70.0.0/24\`) + full Internet. Denied from all other internal subnets.`;
    }

    if (q.includes('vlan 40') || q.includes('iot') || q.includes('sensor')) {
      return `**VLAN 40 (IoT Labs):**\n- **Subnet:** \`10.40.0.0/24\` (Gateway: \`10.40.0.1\`)\n- **Active Core:** Core1 Router\n- **Security Policy:** Outbound ports 443 (HTTPS) and 8883 (MQTT) to Server VLAN + Internet cloud telemetry. All other internal subnets are blocked.`;
    }

    if (q.includes('vlan 50') || q.includes('exam') || q.includes('cbt') || q.includes('test')) {
      return `**VLAN 50 (Online Exam):**\n- **Subnet:** \`10.50.0.0/24\` (Gateway: \`10.50.0.1\`)\n- **Active Core:** Core2 Router\n- **Strict Air-Gap:** Communication is restricted **EXCLUSIVELY** to Exam-Server (\`10.70.0.12\`).\n- **Internet Status:** 🚫 **Zero Internet Access** to prevent examination leaks and cheating.`;
    }

    if (q.includes('vlan 60') || q.includes('cctv') || q.includes('camera') || q.includes('surveillance')) {
      return `**VLAN 60 (CCTV / AI):**\n- **Subnet:** \`10.60.0.0/24\` (Gateway: \`10.60.0.1\`)\n- **Active Core:** Core1 Router\n- **Policy:** Video streams flow exclusively to the AI CCTV NVR Server (\`10.70.0.15\`).\n- **Internet Status:** 🚫 **Zero Internet Access** to guarantee privacy and prevent camera botnet infections.`;
    }

    if (q.includes('vlan 70') || q.includes('server') || q.includes('datacenter')) {
      return `**VLAN 70 (Campus Servers):**\n- **Subnet:** \`10.70.0.0/24\` (Gateway: \`10.70.0.1\`)\n- **Active Core:** Core2 Router\n- **Key Server IPs:**\n  - \`10.70.0.10\`: Campus Web Portal\n  - \`10.70.0.11\`: ERP Database\n  - \`10.70.0.12\`: Online Exam Server\n  - \`10.70.0.15\`: AI CCTV Video Management / NVR`;
    }

    if (q.includes('failover') || q.includes('hsrp') || q.includes('vrrp') || q.includes('redundancy') || q.includes('core1') || q.includes('core2')) {
      return `**Redundancy & Failover Mechanics:**\n1. **Active/Standby Pair:** Core1 and Core2 share virtual \`.1\` gateways via HSRP/VRRP.\n2. **Load Balancing:** Core1 handles VLANs 10, 20, 40, 60. Core2 handles VLANs 30, 50, 70.\n3. **Failover Speed:** If a core fails, standby core assumes active gateway status in **< 1.5 seconds** via OSPF Area 0 fast convergence.`;
    }

    if (q.includes('threat') || q.includes('anomaly') || q.includes('z-score') || q.includes('ai')) {
      return `**AI Threat Detection Architecture:**\n- **Dual Scoring:** Evaluates network flows with a Heuristic Rule engine (ACL policy compliance) and Statistical Z-Score engine on traffic rate ($Z > 3.0$).\n- **Anomalies Detected:** Student port scans, unauthorized lateral moves to Admin VLAN, IoT DDoS volumetric floods, and Exam PC air-gap leaks.\n- **Mitigation:** Instant auto-generated Cisco/VyOS ACL syntax with one-click quarantine blocking.`;
    }

    if (q.includes('test') || q.includes('verification') || q.includes('gns3') || q.includes('command')) {
      return `**Verification & GNS3 Testing Commands:**\n- **Inter-VLAN Block Check:** \`ping 10.20.0.5 source 10.30.2.10\` &rarr; *Expect: Unreachable / Denied by ACL*\n- **HSRP Status:** \`show standby brief\` on Core1 & Core2\n- **OSPF Neighbor Adjacency:** \`show ip ospf neighbor\`\n- **Exam Isolation Check:** \`ping 8.8.8.8 source 10.50.0.10\` &rarr; *Expect: Timeout / Denied*`;
    }

    if (q.includes('budget') || q.includes('cost') || q.includes('scale')) {
      return `**Budget & Scalability:**\n- **Total Redesign Budget:** ~$38,500 (Core switches, Access switches, Edge router, Transceivers, Redundant UPS).\n- **Scalability:** Easily expands from 5,000 to 10,000+ endpoints by adding Wi-Fi 6 APs and scaling core trunks to 40 Gbps.`;
    }

    return `I can help you with anything regarding the **Smart Digital Campus Network** redesign project!

You can ask me about:
- **VLAN Schemes & IP Subnets** (e.g. *"What is the subnet for Student Wi-Fi?"*)
- **Security ACL Rules** (e.g. *"Why is CCTV blocked from the internet?"*)
- **High Availability & Failover** (e.g. *"How does HSRP failover work?"*)
- **AI Threat Detection** (e.g. *"Explain the Z-score anomaly scoring"*)
- **Testing & Verification** (e.g. *"Show GNS3 test commands"*)

*(Please note: I am specialized specifically in this campus network architecture).*`;
  }

  appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg msg-${sender}`;

    const formattedText = this.formatMarkdown(text);

    msgDiv.innerHTML = `
      <div class="msg-bubble">
        ${formattedText}
      </div>
    `;

    this.chatHistoryEl.appendChild(msgDiv);
    this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
    this.messages.push({ role: sender === 'user' ? 'user' : 'assistant', content: text });
  }

  appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-msg msg-bot';
    div.innerHTML = `
      <div class="msg-bubble" style="display:flex; gap:4px; align-items:center;">
        <span class="dot-typing" style="width:6px;height:6px;border-radius:50%;background:#38bdf8;animation:pulse 1s infinite;"></span>
        <span class="dot-typing" style="width:6px;height:6px;border-radius:50%;background:#38bdf8;animation:pulse 1s 0.2s infinite;"></span>
        <span class="dot-typing" style="width:6px;height:6px;border-radius:50%;background:#38bdf8;animation:pulse 1s 0.4s infinite;"></span>
      </div>
    `;
    this.chatHistoryEl.appendChild(div);
    this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
    return id;
  }

  removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  formatMarkdown(str) {
    if (!str) return '';
    let res = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n- /g, '<br>&bull; ')
      .replace(/\n/g, '<br>');
    return res;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.campusAssistant = new CampusAIAssistant();
});
