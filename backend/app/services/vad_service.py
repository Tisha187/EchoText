import time
import collections
import logging
import numpy as np

try:
    import torch
    import torch.hub
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logging.warning("PyTorch not available. VAD will be disabled.")

logger = logging.getLogger(__name__)

# =========================================================
# AUDIO CONSTANTS
# =========================================================
SAMPLE_RATE = 16000
FRAME_DURATION_MS = 32
FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000)
FRAME_BYTES = FRAME_SAMPLES * 2  # int16

# =========================================================
# NOISE-ROBUST TUNING
# =========================================================
RMS_NOISE_GATE = 0.01          # blocks fan/AC noise
STRONG_SPEECH_PROB = 0.85     # confident speech
WEAK_SPEECH_PROB = 0.50       # confident non-speech

# =========================================================
# DECISION WINDOW
# =========================================================
SPEECH_BUFFER_DURATION_MS = 480
SPEECH_BUFFER_FRAMES = SPEECH_BUFFER_DURATION_MS // FRAME_DURATION_MS

SPEECH_TRIGGER_RATIO = 0.90   # speech start
SPEECH_RELEASE_RATIO = 0.25   # speech end

# =========================================================
# UTTERANCE CONTROL
# =========================================================
MIN_UTTERANCE_DURATION_S = 1.2
MIN_UTTERANCE_SAMPLES = int(SAMPLE_RATE * MIN_UTTERANCE_DURATION_S)

PRE_SPEECH_MS = 400
PRE_SPEECH_FRAMES = PRE_SPEECH_MS // FRAME_DURATION_MS

TRAILING_SILENCE_MS = 700
TRAILING_SILENCE_FRAMES = TRAILING_SILENCE_MS // FRAME_DURATION_MS

# =========================================================
# STATE
# =========================================================
class VadState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.speech_buffer = bytearray()
        self.pre_speech_buffer = collections.deque(maxlen=PRE_SPEECH_FRAMES)
        self.vad_decision_buffer = collections.deque(maxlen=SPEECH_BUFFER_FRAMES)
        self.trailing_silence_buffer = collections.deque(maxlen=TRAILING_SILENCE_FRAMES)

        self.in_speech = False
        self.speech_start_time = None
        self.current_utterance_id = None
        self.partial_frame = bytearray()


