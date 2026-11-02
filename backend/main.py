"""
Smart Digital Campus Network - FastAPI Backend Bridge
Bridges the Smart Digital Campus Frontend (running on localhost:3080)
with the local GNS3 Network Simulation API.
"""

import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes.gns3 import router as gns3_router

# Configure logging format and level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("smart_campus_backend")

# Initialize FastAPI application
app = FastAPI(
    title="Smart Digital Campus Network - GNS3 Bridge API",
    description="REST API bridge connecting the Smart Digital Campus web application to the GNS3 Network Simulation Server.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware
# Allows frontend at http://localhost:3080 to communicate seamlessly with backend at http://localhost:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(gns3_router)


@app.get("/", summary="Backend Root Health")
async def root():
    return {
        "service": "Smart Digital Campus - GNS3 FastAPI Bridge",
        "status": "running",
        "docs": "/docs",
        "gns3_server_target": settings.GNS3_SERVER_URL,
        "endpoints": {
            "status": "/api/gns3/status",
            "projects": "/api/gns3/projects",
            "topology": "/api/gns3/topology",
            "nodes": "/api/gns3/nodes",
            "links": "/api/gns3/links"
        }
    }


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 70)
    logger.info(" Smart Digital Campus - GNS3 FastAPI Bridge Started")
    logger.info(f" API Server listening on: http://{settings.BACKEND_HOST}:{settings.BACKEND_PORT}")
    logger.info(f" Interactive Swagger Docs: http://localhost:{settings.BACKEND_PORT}/docs")
    logger.info(f" GNS3 Server Target URL:  {settings.GNS3_SERVER_URL}")
    logger.info(f" Configured CORS Origins: {settings.CORS_ORIGINS}")
    logger.info("=" * 70)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True
    )
