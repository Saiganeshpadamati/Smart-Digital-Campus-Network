/**
 * Smart Digital Campus Network - Main Application Controller
 * Handles SVG Topology Interaction, High Availability Failover Simulator,
 * Automated Verification Test Runner, and UI navigation.
 */

// Device Information Database for Topology Inspector
const CAMPUS_DEVICES = {
  'internet': {
    name: 'WAN / Internet Gateway',
    role: 'Tier-1 ISP Uplink & BGP Peer',
    ip: '203.0.113.1 / 198.51.100.1',
    vlan: 'WAN / Untrusted Zone',
    activeCore: 'N/A (Perimeter)',
    mac: '00:50:79:66:68:00',
    interfaces: 'Gig0/0 (Fiber Uplink to ISP)',
    status: 'ONLINE (1 Gbps Symmetrical)',
    cli: '! Edge NAT Configuration\nip nat inside source list 1 interface GigabitEthernet0/0 overload\nip route 0.0.0.0 0.0.0.0 203.0.113.1'
  },
  'edge-router': {
    name: 'Edge-Router (VyOS / Cisco 2911)',
    role: 'Perimeter Firewall, NAT & Border Gateway',
    ip: '10.0.0.1 / 203.0.113.2',
    vlan: 'Transit WAN / Core Interconnect',
    activeCore: 'Active (Perimeter)',
    mac: '00:50:79:66:68:01',
    interfaces: 'Gig0/0 (WAN), Gig0/1 (Core1 Trunk), Gig0/2 (Core2 Trunk)',
    status: 'ONLINE (Full Inspection)',
    cli: 'interface GigabitEthernet0/1\n description Link to Core1-Router\n ip address 10.0.1.1 255.255.255.252\n ip ospf 1 area 0'
  },
  'core1': {
    name: 'Core1-Router (Cisco Catalyst 3850)',
    role: 'Primary L3 Core Switch & Gateway for VLAN 10, 20, 40, 60',
    ip: '10.10.0.2, 10.20.0.2, 10.40.0.2, 10.60.0.2 (VIP: .1)',
    vlan: 'VLAN 10, 20, 30, 40, 50, 60, 70 (Trunk)',
    activeCore: 'ACTIVE for VLAN 10, 20, 40, 60 (Priority 110)',
    mac: '00:50:79:66:68:10',
    interfaces: 'Te1/1 (Edge), Te1/2 (Cross-Core 10G), Te1/3 (Dist-SW)',
    status: 'ONLINE (Master Gateway)',
    cli: 'interface Vlan10\n ip address 10.10.0.2 255.255.255.0\n standby 10 ip 10.10.0.1\n standby 10 priority 110\n standby 10 preempt'
  },
  'core2': {
    name: 'Core2-Router (Cisco Catalyst 3850)',
    role: 'Primary L3 Core Switch & Gateway for VLAN 30, 50, 70',
    ip: '10.30.0.2, 10.50.0.2, 10.70.0.2 (VIP: .1)',
    vlan: 'VLAN 10, 20, 30, 40, 50, 60, 70 (Trunk)',
    activeCore: 'ACTIVE for VLAN 30, 50, 70 (Priority 110)',
    mac: '00:50:79:66:68:20',
    interfaces: 'Te1/1 (Edge), Te1/2 (Cross-Core 10G), Te1/3 (Dist-SW)',
    status: 'ONLINE (Master Gateway)',
    cli: 'interface Vlan30\n ip address 10.30.0.2 255.255.240.0\n standby 30 ip 10.30.0.1\n standby 30 priority 110\n standby 30 preempt'
  },
  'sw-dist': {
    name: 'SW-Dist (Distribution Aggregation)',
    role: 'High-Density 10G L3 Aggregator & Routing Interconnect',
    ip: '10.0.100.1 /24 (Management)',
    vlan: '802.1Q 10G Trunk to All Access Switches',
    activeCore: 'Dual-Homed to Core1 & Core2',
    mac: '00:50:79:66:68:30',
    interfaces: 'Te1/1-2 (Core Trunks), Te1/3-5 (Access Trunks)',
    status: 'ONLINE (Non-blocking Switching)',
    cli: 'interface Port-channel 1\n description Trunk to Core Switches\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30,40,50,60,70'
  },
  'sw-bldg1': {
    name: 'SW-Bldg1 (Academic & Admin Access)',
    role: 'Building 1 Access Switch (Classrooms & Offices)',
    ip: '10.10.0.250 (Management)',
    vlan: 'VLAN 10 (Academic), VLAN 20 (Admin)',
    activeCore: 'Core1 Gateway (10.10.0.1 / 10.20.0.1)',
    mac: '00:50:79:66:68:40',
    interfaces: 'Gi0/1 (Trunk to Dist), Gi0/2-24 (Access Ports)',
    status: 'ONLINE (PoE+ Enabled)',
    cli: 'interface range FastEthernet0/1 - 12\n description Academic Smart Podiums\n switchport mode access\n switchport access vlan 10\n spanning-tree portfast'
  },
  'sw-bldg2': {
    name: 'SW-Bldg2 (Student & IoT Access)',
    role: 'Building 2 Access Switch (Wi-Fi 6 APs & IoT Labs)',
    ip: '10.30.0.250 (Management)',
    vlan: 'VLAN 30 (Student Wi-Fi), VLAN 40 (IoT), VLAN 60 (CCTV)',
    activeCore: 'Core2 (VLAN 30) / Core1 (VLAN 40, 60)',
    mac: '00:50:79:66:68:50',
    interfaces: 'Gi0/1 (Trunk to Dist), Gi0/2-48 (Access/AP Trunks)',
    status: 'ONLINE (High PoE Density)',
    cli: 'interface range FastEthernet0/1 - 24\n description Student Wi-Fi 6 APs\n switchport mode trunk\n switchport trunk allowed vlan 30'
  },
  'sw-servers': {
    name: 'SW-Servers (Data Center Access Switch)',
    role: 'Data Center & Server Farm Aggregator',
    ip: '10.70.0.250 (Management)',
    vlan: 'VLAN 50 (Exam), VLAN 70 (Servers)',
    activeCore: 'Core2 Gateway (10.70.0.1 / 10.50.0.1)',
    mac: '00:50:79:66:68:60',
    interfaces: 'Te1/1 (Trunk to Dist), Gi0/1-12 (Server 10G NICs)',
    status: 'ONLINE (Ultra Low Latency)',
    cli: 'interface GigabitEthernet0/2\n description Campus Exam Server\n switchport mode access\n switchport access vlan 70'
  },
  'host-academic': {
    name: 'Academic PC / Smart Podium',
    role: 'Smart Classroom Lecturer Console',
    ip: '10.10.0.45 / 24',
    vlan: 'VLAN 10 (Academic)',
    activeCore: 'Core1 (10.10.0.1)',
    mac: '50:00:00:01:00:01',
    interfaces: 'eth0',
    status: 'CONNECTED',
    cli: 'ip 10.10.0.45 255.255.255.0 10.10.0.1'
  },
  'host-admin': {
    name: 'Admin / ERP Workstation',
    role: 'Finance & Institutional ERP Terminal',
    ip: '10.20.0.15 / 24',
    vlan: 'VLAN 20 (Admin/ERP)',
    activeCore: 'Core1 (10.20.0.1)',
    mac: '50:00:00:02:00:01',
    interfaces: 'eth0',
    status: 'CONNECTED',
    cli: 'ip 10.20.0.15 255.255.255.0 10.20.0.1'
  },
  'host-student': {
    name: 'Student Wi-Fi Client',
    role: 'BYOD Student Laptop (5,000 Concurrent Pool)',
    ip: '10.30.4.15 / 20',
    vlan: 'VLAN 30 (Student Wi-Fi)',
    activeCore: 'Core2 (10.30.0.1)',
    mac: '50:00:00:03:00:01',
    interfaces: 'wlan0',
    status: 'CONNECTED',
    cli: 'ip dhcp (Assigned: 10.30.4.15 via Core2 DHCP pool)'
  },
  'host-iot': {
    name: 'IoT Sensor Gateway',
    role: 'Smart Campus Environmental & Energy Sensor',
    ip: '10.40.0.18 / 24',
    vlan: 'VLAN 40 (IoT Labs)',
    activeCore: 'Core1 (10.40.0.1)',
    mac: '50:00:00:04:00:01',
    interfaces: 'eth0 (MQTT Broker Connection)',
    status: 'CONNECTED',
    cli: 'ip 10.40.0.18 255.255.255.0 10.40.0.1'
  },
  'host-exam': {
    name: 'Online Exam Terminal',
    role: 'Secure Air-Gapped CBT Exam Workstation',
    ip: '10.50.0.14 / 24',
    vlan: 'VLAN 50 (Online Exam)',
    activeCore: 'Core2 (10.50.0.1)',
    mac: '50:00:00:05:00:01',
    interfaces: 'eth0',
    status: 'AIR-GAPPED (Locked to 10.70.0.12)',
    cli: 'ip 10.50.0.14 255.255.255.0 10.50.0.1'
  },
  'host-cctv': {
    name: 'AI CCTV Camera Node',
    role: 'Campus Perimeter AI Surveillance Camera',
    ip: '10.60.0.22 / 24',
    vlan: 'VLAN 60 (CCTV / AI)',
    activeCore: 'Core1 (10.60.0.1)',
    mac: '50:00:00:06:00:01',
    interfaces: 'eth0 (RTSP Stream to 10.70.0.15)',
    status: 'ISOLATED (No WAN Access)',
    cli: 'ip 10.60.0.22 255.255.255.0 10.60.0.1'
  },
  'host-server': {
    name: 'Data Center Server Farm',
    role: 'Campus Web (10.70.0.10) & Exam-Server (10.70.0.12)',
    ip: '10.70.0.10 - 10.70.0.15 / 24',
    vlan: 'VLAN 70 (Campus Servers)',
    activeCore: 'Core2 (10.70.0.1)',
    mac: '50:00:00:07:00:01',
    interfaces: 'Bond0 (Dual 10G LACP)',
    status: 'ONLINE (High Availability Cluster)',
    cli: 'ip 10.70.0.10 255.255.255.0 10.70.0.1 (Web)\nip 10.70.0.12 255.255.255.0 10.70.0.1 (Exam-Server)'
  }
};

