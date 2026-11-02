/**
 * Smart Digital Campus Network - Client Application Controller
 * Handles:
 * 1. Interactive SVG Topology & Device Inspector
 * 2. High Availability Failover Simulation
 * 3. Live GNS3 API Polling & Node Control (Start/Stop)
 * 4. Verification Test Execution Simulation
 * 5. AI Threat Detection Telemetry & Z-Score Anomaly Engine
 * 6. Campus Network AI Assistant (Chatbot via /api/chat)
 */

// ==============================================================================
// 1. Device Information Database
// ==============================================================================

const CAMPUS_DEVICES = {
  'internet': {
    name: 'WAN / Internet Gateway',
    subtitle: 'Tier-1 ISP Uplink & BGP Peer',
    role: 'Perimeter Border & External Transit',
    ip: '203.0.113.1 (ISP Peer) / 198.51.100.1',
    vlan: 'WAN Transit (Untrusted Zone)',
    activeCore: 'N/A (Border Perimeter)',
    icon: 'fa-globe',
    status: 'ONLINE (1 Gbps Symmetrical)',
    cli: `! Perimeter Default Route & NAT Overload
ip route 0.0.0.0 0.0.0.0 203.0.113.1
ip nat inside source list 1 interface GigabitEthernet0/0 overload`
  },
  'edge-router': {
    name: 'Edge-Router',
    subtitle: 'Cisco 2911 ISR / VyOS Perimeter Appliance',
    role: 'Perimeter Firewall, NAT & Border Gateway',
    ip: '10.0.0.1 (Inside) / 203.0.113.2 (Outside)',
    vlan: 'Core Interconnect Transit',
    activeCore: 'Active (Perimeter Router)',
    icon: 'fa-shield-alt',
    status: 'ONLINE (Full Inspection)',
    cli: `interface GigabitEthernet0/1
 description Interconnect to Core1
 ip address 10.0.1.1 255.255.255.252
 ip ospf 1 area 0
!
interface GigabitEthernet0/2
 description Interconnect to Core2
 ip address 10.0.2.1 255.255.255.252
 ip ospf 1 area 0`
  },
  'core1': {
    name: 'Core1-Router',
    subtitle: 'Cisco Catalyst 3850 (L3 Multilayer Switch)',
    role: 'Primary L3 Core Switch & Gateway for VLAN 10, 20, 40, 60',
    ip: '10.10.0.2, 10.20.0.2, 10.40.0.2, 10.60.0.2 (VIP: .1)',
    vlan: 'VLAN 10, 20, 30, 40, 50, 60, 70 (Trunk)',
    activeCore: 'ACTIVE for VLAN 10, 20, 40, 60 (Priority 110)',
    icon: 'fa-server',
    status: 'ONLINE (Master Core)',
    cli: `interface Vlan10
 description Academic Gateway
 ip address 10.10.0.2 255.255.255.0
 standby 10 ip 10.10.0.1
 standby 10 priority 110
 standby 10 preempt
!
interface Vlan30
 description Student Gateway (Standby)
 ip address 10.30.0.2 255.255.240.0
 standby 30 ip 10.30.0.1
 standby 30 priority 100
 standby 30 preempt`
  },
  'core2': {
    name: 'Core2-Router',
    subtitle: 'Cisco Catalyst 3850 (L3 Multilayer Switch)',
    role: 'Primary L3 Core Switch & Gateway for VLAN 30, 50, 70',
    ip: '10.30.0.3, 10.50.0.2, 10.70.0.2 (VIP: .1)',
    vlan: 'VLAN 10, 20, 30, 40, 50, 60, 70 (Trunk)',
    activeCore: 'ACTIVE for VLAN 30, 50, 70 (Priority 110)',
    icon: 'fa-server',
    status: 'ONLINE (Master Core)',
    cli: `interface Vlan30
 description Student Gateway (Active)
 ip address 10.30.0.3 255.255.240.0
 standby 30 ip 10.30.0.1
 standby 30 priority 110
 standby 30 preempt
!
interface Vlan50
 description Online Exam Gateway (Active)
 ip address 10.50.0.2 255.255.255.0
 standby 50 ip 10.50.0.1
 standby 50 priority 110
 standby 50 preempt`
  },
  'sw-dist': {
    name: 'SW-Dist (Distribution Switch)',
    subtitle: 'Cisco Catalyst 3850-12X48U Aggregator',
    role: 'High-Density 10G L3 Aggregator & Routing Interconnect',
    ip: '10.0.100.1 /24 (Management)',
    vlan: '802.1Q 10G Trunk to All Access Switches',
    activeCore: 'Dual-Homed to Core1 & Core2',
    icon: 'fa-network-wired',
    status: 'ONLINE (Non-blocking Switching)',
    cli: `interface Port-channel 1
 description Trunk to Core Switches
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70
 spanning-tree portfast trunk`
  },
  'sw-bldg1': {
    name: 'SW-Bldg1 (Academic & Admin Access)',
    subtitle: 'Cisco Catalyst 2960-X 48FPS Access Switch',
    role: 'Building 1 Access Switch (Classrooms & Offices)',
    ip: '10.10.0.250 (Management)',
    vlan: 'VLAN 10 (Academic), VLAN 20 (Admin)',
    activeCore: 'Core1 Gateway (10.10.0.1 / 10.20.0.1)',
    icon: 'fa-laptop-code',
    status: 'ONLINE (PoE+ Enabled)',
    cli: `interface range GigabitEthernet0/1 - 24
 description Academic Smart Podiums
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast`
  },
  'sw-bldg2': {
    name: 'SW-Bldg2 (Student & IoT Access)',
    subtitle: 'Cisco Catalyst 2960-X 48FPS Access Switch',
    role: 'Building 2 Access Switch (Wi-Fi 6 APs & IoT Labs)',
    ip: '10.30.0.250 (Management)',
    vlan: 'VLAN 30 (Student Wi-Fi), VLAN 40 (IoT), VLAN 60 (CCTV)',
    activeCore: 'Core2 (VLAN 30) / Core1 (VLAN 40, 60)',
    icon: 'fa-wifi',
    status: 'ONLINE (High PoE Density)',
    cli: `interface range GigabitEthernet0/1 - 24
 description Student Wi-Fi 6 APs
 switchport mode trunk
 switchport trunk allowed vlan 30`
  },
  'sw-servers': {
    name: 'SW-Servers (Data Center Access)',
    subtitle: 'Cisco Catalyst 2960-X Server Farm Switch',
    role: 'Data Center & Server Farm Aggregator',
    ip: '10.70.0.250 (Management)',
    vlan: 'VLAN 50 (Exam), VLAN 70 (Servers)',
    activeCore: 'Core2 Gateway (10.70.0.1 / 10.50.0.1)',
    icon: 'fa-database',
    status: 'ONLINE (Ultra Low Latency)',
    cli: `interface GigabitEthernet0/2
 description Campus Exam Server (10.70.0.12)
 switchport mode access
 switchport access vlan 70`
  },
  'host-academic': {
    name: 'PC-Academic (Smart Classroom)',
    subtitle: 'Virtual PC Simulator (VPCS / Desktop)',
    role: 'Smart Classroom Lecturer Console',
    ip: '10.10.0.45 / 24 (Gateway: 10.10.0.1)',
    vlan: 'VLAN 10 (Academic)',
    activeCore: 'Core1 Gateway',
    icon: 'fa-desktop',
    status: 'ONLINE (DHCP Bound)',
    cli: `PC-Academic> ip 10.10.0.45/24 10.10.0.1
Checking for duplicate address...
PC1 : 10.10.0.45 255.255.255.0 gateway 10.10.0.1`
  },
  'host-admin': {
    name: 'PC-Admin (Finance / ERP)',
    subtitle: 'Administrative Workstation',
    role: 'Finance & Institutional ERP Management',
    ip: '10.20.0.15 / 24 (Gateway: 10.20.0.1)',
    vlan: 'VLAN 20 (Admin/ERP)',
    activeCore: 'Core1 Gateway',
    icon: 'fa-user-tie',
    status: 'ONLINE (Secure VLAN)',
    cli: `PC-Admin> ip 10.20.0.15/24 10.20.0.1
PC-Admin : 10.20.0.15 255.255.255.0 gateway 10.20.0.1`
  },
  'host-student': {
    name: 'PC-Student (Wi-Fi 6 Host)',
    subtitle: 'Student BYOD Laptop / Mobile Terminal',
    role: 'High-Density Campus Student Access',
    ip: '10.30.2.10 / 20 (Gateway: 10.30.0.1)',
    vlan: 'VLAN 30 (Student Wi-Fi, 4,094 host pool)',
    activeCore: 'Core2 Gateway',
    icon: 'fa-user-graduate',
    status: 'ONLINE (Internet Permitted)',
    cli: `PC-Student> ip 10.30.2.10/20 10.30.0.1
PC-Student : 10.30.2.10 255.255.240.0 gateway 10.30.0.1`
  },
  'host-iot': {
    name: 'IoT-Sensor (Smart Energy Node)',
    subtitle: 'Campus IoT Microcontroller & Power Sensor',
    role: 'Smart Energy & Environmental Monitoring',
    ip: '10.40.0.88 / 24 (Gateway: 10.40.0.1)',
    vlan: 'VLAN 40 (IoT Labs)',
    activeCore: 'Core1 Gateway',
    icon: 'fa-microchip',
    status: 'ONLINE (MQTT Port 8883)',
    cli: `IoT-Sensor> ip 10.40.0.88/24 10.40.0.1
IoT-Sensor : 10.40.0.88 255.255.255.0 gateway 10.40.0.1`
  },
  'host-cctv': {
    name: 'CCTV-AI (Security Camera)',
    subtitle: '4K AI Optical Surveillance Camera',
    role: 'Real-time Facial Recognition & Perimeter Security',
    ip: '10.60.0.104 / 24 (Gateway: 10.60.0.1)',
    vlan: 'VLAN 60 (CCTV / AI)',
    activeCore: 'Core1 Gateway (Air-Gapped from WAN)',
    icon: 'fa-video',
    status: 'ONLINE (RTSP Streaming)',
    cli: `CCTV-AI> ip 10.60.0.104/24 10.60.0.1
CCTV-AI : 10.60.0.104 255.255.255.0 gateway 10.60.0.1`
  },
  'host-exam': {
    name: 'PC-Exam (CBT Terminal)',
    subtitle: 'Locked Secure Examination Terminal',
    role: 'Online Computer-Based Testing Terminal',
    ip: '10.50.0.5 / 24 (Gateway: 10.50.0.1)',
    vlan: 'VLAN 50 (Online Exam - Air-gapped)',
    activeCore: 'Core2 Gateway (Exam Server only)',
    icon: 'fa-file-alt',
    status: 'ONLINE (Locked to 10.70.0.12)',
    cli: `PC-Exam> ip 10.50.0.5/24 10.50.0.1
PC-Exam : 10.50.0.5 255.255.255.0 gateway 10.50.0.1`
  },
  'server-web': {
    name: 'Server-Web (Campus LMS)',
    subtitle: 'Data Center Portal & Learning Management',
    role: 'Primary Campus Web Portal & LMS',
    ip: '10.70.0.10 / 24 (Gateway: 10.70.0.1)',
    vlan: 'VLAN 70 (Servers)',
    activeCore: 'Core2 Gateway',
    icon: 'fa-globe-americas',
    status: 'ONLINE (Port 80/443)',
    cli: `root@server-web:~# ifconfig eth0 10.70.0.10 netmask 255.255.255.0
root@server-web:~# route add default gw 10.70.0.1`
  },
  'server-exam': {
    name: 'Server-Exam (CBT Engine)',
    subtitle: 'Data Center Secure Online Exam Server',
    role: 'Encrypted Question Bank & Exam Evaluation Engine',
    ip: '10.70.0.12 / 24 (Gateway: 10.70.0.1)',
    vlan: 'VLAN 70 (Servers)',
    activeCore: 'Core2 Gateway',
    icon: 'fa-lock',
    status: 'ONLINE (Isolated Exam Target)',
    cli: `root@server-exam:~# ifconfig eth0 10.70.0.12 netmask 255.255.255.0
root@server-exam:~# route add default gw 10.70.0.1`
  }
};

