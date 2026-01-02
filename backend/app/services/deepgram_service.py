import asyncio
import json
import logging
from typing import Optional, Callable
from deepgram import DeepgramClient, LiveTranscriptionEvents
from deepgram.clients.live.v1 import LiveOptions

logger = logging.getLogger(__name__)


class DeepgramService:
    def __init__(self, api_key: str):
        """Initialize Deepgram service with API key."""
        self.api_key = api_key
        self.client = DeepgramClient(api_key)
        self.connection = None
        self.on_transcript: Optional[Callable] = None
        self.on_error: Optional[Callable] = None
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None
        self._is_connected = False
        self._keepalive_task: Optional[asyncio.Task] = None
        self._last_error: Optional[str] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the event loop for thread-safe async callbacks."""
        self._event_loop = loop

    async def start_live_transcription(
        self,
        on_transcript: Callable,
        on_error: Optional[Callable] = None,
    ):
        """
        Start live transcription connection.

        Args:
            on_transcript: Async callback function(text: str, is_final: bool) -> None
            on_error: Optional async callback function(error: Exception) -> None
        """
        self.on_transcript = on_transcript
        self.on_error = on_error

        try:
            # Configure Deepgram options with encoding/sample_rate/channels
            options = LiveOptions(
                model="nova-2",
                language="en-US",
                encoding="linear16",
                sample_rate=16000,
                channels=1,
                smart_format=True,
                interim_results=True,
                endpointing=300,
            )

            # Create live connection
            self.connection = self.client.listen.live.v("1")

            # Check available events for debugging
            available_events = [
                attr
                for attr in dir(LiveTranscriptionEvents)
                if not attr.startswith("_")
            ]
            logger.info(f"Available Deepgram events: {available_events}")

            # Register ALL event handlers BEFORE calling start()
            self.connection.on(LiveTranscriptionEvents.Open, self._on_open)

            # Use Transcript event (v3) - this is the correct event name
            if hasattr(LiveTranscriptionEvents, "Transcript"):
                self.connection.on(LiveTranscriptionEvents.Transcript, self._on_results)
                logger.info("Registered LiveTranscriptionEvents.Transcript handler")
            else:
                # Fallback if Transcript doesn't exist (shouldn't happen in v3)
                logger.warning("Transcript event not found, trying Results")
                if hasattr(LiveTranscriptionEvents, "Results"):
                    self.connection.on(
                        LiveTranscriptionEvents.Results, self._on_results
                    )
                else:
                    raise Exception(
                        f"Could not find transcript event. Available: {available_events}"
                    )

            self.connection.on(LiveTranscriptionEvents.Error, self._on_error)
            self.connection.on(LiveTranscriptionEvents.Close, self._on_close)

            # Optional: Log all events for debugging
            try:
                if hasattr(self.connection, "on_any"):

                    def log_all_events(event, data):
                        # Log important events at INFO level
                        if event in ["Transcript", "Results", "Error", "Close"]:
                            logger.info(f"🔔 Deepgram event '{event}' received")
                        else:
                            logger.debug(f"Deepgram event {event}: {data}")

                    self.connection.on_any(log_all_events)
            except:
                pass  # on_any might not be available

            logger.info("All event handlers registered")

            # Start connection (must be after .on() calls)
            if not self.connection.start(options):
                raise Exception("Failed to start Deepgram connection")

            # Wait for connection to open
            for _ in range(50):  # Wait up to 5 seconds
                if self._is_connected:
                    break
                await asyncio.sleep(0.1)
            else:
                raise Exception("Deepgram connection did not open within timeout")

            # Start keepalive task
            self._start_keepalive()

            logger.info("Deepgram live transcription started successfully")
            return True

        except Exception as e:
            error_msg = str(e)
            self._last_error = error_msg
            logger.error(f"Error starting Deepgram transcription: {error_msg}")
            logger.exception(e)
            if self.on_error:
                await self._call_async_callback(self.on_error, e)
            return False

    def _start_keepalive(self):
        """Start sending KeepAlive messages every 5 seconds."""

        async def keepalive_loop():
            while self._is_connected and self.connection:
                try:
                    await asyncio.sleep(5)  # Send every 5 seconds
                    if self._is_connected and self.connection:
                        keepalive_msg = json.dumps({"type": "KeepAlive"})
                        self.connection.send(keepalive_msg)
                        logger.debug("Sent KeepAlive to Deepgram")
                except Exception as e:
                    logger.error(f"Error sending KeepAlive: {e}")
                    break

        if self._event_loop:
            self._keepalive_task = asyncio.create_task(keepalive_loop())

    def _on_open(self, *args, **kwargs):
        """Handle connection open event."""
        self._is_connected = True
        logger.info("Deepgram connection opened")

    def _on_results(self, *args, **kwargs):
        """Handle transcription results - called from Deepgram's thread."""
        try:
            # Log all arguments to understand the callback signature
            logger.info(f"🔔 Deepgram _on_results called with {len(args)} args")
            for i, arg in enumerate(args):
                arg_type = type(arg).__name__
                logger.info(f"  args[{i}]: type={arg_type}")
                # If it's not LiveClient or DeepgramClient, it might be the result
                if "LiveClient" not in arg_type and "DeepgramClient" not in arg_type:
                    logger.info(f"    -> This might be the result object!")

            # The first argument is often the connection (LiveClient)
            # The result is typically the second argument or in kwargs
            result = None

            # Try args[1] if it exists (result is usually second after connection)
            if len(args) > 1:
                result = args[1]
                logger.info(f"Using args[1] as result: type={type(result).__name__}")
            elif len(args) == 1:
                # Only one arg - check if it's actually the result (not connection)
                arg = args[0]
                arg_type_name = type(arg).__name__
                # If it's not LiveClient, it might be the result
                if "LiveClient" not in arg_type_name:
                    result = arg
                    logger.info(f"Using args[0] as result: type={arg_type_name}")
                else:
                    # It's the connection, try kwargs
                    result = (
                        kwargs.get("result")
                        or kwargs.get("data")
                        or kwargs.get("message")
                    )
                    if result:
                        logger.info(
                            f"Using kwargs result: type={type(result).__name__}"
                        )

            if not result:
                logger.warning(
                    f"⚠️ Could not find result object. Args count: {len(args)}, kwargs keys: {list(kwargs.keys())}"
                )
                # Try to inspect args[0] to see if result is nested
                if args:
                    first_arg = args[0]
                    logger.debug(f"First arg type: {type(first_arg).__name__}")
                    # Check if result is an attribute of the connection
                    if hasattr(first_arg, "result"):
                        result = first_arg.result
                        logger.info(
                            f"Found result in args[0].result: type={type(result).__name__}"
                        )
                    elif hasattr(first_arg, "data"):
                        result = first_arg.data
                        logger.info(
                            f"Found result in args[0].data: type={type(result).__name__}"
                        )

                if not result:
                    return

            # Log that we received a result (INFO level for visibility)
            logger.info(f"🔔 Deepgram result object: type={type(result).__name__}")

            # Log raw result for debugging
            logger.debug(f"Deepgram raw result type: {type(result)}")
            result_attrs = [x for x in dir(result) if not x.startswith("_")]
            logger.debug(f"Deepgram result attributes (first 20): {result_attrs[:20]}")

            # Extract transcript text from Deepgram result structure
            transcript_text = ""
            is_final = False

            # Try different result structures
            try:
                # Most common structure: result.channel.alternatives[0].transcript
                if hasattr(result, "channel"):
                    channels = result.channel
                    if channels:
                        if isinstance(channels, list) and len(channels) > 0:
                            channel = channels[0]
                        else:
                            channel = channels

                        if hasattr(channel, "alternatives") and channel.alternatives:
                            transcript_text = channel.alternatives[0].transcript
                            is_final = getattr(result, "is_final", False)
                            logger.debug(
                                f"Extracted from channel.alternatives: '{transcript_text}' (final: {is_final})"
                            )

                # Fallback: direct alternatives
                if (
                    not transcript_text
                    and hasattr(result, "alternatives")
                    and result.alternatives
                ):
                    transcript_text = result.alternatives[0].transcript
                    is_final = getattr(result, "is_final", False)
                    logger.debug(
                        f"Extracted from alternatives: '{transcript_text}' (final: {is_final})"
                    )

                # Fallback: sentence attribute
                if not transcript_text and hasattr(result, "sentence"):
                    transcript_text = result.sentence
                    is_final = getattr(result, "is_final", False)
                    logger.debug(
                        f"Extracted from sentence: '{transcript_text}' (final: {is_final})"
                    )

            except Exception as e:
                logger.error(f"Error extracting transcript from result: {e}")
                logger.exception(e)

            if transcript_text and self.on_transcript:
                logger.info(
                    f"📝 Transcript received: '{transcript_text}' (final: {is_final})"
                )
                # Schedule async callback in event loop (thread-safe)
                if self._event_loop and self._event_loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        self._call_async_callback(
                            self.on_transcript, transcript_text, is_final
                        ),
                        self._event_loop,
                    )
                else:
                    logger.warning("No event loop available for transcript callback")
            elif not transcript_text:
                logger.warning(
                    "⚠️ Deepgram result received but no transcript text found - result structure may have changed"
                )
                # Log the result structure for debugging
                try:
                    if hasattr(result, "__dict__"):
                        logger.debug(f"Result __dict__: {result.__dict__}")
                    # Try to log as string representation
                    logger.debug(f"Result string: {str(result)[:200]}")
                except:
                    pass

        except Exception as e:
            logger.error(f"Error processing transcription result: {e}")
            logger.exception(e)
            if self.on_error and self._event_loop:
                asyncio.run_coroutine_threadsafe(
                    self._call_async_callback(self.on_error, e), self._event_loop
                )

    async def _call_async_callback(self, callback: Callable, *args):
        """Helper to call async callbacks."""
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(*args)
            else:
                callback(*args)
        except Exception as e:
            logger.error(f"Error in callback: {e}")
            logger.exception(e)

    def _on_error(self, *args, **kwargs):
        """Handle connection errors - called from Deepgram's thread."""
        error = args[0] if args else kwargs.get("error", Exception("Unknown error"))
        self._is_connected = False
        error_msg = str(error) if error else "Unknown error"
        self._last_error = error_msg
        logger.error(f"Deepgram connection error: {error_msg}")

        if self.on_error and self._event_loop:
            asyncio.run_coroutine_threadsafe(
                self._call_async_callback(self.on_error, error), self._event_loop
            )
    
    def get_last_error(self) -> Optional[str]:
        """Get the last error message."""
        return self._last_error

    def _on_close(self, *args, **kwargs):
        """Handle connection close event."""
        self._is_connected = False
        logger.info("Deepgram connection closed")
        # Stop keepalive
        if self._keepalive_task:
            self._keepalive_task.cancel()

    async def send_audio(self, audio_data: bytes):
        """Send audio data to Deepgram."""
        if not self.connection:
            logger.warning("Cannot send audio: No Deepgram connection")
            return False

        if not self._is_connected:
            logger.warning("Cannot send audio: Deepgram not connected")
            return False

        if not audio_data or len(audio_data) == 0:
            logger.warning("Cannot send empty audio data")
            return False

        try:
            self.connection.send(audio_data)
            # Log periodically (every 100 sends) to avoid spam
            if not hasattr(self, "_send_count"):
                self._send_count = 0
            self._send_count += 1
            if self._send_count % 100 == 0:
                logger.info(
                    f"📤 Sent {self._send_count} audio chunks to Deepgram (last: {len(audio_data)} bytes)"
                )
            else:
                logger.debug(f"Sent {len(audio_data)} bytes to Deepgram")
            return True
        except Exception as e:
            logger.error(f"Error sending audio to Deepgram: {e}")
            logger.exception(e)
            self._is_connected = False
            if self.on_error:
                await self._call_async_callback(self.on_error, e)
            return False

    async def finish(self):
        """Finish and close the connection."""
        if self._keepalive_task:
            self._keepalive_task.cancel()
            try:
                await self._keepalive_task
            except asyncio.CancelledError:
                pass

        if self.connection:
            try:
                self.connection.finish()
                self._is_connected = False
                logger.info("Deepgram connection finished")
            except Exception as e:
                logger.error(f"Error finishing Deepgram connection: {e}")

    async def close(self):
        """Close the connection."""
        await self.finish()
