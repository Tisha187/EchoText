# EchoText - Voice-to-Text Transcription App

A functional clone of Wispr Flow, built with Tauri, React, FastAPI, and Deepgram ASR. This application provides real-time voice-to-text transcription with push-to-talk functionality.

## Features

- **Push-to-Talk Voice Input**: Intuitive push-to-talk mechanism for voice recording
- **Microphone Access & Audio Capture**: High-quality audio capture with permission handling
- **Real-Time Transcription**: Stream audio to Deepgram and receive transcribed text with minimal latency
- **Display & Insert Text**: View transcribed text and insert it where needed
- **Recording Controls**: Clear start/stop recording controls with visual feedback
- **Error Handling**: Graceful handling of network issues, API errors, and permission denials
- **Voice Activity Detection**: Silero VAD (PyTorch) for accurate speech detection on the backend

## Architecture

- **Frontend**: Tauri + React (JavaScript/JSX)
- **Backend**: FastAPI with WebSocket support
- **ASR**: Deepgram real-time streaming API
- **VAD**: Silero VAD (PyTorch) - server-side voice activity detection

## Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Rust (for Tauri compilation) - **Required for desktop app**
- Deepgram API key


**Alternative:** If you just want to test the web version without Tauri, you can run `npm run dev` instead of `npm run tauri:dev`

## Setup

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create a `.env` file:

```bash
cp .env.example .env
```

5. Add your Deepgram API key to `.env`:

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
BACKEND_PORT=8000
```

6. Start the backend server:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. **Option A: Run as Desktop App (Tauri - requires Rust)**

   Install Tauri CLI (if not already installed):

   ```bash
   npm install -g @tauri-apps/cli
   ```

   Run the Tauri development server:

   ```bash
   npm run tauri:dev
   ```

4. **Option B: Run as Web App (for testing without Rust)**

   Run just the Vite dev server:

   ```bash
   npm run dev
   ```

   Then open http://localhost:1420 in your browser.

## Usage

1. Start the backend server (see Backend Setup)
2. Start the frontend application (see Frontend Setup)
3. Grant microphone permissions when prompted
4. Press and hold the "Hold to Talk" button or press the Spacebar to start recording
5. Speak into your microphone
6. Release the button or Spacebar to stop recording
7. View the transcribed text in the transcription display area

## Project Structure

```
EchoText/
├── frontend/              # Tauri + React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
│   ├── src-tauri/         # Tauri configuration
│   └── package.json
├── backend/               # FastAPI server
│   ├── app/
│   │   ├── main.py        # FastAPI application
│   │   ├── services/      # Deepgram service
│   │   └── routes/        # API routes
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

## Configuration

### Backend

- **DEEPGRAM_API_KEY**: Your Deepgram API key (required)
- **BACKEND_PORT**: Port for the FastAPI server (default: 8000)


## License

Educational/personal use.

