/**
 * API service for managing WebSocket connections and API calls
 */

const DEFAULT_BACKEND_URL = "http://localhost:8000";

class TranscriptionWebSocket {
  constructor(url = `${DEFAULT_BACKEND_URL.replace('http', 'ws')}/ws/transcribe`) {
    this.url = url;
    this.ws = null;
    this.onMessage = null;
    this.onError = null;
    this.onClose = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (this.onMessage) {
              this.onMessage(data);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            if (this.onError) {
              this.onError(new Error("Failed to parse message"));
            }
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          const errorMessage = new Error(
            "Failed to connect to backend server. Please ensure the backend is running on http://localhost:8000"
          );
          if (this.onError) {
            this.onError(errorMessage);
          }
          reject(errorMessage);
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed", event.code, event.reason);
          if (this.onClose) {
            this.onClose();
          }
          // Only attempt to reconnect if it wasn't a normal closure and we haven't exceeded max attempts
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
              this.connect().catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            if (this.onError) {
              this.onError(new Error("Failed to connect after multiple attempts. Please check if the backend server is running."));
            }
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    console.warn("WebSocket is not open");
    return false;
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Health check function
 */
export async function checkBackendHealth(backendUrl = DEFAULT_BACKEND_URL) {
  try {
    const response = await fetch(`${backendUrl}/health`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
    return { success: false, error: "Health check failed" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new WebSocket connection for transcription
 */
export function createTranscriptionWebSocket(backendUrl = DEFAULT_BACKEND_URL) {
  const wsUrl = backendUrl.replace(/^http/, "ws") + "/ws/transcribe";
  return new TranscriptionWebSocket(wsUrl);
}

export default {
  checkBackendHealth,
  createTranscriptionWebSocket,
};