// ==============================================================================
// 2. Topology Interaction & Failover Simulator
// ==============================================================================

window.selectDevice = function(deviceId) {
  const dev = CAMPUS_DEVICES[deviceId];
  if (!dev) return;

  const titleEl = document.getElementById('inspectorTitle');
  const subEl = document.getElementById('inspectorSubtitle');
  const roleEl = document.getElementById('inspectorRole');
  const ipEl = document.getElementById('inspectorIp');
  const vlanEl = document.getElementById('inspectorVlan');
  const coreEl = document.getElementById('inspectorCore');
  const statusEl = document.getElementById('inspectorStatus');
  const cliEl = document.getElementById('inspectorCli');
  const iconEl = document.getElementById('inspectorIcon');

  if (titleEl) titleEl.textContent = dev.name;
  if (subEl) subEl.textContent = dev.subtitle;
  if (roleEl) roleEl.textContent = dev.role;
  if (ipEl) ipEl.textContent = dev.ip;
  if (vlanEl) vlanEl.textContent = dev.vlan;
  if (coreEl) coreEl.textContent = dev.activeCore;
  if (statusEl) statusEl.innerHTML = `<i class="fas fa-check-circle"></i> ${dev.status}`;
  if (cliEl) cliEl.textContent = dev.cli;
  if (iconEl) iconEl.innerHTML = `<i class="fas ${dev.icon}"></i>`;

  // Highlight active node in SVG
  document.querySelectorAll('.topo-node').forEach(n => n.classList.remove('active-node'));
  const svgNode = document.getElementById(`node-${deviceId}`);
  if (svgNode) svgNode.classList.add('active-node');
};

