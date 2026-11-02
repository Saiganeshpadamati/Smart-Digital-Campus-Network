/**
 * Smart Digital Campus Network - AI Threat Detection Engine
 * Real-time network telemetry simulator, Z-score + rule-based anomaly scoring,
 * interactive forensic inspection, and dynamic Cisco/VyOS ACL rule mitigation.
 */

class AIThreatDetectionEngine {
  constructor() {
    this.isRunning = true;
    this.streamInterval = null;
    this.updateSpeed = 1500; // ms
    this.maxRows = 25;

    // Metrics state
    this.totalFlows = 0;
    this.suspiciousCount = 0;
    this.blockedIPs = new Set();
    this.flowHistory = [];
    this.chartData = [];
    this.maxChartPoints = 20;

    // Statistical Baseline Tracker (Rolling Window)
    this.volumeBaseline = {
      ppsHistory: [45, 60, 52, 38, 70, 65, 48, 55, 80, 40],
      bytesHistory: [1200, 2400, 1800, 3100, 1500, 2900, 4200, 1900, 2100, 3500]
    };

    // UI Elements
    this.tableBody = document.getElementById('flowsTableBody');
    this.totalFlowsEl = document.getElementById('kpiTotalFlows');
    this.suspiciousCountEl = document.getElementById('kpiSuspicious');
    this.blockedCountEl = document.getElementById('kpiBlocked');
    this.avgRiskEl = document.getElementById('kpiAvgRisk');
    this.simToggleBtn = document.getElementById('toggleSimBtn');
    this.chartCanvas = document.getElementById('riskChartCanvas');
    this.drawerEl = document.getElementById('threatDetailDrawer');
    this.disclaimerEl = document.querySelector('.threat-disclaimer');

    // GNS3 Integration State
    this.gns3Online = false;
    this.gns3Project = 'Detecting...';
    this.gns3Nodes = [];

    // Bind event handlers
    this.init();
  }

