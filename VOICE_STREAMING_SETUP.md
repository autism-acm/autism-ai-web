# Real-Time Voice Streaming Guide

## Overview

AUtism GOLD features **zero-latency voice conversations** powered by:
- **ElevenLabs WebSocket TTS** - Converts AI responses to speech in real-time
- **Gemini Audio Understanding** - Processes user speech instantly
- **Personality-Based Voice Routing** - Each AI character can have different voice settings

## Architecture

### Voice Streaming Flow

```
User speaks → Browser captures audio
                ↓
    WebSocket: wss://your-app/api/voice-stream
                ↓
    Server establishes two connections:
        1. ElevenLabs WebSocket (TTS output)
        2. Gemini Live API (Audio understanding)
                ↓
    User speech → Gemini processes → Text response
                ↓
    Text → ElevenLabs → Audio chunks → Browser
                ↓
    User hears response immediately
```

### Key Features

- **Bidirectional streaming** - Both input and output happen simultaneously
- **No buffering delays** - Audio chunks stream as they're generated
- **Secure audio caching** - All conversations stored with secure tokens
- **Personality-aware** - Different voice settings per AI character
- **Admin access** - All audio files accessible via admin panel

## WebSocket Endpoint

### Connection URL

```javascript
const ws = new WebSocket(
  `wss://your-app.replit.dev/api/voice-stream?sessionId=${sessionId}&conversationId=${conversationId}&personality=${personality}`
);
```

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | User's session ID from `/api/session` |
| `conversationId` | string | Current conversation ID |
| `personality` | string | "AUtistic AI", "Level 1 ASD", or "Savantist" |

## Client-Side Implementation

### 1. Establish WebSocket Connection

```javascript
let voiceWs = null;

function startVoiceConversation(sessionId, conversationId, personality) {
  const wsUrl = `wss://${window.location.host}/api/voice-stream?sessionId=${sessionId}&conversationId=${conversationId}&personality=${encodeURIComponent(personality)}`;
  
  voiceWs = new WebSocket(wsUrl);
  
  voiceWs.onopen = () => {
    console.log('Voice streaming connected');
  };
  
  voiceWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleVoiceMessage(data);
  };
  
  voiceWs.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  voiceWs.onclose = () => {
    console.log('Voice streaming disconnected');
  };
}
```

### 2. Capture User Audio

```javascript
let mediaRecorder = null;
let audioChunks = [];

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000
    } 
  });
  
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
      
      // Convert to base64 and send to server
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];
        voiceWs.send(JSON.stringify({
          type: 'audio_input',
          audio: base64Audio
        }));
      };
      reader.readAsDataURL(event.data);
    }
  };
  
  // Send audio chunks every 250ms for real-time processing
  mediaRecorder.start(250);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    voiceWs.send(JSON.stringify({
      type: 'stop'
    }));
  }
}
```

### 3. Handle Voice Responses

```javascript
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioQueue = [];
let isPlaying = false;

function handleVoiceMessage(data) {
  switch(data.type) {
    case 'voice_ready':
      console.log('Voice system ready');
      break;
      
    case 'audio_output':
      // Receive audio chunks from ElevenLabs
      const audioData = data.audio; // base64 encoded
      queueAudioPlayback(audioData);
      break;
      
    case 'audio_processing':
      // Show visual feedback that AI is processing speech
      showProcessingIndicator();
      break;
      
    case 'error':
      console.error('Voice error:', data.message);
      showError(data.message);
      break;
  }
}

async function queueAudioPlayback(base64Audio) {
  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Decode audio
  const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
  audioQueue.push(audioBuffer);
  
  if (!isPlaying) {
    playNextAudio();
  }
}

function playNextAudio() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }
  
  isPlaying = true;
  const audioBuffer = audioQueue.shift();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  
  source.onended = () => {
    playNextAudio();
  };
  
  source.start(0);
}
```

### 4. Send Text for TTS (Optional)

```javascript
// For sending text that should be spoken by the AI
function speakText(text) {
  voiceWs.send(JSON.stringify({
    type: 'text_input',
    text: text
  }));
}
```

## Server-Side Configuration

### ElevenLabs Voice Settings

Each personality can have different voice characteristics. Configure in `server/services/voiceStreaming.ts`:

```typescript
const voiceSettings = {
  'AUtistic AI': {
    voiceId: process.env.ELEVENLABS_VOICE_ID_AUTISTIC || 'default',
    stability: 0.5,
    similarity_boost: 0.8,
    speed: 1.1, // Faster, more energetic
  },
  'Level 1 ASD': {
    voiceId: process.env.ELEVENLABS_VOICE_ID_LEVEL1 || 'default',
    stability: 0.7,
    similarity_boost: 0.9,
    speed: 0.95, // Slower, more measured
  },
  'Savantist': {
    voiceId: process.env.ELEVENLABS_VOICE_ID_SAVANTIST || 'default',
    stability: 0.8,
    similarity_boost: 0.85,
    speed: 1.0, // Normal, professional
  }
};
```

### Audio Caching

All voice conversations are automatically cached:

```typescript
// Cached to database with:
{
  sessionId: 'user-session-id',
  conversationId: 'conversation-id',
  audioUrl: '/api/audio/secure-token',
  secureToken: 'unique-secure-token',
  text: 'Text that was spoken',
  voiceSettings: { provider: 'elevenlabs', model: 'eleven_turbo_v2_5' },
  createdAt: timestamp
}
```

### Accessing Cached Audio (Admin)

```javascript
// Get all audio for a session
const audioFiles = await fetch('/api/admin/audio?sessionId=xyz', {
  credentials: 'include'
});

