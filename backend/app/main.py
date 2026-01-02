import os
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.services.deepgram_service import DeepgramService
from app.services.vad_service import initialize_vad_service
from app.routes.transcription import (
    TranscriptionManager,
    set_transcription_manager,
    get_transcription_manager,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize Deepgram service
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("DEEPGRAM_API_KEY environment variable is required")

# Initialize VAD service
vad_service = initialize_vad_service()

# Initialize Deepgram service
deepgram_service = DeepgramService(DEEPGRAM_API_KEY)
transcription_manager = TranscriptionManager(deepgram_service)
set_transcription_manager(transcription_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting FastAPI application...")
    yield
    # Shutdown
    logger.info("Shutting down FastAPI application...")


# Create FastAPI app
app = FastAPI(
    title="EchoText Transcription API",
    description="Real-time speech-to-text transcription service",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for Tauri
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify Tauri app origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "EchoText Transcription API", "status": "running"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "transcription"}


@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for real-time transcription."""
    connection_id = str(uuid.uuid4())
    logger.info(f"New WebSocket connection: {connection_id}")

    manager = await get_transcription_manager()

    # Create a new Deepgram service instance for this connection
    service = DeepgramService(DEEPGRAM_API_KEY)

    await manager.handle_transcription_websocket(websocket, connection_id, service)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