let failoverActive = false;
function initFailoverSimulator() {
  const toggleBtn = document.getElementById('toggleFailoverAnimBtn');
  const resetBtn = document.getElementById('resetTopologyBtn');
  const linkEdgeCore1 = document.getElementById('link-edge-core1');
  const linkCore1Dist = document.getElementById('link-core1-dist');
  const linkCore2Dist = document.getElementById('link-core2-dist');
  const particle = document.getElementById('packetParticle');

  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    failoverActive = !failoverActive;
    if (failoverActive) {
      toggleBtn.innerHTML = '<i class="fas fa-undo"></i> Restore Core1 Link';
      toggleBtn.classList.remove('btn-outline');
      toggleBtn.classList.add('btn-primary');

      // Sever Core1 links
      if (linkEdgeCore1) linkEdgeCore1.setAttribute('stroke', '#ef4444');
      if (linkEdgeCore1) linkEdgeCore1.setAttribute('stroke-dasharray', '4,4');
      if (linkCore1Dist) linkCore1Dist.setAttribute('stroke', '#ef4444');
      if (linkCore1Dist) linkCore1Dist.setAttribute('stroke-dasharray', '4,4');

      // Boost Core2 link
      if (linkCore2Dist) linkCore2Dist.setAttribute('stroke', '#38bdf8');
      if (linkCore2Dist) linkCore2Dist.setAttribute('stroke-width', '4');

      // Update Core1 status ring
      const ringCore1 = document.getElementById('status-ring-core1');
      if (ringCore1) ringCore1.setAttribute('fill', '#ef4444');

      // Show particle failover animation
      if (particle) {
        particle.style.display = 'block';
        animateParticle();
      }
    } else {
      resetTopology();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', resetTopology);
  }

  function resetTopology() {
    failoverActive = false;
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fas fa-random"></i> Test Core1 Failover';
      toggleBtn.classList.add('btn-outline');
      toggleBtn.classList.remove('btn-primary');
    }
    if (linkEdgeCore1) {
      linkEdgeCore1.setAttribute('stroke', '#38bdf8');
      linkEdgeCore1.removeAttribute('stroke-dasharray');
    }
    if (linkCore1Dist) {
      linkCore1Dist.setAttribute('stroke', '#38bdf8');
      linkCore1Dist.removeAttribute('stroke-dasharray');
    }
    if (linkCore2Dist) {
      linkCore2Dist.setAttribute('stroke', '#38bdf8');
      linkCore2Dist.setAttribute('stroke-width', '2.5');
    }
    const ringCore1 = document.getElementById('status-ring-core1');
    if (ringCore1) ringCore1.setAttribute('fill', '#10b981');
    if (particle) particle.style.display = 'none';
  }

  function animateParticle() {
    if (!failoverActive) return;
    let t = 0;
    const interval = setInterval(() => {
      if (!failoverActive) {
        clearInterval(interval);
        return;
      }
      t += 0.05;
      if (t > 1) t = 0;
      // Animate from Edge (500,125) -> Core2 (650,200) -> Dist (500,300)
      let x, y;
      if (t < 0.5) {
        const seg = t / 0.5;
        x = 500 + (650 - 500) * seg;
        y = 125 + (200 - 125) * seg;
      } else {
        const seg = (t - 0.5) / 0.5;
        x = 650 + (500 - 650) * seg;
        y = 200 + (300 - 200) * seg;
      }
      if (particle) {
        particle.setAttribute('cx', x);
        particle.setAttribute('cy', y);
      }
    }, 40);
  }
}

// ==============================================================================
// 3. Live GNS3 API Polling & Node Control
// ==============================================================================

class GNS3LiveManager {
  constructor() {
    this.pollInterval = null;
    this.pollSpeed = 5000; // 5s polling
    this.isReachable = false;
    this.currentProjectId = 'smartcampus_demo';
    this.mockNodes = [
      { node_id: 'node-internet', name: 'Internet-Cloud', node_type: 'cloud', status: 'started', ringId: 'status-ring-internet' },
      { node_id: 'node-edge', name: 'Edge-Router', node_type: 'dynamips', status: 'started', ringId: 'status-ring-edge' },
      { node_id: 'node-core1', name: 'Core1-Router', node_type: 'iou', status: 'started', ringId: 'status-ring-core1' },
      { node_id: 'node-core2', name: 'Core2-Router', node_type: 'iou', status: 'started', ringId: 'status-ring-core2' },
      { node_id: 'node-dist', name: 'SW-Dist', node_type: 'iou', status: 'started', ringId: 'status-ring-dist' },
      { node_id: 'node-bldg1', name: 'SW-Bldg1', node_type: 'iou', status: 'started', ringId: 'status-ring-bldg1' },
      { node_id: 'node-bldg2', name: 'SW-Bldg2', node_type: 'iou', status: 'started', ringId: 'status-ring-bldg2' },
      { node_id: 'node-servers', name: 'SW-Servers', node_type: 'iou', status: 'started', ringId: 'status-ring-servers' },
      { node_id: 'node-academic-pc', name: 'PC-Academic', node_type: 'vpcs', status: 'started', ringId: 'status-ring-academic' },
      { node_id: 'node-admin-pc', name: 'PC-Admin', node_type: 'vpcs', status: 'started', ringId: 'status-ring-admin' },
      { node_id: 'node-student-pc', name: 'PC-Student', node_type: 'vpcs', status: 'started', ringId: 'status-ring-student' },
      { node_id: 'node-iot-sensor', name: 'IoT-Sensor', node_type: 'vpcs', status: 'started', ringId: 'status-ring-iot' },
      { node_id: 'node-cctv-camera', name: 'CCTV-AI', node_type: 'vpcs', status: 'started', ringId: 'status-ring-cctv' },
      { node_id: 'node-exam-pc', name: 'PC-Exam', node_type: 'vpcs', status: 'started', ringId: 'status-ring-exam' },
      { node_id: 'node-server-web', name: 'Server-Web', node_type: 'docker', status: 'started', ringId: 'status-ring-web' },
      { node_id: 'node-server-exam', name: 'Server-Exam', node_type: 'docker', status: 'started', ringId: 'status-ring-exsrv' }
    ];

    this.init();
  }

