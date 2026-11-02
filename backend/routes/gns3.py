"""
FastAPI Routes for GNS3 Server Integration
Endpoints:
- GET /api/gns3/status
- GET /api/gns3/projects
- GET /api/gns3/topology
- GET /api/gns3/nodes
- GET /api/gns3/node/{node_id}
- GET /api/gns3/links
"""

import logging
from typing import Optional
from fastapi import APIRouter, Query, Path
from ..gns3_client import gns3_client

logger = logging.getLogger("routes.gns3")

router = APIRouter(prefix="/api/gns3", tags=["GNS3 Network Simulation"])


@router.get("/status", summary="Check GNS3 Reachability")
async def get_gns3_status():
    """
    Checks whether the GNS3 server is reachable and active.
    Returns status: 'online' or 'offline' with message.
    """
    logger.info("Handling GET /api/gns3/status")
    result = await gns3_client.check_status()
    return result


@router.get("/projects", summary="List GNS3 Projects")
async def get_gns3_projects():
    """
    Returns list of available GNS3 projects with IDs, names, and opened/closed statuses.
    """
    logger.info("Handling GET /api/gns3/projects")
    result = await gns3_client.get_projects()
    return result


@router.get("/topology", summary="Get Project Topology (Nodes & Links)")
async def get_gns3_topology(
    project_id: Optional[str] = Query(None, description="Optional GNS3 Project ID. If omitted, uses active/default project.")
):
    """
    Returns the complete network topology including all nodes, links, and connection topology.
    """
    logger.info(f"Handling GET /api/gns3/topology (project_id={project_id})")
    result = await gns3_client.get_topology(project_id=project_id)
    return result


@router.get("/nodes", summary="List Nodes in Project")
async def get_gns3_nodes(
    project_id: Optional[str] = Query(None, description="Optional GNS3 Project ID")
):
    """
    Returns all nodes in the selected project with their operational statuses (started, stopped).
    """
    logger.info(f"Handling GET /api/gns3/nodes (project_id={project_id})")
    result = await gns3_client.get_nodes(project_id=project_id)
    return result


@router.get("/node/{node_id}", summary="Get Node Details")
async def get_gns3_node(
    node_id: str = Path(..., description="The unique ID of the node"),
    project_id: Optional[str] = Query(None, description="Optional GNS3 Project ID")
):
    """
    Returns detailed properties, console port, and interface mappings for a specific node.
    """
    logger.info(f"Handling GET /api/gns3/node/{node_id} (project_id={project_id})")
    result = await gns3_client.get_node(node_id=node_id, project_id=project_id)
    return result


@router.get("/links", summary="List Links in Project")
async def get_gns3_links(
    project_id: Optional[str] = Query(None, description="Optional GNS3 Project ID")
):
    """
    Returns all network link connections between nodes in the project.
    """
    logger.info(f"Handling GET /api/gns3/links (project_id={project_id})")
    result = await gns3_client.get_links(project_id=project_id)
    return result


@router.get("/events", summary="List GNS3 Simulation Events")
async def get_gns3_events(
    project_id: Optional[str] = Query(None, description="Optional GNS3 Project ID")
):
    """
    Returns simulation events from active GNS3 project.
    Guarantees that ONLY GNS3 simulation source is used. Real host network is DISABLED.
    """
    logger.info(f"Handling GET /api/gns3/events (project_id={project_id})")
    result = await gns3_client.get_events(project_id=project_id)
    return result


# Project-scoped parameterized routes (GET /api/gns3/projects/{project_id}/*)

@router.get("/projects/{project_id}/topology", summary="Get Topology for Specific Project")
async def get_gns3_project_topology(
    project_id: str = Path(..., description="GNS3 Project ID")
):
    """
    Returns nodes and links for a specific project ID.
    """
    logger.info(f"Handling GET /api/gns3/projects/{project_id}/topology")
    result = await gns3_client.get_topology(project_id=project_id)
    return result


@router.get("/projects/{project_id}/nodes", summary="List Nodes for Specific Project")
async def get_gns3_project_nodes(
    project_id: str = Path(..., description="GNS3 Project ID")
):
    """
    Returns all nodes in a specific project ID.
    """
    logger.info(f"Handling GET /api/gns3/projects/{project_id}/nodes")
    result = await gns3_client.get_nodes(project_id=project_id)
    return result


@router.get("/projects/{project_id}/links", summary="List Links for Specific Project")
async def get_gns3_project_links(
    project_id: str = Path(..., description="GNS3 Project ID")
):
    """
    Returns all links in a specific project ID.
    """
    logger.info(f"Handling GET /api/gns3/projects/{project_id}/links")
    result = await gns3_client.get_links(project_id=project_id)
    return result


@router.get("/projects/{project_id}/events", summary="List Events for Specific Project")
async def get_gns3_project_events(
    project_id: str = Path(..., description="GNS3 Project ID")
):
    """
    Returns simulation events for a specific project ID.
    """
    logger.info(f"Handling GET /api/gns3/projects/{project_id}/events")
    result = await gns3_client.get_events(project_id=project_id)
    return result

