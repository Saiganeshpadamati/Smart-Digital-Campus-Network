/**
 * GNS3 FastAPI Service Layer
 * Connects the Smart Digital Campus Frontend (localhost:3080)
 * to the FastAPI Backend Bridge (localhost:8000) -> GNS3 API.
 * 
 * Secure: Communicates ONLY with FastAPI backend. Never exposes GNS3 credentials.
 */

(function () {
  'use strict';

  // Configurable FastAPI backend base URL
  const BACKEND_BASE_URL = window.GNS3_BACKEND_URL || 'http://localhost:8000';

  class GNS3Service {
    constructor(baseUrl = BACKEND_BASE_URL) {
      this.baseUrl = baseUrl.replace(/\/+$/, '');
      this.pollInterval = null;
      this.pollSpeed = 5000; // Poll every 5 seconds
      this.currentProjectId = null;
      this.state = {
        isOnline: false,
        version: null,
        message: 'Initializing...',
        project: null,
        nodes: [],
        links: [],
        nodeCount: 0,
        linkCount: 0
      };
      this.listeners = [];
    }

    /**
     * Subscribe to state updates
     */
    onStateChange(fn) {
      if (typeof fn === 'function') {
        this.listeners.push(fn);
      }
    }

    _notify() {
      this.listeners.forEach(fn => fn(this.state));
    }

    /**
     * GET /api/gns3/status
     * Checks whether GNS3 server is reachable through FastAPI backend.
     */
    async getStatus() {
      try {
        const response = await fetch(`${this.baseUrl}/api/gns3/status`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        return {
          status: 'offline',
          connected: false,
          message: `Backend API unreachable at ${this.baseUrl} (${err.message})`
        };
      }
    }

    /**
     * GET /api/gns3/projects
     * Returns list of available GNS3 projects.
     */
    async getProjects() {
      try {
        const response = await fetch(`${this.baseUrl}/api/gns3/projects`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { status: 'offline', projects: [], message: err.message };
      }
    }

    /**
     * GET /api/gns3/topology
     * Returns complete nodes and links for active project.
     */
    async getTopology(projectId = null) {
      try {
        const url = new URL(`${this.baseUrl}/api/gns3/topology`);
        if (projectId || this.currentProjectId) {
          url.searchParams.set('project_id', projectId || this.currentProjectId);
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { status: 'offline', nodes: [], links: [], node_count: 0, link_count: 0, message: err.message };
      }
    }

    /**
     * GET /api/gns3/nodes
     * Returns all nodes in the selected project.
     */
    async getNodes(projectId = null) {
      try {
        const url = new URL(`${this.baseUrl}/api/gns3/nodes`);
        if (projectId || this.currentProjectId) {
          url.searchParams.set('project_id', projectId || this.currentProjectId);
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { status: 'offline', nodes: [], node_count: 0, message: err.message };
      }
    }

    /**
     * GET /api/gns3/node/{node_id}
     * Returns details for a specific node.
     */
    async getNode(nodeId, projectId = null) {
      try {
        const url = new URL(`${this.baseUrl}/api/gns3/node/${encodeURIComponent(nodeId)}`);
        if (projectId || this.currentProjectId) {
          url.searchParams.set('project_id', projectId || this.currentProjectId);
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { status: 'error', message: err.message };
      }
    }

    /**
     * GET /api/gns3/links
     * Returns network links/connections.
     */
    async getLinks(projectId = null) {
      try {
        const url = new URL(`${this.baseUrl}/api/gns3/links`);
        if (projectId || this.currentProjectId) {
          url.searchParams.set('project_id', projectId || this.currentProjectId);
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { status: 'offline', links: [], link_count: 0, message: err.message };
      }
    }

    /**
     * Sync state from backend
     */
    async sync() {
      const statusRes = await this.getStatus();
      this.state.isOnline = statusRes.status === 'online' && statusRes.connected === true;
      this.state.version = statusRes.version || null;
      this.state.message = statusRes.message || (this.state.isOnline ? 'Connected' : 'Offline');

      if (this.state.isOnline) {
        // Fetch projects & topology
        const topRes = await this.getTopology();
        if (topRes.status === 'success') {
          this.state.project = topRes.project_id || 'Smart Campus Lab';
          this.state.nodes = topRes.nodes || [];
          this.state.links = topRes.links || [];
          this.state.nodeCount = topRes.node_count || this.state.nodes.length;
          this.state.linkCount = topRes.link_count || this.state.links.length;
        } else {
          this.state.nodes = [];
          this.state.links = [];
          this.state.nodeCount = 0;
          this.state.linkCount = 0;
        }
      } else {
        this.state.nodes = [];
        this.state.links = [];
        this.state.nodeCount = 0;
        this.state.linkCount = 0;
      }

      this._notify();
    }

    startAutoPolling() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.sync();
      this.pollInterval = setInterval(() => this.sync(), this.pollSpeed);
    }

    stopAutoPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    }
  }

  // Export service instance globally
  window.GNS3Service = new GNS3Service();

  // ==============================================================================
  // Minimum UI Component Integration (Non-destructive)
  // Displays:
  // - GNS3 CONNECTION: 🟢 Connected or 🔴 Offline
  // - NETWORK SIMULATION: Project Name, Node count, Link count, Node status, Link status
  // - SMART CAMPUS DEVICES: Real nodes from GNS3
  // ==============================================================================

  function initGNS3LiveWidget() {
    let container = document.getElementById('gns3IntegrationWidget');
    
    // If element doesn't exist in DOM, create and mount floating widget cleanly
    if (!container) {
      container = document.createElement('div');
      container.id = 'gns3IntegrationWidget';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 9999;
        font-family: 'JetBrains Mono', Consolas, monospace;
        font-size: 0.8rem;
        color: #f8fafc;
        max-width: 380px;
        width: calc(100vw - 48px);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(container);
    }

    window.GNS3Service.onStateChange((state) => {
      const isOnline = state.isOnline;
      const statusIcon = isOnline ? '🟢 Connected' : '🔴 Offline';
      const statusColor = isOnline ? '#10b981' : '#ef4444';

      let devicesHtml = '';
      if (isOnline && state.nodes.length > 0) {
        devicesHtml = state.nodes.slice(0, 6).map(n => `
          <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="color:#94a3b8;">${n.name || 'Device'}</span>
            <span style="color:${n.status === 'started' ? '#34d399' : '#f87171'}; font-weight:bold;">${n.status || 'stopped'}</span>
          </div>
        `).join('');
      } else {
        devicesHtml = `
          <div style="display:flex; justify-content:space-between; padding:2px 0; color:#64748b;">
            <span>ADMIN-PC</span><span>${isOnline ? 'online' : 'offline'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:2px 0; color:#64748b;">
            <span>STUDENT-PC</span><span>${isOnline ? 'online' : 'offline'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:2px 0; color:#64748b;">
            <span>IOT-PC</span><span>${isOnline ? 'online' : 'offline'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:2px 0; color:#64748b;">
            <span>CAMPUS-SW</span><span>${isOnline ? 'online' : 'offline'}</span>
          </div>
        `;
      }

      container.innerHTML = `
        <div style="
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid ${statusColor};
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px ${statusColor}33;
          backdrop-filter: blur(10px);
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(148,163,184,0.2); padding-bottom:6px;">
            <div style="font-weight:bold; color:#fff; display:flex; align-items:center; gap:6px;">
              <span>GNS3 BRIDGE</span>
              <span style="font-size:0.7rem; background:#1e293b; color:#38bdf8; padding:1px 5px; border-radius:4px;">:8000</span>
            </div>
            <div style="font-weight:bold; color:${statusColor}; font-size:0.75rem;">
              ${statusIcon}
            </div>
          </div>

          <div style="margin-bottom:8px;">
            <div style="color:#38bdf8; font-size:0.75rem; font-weight:bold; margin-bottom:2px;">NETWORK SIMULATION:</div>
            <div style="font-size:0.75rem; color:#cbd5e1;">Project: <strong style="color:#fff;">${state.project || (isOnline ? 'Active Lab' : 'None')}</strong></div>
            <div style="display:flex; gap:12px; font-size:0.75rem; color:#94a3b8; margin-top:2px;">
              <span>Nodes: <strong style="color:#fff;">${state.nodeCount}</strong></span>
              <span>Links: <strong style="color:#fff;">${state.linkCount}</strong></span>
              <span>Link Status: <strong style="color:${isOnline ? '#34d399' : '#f87171'};">${isOnline ? 'UP' : 'DOWN'}</strong></span>
            </div>
          </div>

          <div style="margin-top:6px;">
            <div style="color:#c084fc; font-size:0.75rem; font-weight:bold; margin-bottom:3px;">SMART CAMPUS DEVICES:</div>
            <div style="font-size:0.72rem; max-height:85px; overflow-y:auto;">
              ${devicesHtml}
            </div>
          </div>

          ${!isOnline ? `
            <div style="margin-top:8px; font-size:0.7rem; color:#fca5a5; background:rgba(239,68,68,0.15); padding:4px 6px; border-radius:4px;">
              ⚠️ ${state.message}
            </div>
          ` : ''}
        </div>
      `;
    });

    // Start auto polling
    window.GNS3Service.startAutoPolling();
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGNS3LiveWidget);
  } else {
    initGNS3LiveWidget();
  }

})();