class VadService:
    def __init__(self):
        self.model = None
        self.vad_model_loaded = False
        self.connections = {}
        
        if TORCH_AVAILABLE:
            self._load_model()
        else:
            logger.warning("PyTorch not available. VAD disabled.")

    def _load_model(self):
        """Load Silero VAD model."""
        try:
            logger.info("Loading Silero VAD model...")
            self.model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                trust_repo=True  # Required for Windows
            )
            self.model.eval()
            self.vad_model_loaded = True
            logger.info("✅ Silero VAD loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load Silero VAD: {e}")
            logger.exception(e)
            self.vad_model_loaded = False
            self.model = None

    def get_state(self, connection_id: str) -> VadState:
        """Get or create VAD state for a connection."""
        if connection_id not in self.connections:
            self.connections[connection_id] = VadState()
        return self.connections[connection_id]

    def cleanup_connection(self, connection_id: str):
        """Clean up VAD state for a disconnected client."""
        if connection_id in self.connections:
            del self.connections[connection_id]
            logger.info(f"🧹 VAD state cleaned for connection: {connection_id}")

    async def process_audio_chunk(
        self,
        connection_id: str,
        audio_bytes: bytes,
        on_utterance_detected
    ):
        """
        Process audio chunk through VAD.
        
        Args:
            connection_id: Unique connection identifier
            audio_bytes: Raw PCM16 audio bytes
            on_utterance_detected: Callback(utterance_bytes) when speech detected
        """
        if not self.vad_model_loaded:
            # If VAD not available, pass through all audio
            if on_utterance_detected:
                await on_utterance_detected(audio_bytes)
            return

        state = self.get_state(connection_id)

        # Combine with any partial frame from previous chunk
        if state.partial_frame:
            audio_bytes = bytes(state.partial_frame) + audio_bytes
            state.partial_frame = bytearray()

        # Process audio in frames (FRAME_BYTES each)
        offset = 0
        while offset < len(audio_bytes):
            remaining = len(audio_bytes) - offset
            if remaining >= FRAME_BYTES:
                # Process complete frame
                frame_bytes = audio_bytes[offset:offset + FRAME_BYTES]
                await self._process_frame(state, frame_bytes, on_utterance_detected)
                offset += FRAME_BYTES
            else:
                # Store partial frame for next chunk
                state.partial_frame.extend(audio_bytes[offset:])
                break

    async def _process_frame(
        self,
        state: VadState,
        frame_bytes: bytes,
        on_utterance_detected
    ):
        """Process a single audio frame."""
        if len(frame_bytes) != FRAME_BYTES:
            logger.warning(f"Unexpected frame size {len(frame_bytes)}, expected {FRAME_BYTES}")
            return

        # Convert PCM → float
        audio_np = np.frombuffer(frame_bytes, dtype=np.int16).astype(np.float32)
        audio_f32 = audio_np / 32768.0

        # RMS Noise Gate
        rms = np.sqrt(np.mean(audio_f32 ** 2))
        if rms < RMS_NOISE_GATE:
            speech_prob = 0.0
        else:
            with torch.no_grad():
                speech_prob = self.model(
                    torch.from_numpy(audio_f32),
                    SAMPLE_RATE
                ).item()

        # Probability-weighted decision
        if speech_prob > STRONG_SPEECH_PROB:
            is_speech = True
        elif speech_prob < WEAK_SPEECH_PROB:
            is_speech = False
        else:
            is_speech = False  # treat uncertain as noise

        # Update rolling decision buffer
        state.vad_decision_buffer.append(is_speech)
        speech_frames = state.vad_decision_buffer.count(True)
        total_frames = len(state.vad_decision_buffer)
        speech_ratio = speech_frames / total_frames if total_frames else 0.0

        # Always collect pre-speech audio
        state.pre_speech_buffer.append(frame_bytes)

        # STATE MACHINE
        # ---------------- SPEECH START ----------------
        if not state.in_speech:
            if (
                speech_ratio >= SPEECH_TRIGGER_RATIO and
                speech_frames >= int(0.6 * total_frames)
            ):
                state.in_speech = True
                state.speech_start_time = time.time()
                state.current_utterance_id = f"utt_{int(time.time() * 1000)}"

                logger.info("🎙️ >>> Speech started")

                # Prepend pre-speech
                for f in state.pre_speech_buffer:
                    state.speech_buffer.extend(f)

                state.speech_buffer.extend(frame_bytes)
                state.trailing_silence_buffer.clear()

        # ---------------- SPEECH CONTINUE ----------------
        else:
            state.speech_buffer.extend(frame_bytes)

            if speech_ratio < SPEECH_RELEASE_RATIO:
                state.trailing_silence_buffer.append(frame_bytes)

                if len(state.trailing_silence_buffer) == state.trailing_silence_buffer.maxlen:
                    logger.info("🛑 <<< Speech ended (silence)")

                    # MIN_UTTERANCE_SAMPLES is in samples, convert to bytes (2 bytes per sample)
                    min_utterance_bytes = MIN_UTTERANCE_SAMPLES * 2
                    if len(state.speech_buffer) >= min_utterance_bytes:
                        logger.info(
                            f"📤 Sending utterance to ASR "
                            f"({len(state.speech_buffer)} bytes)"
                        )

                        if on_utterance_detected:
                            await on_utterance_detected(bytes(state.speech_buffer))
                    else:
                        logger.warning("🗑️ Utterance too short, discarded")

                    state.reset()
            else:
                state.trailing_silence_buffer.clear()


# Global VAD service instance
vad_service: VadService = None


def get_vad_service() -> VadService:
    """Get the global VAD service instance."""
    return vad_service


def initialize_vad_service():
    """Initialize the global VAD service."""
    global vad_service
    vad_service = VadService()
    return vad_service