// Get all audio for a conversation
const conversationAudio = await fetch('/api/admin/audio?conversationId=xyz', {
  credentials: 'include'
});

// Response format:
[
  {
    id: 'uuid',
    audioUrl: '/api/audio/secure-token-123',
    secureToken: 'secure-token-123',
    text: 'What was said',
    duration: 5, // seconds
    createdAt: '2025-11-18T...',
  }
]
```

## Environment Variables

Set these in Replit Secrets:

```bash
# Required
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=default_voice_id

# Optional - Different voices per personality
ELEVENLABS_VOICE_ID_AUTISTIC=voice_id_1
ELEVENLABS_VOICE_ID_LEVEL1=voice_id_2
ELEVENLABS_VOICE_ID_SAVANTIST=voice_id_3

# Gemini for audio understanding
GEMINI_API_KEY=your_gemini_api_key
```

## Rate Limiting

Voice conversations count against the voice rate limit:

```javascript
// Check limits before starting voice
const session = await fetch('/api/session');
const { voiceLimit } = await session.json();

if (voiceLimit.remaining <= 0) {
  // Show upgrade prompt
  showUpgradeModal();
} else {
  // Start voice conversation
  startVoiceConversation();
}
```

### Voice Limits by Tier

| Tier | Voice Minutes per Day |
|------|----------------------|
| Free Trial | 1 minute / 4 hours |
| Electrum (100k $AU) | 1 hour / day |
| Pro (200k $AU) | 2 hours / day |
| Gold (300k $AU) | 4 hours / day |

## Complete React Component Example

```tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

export function VoiceChat({ sessionId, conversationId, personality }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  const connectVoice = () => {
    const wsUrl = `wss://${window.location.host}/api/voice-stream?sessionId=${sessionId}&conversationId=${conversationId}&personality=${encodeURIComponent(personality)}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      setIsConnected(true);
      console.log('Voice connected');
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'audio_output') {
        playAudio(data.audio);
      }
    };
    
    wsRef.current.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
    };
  };
  
  const toggleRecording = async () => {
    if (!isConnected) {
      connectVoice();
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };
  
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true } 
    });
    
    mediaRecorderRef.current = new MediaRecorder(stream);
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        wsRef.current?.send(JSON.stringify({
          type: 'audio_input',
          audio: base64
        }));
      };
      reader.readAsDataURL(event.data);
    };
    
    mediaRecorderRef.current.start(250);
    setIsRecording(true);
  };
  
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    wsRef.current?.send(JSON.stringify({ type: 'stop' }));
    setIsRecording(false);
  };
  
  const playAudio = async (base64Audio: string) => {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const audioBuffer = await audioContextRef.current!.decodeAudioData(bytes.buffer);
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current!.destination);
    source.start(0);
  };
  
  return (
    <Button
      onClick={toggleRecording}
      variant={isRecording ? 'destructive' : 'default'}
      size="icon"
    >
      {isRecording ? <MicOff /> : <Mic />}
    </Button>
  );
}
```

## Troubleshooting

### Connection Issues

**Problem**: WebSocket won't connect  
**Solution**: Check that `sessionId` and `conversationId` are valid

**Problem**: No audio output  
**Solution**: Verify `ELEVENLABS_API_KEY` is set correctly

**Problem**: Audio is choppy  
**Solution**: Reduce `mediaRecorder.start()` interval (currently 250ms)

### Browser Compatibility

- **Chrome/Edge**: Full support ✅
- **Firefox**: Full support ✅
- **Safari**: Partial support (requires user gesture for AudioContext)
- **Mobile**: Works on iOS 14.5+ and Android 9+

### Rate Limit Handling

Always check voice limits before starting:

```javascript
const canUseVoice = voiceLimit.remaining > 0;
if (!canUseVoice) {
  // Show upgrade modal or error
}
```

## Production Deployment

When deploying to production:

1. Use WSS (secure WebSocket) - Replit handles this automatically
2. Set proper CORS headers if needed
3. Monitor ElevenLabs API usage and costs
4. Implement proper error handling for disconnections
5. Add reconnection logic for dropped connections

## N8N Integration with Voice

Voice requests also trigger N8N webhooks with `modality: "VOICE"`:

```json
{
  "personality": "AUtistic AI",
  "modality": "VOICE",
  "content": "transcribed user speech",
  "metadata": { ... }
}
```

In your N8N workflow, return concise text responses optimized for speech:

```javascript
if (modality === "VOICE") {
  // Remove markdown
  response = response.replace(/[*_~`#]/g, '');
  // Make more conversational
  response = response.replace(/\n\n/g, '. ');
}
```

---

**Result**: Users can have natural, real-time voice conversations with AI personalities!
