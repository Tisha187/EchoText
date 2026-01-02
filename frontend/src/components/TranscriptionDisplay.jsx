import React, { useState } from "react";

export function TranscriptionDisplay({ transcript, onInsert }) {
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

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 min-h-[300px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Transcription
          </h2>
          <div className="flex gap-2">
            {transcript && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                {/* {onInsert && (
                  <button
                    onClick={handleInsert}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                  >
                    Insert
                  </button>
                )} */}
              </>
            )}
          </div>
        </div>

        <div className="border border-gray-300 rounded p-4 min-h-[200px] bg-gray-50">
          {transcript ? (
            <p className="text-gray-800 whitespace-pre-wrap break-words">
              {transcript}
            </p>
          ) : (
            <p className="text-gray-400 italic">
              Your transcription will appear here...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

