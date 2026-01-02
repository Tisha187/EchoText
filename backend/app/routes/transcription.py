import asyncio
import logging
from fastapi import WebSocket, WebSocketDisconnect
from app.services.deepgram_service import DeepgramService
from app.services.vad_service import get_vad_service

logger = logging.getLogger(__name__)


class TranscriptionManager:
    def __init__(self, deepgram_service: DeepgramService):
        self.deepgram_service = deepgram_service
        self.active_connections: dict[str, WebSocket] = {}

    async def handle_transcription_websocket(
        self, websocket: WebSocket, connection_id: str, deepgram_service: DeepgramService
    ):
        """Handle WebSocket connection for real-time transcription."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket

        # Set event loop for thread-safe async callbacks
        event_loop = asyncio.get_event_loop()
        deepgram_service.set_event_loop(event_loop)

        try:
            # Define async callbacks
            async def on_transcript(text: str, is_final: bool):
                print(" TRANSCRIPT FROM DEEPGRAM:", text)
                await self._send_transcript(websocket, text, is_final)
            
            async def on_error(error):
                error_msg = str(error) if error else "Unknown error"
                await self._send_error(websocket, error_msg)
            
            # Start Deepgram transcription
            success = await deepgram_service.start_live_transcription(
                on_transcript=on_transcript,
                on_error=on_error,
            )
            
            if not success:
                error_msg = deepgram_service.get_last_error() or "Failed to start Deepgram transcription. Please check your API key and network connection."
                logger.error(f"Failed to start Deepgram transcription: {error_msg}")
                await self._send_error(websocket, error_msg)
                return

            # Send connection confirmation
            await websocket.send_json({
                "type": "connected",
                "message": "Transcription service ready"
            })

            # Get VAD service
            vad_service = get_vad_service()
            
            # Callback for when VAD detects a complete utterance (for logging only)
            async def on_utterance_detected(utterance_bytes: bytes):
                """Log when VAD detects complete utterance."""
                logger.info(f"✅ VAD detected complete utterance: {len(utterance_bytes)} bytes")

            # Track audio chunks for logging
            audio_chunk_count = 0
            total_audio_bytes = 0

            # Receive audio data and send to both Deepgram and VAD
            while True:
                try:
                    # Receive audio data (expecting binary)
                    data = await websocket.receive_bytes()
                    
                    if data:
                        audio_chunk_count += 1
                        total_audio_bytes += len(data)
                        
                        # Log every 50th chunk (approximately every second at 16kHz)
                        if audio_chunk_count % 50 == 0:
                            logger.debug(
                                f"📥 Received audio chunk #{audio_chunk_count}: "
                                f"{len(data)} bytes (total: {total_audio_bytes} bytes)"
                            )
                        
                        # Send audio continuously to Deepgram to prevent timeout
                        # This ensures Deepgram receives audio even during silence
                        success = await deepgram_service.send_audio(data)
                        if not success and audio_chunk_count % 50 == 0:
                            logger.warning("Failed to send audio to Deepgram")
                        
                        # Also process through VAD for speech detection (logging/debugging)
                        await vad_service.process_audio_chunk(
                            connection_id,
                            data,
                            on_utterance_detected
                        )

                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected: {connection_id}")
                    break
                except Exception as e:
                    logger.error(f"Error processing audio data: {e}")
                    logger.exception(e)
                    await self._send_error(websocket, f"Processing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error in transcription WebSocket: {e}")
            await self._send_error(websocket, f"Connection error: {str(e)}")
        finally:
            # Cleanup
            vad_service = get_vad_service()
            if vad_service:
                vad_service.cleanup_connection(connection_id)
            await deepgram_service.close()
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]

    async def _send_transcript(self, websocket: WebSocket, text: str, is_final: bool):
        """Send transcription result to client."""
        try:
            logger.info(f"📤 Sending transcript to client: '{text[:50]}...' (final: {is_final})")
            await websocket.send_json({
                "type": "transcript",
                "text": text,
                "is_final": is_final
            })
            logger.info(f"✅ Transcript sent successfully to client")
        except Exception as e:
            logger.error(f"❌ Error sending transcript: {e}")
            logger.exception(e)

    async def _send_error(self, websocket: WebSocket, error_message: str):
        """Send error message to client."""
        try:
            await websocket.send_json({
                "type": "error",
                "message": error_message
            })
        except Exception as e:
            logger.error(f"Error sending error message: {e}")


# Global manager instance (will be initialized in main.py)
transcription_manager: TranscriptionManager = None


async def get_transcription_manager() -> TranscriptionManager:
    """Get the global transcription manager instance."""
    return transcription_manager


def set_transcription_manager(manager: TranscriptionManager):
    """Set the global transcription manager instance."""
    global transcription_manager
    transcription_manager = manager

