import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for Voice Activity Detection using Web Audio API
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - RMS threshold for speech detection (default: 0.01)
 * @param {number} options.smoothingTimeConstant - Smoothing constant for analyzer (default: 0.8)
 * @param {number} options.fftSize - FFT size for frequency analysis (default: 2048)
 * @param {number} options.debounceMs - Debounce time in milliseconds (default: 100)
 * @returns {Object} VAD state and controls
 */
export function useVAD(options = {}) {
  const {
    threshold = 0.01,
    smoothingTimeConstant = 0.8,
    fftSize = 2048,
    debounceMs = 100,
  } = options;

  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isActiveRef = useRef(false);

  /**
   * Calculate RMS (Root Mean Square) from audio data
   */
  const calculateRMS = useCallback((dataArray) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 128.0 - 1.0;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }, []);

  /**
   * Analyze audio and detect speech
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isActiveRef.current) {
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    const rms = calculateRMS(dataArray);
    setAudioLevel(rms);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce speech detection
    debounceTimerRef.current = setTimeout(() => {
      const detected = rms > threshold;
      setIsSpeechDetected(detected);
    }, debounceMs);

    // Continue analyzing
    if (isActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [threshold, debounceMs, calculateRMS]);

  /**
   * Start VAD with a MediaStream
   */
  const start = useCallback(
    async (stream) => {
      if (!stream) {
        console.error("No stream provided to VAD");
        return false;
      }

      try {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });

        // Create analyser node
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = fftSize;
        analyserRef.current.smoothingTimeConstant = smoothingTimeConstant;

        // Create source from stream
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);

        // Start analysis
        isActiveRef.current = true;
        analyzeAudio();

        return true;
      } catch (error) {
        console.error("Error starting VAD:", error);
        return false;
      }
    },
    [fftSize, smoothingTimeConstant, analyzeAudio]
  );

  /**
   * Stop VAD
   */
  const stop = useCallback(() => {
    isActiveRef.current = false;

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Disconnect audio nodes
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

    analyserRef.current = null;
    setIsSpeechDetected(false);
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeechDetected,
    audioLevel,
    start,
    stop,
  };
}