  init() {
    if (!this.tableBody) return;

    // Initialize Chart Canvas
    this.initChart();

    // Hook to GNS3 Service
    if (window.GNS3Service) {
      window.GNS3Service.onStateChange((state) => {
        this.onGNS3StateChange(state);
      });
    }

    // Start Simulation Loop
    this.startSimulation();

    // Setup Event Listeners for Toolbar
    if (this.simToggleBtn) {
      this.simToggleBtn.addEventListener('click', () => this.toggleSimulation());
    }

    const injectScanBtn = document.getElementById('injectScanBtn');
    if (injectScanBtn) {
      injectScanBtn.addEventListener('click', () => this.injectAnomaly('port_scan'));
    }

    const injectAdminProbeBtn = document.getElementById('injectAdminProbeBtn');
    if (injectAdminProbeBtn) {
      injectAdminProbeBtn.addEventListener('click', () => this.injectAnomaly('admin_probe'));
    }

    const injectIoTFloodBtn = document.getElementById('injectIoTFloodBtn');
    if (injectIoTFloodBtn) {
      injectIoTFloodBtn.addEventListener('click', () => this.injectAnomaly('iot_flood'));
    }

    const injectExamLeakBtn = document.getElementById('injectExamLeakBtn');
    if (injectExamLeakBtn) {
      injectExamLeakBtn.addEventListener('click', () => this.injectAnomaly('exam_leak'));
    }

    const clearLogBtn = document.getElementById('clearLogBtn');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => this.clearLogs());
    }

    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        if (this.drawerEl) this.drawerEl.style.display = 'none';
      });
    }
  }

  onGNS3StateChange(state) {
    this.gns3Online = state.isOnline;
    this.gns3Project = state.project || 'Smart Campus Lab';
    this.gns3Nodes = state.nodes || [];

    if (this.disclaimerEl) {
      if (this.gns3Online) {
        this.disclaimerEl.innerHTML = `
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.75rem; font-size:0.82rem;">
            <span><strong style="color:#10b981;">🟢 GNS3 CONNECTED</strong></span>
            <span>&bull;</span>
            <span><strong>Project:</strong> <span style="color:#38bdf8;">${this.gns3Project}</span></span>
            <span>&bull;</span>
            <span><strong>Source:</strong> GNS3 Simulation (${state.nodeCount || this.gns3Nodes.length} Nodes)</span>
            <span>&bull;</span>
            <span style="color:#94a3b8;"><strong style="color:#f59e0b;">Real Network:</strong> DISABLED</span>
          </div>
        `;
      } else {
        this.disclaimerEl.innerHTML = `
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
  }

  startSimulation() {
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.isRunning = true;
    if (this.simToggleBtn) {
      this.simToggleBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Stream';
      this.simToggleBtn.classList.remove('btn-outline');
      this.simToggleBtn.classList.add('btn-primary');
    }

    this.streamInterval = setInterval(() => {
      // If GNS3 is explicitly offline, do not fabricate threat alerts
      if (window.GNS3Service && window.GNS3Service.state && !window.GNS3Service.state.isOnline) {
        if (this.flowHistory.length === 0 && this.tableBody && this.tableBody.children.length === 0) {
          this.tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:#94a3b8;">⚠️ GNS3 Simulation Offline &bull; Waiting for GNS3 simulation data</td></tr>`;
        }
        return;
      }

      // 80% normal traffic, 20% random anomaly
      if (Math.random() < 0.22) {
        const types = ['port_scan', 'admin_probe', 'iot_flood', 'exam_leak'];
        const randomAnomaly = types[Math.floor(Math.random() * types.length)];
        this.generateFlow(randomAnomaly);
      } else {
        this.generateFlow('normal');
      }
    }, this.updateSpeed);
  }

  toggleSimulation() {
    if (this.isRunning) {
      clearInterval(this.streamInterval);
      this.isRunning = false;
      if (this.simToggleBtn) {
        this.simToggleBtn.innerHTML = '<i class="fas fa-play"></i> Resume Stream';
        this.simToggleBtn.classList.remove('btn-primary');
        this.simToggleBtn.classList.add('btn-outline');
      }
    } else {
      this.startSimulation();
    }
  }

  injectAnomaly(type) {
    this.generateFlow(type);
  }

  clearLogs() {
    this.flowHistory = [];
    if (this.tableBody) this.tableBody.innerHTML = '';
    this.totalFlows = 0;
    this.suspiciousCount = 0;
    this.updateKPIs(0);
    this.chartData = [];
    this.drawChart();
  }

  /* -------------------------------------------------------------
     Telemetry Generator & Anomaly Injection
     ------------------------------------------------------------- */
  generateFlow(flowType) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);

    let flow = {
      id: 'FL-' + Math.floor(100000 + Math.random() * 900000),
      time: timeStr,
      srcIp: '',
      vlan: '',
      dstIp: '',
      port: 0,
      protocol: 'TCP',
      bytes: 0,
      pps: 0,
      type: flowType,
      blocked: false
    };

    if (flowType === 'normal') {
      const normalProfiles = [
        { vlan: 'VLAN 30 (Student)', src: `10.30.${Math.floor(Math.random()*15)}.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.10', port: 443, proto: 'TCP', bytes: Math.floor(Math.random()*3500 + 800), pps: Math.floor(Math.random()*60 + 20) },
        { vlan: 'VLAN 30 (Student)', src: `10.30.${Math.floor(Math.random()*15)}.${Math.floor(Math.random()*250+2)}`, dst: '142.250.190.46', port: 443, proto: 'TCP', bytes: Math.floor(Math.random()*8500 + 1200), pps: Math.floor(Math.random()*90 + 30) },
        { vlan: 'VLAN 10 (Academic)', src: `10.10.0.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.10', port: 80, proto: 'TCP', bytes: Math.floor(Math.random()*4200 + 1000), pps: Math.floor(Math.random()*45 + 15) },
        { vlan: 'VLAN 40 (IoT Labs)', src: `10.40.0.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.10', port: 8883, proto: 'TCP', bytes: Math.floor(Math.random()*600 + 200), pps: Math.floor(Math.random()*15 + 5) },
        { vlan: 'VLAN 60 (CCTV/AI)', src: `10.60.0.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.15', port: 554, proto: 'UDP', bytes: Math.floor(Math.random()*12000 + 6000), pps: Math.floor(Math.random()*150 + 80) },
        { vlan: 'VLAN 20 (Admin)', src: `10.20.0.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.11', port: 5432, proto: 'TCP', bytes: Math.floor(Math.random()*5500 + 1500), pps: Math.floor(Math.random()*70 + 20) },
        { vlan: 'VLAN 50 (Online Exam)', src: `10.50.0.${Math.floor(Math.random()*250+2)}`, dst: '10.70.0.12', port: 443, proto: 'TCP', bytes: Math.floor(Math.random()*1800 + 400), pps: Math.floor(Math.random()*25 + 10) }
      ];
      const p = normalProfiles[Math.floor(Math.random() * normalProfiles.length)];
      flow.srcIp = p.src;
      flow.vlan = p.vlan;
      flow.dstIp = p.dst;
      flow.port = p.port;
      flow.protocol = p.proto;
      flow.bytes = p.bytes;
      flow.pps = p.pps;

    } else if (flowType === 'port_scan') {
      const scanPorts = [21, 22, 23, 25, 80, 135, 139, 443, 445, 1433, 3306, 3389, 8080];
      flow.srcIp = '10.30.4.15';
      flow.vlan = 'VLAN 30 (Student)';
      flow.dstIp = '10.70.0.10';
      flow.port = scanPorts[Math.floor(Math.random() * scanPorts.length)];
      flow.protocol = 'TCP [SYN]';
      flow.bytes = 64;
      flow.pps = Math.floor(Math.random() * 300 + 250);

    } else if (flowType === 'admin_probe') {
      flow.srcIp = '10.30.2.88';
      flow.vlan = 'VLAN 30 (Student)';
      flow.dstIp = '10.20.0.5';
      flow.port = Math.random() < 0.5 ? 22 : 445;
      flow.protocol = 'TCP';
      flow.bytes = 480;
      flow.pps = 12;

    } else if (flowType === 'iot_flood') {
      flow.srcIp = '10.40.0.18';
      flow.vlan = 'VLAN 40 (IoT Labs)';
      flow.dstIp = '10.70.0.10';
      flow.port = 8883;
      flow.protocol = 'UDP Flood';
      flow.bytes = Math.floor(Math.random() * 45000000 + 35000000); // 35MB+
      flow.pps = Math.floor(Math.random() * 25000 + 45000); // 50k pps

    } else if (flowType === 'exam_leak') {
      flow.srcIp = '10.50.0.14';
      flow.vlan = 'VLAN 50 (Online Exam)';
      flow.dstIp = '142.250.190.46'; // External Google IP
      flow.port = 443;
      flow.protocol = 'TCP';
      flow.bytes = 1450;
      flow.pps = 35;
    }

    // Check if IP is in active blocklist
    if (this.blockedIPs.has(flow.srcIp)) {
      flow.blocked = true;
    }

    // Analyze flow with Dual-Engine (Rules + Z-Score)
    const analysis = this.analyzeFlow(flow);
    flow.riskScore = analysis.riskScore;
    flow.status = analysis.status;
    flow.explanation = analysis.explanation;
    flow.recommendedACL = analysis.recommendedACL;

    // Update Stats
    this.totalFlows++;
    if (flow.status === 'Suspicious') {
      this.suspiciousCount++;
    }

    // Record flow
    this.flowHistory.unshift(flow);
    if (this.flowHistory.length > this.maxRows) {
      this.flowHistory.pop();
    }

    // Update Rolling Baseline
    if (flow.status === 'Normal') {
      this.volumeBaseline.ppsHistory.push(flow.pps);
      this.volumeBaseline.bytesHistory.push(flow.bytes);
      if (this.volumeBaseline.ppsHistory.length > 50) this.volumeBaseline.ppsHistory.shift();
      if (this.volumeBaseline.bytesHistory.length > 50) this.volumeBaseline.bytesHistory.shift();
    }

    // Render Table Row & Update UI
    this.renderFlowRow(flow);
    this.updateKPIs(flow.riskScore);
    this.updateChart(flow.riskScore);
  }

  /* -------------------------------------------------------------
     Dual-Layer Anomaly Detection Engine (Z-Score + Rule Heuristics)
     ------------------------------------------------------------- */
  analyzeFlow(flow) {
    let risk = 0;
    let reasons = [];
    let acl = '';

    // If source IP is currently blocked
    if (flow.blocked) {
      return {
        riskScore: 99,
        status: 'Suspicious',
        explanation: `⛔ Source IP ${flow.srcIp} is in the active Quarantine Blocklist. Packet dropped by ACL.`,
        recommendedACL: `access-list 101 deny ip host ${flow.srcIp} any`
      };
    }

    // 1. RULE-BASED HEURISTICS

    // Anomaly 1: Student Scanning Server VLAN
    if (flow.type === 'port_scan' || (flow.vlan.includes('Student') && flow.dstIp.startsWith('10.70.') && flow.pps > 180)) {
      risk = Math.max(risk, 88);
      reasons.push(`Student host ${flow.srcIp} executed a rapid SYN port scan (${flow.pps} pps) targeting Server VLAN destination ${flow.dstIp}:${flow.port}.`);
      acl = `access-list 130 deny tcp host ${flow.srcIp} 10.70.0.0 0.0.0.255\naccess-list 130 permit ip any any`;
    }

    // Anomaly 2: Student Probing Admin Subnet (Unauthorized Lateral Movement)
    if (flow.type === 'admin_probe' || (flow.vlan.includes('Student') && flow.dstIp.startsWith('10.20.'))) {
      risk = Math.max(risk, 94);
      reasons.push(`Unauthorized inter-VLAN lateral probe: Student host ${flow.srcIp} attempted direct connection to Admin/ERP VLAN host ${flow.dstIp} on port ${flow.port} (Denied by Zero-Trust ACL).`);
      acl = `access-list 130 deny ip host ${flow.srcIp} 10.20.0.0 0.0.0.255`;
    }

    // Anomaly 4: Exam PC Reaching the Internet (Air-Gap Violation)
    if (flow.type === 'exam_leak' || (flow.vlan.includes('Exam') && !flow.dstIp.startsWith('10.70.0.12'))) {
      risk = Math.max(risk, 96);
      reasons.push(`Critical Exam Isolation Breach: CBT Terminal ${flow.srcIp} attempted outbound WAN connection to external IP ${flow.dstIp}. All non-exam server traffic is strictly prohibited.`);
      acl = `access-list 150 permit tcp host ${flow.srcIp} host 10.70.0.12 eq 443\naccess-list 150 deny ip host ${flow.srcIp} any`;
    }

    // 2. STATISTICAL Z-SCORE ENGINE (Volumetric Anomalies)
    const ppsMean = this.getMean(this.volumeBaseline.ppsHistory);
    const ppsStd = this.getStdDev(this.volumeBaseline.ppsHistory, ppsMean);
    const zScorePPS = ppsStd > 0 ? (flow.pps - ppsMean) / ppsStd : 0;

    const bytesMean = this.getMean(this.volumeBaseline.bytesHistory);
    const bytesStd = this.getStdDev(this.volumeBaseline.bytesHistory, bytesMean);
    const zScoreBytes = bytesStd > 0 ? (flow.bytes - bytesMean) / bytesStd : 0;

    // Anomaly 3: IoT Device Sending Huge Traffic Burst
    if (flow.type === 'iot_flood' || zScorePPS > 4.0 || zScoreBytes > 4.0) {
      risk = Math.max(risk, 92);
      reasons.push(`Statistical Anomaly: IoT endpoint ${flow.srcIp} exhibited volumetric flood (Z-Score PPS: ${zScorePPS.toFixed(1)}, Rate: ${flow.pps.toLocaleString()} pps, Payload: ${(flow.bytes / 1024 / 1024).toFixed(1)} MB). Exceeds baseline by >4σ.`);
      acl = `access-list 140 deny ip host ${flow.srcIp} any\n! Rate-limit IoT interface: police 1000000 conform-action transmit exceed-action drop`;
    }

    // Baseline normal traffic evaluation
    if (risk === 0) {
      risk = Math.floor(Math.random() * 18 + 5); // 5-23 Low Normal
      return {
        riskScore: risk,
        status: 'Normal',
        explanation: `Flow complies with campus ACL policies and baseline volumetric metrics (Z-Score: ${Math.max(zScorePPS, 0.1).toFixed(2)}).`,
        recommendedACL: `Rule compliant. No remediation action needed.`
      };
    }

    return {
      riskScore: risk,
      status: 'Suspicious',
      explanation: reasons.join(' '),
      recommendedACL: acl
    };
  }

  getMean(arr) {
    if (!arr.length) return 1;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  getStdDev(arr, mean) {
    if (arr.length <= 1) return 1;
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /* -------------------------------------------------------------
     UI Rendering & Interactive Handlers
     ------------------------------------------------------------- */
  renderFlowRow(flow) {
    if (!this.tableBody) return;

    const tr = document.createElement('tr');
    tr.id = `row-${flow.id}`;
    tr.className = flow.status === 'Suspicious' ? 'suspicious-row' : 'normal-row';

    let riskBadgeClass = 'risk-low';
    if (flow.riskScore > 65) riskBadgeClass = 'risk-high';
    else if (flow.riskScore > 30) riskBadgeClass = 'risk-med';

    const formattedBytes = flow.bytes > 1000000 
      ? (flow.bytes / 1000000).toFixed(1) + ' MB' 
      : (flow.bytes > 1000 ? (flow.bytes / 1000).toFixed(1) + ' KB' : flow.bytes + ' B');

    tr.innerHTML = `
      <td>${flow.time}</td>
      <td><span class="prop-val">${flow.srcIp}</span></td>
      <td><span style="font-size:0.75rem; color:var(--text-secondary);">${flow.vlan}</span></td>
      <td><span class="prop-val">${flow.dstIp}</span></td>
      <td>${flow.port}</td>
      <td>${formattedBytes}</td>
      <td>${flow.pps.toLocaleString()}</td>
      <td>
        <span class="badge-risk ${riskBadgeClass}">
          <i class="fas fa-${flow.status === 'Suspicious' ? 'exclamation-triangle' : 'shield-alt'}"></i>
          ${flow.status} (${flow.riskScore})
        </span>
      </td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-sm btn-outline inspect-btn" data-id="${flow.id}" title="Inspect AI Explanation">
            <i class="fas fa-brain"></i> Explain
          </button>
          ${flow.status === 'Suspicious' && !flow.blocked ? `
            <button class="btn btn-sm btn-danger block-btn" data-ip="${flow.srcIp}" data-id="${flow.id}" title="Block Source IP">
              <i class="fas fa-ban"></i> Block
            </button>
          ` : (flow.blocked ? `<span class="badge-risk risk-high">BLOCKED</span>` : '')}
        </div>
      </td>
    `;

    // Insert at top of table
    this.tableBody.insertBefore(tr, this.tableBody.firstChild);

    // Limit table row count
    while (this.tableBody.children.length > this.maxRows) {
      this.tableBody.removeChild(this.tableBody.lastChild);
    }

    // Attach row button handlers
    const inspectBtn = tr.querySelector('.inspect-btn');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => this.showThreatDetail(flow));
    }

    const blockBtn = tr.querySelector('.block-btn');
    if (blockBtn) {
      blockBtn.addEventListener('click', (e) => {
        const ip = e.currentTarget.getAttribute('data-ip');
        this.blockIP(ip, flow);
      });
    }
  }

  showThreatDetail(flow) {
    if (!this.drawerEl) return;

    const titleEl = document.getElementById('drawerTitle');
    const flowMetaEl = document.getElementById('drawerFlowMeta');
    const explanationEl = document.getElementById('drawerExplanation');
    const aclCodeEl = document.getElementById('drawerAclCode');
    const drawerBlockBtn = document.getElementById('drawerBlockBtn');
    const drawerIgnoreBtn = document.getElementById('drawerIgnoreBtn');

    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-${flow.status === 'Suspicious' ? 'shield-virus' : 'check-circle'}" style="color:${flow.status === 'Suspicious' ? '#ef4444' : '#10b981'};"></i> Flow Analysis: ${flow.srcIp} &rarr; ${flow.dstIp} (${flow.id})`;
    }

    if (flowMetaEl) {
      flowMetaEl.innerHTML = `
        <div class="prop-row"><span class="prop-label">Source VLAN:</span><span class="prop-val">${flow.vlan}</span></div>
        <div class="prop-row"><span class="prop-label">Destination Port:</span><span class="prop-val">${flow.port} (${flow.protocol})</span></div>
        <div class="prop-row"><span class="prop-label">Throughput / Rate:</span><span class="prop-val">${flow.pps.toLocaleString()} pps (${flow.bytes} Bytes)</span></div>
        <div class="prop-row"><span class="prop-label">Computed AI Risk:</span><span class="prop-val" style="color:${flow.riskScore > 60 ? '#ef4444' : '#10b981'}">${flow.riskScore}/100</span></div>
      `;
    }

    if (explanationEl) {
      explanationEl.innerHTML = `<p>${flow.explanation}</p>`;
    }

    if (aclCodeEl) {
      aclCodeEl.textContent = flow.recommendedACL;
    }

    if (drawerBlockBtn) {
      drawerBlockBtn.onclick = () => {
        this.blockIP(flow.srcIp, flow);
        this.drawerEl.style.display = 'none';
      };
      drawerBlockBtn.style.display = flow.status === 'Suspicious' && !flow.blocked ? 'inline-flex' : 'none';
    }

    if (drawerIgnoreBtn) {
      drawerIgnoreBtn.onclick = () => {
        this.drawerEl.style.display = 'none';
      };
    }

    this.drawerEl.style.display = 'block';
    this.drawerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  blockIP(ip, flow) {
    this.blockedIPs.add(ip);
    if (this.blockedCountEl) {
      this.blockedCountEl.textContent = this.blockedIPs.size;
    }

    // Flash alert banner / notification
    this.showToast(`🚫 IP ${ip} successfully quarantined and added to Core ACL blocklist!`);

    // Update row state
    if (flow) {
      flow.blocked = true;
      const row = document.getElementById(`row-${flow.id}`);
      if (row) {
        const blockBtn = row.querySelector('.block-btn');
        if (blockBtn) {
          blockBtn.replaceWith(document.createRange().createContextualFragment('<span class="badge-risk risk-high">BLOCKED</span>'));
        }
      }
    }
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 5rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid #ef4444;
      color: #fff;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 9999;
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 3500);
  }

  updateKPIs(currentRisk) {
    if (this.totalFlowsEl) this.totalFlowsEl.textContent = this.totalFlows.toLocaleString();
    if (this.suspiciousCountEl) this.suspiciousCountEl.textContent = this.suspiciousCount.toLocaleString();
    if (this.blockedCountEl) this.blockedCountEl.textContent = this.blockedIPs.size;
    
    if (this.avgRiskEl) {
      const avg = this.flowHistory.length 
        ? Math.round(this.flowHistory.reduce((acc, f) => acc + f.riskScore, 0) / this.flowHistory.length)
        : 0;
      this.avgRiskEl.textContent = `${avg}/100`;
    }
  }

  /* -------------------------------------------------------------
     Canvas Risk Over Time Chart
     ------------------------------------------------------------- */
  initChart() {
    if (!this.chartCanvas) return;
    this.chartCtx = this.chartCanvas.getContext('2d');
    this.drawChart();
  }

  updateChart(risk) {
    this.chartData.push(risk);
    if (this.chartData.length > this.maxChartPoints) {
      this.chartData.shift();
    }
    this.drawChart();
  }

  drawChart() {
    if (!this.chartCanvas || !this.chartCtx) return;
    const ctx = this.chartCtx;
    const w = this.chartCanvas.width = this.chartCanvas.parentElement.clientWidth || 600;
    const h = this.chartCanvas.height = 180;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    // Y Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('100', 10, 35);
    ctx.fillText('50', 15, 95);
    ctx.fillText('0', 20, 155);

    if (this.chartData.length < 2) return;

    const startX = 45;
    const chartW = w - startX - 25;
    const stepX = chartW / (this.maxChartPoints - 1);

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradient.addColorStop(0.7, 'rgba(99, 102, 241, 0.15)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.beginPath();
    this.chartData.forEach((val, idx) => {
      const x = startX + idx * stepX;
      const y = h - 25 - (val / 100) * (h - 55);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Fill path
    const lastX = startX + (this.chartData.length - 1) * stepX;
    ctx.lineTo(lastX, h - 25);
    ctx.lineTo(startX, h - 25);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    this.chartData.forEach((val, idx) => {
      const x = startX + idx * stepX;
      const y = h - 25 - (val / 100) * (h - 55);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Data points with threat markers
    this.chartData.forEach((val, idx) => {
      const x = startX + idx * stepX;
      const y = h - 25 - (val / 100) * (h - 55);
      ctx.beginPath();
      ctx.arc(x, y, val > 65 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = val > 65 ? '#ef4444' : '#38bdf8';
      ctx.fill();
      if (val > 65) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.threatEngine = new AIThreatDetectionEngine();
});