  init() {
    this.banner = document.getElementById('gns3StatusBanner');
    this.bannerIcon = document.getElementById('gns3BannerIcon');
    this.bannerTitle = document.getElementById('gns3BannerTitle');
    this.bannerDesc = document.getElementById('gns3BannerDesc');
    this.nodeGrid = document.getElementById('nodeCardsGrid');
    this.projectSelect = document.getElementById('projectSelect');
    this.retryBtn = document.getElementById('retryHealthBtn');
    this.refreshBtn = document.getElementById('refreshNodesBtn');
    this.startAllBtn = document.getElementById('startAllNodesBtn');
    this.stopAllBtn = document.getElementById('stopAllNodesBtn');

    if (this.retryBtn) this.retryBtn.addEventListener('click', () => this.checkHealth());
    if (this.refreshBtn) this.refreshBtn.addEventListener('click', () => this.fetchNodes());
    if (this.projectSelect) this.projectSelect.addEventListener('change', (e) => {
      this.currentProjectId = e.target.value;
      this.fetchNodes();
    });

    if (this.startAllBtn) this.startAllBtn.addEventListener('click', () => this.bulkControl('start'));
    if (this.stopAllBtn) this.stopAllBtn.addEventListener('click', () => this.bulkControl('stop'));

    // Initial Health Check & Render
    this.checkHealth();
    this.startPolling();
  }

  async checkHealth() {
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      this.isReachable = data.gns3_reachable;

      if (this.isReachable) {
        if (this.banner) {
          this.banner.className = 'gns3-status-banner gns3-banner-online';
          this.bannerIcon.className = 'fas fa-check-circle';
          this.bannerTitle.textContent = `GNS3 Server Connected (v${data.gns3_version || '2.x'})`;
          this.bannerDesc.textContent = `Connected live to ${data.gns3_url}. Active telemetry synchronized.`;
        }
        this.fetchProjects();
      } else {
        if (this.banner) {
          this.banner.className = 'gns3-status-banner gns3-banner-offline';
          this.bannerIcon.className = 'fas fa-exclamation-triangle';
          this.bannerTitle.textContent = 'GNS3 Server Not Reachable';
          this.bannerDesc.textContent = `Could not connect to GNS3 at ${data.gns3_url || 'http://127.0.0.1:3080/v2'}. Displaying simulated standby lab state.`;
        }
        this.renderNodeCards(this.mockNodes);
      }
    } catch (err) {
      this.isReachable = false;
      this.renderNodeCards(this.mockNodes);
    }
  }

  async fetchProjects() {
    try {
      const resp = await fetch('/api/projects');
      if (resp.ok) {
        const projects = await resp.json();
        if (Array.isArray(projects) && projects.length > 0) {
          if (this.projectSelect) {
            this.projectSelect.innerHTML = projects.map(p => 
              `<option value="${p.project_id}">${p.name} (${p.status})</option>`
            ).join('');
            this.currentProjectId = projects[0].project_id;
          }
          this.fetchNodes();
        }
      }
    } catch (e) {
      console.warn('Could not fetch projects:', e);
    }
  }

  async fetchNodes() {
    if (!this.isReachable || this.currentProjectId === 'smartcampus_demo') {
      this.renderNodeCards(this.mockNodes);
      return;
    }

    try {
      const resp = await fetch(`/api/nodes/${this.currentProjectId}`);
      if (resp.ok) {
        const nodes = await resp.json();
        this.renderNodeCards(nodes);
      } else {
        this.renderNodeCards(this.mockNodes);
      }
    } catch (e) {
      this.renderNodeCards(this.mockNodes);
    }
  }

  renderNodeCards(nodes) {
    if (!this.nodeGrid) return;
    this.nodeGrid.innerHTML = '';

    nodes.forEach(node => {
      const isStarted = node.status === 'started';
      const card = document.createElement('div');
      card.className = 'node-card';
      card.innerHTML = `
        <div class="node-card-header">
          <div>
            <div class="node-card-name">${node.name}</div>
            <div class="node-card-type"><i class="fas fa-cube"></i> ${node.node_type}</div>
          </div>
          <span class="node-status-pill ${isStarted ? 'status-started' : 'status-stopped'}">
            <i class="fas fa-circle" style="font-size:0.5rem;"></i> ${node.status}
          </span>
        </div>

        <div class="node-actions">
          <button class="btn btn-sm btn-success-sm" style="flex:1;" onclick="window.gns3Mgr.controlNode('${node.node_id}', 'start')">
            <i class="fas fa-play"></i> Start
          </button>
          <button class="btn btn-sm btn-danger-sm" style="flex:1;" onclick="window.gns3Mgr.controlNode('${node.node_id}', 'stop')">
            <i class="fas fa-stop"></i> Stop
          </button>
        </div>
      `;
      this.nodeGrid.appendChild(card);

      // Sync with SVG Ring
      const mockMatch = this.mockNodes.find(m => m.node_id === node.node_id || m.name.toLowerCase() === node.name.toLowerCase());
      if (mockMatch && mockMatch.ringId) {
        const ring = document.getElementById(mockMatch.ringId);
        if (ring) {
          ring.setAttribute('fill', isStarted ? '#10b981' : '#ef4444');
        }
      }
    });
  }

  async controlNode(nodeId, action) {
    if (!this.isReachable || this.currentProjectId === 'smartcampus_demo') {
      // Offline / Demo Mode Local Simulation
      const node = this.mockNodes.find(n => n.node_id === nodeId);
      if (node) {
        node.status = action === 'start' ? 'started' : 'stopped';
        this.renderNodeCards(this.mockNodes);
      }
      return;
    }

    try {
      const resp = await fetch(`/api/nodes/${this.currentProjectId}/${nodeId}/${action}`, { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        this.fetchNodes();
      } else {
        alert(`GNS3 action failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error controlling node: ${err.message}`);
    }
  }

  bulkControl(action) {
    this.mockNodes.forEach(n => {
      n.status = action === 'start' ? 'started' : 'stopped';
    });
    this.renderNodeCards(this.mockNodes);
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.checkHealth();
    }, this.pollSpeed);
  }
}

