import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for capturing audio from microphone
 * @param {Object} options - Configuration options
 * @param {number} options.sampleRate - Audio sample rate (default: 16000)
 * @param {number} options.channels - Number of audio channels (default: 1)
 * @param {number} options.bitsPerSample - Bits per sample (default: 16)
 * @param {Function} options.onAudioData - Callback for audio data chunks
 * @returns {Object} Audio capture state and controls
 */
export function useAudioCapture(options = {}) {
  console.log("=== useAudioCapture Hook Initialized ===", options);
  
  const {
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16,
    onAudioData = null,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  const recordingActiveRef = useRef(false);
  const audioStatsRef = useRef({
    chunksProcessed: 0,
    totalBytes: 0,
    startTime: null,
    endTime: null,
  });

  // Update callback ref when it changes
  useEffect(() => {
    onAudioDataRef.current = onAudioData;
  }, [onAudioData]);

  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: sampleRate,
          channelCount: channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Permission granted
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setHasPermission(false);
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access."
          : err.message
      );
      return false;
    }
  }, [sampleRate, channels]);

  /**
   * Process audio data and send to callback
   */
  const processAudio = useCallback(
    (audioBuffer) => {
      if (!onAudioDataRef.current) {
        return;
      }

      try {
        // Convert AudioBuffer to PCM16 format
        const inputData = audioBuffer.getChannelData(0);
        const buffer = new ArrayBuffer(inputData.length * 2);
        const view = new DataView(buffer);

        // Calculate audio level for logging
        let sum = 0;
        let maxLevel = 0;
        for (let i = 0; i < inputData.length; i++) {
          const absValue = Math.abs(inputData[i]);
          sum += absValue;
          maxLevel = Math.max(maxLevel, absValue);
        }
        const avgLevel = sum / inputData.length;
        
        // Warn if audio seems silent
        if (avgLevel < 0.001 && audioStatsRef.current.chunksProcessed < 10) {
          console.warn(`[AudioCapture] Very low audio level detected: avg=${avgLevel.toFixed(6)}, max=${maxLevel.toFixed(6)}`);
        }

        for (let i = 0; i < inputData.length; i++) {
          // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
          const s = Math.max(-1, Math.min(1, inputData[i]));
          // Properly convert to int16: multiply by 32767 for positive, 32768 for negative
          const int16Value = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
          view.setInt16(i * 2, int16Value, true); // little-endian
        }

        const audioBytes = new Uint8Array(buffer);
        
        // Update statistics
        audioStatsRef.current.chunksProcessed++;
        audioStatsRef.current.totalBytes += audioBytes.length;

        // Log every 10th chunk to avoid spam (approximately every 0.2 seconds at 16kHz)
        if (audioStatsRef.current.chunksProcessed % 10 === 0) {
          console.log(
            `[AudioCapture] Chunk #${audioStatsRef.current.chunksProcessed}: ` +
            `${audioBytes.length} bytes, avg level: ${avgLevel.toFixed(4)}, ` +
            `total: ${audioStatsRef.current.totalBytes} bytes`
          );
        }

        // Send audio data to callback
        onAudioDataRef.current(audioBytes);
      } catch (err) {
        console.error("[AudioCapture] Error processing audio:", err);
      }
    },
    []
  );

  /**
   * Start audio capture
   */
  const start = useCallback(async () => {
    console.log("=== useAudioCapture.start() CALLED ===");
    console.log("Current state:", { hasPermission, isRecording: recordingActiveRef.current });
    
    try {
      // Request permission if not already granted
      if (hasPermission === null) {
        console.log("Requesting microphone permission...");
        const granted = await requestPermission();
        console.log("Permission granted:", granted);
        if (!granted) {
          console.error("Permission denied, cannot start recording");
          return false;
        }
      }

      // Get user media
      console.log("Requesting getUserMedia with config:", { sampleRate, channels });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: sampleRate,
          channelCount: channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("getUserMedia success! Stream:", stream);
      console.log("Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled, muted: t.muted })));
      streamRef.current = stream;

      // Initialize audio statistics
      audioStatsRef.current = {
        chunksProcessed: 0,
        totalBytes: 0,
        startTime: Date.now(),
        endTime: null,
      };

      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRate,
      });
      
      console.log(
        `[AudioCapture] Audio context created: sampleRate=${audioContextRef.current.sampleRate}, ` +
        `state=${audioContextRef.current.state}`
      );

      // Create script processor for real-time audio processing
      const bufferSize = 4096;
      processorRef.current = audioContextRef.current.createScriptProcessor(
        bufferSize,
        channels,
        channels
      );

      recordingActiveRef.current = true;
      processorRef.current.onaudioprocess = (event) => {
        if (recordingActiveRef.current) {
          const inputBuffer = event.inputBuffer;
          // Log first few chunks to verify it's working
          if (audioStatsRef.current.chunksProcessed < 3) {
            console.log(`[AudioCapture] onaudioprocess called! Chunk #${audioStatsRef.current.chunksProcessed + 1}, buffer length: ${inputBuffer.length}`);
          }
          processAudio(inputBuffer);
        } else {
          console.warn("[AudioCapture] onaudioprocess called but recordingActiveRef is false!");
        }
      };
      
      console.log("[AudioCapture] Script processor connected, recording started");

      // Create source from stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setIsRecording(true);
      setError(null);
      console.log("[AudioCapture] Audio capture started successfully");
      return { success: true, stream: streamRef.current };
    } catch (err) {
      console.error("Error starting audio capture:", err);
      setError(err.message);
      setIsRecording(false);
      return { success: false, error: err.message };
    }
  }, [hasPermission, requestPermission, sampleRate, channels, processAudio]);

  /**
   * Stop audio capture
   */
  const stop = useCallback(() => {
    console.log("[AudioCapture] Stopping audio capture...");
    recordingActiveRef.current = false;
    setIsRecording(false);
    audioStatsRef.current.endTime = Date.now();

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[AudioCapture] Stopped track: ${track.kind}, label: ${track.label}`);
      });
      streamRef.current = null;
    }

    // Disconnect audio nodes
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      sourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current
        .close()
        .then(() => {
          console.log("Audio context closed");
        })
        .catch((error) => {
          console.error("Error closing audio context:", error);
        });
      audioContextRef.current = null;
    }

    // Log final statistics
    const duration = audioStatsRef.current.endTime && audioStatsRef.current.startTime
      ? ((audioStatsRef.current.endTime - audioStatsRef.current.startTime) / 1000).toFixed(2)
      : "unknown";
    
    console.log(
      `[AudioCapture] Recording stopped. Stats: ` +
      `duration: ${duration}s, ` +
      `chunks processed: ${audioStatsRef.current.chunksProcessed}, ` +
      `total bytes: ${audioStatsRef.current.totalBytes}`
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isRecording,
    error,
    hasPermission,
    stream: streamRef.current,
    start,
    stop,
    requestPermission,
  };
}

