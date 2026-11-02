# Smart Digital Campus Network - GNS3 FastAPI Integration

A bridge between the **Smart Digital Campus Network website** (running on `http://localhost:3080`) and your local **GNS3 Network Simulation Server**.

```
Website (localhost:3080)
        ↓
FastAPI Backend Bridge (localhost:8000)
        ↓
GNS3 REST API (v2)
        ↓
GNS3 Smart Campus Network Lab
```

---

## 🏗️ Architecture & Backend Structure

```
backend/
├── main.py              # FastAPI application, CORS middleware & route registration
├── config.py            # Environment configuration & settings management
├── gns3_client.py       # Asynchronous HTTP GNS3 client with error handling & timeouts
├── routes/
│   ├── __init__.py
│   └── gns3.py          # API endpoints (/api/gns3/*)
├── requirements.txt     # Python dependencies (FastAPI, uvicorn, httpx, pydantic-settings)
└── .env.example         # Environment template
```

---

## 🚀 Quick Start Instructions

### 1. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment (`.env`)
Edit or create `.env` in the project root:

```env
# GNS3 Server Configuration
GNS3_SERVER_URL=http://localhost:3080
GNS3_API_VERSION=v2

# (Optional) GNS3 Credentials if HTTP auth is enabled in GNS3 (Edit -> Preferences -> Server)
# GNS3_USER=admin
# GNS3_PASSWORD=admin

# (Optional) Project name in GNS3
GNS3_PROJECT_NAME=SmartCampus_Full

# Backend Server Port
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

### 3. Start the FastAPI Backend
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
or run with Python:
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📡 API Endpoints Reference

Base URL: `http://localhost:8000`  
Interactive Swagger Documentation: `http://localhost:8000/docs`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/gns3/status` | Check whether GNS3 server is reachable |
| `GET` | `/api/gns3/projects` | List all available GNS3 projects |
| `GET` | `/api/gns3/topology` | Get complete topology (nodes and links) for project |
| `GET` | `/api/gns3/nodes` | List all nodes in active project |
| `GET` | `/api/gns3/node/{node_id}` | Get detailed properties for a specific node |
| `GET` | `/api/gns3/links` | List all network link connections |

### Sample Status Response (Online):
```json
{
  "status": "online",
  "connected": true,
  "version": "2.2.45",
  "gns3_url": "http://localhost:3080",
  "message": "GNS3 server is reachable and connected"
}
```

### Sample Status Response (Offline / Unreachable):
```json
{
  "status": "offline",
  "connected": false,
  "gns3_url": "http://localhost:3080",
  "message": "GNS3 server is not reachable at http://localhost:3080"
}
```

---

## 💻 Frontend Integration

The frontend includes [`js/gns3-api.js`](file:///c:/Users/mohan/OneDrive/Desktop/cn/js/gns3-api.js) which communicates **exclusively with the FastAPI backend**:

- **GNS3 CONNECTION Indicator**: `🟢 Connected` or `🔴 Offline`
- **NETWORK SIMULATION**: Project name, Node count, Link count, Node status (started/stopped), Link status
- **SMART CAMPUS DEVICES**: Real-time status for `ADMIN-PC`, `STUDENT-PC`, `IOT-PC`, `CAMPUS-SW` and any additional GNS3 topology nodes.
- **Security**: No GNS3 credentials or sensitive internal URLs are ever exposed to client-side code.