// ==============================================================================
// 4. Verification Test Runner
// ==============================================================================

window.runLabTest = function(testKey) {
  const terminalBox = document.getElementById('testTerminalBox');
  const titleEl = document.getElementById('terminalCmdTitle');
  const outputEl = document.getElementById('terminalOutput');

  if (!terminalBox || !outputEl) return;

  terminalBox.style.display = 'block';
  terminalBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const tests = {
    'student_to_admin': {
      title: 'Testing Student -> Admin VLAN Isolation (PC-Student to 10.20.0.15)',
      output: `PC-Student> ping 10.20.0.15 -c 4\nPing 10.20.0.15 with 64 bytes of data:\n*10.30.0.1 icmp_seq=1 Destination Host Unreachable (ACL_STUDENTS Deny)\n*10.30.0.1 icmp_seq=2 Destination Host Unreachable\n*10.30.0.1 icmp_seq=3 Destination Host Unreachable\n*10.30.0.1 icmp_seq=4 Destination Host Unreachable\n\n--- 10.20.0.15 ping statistics ---\n4 packets transmitted, 0 packets received, 100% packet loss\n[VERIFICATION PASS] Zero-Trust Layer 3 ACL successfully blocked unauthorized lateral probe.`
    },
    'exam_to_wan': {
      title: 'Testing Online Exam Air-Gap (PC-Exam to 8.8.8.8 WAN)',
      output: `PC-Exam> ping 8.8.8.8 -c 4\nPing 8.8.8.8 with 64 bytes of data:\n*10.50.0.1 icmp_seq=1 Request Timed Out (ACL_ONLINE_EXAM Deny)\n*10.50.0.1 icmp_seq=2 Request Timed Out\n*10.50.0.1 icmp_seq=3 Request Timed Out\n*10.50.0.1 icmp_seq=4 Request Timed Out\n\n--- 8.8.8.8 ping statistics ---\n4 packets transmitted, 0 packets received, 100% packet loss\n[VERIFICATION PASS] Online Exam VLAN is strictly isolated from the Public Internet.`
    },
    'exam_to_server': {
      title: 'Testing Online Exam Server Access (PC-Exam to 10.70.0.12:443)',
      output: `PC-Exam> curl -I -k https://10.70.0.12\nHTTP/1.1 200 OK\nServer: Nginx / Campus CBT Exam Engine v4.2\nDate: Sun, 04 Oct 2026 16:00:00 GMT\nContent-Type: text/html; charset=UTF-8\nConnection: keep-alive\nStrict-Transport-Security: max-age=31536000\n\n[VERIFICATION PASS] Authorized Exam Portal communication permitted.`
    },
    'hsrp_check': {
      title: 'Core1-Router: HSRP Group Status Verification',
      output: `Core1# show standby brief
                     P indicates configured to preempt.
                     |
Interface   Grp  Pri P State   Active          Standby         Virtual IP
Vl10        10   110 P Active  local           10.10.0.3       10.10.0.1
Vl20        20   110 P Active  local           10.20.0.3       10.20.0.1
Vl30        30   100 P Standby 10.30.0.3       local           10.30.0.1
Vl40        40   110 P Active  local           10.40.0.3       10.40.0.1
Vl50        50   100 P Standby 10.50.0.3       local           10.50.0.1
Vl60        60   110 P Active  local           10.60.0.3       10.60.0.1
Vl70        70   100 P Standby 10.70.0.3       local           10.70.0.1
[VERIFICATION PASS] Core1 is Active for VLAN 10,20,40,60 and Standby for 30,50,70.`
    },
    'ospf_check': {
      title: 'Core2-Router: OSPF Dynamic Routing Neighbor Check',
      output: `Core2# show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.0.0.1          1   FULL/BDR        00:00:34    10.0.2.1        GigabitEthernet0/1 (Edge)
10.10.0.2         1   FULL/DR         00:00:31    10.0.10.1       TenGigabitEthernet1/2 (Core1)
10.0.100.1        1   FULL/DR         00:00:36    10.0.100.1      TenGigabitEthernet1/3 (Dist-SW)
[VERIFICATION PASS] OSPF Area 0 fully converged across all core links.`
    }
  };

  const test = tests[testKey];
  if (test) {
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-terminal"></i> ${test.title}`;
    if (outputEl) outputEl.textContent = test.output;
  }
};

// ==============================================================================
// 5. AI Threat Detection Telemetry & Z-Score Engine
// ==============================================================================

class AIThreatDetectionEngine {
  constructor() {
    this.isRunning = true;
    this.streamInterval = null;
    this.updateSpeed = 1600;

    // Metrics
    this.totalFlows = 0;
    this.suspiciousCount = 0;
    this.blockedIPs = new Set();
    this.chartData = [];
    this.maxChartPoints = 18;

    // Volume baseline for statistical Z-Score
    this.volumeBaseline = {
      pps: [40, 55, 60, 48, 70, 65, 52, 58, 75, 45],
      bytes: [1200, 2400, 1800, 3100, 1500, 2900, 4200, 1900, 2100, 3500]
    };

    this.init();
  }

