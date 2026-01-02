import React, { useState, useRef } from "react";
import { VoiceRecorder } from "./components/VoiceRecorder";
import { TranscriptionDisplay } from "./components/TranscriptionDisplay";

function App() {
  console.log("=== App Component Rendered ===");
  
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const voiceRecorderRef = useRef(null);

  const handleTranscriptUpdate = (newTranscript) => {
    setTranscript(newTranscript);
  };

  const handleClearTranscript = () => {
    // Clear transcript in VoiceRecorder hook
    if (voiceRecorderRef.current && voiceRecorderRef.current.clearTranscript) {
      voiceRecorderRef.current.clearTranscript();
    }
    // Clear local state
    setTranscript("");
  };

  const handleStartRecording = async () => {
    console.log("[App] Start recording requested");
    setError(null);
    if (voiceRecorderRef.current && voiceRecorderRef.current.startRecording) {
      try {
        await voiceRecorderRef.current.startRecording();
        setIsRecording(true);
      } catch (err) {
        console.error("[App] Error starting recording:", err);
        setError("Failed to start recording: " + (err.message || "Unknown error"));
      }
    } else {
      console.error("[App] VoiceRecorder ref not available");
      setError("Recording component not ready");
    }
  };

  const handleStopRecording = () => {
    console.log("[App] Stop recording requested");
    if (voiceRecorderRef.current && voiceRecorderRef.current.stopRecording) {
      voiceRecorderRef.current.stopRecording();
      setIsRecording(false);
    } else {
      console.error("[App] VoiceRecorder ref not available");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-80 bg-gray-900/80 backdrop-blur-sm border-r border-amber-800/30 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-amber-800/30">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent mb-1">
              EchoText
            </h1>
            <p className="text-gray-400 text-sm">Voice-to-Text Transcription</p>
          </div>

          {/* Controls Section */}
          <div className="flex-1 p-6 flex flex-col justify-center">
            <VoiceRecorder 
              ref={voiceRecorderRef}
              onTranscriptUpdate={handleTranscriptUpdate}
              onRecordingStateChange={(recording) => {
                setIsRecording(recording);
              }}
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              isRecording={isRecording}
              error={error}
            />
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-amber-800/30">
            <p className="text-gray-400 text-xs text-center">
              Press Spacebar or hold the button to record
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="bg-gray-900/50 backdrop-blur-sm border-b border-amber-800/30 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-200">Transcription</h2>
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-400 text-sm font-medium">Recording...</span>
                </div>
              )}
            </div>
          </div>

          {/* Transcription Display */}
          <div className="flex-1 overflow-auto p-6">
            <TranscriptionDisplay
              transcript={transcript}
              onInsert={(text) => {
                console.log("Insert text:", text);
                navigator.clipboard.writeText(text).catch(console.error);
              }}
              onClear={handleClearTranscript}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

