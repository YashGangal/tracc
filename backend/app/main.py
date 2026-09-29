import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.db.session import init_db
from app.services.rag import index_sop_documents
from app.ml.predictor import _load_artifacts
from app.api.v1 import (
    auth, loads, carriers, drivers, analytics,
    predictions, alerts, copilot, rag, agent, chat
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("logistics_copilot")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Initializing database schemas...")
    init_db()
    logger.info("Indexing official SOP knowledge documents...")
    try:
        index_sop_documents()
    except Exception as e:
        logger.warning(f"SOP index notice: {e}")
    logger.info("Verifying ML delay risk models & SHAP artifacts...")
    try:
        _load_artifacts()
    except Exception as e:
        logger.warning(f"ML artifacts notice: {e}")
    logger.info("AI Logistics Operations Copilot Backend ready!")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Logistics Operations Copilot - Unified Freight Intelligence Platform",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(loads.router, prefix=settings.API_V1_STR)
app.include_router(carriers.router, prefix=settings.API_V1_STR)
app.include_router(drivers.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(predictions.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(copilot.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(rag.router, prefix=settings.API_V1_STR)
app.include_router(agent.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "logistics_copilot_api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