  init() {
    this.tableBody = document.getElementById('flowsTableBody');
    this.kpiTotal = document.getElementById('kpiTotalFlows');
    this.kpiSuspicious = document.getElementById('kpiSuspicious');
    this.kpiBlocked = document.getElementById('kpiBlocked');
    this.kpiAvgRisk = document.getElementById('kpiAvgRisk');
    this.toggleSimBtn = document.getElementById('toggleSimBtn');
    this.chartCanvas = document.getElementById('riskChartCanvas');
    this.blockedListEl = document.getElementById('blockedIpList');
    this.blockedBadge = document.getElementById('blockedBadgeCount');

    this.drawer = document.getElementById('threatDetailDrawer');
    this.drawerExp = document.getElementById('drawerExplanation');
    this.drawerAcl = document.getElementById('drawerAclSnippet');
    this.closeDrawerBtn = document.getElementById('closeDrawerBtn');

    if (this.toggleSimBtn) {
      this.toggleSimBtn.addEventListener('click', () => this.toggleSimulation());
    }
    if (this.closeDrawerBtn) {
      this.closeDrawerBtn.addEventListener('click', () => {
        if (this.drawer) this.drawer.style.display = 'none';
      });
    }

    // Injections
    const btnScan = document.getElementById('injectScanBtn');
    const btnAdmin = document.getElementById('injectAdminProbeBtn');
    const btnIot = document.getElementById('injectIoTFloodBtn');
    const btnExam = document.getElementById('injectExamLeakBtn');
    const btnClear = document.getElementById('clearLogBtn');

    if (btnScan) btnScan.addEventListener('click', () => this.injectAnomaly('port_scan'));
    if (btnAdmin) btnAdmin.addEventListener('click', () => this.injectAnomaly('admin_probe'));
    if (btnIot) btnIot.addEventListener('click', () => this.injectAnomaly('iot_flood'));
    if (btnExam) btnExam.addEventListener('click', () => this.injectAnomaly('exam_leak'));
    if (btnClear) btnClear.addEventListener('click', () => this.clearLogs());

    this.initChart();

    if (window.GNS3Service) {
      window.GNS3Service.onStateChange((state) => {
        const disclaimerEl = document.querySelector('.threat-disclaimer');
        if (disclaimerEl) {
          if (state.isOnline) {
            disclaimerEl.innerHTML = `
              <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.75rem; font-size:0.82rem;">
                <span><strong style="color:#10b981;">🟢 GNS3 CONNECTED</strong></span>
                <span>&bull;</span>
                <span><strong>Project:</strong> <span style="color:#38bdf8;">${state.project || 'Smart Campus Lab'}</span></span>
                <span>&bull;</span>
                <span><strong>Source:</strong> GNS3 Simulation (${state.nodeCount || 0} Nodes)</span>
                <span>&bull;</span>
                <span style="color:#94a3b8;"><strong style="color:#f59e0b;">Real Network:</strong> DISABLED</span>
              </div>
            `;
          } else {
            disclaimerEl.innerHTML = `
              <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.75rem; font-size:0.82rem;">
                <span><strong style="color:#ef4444;">🔴 GNS3 SIMULATION OFFLINE</strong></span>
                <span>&bull;</span>
                <span>Waiting for GNS3 simulation data</span>
                <span>&bull;</span>
                <span style="color:#94a3b8;"><strong style="color:#f59e0b;">Real Network:</strong> DISABLED</span>
              </div>
            `;
          }
        }
      });
    }

    this.startSimulation();
  }

