"""
GNS3 REST API Client
Provides asynchronous communication with GNS3 server API v2 with robust error handling,
timeouts, and connection failure resilience.
"""

import logging
from typing import Dict, Any, List, Optional
import httpx
from .config import settings

logger = logging.getLogger("gns3_client")


class GNS3Client:
    def __init__(self):
        self.base_url = settings.gns3_base_api_url
        self.timeout = settings.GNS3_TIMEOUT_SECONDS
        self.auth = (settings.GNS3_USER, settings.GNS3_PASSWORD) if settings.GNS3_USER and settings.GNS3_PASSWORD else None

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            auth=self.auth
        )

    async def check_status(self) -> Dict[str, Any]:
        """
        Checks whether GNS3 server is reachable and online.
        """
        try:
            async with self._get_client() as client:
                logger.info(f"Checking GNS3 server health at {self.base_url}/version")
                resp = await client.get("/version")
                
                if resp.status_code == 200:
                    data = resp.json()
                    version = data.get("version", "2.x")
                    logger.info(f"GNS3 server is ONLINE (version {version})")
                    return {
                        "status": "online",
                        "connected": True,
                        "version": version,
                        "gns3_url": settings.GNS3_SERVER_URL,
                        "message": "GNS3 server is reachable and connected"
                    }
                elif resp.status_code == 401:
                    logger.warning("GNS3 server returned HTTP 401 (Authentication required)")
                    return {
                        "status": "offline",
                        "connected": False,
                        "gns3_url": settings.GNS3_SERVER_URL,
                        "message": "GNS3 server authentication failed (HTTP 401). Check GNS3_USER/GNS3_PASSWORD in .env."
                    }
                else:
                    logger.warning(f"GNS3 server returned HTTP {resp.status_code}")
                    return {
                        "status": "offline",
                        "connected": False,
                        "gns3_url": settings.GNS3_SERVER_URL,
                        "message": f"GNS3 server returned unexpected HTTP status {resp.status_code}"
                    }
        except httpx.ConnectError:
            logger.error(f"Failed to connect to GNS3 server at {self.base_url}. Connection refused.")
            return {
                "status": "offline",
                "connected": False,
                "gns3_url": settings.GNS3_SERVER_URL,
                "message": f"GNS3 server is not reachable at {settings.GNS3_SERVER_URL}"
            }
        except httpx.TimeoutException:
            logger.error(f"Timed out connecting to GNS3 server at {self.base_url}")
            return {
                "status": "offline",
                "connected": False,
                "gns3_url": settings.GNS3_SERVER_URL,
                "message": f"Connection timed out reaching GNS3 server at {settings.GNS3_SERVER_URL}"
            }
        except Exception as e:
            logger.error(f"GNS3 health check error: {str(e)}")
            return {
                "status": "offline",
                "connected": False,
                "gns3_url": settings.GNS3_SERVER_URL,
                "message": f"GNS3 connection error: {str(e)}"
            }

    async def get_projects(self) -> Dict[str, Any]:
        """
        Retrieves list of all projects from GNS3.
        """
        try:
            async with self._get_client() as client:
                logger.info("Fetching GNS3 projects list")
                resp = await client.get("/projects")
                
                if resp.status_code == 200:
                    raw_projects = resp.json()
                    projects = [
                        {
                            "project_id": p.get("project_id"),
                            "name": p.get("name"),
                            "status": p.get("status"),
                            "path": p.get("path"),
                            "filename": p.get("filename"),
                            "auto_start": p.get("auto_start", False)
                        }
                        for p in raw_projects
                    ]
                    return {
                        "status": "success",
                        "count": len(projects),
                        "projects": projects
                    }
                else:
                    return {
                        "status": "offline",
                        "message": f"GNS3 returned status {resp.status_code}: {resp.text}",
                        "projects": []
                    }
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Cannot reach GNS3 for projects: {e}")
            return {
                "status": "offline",
                "message": "GNS3 server is not reachable",
                "projects": []
            }
        except Exception as e:
            logger.error(f"Error fetching GNS3 projects: {e}")
            return {
                "status": "offline",
                "message": str(e),
                "projects": []
            }

    async def resolve_project_id(self, project_id: Optional[str] = None) -> Optional[str]:
        """
        Resolves project ID from explicit param, config, or first available/open project in GNS3.
        """
        if project_id:
            return project_id
        
        if settings.GNS3_PROJECT_ID:
            return settings.GNS3_PROJECT_ID
        
        # Query projects from GNS3
        projects_data = await self.get_projects()
        projects = projects_data.get("projects", [])
        
        if not projects:
            return None
        
        # 1. Prioritize currently opened active project in GNS3
        for p in projects:
            if p.get("status") == "opened":
                return p.get("project_id")

        # 2. Try match by configured project name
        if settings.GNS3_PROJECT_NAME:
            for p in projects:
                if p.get("name") and p.get("name").lower() == settings.GNS3_PROJECT_NAME.lower():
                    return p.get("project_id")

        return projects[0].get("project_id")

    async def get_nodes(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves all nodes for the given project.
        """
        p_id = await self.resolve_project_id(project_id)
        if not p_id:
            return {
                "status": "offline",
                "message": "No valid GNS3 project found or GNS3 is unreachable",
                "nodes": [],
                "node_count": 0
            }

        try:
            async with self._get_client() as client:
                logger.info(f"Fetching nodes for project ID {p_id}")
                resp = await client.get(f"/projects/{p_id}/nodes")
                
                if resp.status_code == 200:
                    raw_nodes = resp.json()
                    nodes = [
                        {
                            "node_id": n.get("node_id"),
                            "name": n.get("name"),
                            "node_type": n.get("node_type", "unknown"),
                            "status": n.get("status", "stopped"), # 'started', 'stopped', 'suspended'
                            "compute_id": n.get("compute_id", "local"),
                            "console": n.get("console"),
                            "console_type": n.get("console_type"),
                            "x": n.get("x"),
                            "y": n.get("y")
                        }
                        for n in raw_nodes
                    ]
                    return {
                        "status": "success",
                        "project_id": p_id,
                        "node_count": len(nodes),
                        "nodes": nodes
                    }
                elif resp.status_code == 404:
                    return {
                        "status": "error",
                        "message": f"Project ID '{p_id}' not found in GNS3",
                        "nodes": []
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"GNS3 error {resp.status_code}: {resp.text}",
                        "nodes": []
                    }
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Cannot reach GNS3 for nodes: {e}")
            return {
                "status": "offline",
                "message": "GNS3 server is not reachable",
                "nodes": []
            }
        except Exception as e:
            logger.error(f"Error fetching GNS3 nodes: {e}")
            return {
                "status": "error",
                "message": str(e),
                "nodes": []
            }

    async def get_node(self, node_id: str, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves details for a specific node in a project.
        """
        p_id = await self.resolve_project_id(project_id)
        if not p_id:
            return {
                "status": "offline",
                "message": "No valid GNS3 project found or GNS3 is unreachable"
            }

        try:
            async with self._get_client() as client:
                logger.info(f"Fetching node {node_id} in project {p_id}")
                resp = await client.get(f"/projects/{p_id}/nodes/{node_id}")
                
                if resp.status_code == 200:
                    n = resp.json()
                    return {
                        "status": "success",
                        "project_id": p_id,
                        "node": {
                            "node_id": n.get("node_id"),
                            "name": n.get("name"),
                            "node_type": n.get("node_type"),
                            "status": n.get("status"),
                            "properties": n.get("properties", {}),
                            "ports": n.get("ports", []),
                            "command_line": n.get("command_line", ""),
                            "console": n.get("console"),
                            "console_type": n.get("console_type")
                        }
                    }
                elif resp.status_code == 404:
                    return {
                        "status": "error",
                        "message": f"Node ID '{node_id}' not found in project '{p_id}'"
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"GNS3 error {resp.status_code}: {resp.text}"
                    }
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            return {
                "status": "offline",
                "message": "GNS3 server is not reachable"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }

    async def get_links(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves all links/connections for the given project.
        """
        p_id = await self.resolve_project_id(project_id)
        if not p_id:
            return {
                "status": "offline",
                "message": "No valid GNS3 project found or GNS3 is unreachable",
                "links": [],
                "link_count": 0
            }

        try:
            async with self._get_client() as client:
                logger.info(f"Fetching links for project ID {p_id}")
                resp = await client.get(f"/projects/{p_id}/links")
                
                if resp.status_code == 200:
                    raw_links = resp.json()
                    links = [
                        {
                            "link_id": l.get("link_id"),
                            "nodes": l.get("nodes", []),
                            "link_type": l.get("link_type", "ethernet"),
                            "suspend": l.get("suspend", False),
                            "capturing": l.get("capturing", False)
                        }
                        for l in raw_links
                    ]
                    return {
                        "status": "success",
                        "project_id": p_id,
                        "link_count": len(links),
                        "links": links
                    }
                elif resp.status_code == 404:
                    return {
                        "status": "error",
                        "message": f"Project ID '{p_id}' not found in GNS3",
                        "links": []
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"GNS3 error {resp.status_code}: {resp.text}",
                        "links": []
                    }
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            return {
                "status": "offline",
                "message": "GNS3 server is not reachable",
                "links": []
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "links": []
            }

    async def get_topology(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves the complete topology (nodes and links) for the project.
        """
        p_id = await self.resolve_project_id(project_id)
        if not p_id:
            return {
                "status": "offline",
                "message": "No valid GNS3 project found or GNS3 is unreachable",
                "nodes": [],
                "links": [],
                "node_count": 0,
                "link_count": 0
            }

        nodes_res = await self.get_nodes(p_id)
        if nodes_res.get("status") == "offline":
            return {
                "status": "offline",
                "message": "GNS3 server is not reachable",
                "nodes": [],
                "links": [],
                "node_count": 0,
                "link_count": 0
            }

        links_res = await self.get_links(p_id)

        project_name = "Unknown Project"
        try:
            projects_data = await self.get_projects()
            for p in projects_data.get("projects", []):
                if p.get("project_id") == p_id:
                    project_name = p.get("name", project_name)
                    break
        except Exception:
            pass

        return {
            "status": "success",
            "project_id": p_id,
            "project_name": project_name,
            "network_source": "GNS3 SIMULATION",
            "real_network": "DISABLED",
            "node_count": nodes_res.get("node_count", 0),
            "link_count": links_res.get("link_count", 0),
            "nodes": nodes_res.get("nodes", []),
            "links": links_res.get("links", [])
        }

    async def get_events(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves live simulation events from the GNS3 project.
        Guarantees that ONLY GNS3 simulation source is used. Real host network is DISABLED.
        """
        p_id = await self.resolve_project_id(project_id)
        if not p_id:
            return {
                "status": "offline",
                "connected": False,
                "message": "GNS3 server is not reachable",
                "network_source": "GNS3 SIMULATION",
                "real_network": "DISABLED",
                "events": []
            }

        topology = await self.get_topology(p_id)
        if topology.get("status") == "offline":
            return {
                "status": "offline",
                "connected": False,
                "message": "GNS3 server is not reachable",
                "network_source": "GNS3 SIMULATION",
                "real_network": "DISABLED",
                "events": []
            }

        nodes = topology.get("nodes", [])
        started_nodes = [n for n in nodes if n.get("status") == "started"]

        events = []
        for n in started_nodes:
            events.append({
                "event_id": f"EVT-{n.get('node_id')[:8]}",
                "type": "node_active",
                "node_name": n.get("name"),
                "node_type": n.get("node_type"),
                "status": n.get("status"),
                "network_source": "GNS3 SIMULATION"
            })

        return {
            "status": "success",
            "project_id": p_id,
            "project_name": topology.get("project_name", "Smart Campus Lab"),
            "network_source": "GNS3 SIMULATION",
            "real_network": "DISABLED",
            "events_count": len(events),
            "events": events
        }


gns3_client = GNS3Client()