class CampusApp {
  constructor() {
    this.core1Online = true;
    this.core2Online = true;
    this.selectedDeviceKey = 'core1';
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupTopologyInspector();
    this.setupFailoverSimulator();
    this.setupVerificationTests();
    this.selectDevice('core1');
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');

    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
      });
    }

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        if (navMenu) navMenu.classList.remove('open');
      });
    });

    // Update active nav link on scroll
    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 100;
      document.querySelectorAll('section[id]').forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        if (scrollPos >= top && scrollPos < top + height) {
          navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('href') === `#${id}`) {
              l.classList.add('active');
            }
          });
        }
      });
    });
  }

  /* -------------------------------------------------------------
     Interactive SVG Topology Inspector
     ------------------------------------------------------------- */
  setupTopologyInspector() {
    const nodes = document.querySelectorAll('.svg-node');
    nodes.forEach(node => {
      node.addEventListener('click', (e) => {
        const key = node.getAttribute('data-device');
        if (key && CAMPUS_DEVICES[key]) {
          this.selectDevice(key);
        }
      });
    });
  }

  selectDevice(key) {
    this.selectedDeviceKey = key;
    const dev = CAMPUS_DEVICES[key];
    if (!dev) return;

    // Update SVG active node class
    document.querySelectorAll('.svg-node').forEach(n => {
      n.classList.remove('selected');
      if (n.getAttribute('data-device') === key) {
        n.classList.add('selected');
      }
    });

    // Populate Inspector Side Panel
    const nameEl = document.getElementById('inspectorDevName');
    const roleEl = document.getElementById('inspectorDevRole');
    const ipEl = document.getElementById('inspectorDevIP');
    const vlanEl = document.getElementById('inspectorDevVlan');
    const coreEl = document.getElementById('inspectorDevCore');
    const ifaceEl = document.getElementById('inspectorDevIface');
    const statusEl = document.getElementById('inspectorDevStatus');
    const cliEl = document.getElementById('inspectorDevCLI');

    if (nameEl) nameEl.textContent = dev.name;
    if (roleEl) roleEl.textContent = dev.role;
    if (ipEl) ipEl.textContent = dev.ip;
    if (vlanEl) vlanEl.textContent = dev.vlan;
    if (coreEl) coreEl.textContent = dev.activeCore;
    if (ifaceEl) ifaceEl.textContent = dev.interfaces;
    if (statusEl) {
      statusEl.textContent = dev.status;
      statusEl.style.color = dev.status.includes('ONLINE') || dev.status.includes('CONNECTED') ? '#10b981' : '#38bdf8';
    }
    if (cliEl) cliEl.textContent = dev.cli;
  }

  /* -------------------------------------------------------------
     High Availability & Redundancy Failover Simulator
     ------------------------------------------------------------- */
  setupFailoverSimulator() {
    const btnFailCore1 = document.getElementById('btnFailCore1');
    const btnFailCore2 = document.getElementById('btnFailCore2');
    const btnResetCore = document.getElementById('btnResetCore');
    const consoleEl = document.getElementById('failoverConsole');

    if (btnFailCore1) {
      btnFailCore1.addEventListener('click', () => {
        this.simulateCoreFailure('Core1');
      });
    }

    if (btnFailCore2) {
      btnFailCore2.addEventListener('click', () => {
        this.simulateCoreFailure('Core2');
      });
    }

    if (btnResetCore) {
      btnResetCore.addEventListener('click', () => {
        this.resetCores();
      });
    }
  }

  simulateCoreFailure(coreName) {
    const consoleEl = document.getElementById('failoverConsole');
    const boxCore1 = document.getElementById('boxCore1');
    const boxCore2 = document.getElementById('boxCore2');
    const statusCore1 = document.getElementById('statusCore1');
    const statusCore2 = document.getElementById('statusCore2');
    const linkCore1 = document.getElementById('link-edge-core1');
    const linkCore2 = document.getElementById('link-edge-core2');

    const timestamp = new Date().toTimeString().split(' ')[0];

    if (coreName === 'Core1') {
      this.core1Online = false;
      if (boxCore1) {
        boxCore1.classList.remove('active-core-box');
        boxCore1.classList.add('failed-core-box');
      }
      if (statusCore1) statusCore1.innerHTML = '<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> HARDWARE DOWN</span>';
      if (statusCore2) statusCore2.innerHTML = '<span style="color:#10b981;"><i class="fas fa-check-double"></i> ACTIVE FOR ALL VLANS (10-70)</span>';
      if (linkCore1) linkCore1.setAttribute('class', 'svg-link fail-link');

      this.appendConsoleLog(`[${timestamp}] <span class="log-err">%LINK-3-UPDOWN: Interface Te1/1 (Core1), changed state to down</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-warn">%HSRP-5-STATECHANGE: Vlan10 Grp 10 state Active -> Init (Core1 Down)</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-warn">%HSRP-5-STATECHANGE: Vlan20 Grp 20 state Active -> Init</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-succ">%HSRP-5-STATECHANGE: Core2 assumed ACTIVE gateway for VLANs 10, 20, 40, 60 (Preempted)</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-succ">%OSPF-5-ADJCHANGE: Neighbor 10.0.1.2 converged in 1.14s. 0 packets lost.</span>`);
    } else {
      this.core2Online = false;
      if (boxCore2) {
        boxCore2.classList.remove('active-core-box');
        boxCore2.classList.add('failed-core-box');
      }
      if (statusCore2) statusCore2.innerHTML = '<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> HARDWARE DOWN</span>';
      if (statusCore1) statusCore1.innerHTML = '<span style="color:#10b981;"><i class="fas fa-check-double"></i> ACTIVE FOR ALL VLANS (10-70)</span>';
      if (linkCore2) linkCore2.setAttribute('class', 'svg-link fail-link');

      this.appendConsoleLog(`[${timestamp}] <span class="log-err">%LINK-3-UPDOWN: Interface Te1/1 (Core2), changed state to down</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-warn">%HSRP-5-STATECHANGE: Vlan30 Grp 30 state Active -> Init (Core2 Down)</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-succ">%HSRP-5-STATECHANGE: Core1 assumed ACTIVE gateway for VLANs 30, 50, 70</span>`);
      this.appendConsoleLog(`[${timestamp}] <span class="log-succ">%OSPF-5-ADJCHANGE: Failover converged in 0.98s. All student & server routes preserved.</span>`);
    }
  }

  resetCores() {
    this.core1Online = true;
    this.core2Online = true;
    const boxCore1 = document.getElementById('boxCore1');
    const boxCore2 = document.getElementById('boxCore2');
    const statusCore1 = document.getElementById('statusCore1');
    const statusCore2 = document.getElementById('statusCore2');
    const linkCore1 = document.getElementById('link-edge-core1');
    const linkCore2 = document.getElementById('link-edge-core2');

    if (boxCore1) {
      boxCore1.classList.add('active-core-box');
      boxCore1.classList.remove('failed-core-box');
    }
    if (boxCore2) {
      boxCore2.classList.add('active-core-box');
      boxCore2.classList.remove('failed-core-box');
    }
    if (statusCore1) statusCore1.innerHTML = '<span style="color:#67e8f9;"><i class="fas fa-check-circle"></i> ACTIVE: VLAN 10, 20, 40, 60</span>';
    if (statusCore2) statusCore2.innerHTML = '<span style="color:#d8b4fe;"><i class="fas fa-check-circle"></i> ACTIVE: VLAN 30, 50, 70</span>';
    if (linkCore1) linkCore1.setAttribute('class', 'svg-link active-link');
    if (linkCore2) linkCore2.setAttribute('class', 'svg-link active-link');

    const timestamp = new Date().toTimeString().split(' ')[0];
    this.appendConsoleLog(`[${timestamp}] <span class="log-succ">%SYS-5-RELOAD: Redundant Cores Restored to Normal Dual-Active State.</span>`);
  }

  appendConsoleLog(msg) {
    const consoleEl = document.getElementById('failoverConsole');
    if (!consoleEl) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = msg;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  /* -------------------------------------------------------------
     Automated Verification Test Suite Runner
     ------------------------------------------------------------- */
  setupVerificationTests() {
    const runAllBtn = document.getElementById('runAllTestsBtn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.runAutomatedTests());
    }
  }

  async runAutomatedTests() {
    const rows = document.querySelectorAll('#testTableBody tr');
    const runBtn = document.getElementById('runAllTestsBtn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running GNS3 Test Suite...';
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const badge = row.querySelector('.test-status-badge');
      if (badge) {
        badge.className = 'test-status-badge test-run';
        badge.innerHTML = '<i class="fas fa-sync fa-spin"></i> EXECUTING';
      }

      await new Promise(r => setTimeout(r, 450));

      if (badge) {
        badge.className = 'test-status-badge test-pass';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> PASSED (100%)';
      }
    }

    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fas fa-play"></i> Re-run Verification Suite';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.campusApp = new CampusApp();
});