  startSimulation() {
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.isRunning = true;
    if (this.toggleSimBtn) {
      this.toggleSimBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Stream';
      this.toggleSimBtn.className = 'btn btn-sm btn-primary';
    }

    this.streamInterval = setInterval(() => {
      // If GNS3 is explicitly offline, do not fabricate threat alerts
      if (window.GNS3Service && window.GNS3Service.state && !window.GNS3Service.state.isOnline) {
        if (this.tableBody && this.tableBody.children.length === 0) {
          this.tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:#94a3b8;">⚠️ GNS3 Simulation Offline &bull; Waiting for GNS3 simulation data</td></tr>`;
        }
        return;
      }

      // 80% normal traffic, 20% random anomaly
      if (Math.random() < 0.22) {
        const types = ['port_scan', 'admin_probe', 'iot_flood', 'exam_leak'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        this.injectAnomaly(randomType);
      } else {
        this.generateNormalFlow();
      }
    }, this.updateSpeed);
  }

  toggleSimulation() {
    if (this.isRunning) {
      clearInterval(this.streamInterval);
      this.isRunning = false;
      if (this.toggleSimBtn) {
        this.toggleSimBtn.innerHTML = '<i class="fas fa-play"></i> Resume Stream';
        this.toggleSimBtn.className = 'btn btn-sm btn-outline';
      }
    } else {
      this.startSimulation();
    }
  }

  generateNormalFlow() {
    const normalTemplates = [
      { src: '10.30.4.22', vlan: 'VLAN 30 (Student)', dst: '10.70.0.10', port: 443, pps: Math.floor(35 + Math.random() * 40), bytes: Math.floor(1200 + Math.random() * 2500) },
      { src: '10.10.0.14', vlan: 'VLAN 10 (Academic)', dst: '10.70.0.10', port: 80, pps: Math.floor(20 + Math.random() * 30), bytes: Math.floor(800 + Math.random() * 1500) },
      { src: '10.40.0.12', vlan: 'VLAN 40 (IoT Labs)', dst: '10.70.0.10', port: 8883, pps: Math.floor(10 + Math.random() * 20), bytes: Math.floor(256 + Math.random() * 512) },
      { src: '10.30.8.50', vlan: 'VLAN 30 (Student)', dst: '142.250.190.46', port: 443, pps: Math.floor(50 + Math.random() * 45), bytes: Math.floor(3000 + Math.random() * 4000) },
      { src: '10.50.0.18', vlan: 'VLAN 50 (Exam)', dst: '10.70.0.12', port: 443, pps: Math.floor(15 + Math.random() * 25), bytes: Math.floor(1100 + Math.random() * 1800) },
      { src: '10.60.0.102', vlan: 'VLAN 60 (CCTV)', dst: '10.70.0.15', port: 554, pps: Math.floor(80 + Math.random() * 30), bytes: Math.floor(4500 + Math.random() * 3000) }
    ];

    const t = normalTemplates[Math.floor(Math.random() * normalTemplates.length)];
    this.processFlow(t.src, t.vlan, t.dst, t.port, t.bytes, t.pps, false);
  }

  injectAnomaly(type) {
    let flow;
    switch (type) {
      case 'port_scan':
        flow = {
          src: '10.30.12.88',
          vlan: 'VLAN 30 (Student)',
          dst: '10.70.0.11',
          port: Math.floor(1000 + Math.random() * 8000),
          bytes: 64,
          pps: 1450,
          anomalyType: 'Port Scan Sweep',
          explanation: 'Student host 10.30.12.88 is executing an automated SYN port scan against ERP Database Server (10.70.0.11) probing >50 ports/sec.',
          acl: 'ip access-list extended QUARANTINE_BLOCK\n deny ip host 10.30.12.88 any\n permit ip any any'
        };
        break;

      case 'admin_probe':
        flow = {
          src: '10.30.3.105',
          vlan: 'VLAN 30 (Student)',
          dst: '10.20.0.15',
          port: 445,
          bytes: 512,
          pps: 180,
          anomalyType: 'Unauthorized Admin Probe',
          explanation: 'Student host 10.30.3.105 attempting lateral movement probe to Finance Admin PC (10.20.0.15) over SMB Port 445.',
          acl: 'ip access-list extended QUARANTINE_BLOCK\n deny ip host 10.30.3.105 10.20.0.0 0.0.0.255\n permit ip any any'
        };
        break;

      case 'iot_flood':
        flow = {
          src: '10.40.0.99',
          vlan: 'VLAN 40 (IoT Labs)',
          dst: '10.70.0.10',
          port: 80,
          bytes: 98000,
          pps: 12500,
          anomalyType: 'IoT Volumetric Flood / Botnet',
          explanation: 'Compromised IoT temperature node 10.40.0.99 generating volumetric UDP/HTTP flood (>12,500 pps, Z-Score 8.4) exceeding normal baseline.',
          acl: 'ip access-list extended QUARANTINE_BLOCK\n deny ip host 10.40.0.99 any\n permit ip any any'
        };
        break;

      case 'exam_leak':
        flow = {
          src: '10.50.0.44',
          vlan: 'VLAN 50 (Online Exam)',
          dst: '198.51.100.77',
          port: 8080,
          bytes: 4200,
          pps: 320,
          anomalyType: 'Air-Gap Exam WAN Breach',
          explanation: 'Online Exam terminal 10.50.0.44 attempting direct outbound connection to external public proxy 198.51.100.77.',
          acl: 'ip access-list extended QUARANTINE_BLOCK\n deny ip host 10.50.0.44 any\n permit ip any any'
        };
        break;
    }

    if (flow) {
      this.processFlow(flow.src, flow.vlan, flow.dst, flow.port, flow.bytes, flow.pps, true, flow);
    }
  }

  processFlow(src, vlan, dst, port, bytes, pps, isExplicitAnomaly, anomalyMeta = null) {
    this.totalFlows++;

    // 1. Z-Score Calculation on PPS
    const mean = this.volumeBaseline.pps.reduce((a, b) => a + b, 0) / this.volumeBaseline.pps.length;
    const stdDev = Math.sqrt(this.volumeBaseline.pps.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / this.volumeBaseline.pps.length);
    const zScore = (pps - mean) / (stdDev || 1);

    // 2. Heuristic Rule Scoring
    let risk = 5;
    let verdict = 'Normal';
    let isSuspicious = false;

    if (this.blockedIPs.has(src)) {
      risk = 100;
      verdict = 'Quarantined';
      isSuspicious = true;
    } else if (isExplicitAnomaly || zScore > 3.0 || pps > 800) {
      isSuspicious = true;
      risk = Math.min(100, Math.floor(65 + Math.abs(zScore) * 6 + Math.random() * 15));
      verdict = risk > 80 ? 'CRITICAL' : 'SUSPICIOUS';
      this.suspiciousCount++;
    } else {
      risk = Math.floor(5 + Math.random() * 18);
      // Update baseline rolling window
      this.volumeBaseline.pps.push(pps);
      if (this.volumeBaseline.pps.length > 20) this.volumeBaseline.pps.shift();
    }

    // Update KPI metrics
    if (this.kpiTotal) this.kpiTotal.textContent = this.totalFlows.toLocaleString();
    if (this.kpiSuspicious) this.kpiSuspicious.textContent = this.suspiciousCount.toLocaleString();
    if (this.kpiAvgRisk) {
      const avg = Math.round((this.suspiciousCount / (this.totalFlows || 1)) * 100);
      this.kpiAvgRisk.textContent = `${Math.min(100, avg * 3 + 12)}%`;
    }

    // Append to Chart
    this.chartData.push(risk);
    if (this.chartData.length > this.maxChartPoints) this.chartData.shift();
    this.drawChart();

    // Append Row to Table
    const now = new Date().toTimeString().split(' ')[0];
    const row = document.createElement('tr');
    if (isSuspicious) row.className = 'row-suspicious';

    const riskClass = risk < 35 ? 'risk-low' : (risk < 70 ? 'risk-med' : 'risk-high');

    row.innerHTML = `
      <td>${now}</td>
      <td><strong>${src}</strong></td>
      <td>${vlan}</td>
      <td>${dst}</td>
      <td><code>${port}</code></td>
      <td>${bytes.toLocaleString()} B</td>
      <td>${pps.toLocaleString()}</td>
      <td><span class="risk-badge ${riskClass}">${risk}/100</span></td>
      <td><strong style="color: ${risk >= 70 ? '#f87171' : (risk >= 35 ? '#fbbf24' : '#34d399')}">${verdict}</strong></td>
      <td>
        ${isSuspicious ? `
          <button class="btn btn-sm btn-danger-sm" onclick="window.threatEngine.blockIp('${src}', '${anomalyMeta ? anomalyMeta.acl.replace(/\n/g, '\\n') : ''}')">
            <i class="fas fa-ban"></i> Block
          </button>
          <button class="btn btn-sm btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick='window.threatEngine.showForensics(${JSON.stringify(anomalyMeta || {
            explanation: `High traffic anomaly flagged with Z-score deviation ${zScore.toFixed(2)}. Destination: ${dst}:${port}.`,
            acl: `ip access-list extended DYNAMIC_BLOCK\n deny ip host ${src} any\n permit ip any any`
          })})'>
            <i class="fas fa-search"></i> Inspect
          </button>
        ` : `
          <span style="color:var(--text-muted); font-size:0.75rem;">Allowed</span>
        `}
      </td>
    `;

    if (this.tableBody) {
      this.tableBody.insertBefore(row, this.tableBody.firstChild);
      if (this.tableBody.children.length > 25) {
        this.tableBody.removeChild(this.tableBody.lastChild);
      }
    }
  }

  blockIp(ip, aclSnippet) {
    this.blockedIPs.add(ip);
    if (this.kpiBlocked) this.kpiBlocked.textContent = this.blockedIPs.size;
    if (this.blockedBadge) this.blockedBadge.textContent = `${this.blockedIPs.size} IPs`;

    if (this.blockedListEl) {
      this.blockedListEl.innerHTML = Array.from(this.blockedIPs).map(bIp => `
        <div class="blocked-item">
          <span><i class="fas fa-shield-virus"></i> ${bIp}</span>
          <button class="btn btn-sm btn-outline" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.threatEngine.unblockIp('${bIp}')">Unblock</button>
        </div>
      `).join('');
    }

    if (this.drawer && this.drawerExp && this.drawerAcl) {
      this.drawer.style.display = 'block';
      this.drawerExp.textContent = `IP ${ip} has been added to the active mitigation quarantine list. Forwarding traffic dropped at Core1/Core2 boundary.`;
      this.drawerAcl.textContent = aclSnippet ? aclSnippet.replace(/\\n/g, '\n') : `! Dynamic Mitigation ACL for ${ip}\nip access-list extended QUARANTINE_ISOLATION\n deny ip host ${ip} any\n permit ip any any`;
      this.drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  unblockIp(ip) {
    this.blockedIPs.delete(ip);
    if (this.kpiBlocked) this.kpiBlocked.textContent = this.blockedIPs.size;
    if (this.blockedBadge) this.blockedBadge.textContent = `${this.blockedIPs.size} IPs`;

    if (this.blockedListEl) {
      if (this.blockedIPs.size === 0) {
        this.blockedListEl.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">No active quarantined IPs</span>';
      } else {
        this.blockedListEl.innerHTML = Array.from(this.blockedIPs).map(bIp => `
          <div class="blocked-item">
            <span><i class="fas fa-shield-virus"></i> ${bIp}</span>
            <button class="btn btn-sm btn-outline" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.threatEngine.unblockIp('${bIp}')">Unblock</button>
          </div>
        `).join('');
      }
    }
  }

  showForensics(meta) {
    if (this.drawer && this.drawerExp && this.drawerAcl) {
      this.drawer.style.display = 'block';
      this.drawerExp.textContent = meta.explanation || 'Anomaly detected via statistical deviation.';
      this.drawerAcl.textContent = meta.acl || 'ip access-list extended DYNAMIC_BLOCK\n deny ip host any any';
      this.drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  clearLogs() {
    if (this.tableBody) this.tableBody.innerHTML = '';
    this.totalFlows = 0;
    this.suspiciousCount = 0;
    if (this.kpiTotal) this.kpiTotal.textContent = '0';
    if (this.kpiSuspicious) this.kpiSuspicious.textContent = '0';
    if (this.kpiAvgRisk) this.kpiAvgRisk.textContent = '0%';
    this.chartData = [];
    this.drawChart();
  }

  initChart() {
    if (!this.chartCanvas) return;
    this.ctx = this.chartCanvas.getContext('2d');
    for (let i = 0; i < this.maxChartPoints; i++) {
      this.chartData.push(10 + Math.floor(Math.random() * 15));
    }
    this.drawChart();
  }

  drawChart() {
    if (!this.ctx || !this.chartCanvas) return;
    const w = this.chartCanvas.width;
    const h = this.chartCanvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Draw Gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (this.chartData.length < 2) return;

    // Draw Gradient Area
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    ctx.beginPath();
    const step = w / (this.maxChartPoints - 1);
    this.chartData.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / 100) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.lineTo((this.chartData.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    this.chartData.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / 100) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Points
    this.chartData.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / 100) * (h - 20) - 10;
      ctx.beginPath();
      ctx.arc(x, y, val > 60 ? 4.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = val > 60 ? '#ef4444' : '#38bdf8';
      ctx.fill();
    });
  }
}

// ==============================================================================
// 6. Campus Network AI Assistant
// ==============================================================================

class CampusAIAssistant {
  constructor() {
    this.form = document.getElementById('chatForm');
    this.input = document.getElementById('chatInput');
    this.messagesBox = document.getElementById('chatMessages');
    this.clearBtn = document.getElementById('clearChatBtn');
    this.history = [];

    this.init();
  }

  init() {
    if (!this.form) return;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        if (this.messagesBox) {
          this.messagesBox.innerHTML = `
            <div class="chat-bubble chat-bubble-assistant">
              Chat history cleared. How can I help you with the <strong>Smart Digital Campus Network</strong>?
            </div>
          `;
          this.history = [];
        }
      });
    }
  }

  async sendMessage() {
    const text = this.input.value.trim();
    if (!text) return;

    // Append User Bubble
    this.appendMessage(text, 'user');
    this.input.value = '';
    this.history.push({ role: 'user', content: text });

    // Append Loading indicator
    const loadingId = 'loading-' + Date.now();
    this.appendLoading(loadingId);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: this.history })
      });

      const data = await resp.json();
      this.removeLoading(loadingId);

      if (resp.ok && data.response) {
        this.appendMessage(data.response, 'assistant');
        this.history.push({ role: 'assistant', content: data.response });
      } else {
        this.appendMessage(data.error || 'Failed to receive response from backend.', 'assistant');
      }
    } catch (err) {
      this.removeLoading(loadingId);
      this.appendMessage(`Connection error: ${err.message}. Make sure Flask backend is running on port 5000.`, 'assistant');
    }
  }

  appendMessage(content, sender) {
    if (!this.messagesBox) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${sender}`;

    // Simple Markdown to HTML formatting
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n- /g, '<br>&bull; ')
      .replace(/\n/g, '<br>');

    bubble.innerHTML = formatted;
    this.messagesBox.appendChild(bubble);
    this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
  }

  appendLoading(id) {
    if (!this.messagesBox) return;
    const loadDiv = document.createElement('div');
    loadDiv.id = id;
    loadDiv.className = 'chat-bubble chat-bubble-assistant';
    loadDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analyzing campus network knowledge...';
    this.messagesBox.appendChild(loadDiv);
    this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
  }

  removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

// ==============================================================================
// 7. Application Initialization
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  // Initialize Modules
  initFailoverSimulator();
  window.gns3Mgr = new GNS3LiveManager();
  window.threatEngine = new AIThreatDetectionEngine();
  window.aiAssistant = new CampusAIAssistant();

  // Select initial device in inspector
  window.selectDevice('core1');
});
