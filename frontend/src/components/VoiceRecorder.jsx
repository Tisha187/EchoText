import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useTranscription } from "../hooks/useTranscription";

export const VoiceRecorder = forwardRef(function VoiceRecorder({ onTranscriptUpdate, onRecordingStateChange }, ref) {
  console.log("=== VoiceRecorder Component Mounted ===");
  
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Initialize hooks
  const audioCapture = useAudioCapture({
    sampleRate: 16000,
    channels: 1,
    onAudioData: (audioData) => {
      // Send audio data to transcription service
      transcription.sendAudio(audioData);
    },
  });

  const transcription = useTranscription({
    backendUrl: "http://localhost:8000",
  });

  // Connect to transcription service when component mounts
  useEffect(() => {
    console.log("=== VoiceRecorder useEffect: Connecting to transcription ===");
    
    // First check if backend is available
    const checkBackend = async () => {
      try {
        const response = await fetch("http://localhost:8000/health");
        if (!response.ok) {
          throw new Error("Backend health check failed");
        }
        console.log("Backend is available, connecting to transcription...");
        await transcription.connect();
      } catch (err) {
        console.error("Backend check failed:", err);
        setConnectionError("Backend server is not running. Please start the backend server on http://localhost:8000");
      }
    };
    
    checkBackend().catch((err) => {
      console.error("Failed to connect to transcription:", err);
      setConnectionError("Failed to connect to transcription service. Make sure the backend server is running on http://localhost:8000");
    });
  }, [transcription]);

  // Handle push-to-talk button press
  const handlePushToTalkStart = useCallback(async () => {
    console.log("[VoiceRecorder] Push-to-talk started");
    setIsPushToTalk(true);
    setConnectionError(null);

    // Ensure transcription is connected first
    if (!transcription.isConnected) {
      console.log("[VoiceRecorder] Connecting to transcription service...");
      const connected = await transcription.connect();
      if (!connected) {
        console.error("[VoiceRecorder] Failed to connect to transcription service");
        setConnectionError("Failed to connect to transcription service");
        setIsPushToTalk(false);
        return;
      }
      console.log("[VoiceRecorder] Connected to transcription service");
    }

    // Start audio capture
    console.log("[VoiceRecorder] Starting audio capture...");
    const result = await audioCapture.start();
    if (!result || !result.success) {
      console.error("[VoiceRecorder] Failed to start audio capture");
      setIsPushToTalk(false);
      return;
    }
    console.log("[VoiceRecorder] Audio capture started successfully");

    setIsRecording(true);
    console.log("[VoiceRecorder] Recording active");
    
    // Notify parent component of recording state change
    if (onRecordingStateChange) {
      onRecordingStateChange(true);
    }
  }, [audioCapture, transcription, onRecordingStateChange]);

  // Handle push-to-talk button release
  const handlePushToTalkStop = useCallback(() => {
    console.log("[VoiceRecorder] Push-to-talk stopped");
    setIsPushToTalk(false);
    setIsRecording(false);

    // Notify parent component of recording state change
    if (onRecordingStateChange) {
      onRecordingStateChange(false);
    }

    // Stop audio capture (this will trigger audio file save)
    console.log("[VoiceRecorder] Stopping audio capture...");
    if (audioCapture.stop) {
      audioCapture.stop();
      console.log("[VoiceRecorder] Recording stopped, audio file should be saved");
    }
    
    // Keep transcription connected for next recording (don't disconnect)
  }, [audioCapture, onRecordingStateChange]);

  // Expose start and stop functions via ref
  useImperativeHandle(ref, () => ({
    startRecording: handlePushToTalkStart,
    stopRecording: handlePushToTalkStop,
    isRecording: isRecording,
  }), [handlePushToTalkStart, handlePushToTalkStop, isRecording]);

  // Update parent component with transcript
  useEffect(() => {
    if (onTranscriptUpdate && transcription.transcript) {
      onTranscriptUpdate(transcription.transcript);
    }
  }, [transcription.transcript, onTranscriptUpdate]);

  // Handle keyboard events for push-to-talk
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Spacebar for push-to-talk
      if (e.code === "Space" && !isPushToTalk && !e.repeat) {
        e.preventDefault();
        handlePushToTalkStart();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space" && isPushToTalk) {
        e.preventDefault();
        handlePushToTalkStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPushToTalk, handlePushToTalkStart, handlePushToTalkStop]);

  return (
    <div className="flex flex-col items-center gap-6">
      {connectionError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {connectionError}
        </div>
      )}

      {transcription.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-semibold">Transcription Error:</p>
          <p className="text-sm mt-1">{transcription.error}</p>
          <p className="text-xs mt-2 text-red-600">
            Troubleshooting: Check that the backend server is running and your Deepgram API key is configured correctly.
          </p>
        </div>
      )}

      {audioCapture.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {audioCapture.error}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <button
          onMouseDown={handlePushToTalkStart}
          onMouseUp={handlePushToTalkStop}
          onTouchStart={(e) => {
            e.preventDefault();
            handlePushToTalkStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePushToTalkStop();
          }}
          className={`
            w-32 h-32 rounded-full font-bold text-lg transition-all
            ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 scale-110 shadow-lg"
                : "bg-blue-500 hover:bg-blue-600"
            }
            text-white
            focus:outline-none focus:ring-4 focus:ring-blue-300
            active:scale-95
          `}
        >
          {isRecording ? "Recording..." : "Hold to Talk"}
        </button>

        <p className="text-sm text-gray-600">
          {isRecording
            ? "Release to stop recording"
            : "Hold the button or press Spacebar to record"}
        </p>

        {transcription.isConnecting && (
          <p className="text-sm text-blue-600">Connecting to transcription service...</p>
        )}

        {transcription.isConnected && !isRecording && (
          <p className="text-sm text-green-600">Ready to record</p>
        )}
      </div>
    </div>
  );
});

// Expose start and stop functions via ref
VoiceRecorder.displayName = "VoiceRecorder";

