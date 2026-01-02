import React, { useState } from "react";

export function TranscriptionDisplay({ transcript, onInsert, onClear }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!transcript) return;

    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleInsert = () => {
    if (onInsert && transcript) {
      onInsert(transcript);
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
      <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl shadow-2xl border border-amber-800/30 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-amber-800/30">
          <h2 className="text-xl font-semibold text-gray-200">
            Transcription
          </h2>
          <div className="flex gap-2">
            {transcript && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white rounded-lg transition-all duration-200 shadow-lg shadow-amber-700/30 hover:shadow-amber-700/50 transform hover:scale-105 active:scale-95 font-medium"
                >
                  {copied ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-lg transition-all duration-200 shadow-lg shadow-gray-700/30 hover:shadow-gray-700/50 transform hover:scale-105 active:scale-95 font-medium"
                  title="Clear transcription"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Clear</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-black/50 rounded-xl p-6 min-h-[200px] border border-amber-800/20">
            {transcript ? (
              <p className="text-gray-200 whitespace-pre-wrap break-words leading-relaxed text-base">
                {transcript}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-500">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-gray-400 italic text-lg">
                  Your transcription will appear here...
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Start recording to see transcribed text
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

