// Real-time Voice Streaming Service
// Integrates ElevenLabs TTS WebSocket with Gemini Live API for bidirectional audio conversations

import WebSocket from 'ws';
import { GoogleGenAI } from '@google/genai';
import { storage } from '../storage';
import { generateSecureToken } from '../utils/fingerprint';

interface VoiceStreamingSession {
  sessionId: string;
  conversationId: string;
  elevenLabsWs?: WebSocket;
  geminiSession?: any;
  isActive: boolean;
  startTime: number;
}

export class VoiceStreamingService {
  private activeSessions: Map<string, VoiceStreamingSession> = new Map();
  private sessionKeyMap: Map<string, string> = new Map(); // Maps real sessionId to streamSessionId
  private geminiClient: GoogleGenAI;
  private personality: string = 'AUtistic AI'; // Store personality for webhook routing

  constructor() {
    this.geminiClient = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY! 
    });
  }

  /**
   * Initialize bidirectional voice streaming session
   * Combines ElevenLabs TTS output with Gemini audio understanding
   */
  async initializeVoiceSession(
    clientWs: WebSocket,
    sessionId: string,
    conversationId: string,
    personality: string
  ): Promise<void> {
    // Use real sessionId - DO NOT create synthetic ID
    const streamSessionId = `${sessionId}-voice-${Date.now()}`; // Unique per stream, but preserves sessionId
    
    console.log(`[Voice] Initializing voice session: ${sessionId}, personality: ${personality}`);
    
    // Store personality for this stream
    this.personality = personality;

    const voiceSession: VoiceStreamingSession = {
      sessionId: sessionId, // Store REAL sessionId for caching
      conversationId,
      isActive: true,
      startTime: Date.now(),
    };

    // Store under streamSessionId but track mapping for cleanup
    this.activeSessions.set(streamSessionId, voiceSession);
    this.sessionKeyMap.set(sessionId, streamSessionId);

    try {
      // Initialize ElevenLabs WebSocket for TTS output
      await this.initializeElevenLabs(clientWs, voiceSession);

      // Initialize Gemini Live API for audio input understanding
      await this.initializeGeminiLive(clientWs, voiceSession, personality);

      // Set up client message handlers
      this.setupClientHandlers(clientWs, voiceSession, streamSessionId);

    } catch (error) {
      console.error('[Voice] Failed to initialize voice session:', error);
      clientWs.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to initialize voice streaming' 
      }));
      this.cleanupSession(streamSessionId);
    }
  }

  /**
   * Initialize ElevenLabs WebSocket for real-time TTS
   */
  private async initializeElevenLabs(
    clientWs: WebSocket,
    voiceSession: VoiceStreamingSession
  ): Promise<void> {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'default_voice_id';
    const modelId = 'eleven_turbo_v2_5';
    
    const elevenLabsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;
    
    const elevenLabsWs = new WebSocket(elevenLabsUrl);
    voiceSession.elevenLabsWs = elevenLabsWs;

    elevenLabsWs.on('open', () => {
      console.log('[Voice] ElevenLabs WebSocket connected');
      
      // Send API key first (required for authentication)
      elevenLabsWs.send(JSON.stringify({
        xi_api_key: process.env.ELEVENLABS_API_KEY,
      }));

      // Then initialize with voice settings
      setTimeout(() => {
        elevenLabsWs.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
        }));
      }, 100);
    });

    elevenLabsWs.on('message', async (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.audio) {
          // Forward audio chunks to client
          clientWs.send(JSON.stringify({
            type: 'audio_output',
            audio: response.audio,
            alignment: response.alignment,
          }));

          // Cache audio for playback/admin access
          if (response.isFinal) {
            await this.cacheAudioOutput(
              voiceSession.sessionId,
              voiceSession.conversationId,
              response.audio
            );
          }
        }
      } catch (error) {
        console.error('[Voice] ElevenLabs message error:', error);
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('[Voice] ElevenLabs WebSocket error:', error);
      clientWs.send(JSON.stringify({ 
        type: 'error', 
        message: 'TTS connection error' 
      }));
    });
  }

  /**
   * Initialize Gemini Live API for bidirectional audio streaming
   */
  private async initializeGeminiLive(
    clientWs: WebSocket,
    voiceSession: VoiceStreamingSession,
    personality: string
  ): Promise<void> {
    try {
      // Configure Gemini Live API for audio input/output
      const config = {
        response_modalities: ['TEXT'], // We use ElevenLabs for audio output
        realtime_input_config: {
          automatic_activity_detection: {
            disabled: false,
            start_of_speech_sensitivity: 'START_SENSITIVITY_LOW',
            end_of_speech_sensitivity: 'END_SENSITIVITY_HIGH',
            silence_duration_ms: 100,
          },
        },
        system_instruction: this.getPersonalitySystemPrompt(personality),
      };

      // Note: Gemini Live API connection would be established here
      // For now, we'll use the standard Gemini API and upgrade to Live API when available
      console.log('[Voice] Gemini configuration prepared for personality:', personality);
      
      clientWs.send(JSON.stringify({ 
        type: 'voice_ready',
        message: 'Voice streaming ready' 
      }));

    } catch (error) {
      console.error('[Voice] Gemini Live initialization error:', error);
      throw error;
    }
  }

  /**
   * Setup client WebSocket message handlers
   */
  private setupClientHandlers(
    clientWs: WebSocket,
    voiceSession: VoiceStreamingSession,
    streamSessionId: string
  ): void {
    clientWs.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'audio_input':
            // User speaking - process through Gemini for understanding
            await this.processAudioInput(message.audio, voiceSession, clientWs);
            break;

          case 'text_input':
            // User typing - route through N8N webhook then send to ElevenLabs for TTS
            const webhookResponse = await this.routeToN8NWebhook(message.text, voiceSession, this.personality);
            const responseText = webhookResponse?.response || webhookResponse?.text || message.text;
            await this.processTextInput(responseText, voiceSession);
            break;

          case 'stop':
            // User stopped speaking
            this.handleStopSpeaking(voiceSession);
            break;

          default:
            console.warn('[Voice] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[Voice] Client message error:', error);
      }
    });

    clientWs.on('close', () => {
      console.log('[Voice] Client disconnected');
      this.cleanupSession(streamSessionId); // Use streamSessionId for cleanup
    });
  }

  /**
   * Process audio input from user (speech-to-text via Gemini)
   * Routes through N8N webhook for personality-specific processing
   */
  private async processAudioInput(
    audioData: string,
    voiceSession: VoiceStreamingSession,
    clientWs: WebSocket
  ): Promise<void> {
    try {
      // TODO: Implement actual speech-to-text with Gemini Live API
      // For now, acknowledge receipt
      clientWs.send(JSON.stringify({ 
        type: 'audio_processing',
        message: 'Processing your speech...' 
      }));

      // Example: Once we have transcribed text, route through N8N webhook
      // const transcribedText = await this.transcribeAudio(audioData);
      // const webhookResponse = await this.routeToN8NWebhook(transcribedText, voiceSession, 'VOICE');
      // await this.processTextInput(webhookResponse.text, voiceSession);
      
    } catch (error) {
      console.error('[Voice] Audio processing error:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process audio'
      }));
    }
  }

  /**
   * Route voice input through personality-specific N8N webhook
   */
  private async routeToN8NWebhook(
    text: string,
    voiceSession: VoiceStreamingSession,
    personality: string
  ): Promise<any> {
    const { getWebhookUrl } = await import('../config/webhooks');
    const webhookUrl = getWebhookUrl(personality as any, 'VOICE');

    const { storage } = await import('../storage');
    const axios = (await import('axios')).default;

    try {
      const session = await storage.getSession(voiceSession.sessionId);
      
      const webhookPayload = {
        personality,
        modality: 'VOICE',
        sessionId: voiceSession.sessionId,
        conversationId: voiceSession.conversationId,
        content: text,
        metadata: {
          tier: session?.tier || 'Free Trial',
          tokenBalance: session?.tokenBalance || 0,
          walletAddress: session?.walletAddress,
          timestamp: Date.now(),
        },
      };

      const response = await axios.post(webhookUrl, webhookPayload);
      
      // Log webhook call
      await storage.createWebhookLog({
        sessionId: voiceSession.sessionId,
        conversationId: voiceSession.conversationId,
        requestData: { personality, modality: 'VOICE', content: text },
        responseData: { status: 'sent', webhookUrl },
        status: 'success',
      });

      return response.data;
    } catch (error) {
      console.error('[Voice] Webhook error:', error);
      
      const { storage } = await import('../storage');
      await storage.createWebhookLog({
        sessionId: voiceSession.sessionId,
        conversationId: voiceSession.conversationId,
        requestData: { personality, modality: 'VOICE', content: text },
        responseData: { error: String(error) },
        status: 'error',
      });
      
      throw error;
    }
  }

  /**
   * Process text input and convert to speech via ElevenLabs
   */
  private async processTextInput(
    text: string,
    voiceSession: VoiceStreamingSession
  ): Promise<void> {
    if (!voiceSession.elevenLabsWs || voiceSession.elevenLabsWs.readyState !== WebSocket.OPEN) {
      console.error('[Voice] ElevenLabs WebSocket not ready');
      return;
    }

    // Send text to ElevenLabs for TTS
    voiceSession.elevenLabsWs.send(JSON.stringify({
      text: text,
      try_trigger_generation: true,
    }));
  }

  /**
   * Handle user stopping speech
   */
  private handleStopSpeaking(voiceSession: VoiceStreamingSession): void {
    if (!voiceSession.elevenLabsWs || voiceSession.elevenLabsWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Flush remaining audio
    voiceSession.elevenLabsWs.send(JSON.stringify({
      text: '',
      flush: true,
    }));
  }

  /**
   * Cache audio output for secure access
   */
  private async cacheAudioOutput(
    sessionId: string,
    conversationId: string,
    audioBase64: string
  ): Promise<void> {
    try {
      const secureToken = generateSecureToken();
      const audioUrl = `/api/audio/${secureToken}`;

      await storage.createAudioCache({
        sessionId,
        conversationId,
        audioUrl,
        secureToken,
        text: 'Voice conversation audio',
        voiceSettings: {
          provider: 'elevenlabs',
          model: 'eleven_turbo_v2_5',
        },
      });

      console.log('[Voice] Audio cached with secure token');
    } catch (error) {
      console.error('[Voice] Failed to cache audio:', error);
    }
  }

  /**
   * Get system prompt based on personality
   */
  private getPersonalitySystemPrompt(personality: string): string {
    const prompts: Record<string, string> = {
      'AUtistic AI': 'You are AUtistic AI, specialized in meme coins and creative content. Be casual, fun, and knowledgeable about crypto culture.',
      'Level 1 ASD': 'You are Level 1 ASD, focused on learning, facts, and solving complex problems. Be analytical and educational.',
      'Savantist': 'You are Savantist, the expert in advanced trading insights. Provide deep analysis with maximum detail and precision.',
    };

    return prompts[personality] || prompts['AUtistic AI'];
  }

  /**
   * Cleanup voice session
   */
  private cleanupSession(streamSessionId: string): void {
    const session = this.activeSessions.get(streamSessionId);
    
    if (session) {
      session.isActive = false;

      if (session.elevenLabsWs) {
        session.elevenLabsWs.close();
      }

      this.activeSessions.delete(streamSessionId);
      // Also remove from mapping
      this.sessionKeyMap.delete(session.sessionId);
      console.log(`[Voice] Session cleaned up: ${streamSessionId} (real session: ${session.sessionId})`);
    }
  }
}

// Singleton instance
export const voiceStreamingService = new VoiceStreamingService();
