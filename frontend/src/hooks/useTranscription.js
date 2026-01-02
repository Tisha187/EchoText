import { useState, useEffect, useRef, useCallback } from "react";
import { createTranscriptionWebSocket } from "../services/api";

/**
 * Custom hook for managing transcription via WebSocket
 * @param {Object} options - Configuration options
 * @param {string} options.backendUrl - Backend URL (default: http://localhost:8000)
 * @returns {Object} Transcription state and controls
 */
export function useTranscription(options = {}) {
  const { backendUrl = "http://localhost:8000" } = options;

  const [transcript, setTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef(null);
  const transcriptBufferRef = useRef("");

  /**
   * Handle WebSocket messages
   */
  const handleMessage = useCallback((data) => {
    console.log("[Transcription] 📨 WebSocket message received:", data.type, data);
    switch (data.type) {
      case "connected":
        console.log("Transcription service connected:", data.message);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        break;

      case "transcript":
        console.log("[Transcription] 📝 Transcript received:", {
          text: data.text,
          is_final: data.is_final,
          textLength: data.text?.length || 0
        });
        if (data.text) {
          if (data.is_final) {
            // Final transcript - append to buffer and update state
            const newText = transcriptBufferRef.current
              ? `${transcriptBufferRef.current} ${data.text}`
              : data.text;
            transcriptBufferRef.current = newText;
            setTranscript(newText);
            console.log("[Transcription] ✅ Final transcript updated:", newText);
          } else {
            // Interim result - show but don't add to buffer yet
            const displayText = transcriptBufferRef.current
              ? `${transcriptBufferRef.current} ${data.text}`
              : data.text;
            setTranscript(displayText);
            console.log("[Transcription] 🔄 Interim transcript updated:", displayText);
          }
        } else {
          console.warn("[Transcription] ⚠️ Transcript message received but text is empty");
        }
        break;

      case "error":
        console.error("Transcription error:", data.message);
        setError(data.message);
        setIsConnected(false);
        break;

      default:
        console.warn("Unknown message type:", data.type);
    }
  }, []);

  /**
   * Handle WebSocket errors
   */
  const handleError = useCallback((err) => {
    console.error("WebSocket error:", err);
    setError(err.message || "Connection error");
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Handle WebSocket close
   */
  const handleClose = useCallback(() => {
    console.log("WebSocket closed");
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Connect to transcription service
   */
  const connect = useCallback(async () => {
    if (wsRef.current && wsRef.current.isConnected()) {
      console.log("Already connected");
      return true;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const ws = createTranscriptionWebSocket(backendUrl);
      ws.onMessage = handleMessage;
      ws.onError = handleError;
      ws.onClose = handleClose;

      await ws.connect();
      wsRef.current = ws;

      return true;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError(err.message || "Failed to connect to transcription service");
      setIsConnecting(false);
      return false;
    }
  }, [backendUrl, handleMessage, handleError, handleClose]);

  /**
   * Disconnect from transcription service
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Send audio data to transcription service
   */
  const sendAudio = useCallback(
    (audioData) => {
      if (wsRef.current && wsRef.current.isConnected()) {
        return wsRef.current.send(audioData);
      }
      return false;
    },
    []
  );

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript("");
    transcriptBufferRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    transcript,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendAudio,
    clearTranscript,
  };
}

