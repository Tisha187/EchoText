import React, { useState, useRef } from "react";
import { VoiceRecorder } from "./components/VoiceRecorder";
import { TranscriptionDisplay } from "./components/TranscriptionDisplay";
import { Controls } from "./components/Controls";

function App() {
  console.log("=== App Component Rendered ===");
  
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const voiceRecorderRef = useRef(null);

  const handleTranscriptUpdate = (newTranscript) => {
    setTranscript(newTranscript);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">EchoText</h1>
          <p className="text-gray-600">Voice-to-Text Transcription</p>
        </header>

        <main className="space-y-8">
          {/* Voice Recorder Component */}
          <section className="bg-white rounded-lg shadow-lg p-8">
            <VoiceRecorder 
              ref={voiceRecorderRef}
              onTranscriptUpdate={handleTranscriptUpdate}
              onRecordingStateChange={(recording) => {
                setIsRecording(recording);
              }}
            />
          </section>

          {/* Transcription Display */}
          <section>
            <TranscriptionDisplay
              transcript={transcript}
              onInsert={(text) => {
                // Handle text insertion (can be extended for clipboard or other actions)
                console.log("Insert text:", text);
                navigator.clipboard.writeText(text).catch(console.error);
              }}
            />
          </section>

          {/* Controls (optional, for manual start/stop) */}
          <section className="bg-white rounded-lg shadow-lg p-6">
            <Controls
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              isRecording={isRecording}
              error={error}
            />
          </section>
        </main>

        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Press and hold the button or Spacebar to record</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

