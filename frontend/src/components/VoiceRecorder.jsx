import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useTranscription } from "../hooks/useTranscription";

export const VoiceRecorder = forwardRef(function VoiceRecorder({ onTranscriptUpdate, onRecordingStateChange, onStart, onStop, isRecording: externalIsRecording, error: externalError }, ref) {
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
    clearTranscript: transcription.clearTranscript,
  }), [handlePushToTalkStart, handlePushToTalkStop, isRecording, transcription.clearTranscript]);

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

  const displayIsRecording = isRecording || externalIsRecording;
  const displayError = connectionError || transcription.error || audioCapture.error || externalError;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Error Messages */}
      {displayError && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg backdrop-blur-sm w-full">
          <p className="text-sm font-medium">{displayError}</p>
        </div>
      )}

      {/* Status Messages */}
      {transcription.isConnecting && (
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          <span>Connecting to transcription service...</span>
        </div>
      )}

      {transcription.isConnected && !displayIsRecording && (
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span>Ready to record</span>
        </div>
      )}

      {/* Main Recording Button */}
      <div className="flex flex-col items-center gap-6 w-full">
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
            w-40 h-40 rounded-full font-bold text-lg transition-all duration-300
            ${
              displayIsRecording
                ? "bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 scale-110 shadow-2xl shadow-red-500/50 ring-4 ring-red-500/30"
                : "bg-gradient-to-br from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 shadow-xl shadow-amber-700/30 hover:shadow-amber-700/50"
            }
            text-white
            focus:outline-none focus:ring-4 focus:ring-amber-600/50
            active:scale-95
            transform
          `}
        >
          {displayIsRecording ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 bg-white rounded-full animate-pulse"></div>
              <span>Recording</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              <span>Hold to Talk</span>
            </div>
          )}
        </button>

        <p className="text-gray-400 text-sm text-center">
          {displayIsRecording
            ? "Release to stop recording"
            : "Hold the button or press Spacebar to record"}
        </p>
      </div>

      {/* Start/Stop Buttons */}
      <div className="flex flex-col gap-3 w-full mt-4">
        <div className="h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent"></div>
        <div className="flex gap-3">
          <button
            onClick={onStart || handlePushToTalkStart}
            disabled={displayIsRecording}
            className={`
              flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200
              ${
                displayIsRecording
                  ? "bg-gray-800/50 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white shadow-lg shadow-amber-700/30 hover:shadow-amber-700/50 transform hover:scale-105 active:scale-95"
              }
            }
          `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start</span>
            </div>
          </button>

          <button
            onClick={onStop || handlePushToTalkStop}
            disabled={!displayIsRecording}
            className={`
              flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200
              ${
                !displayIsRecording
                  ? "bg-gray-800/50 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transform hover:scale-105 active:scale-95"
              }
            }
          `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
              </svg>
              <span>Stop</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
});

// Expose start and stop functions via ref
VoiceRecorder.displayName = "VoiceRecorder";

