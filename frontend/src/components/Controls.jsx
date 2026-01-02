import React from "react";

export function Controls({ onStart, onStop, isRecording, error }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onStart}
          disabled={isRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isRecording
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 text-white"
          }`}
        >
          Start Recording
        </button>

        <button
          onClick={onStop}
          disabled={!isRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            !isRecording
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          Stop Recording
        </button>
      </div>
    </div>
  );
}

