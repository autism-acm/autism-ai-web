import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { sessionMiddleware } from "./middleware/session";
import { adminMiddleware } from "./middleware/admin";
import { checkMessageRateLimit, incrementMessageCount, checkVoiceRateLimit, incrementVoiceMinutes } from "./utils/rateLimit";
import { getTokenBalance } from "./utils/solana";
import { generateSecureToken, hashPassword, verifyPassword } from "./utils/fingerprint";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const N8N_WEBHOOK_URL = "https://autism.app.n8n.cloud/webhook/autism-ai";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  app.use(sessionMiddleware);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get current session info
  app.get("/api/session", async (req, res) => {
    try {
      const session = req.session!;
      const rateLimit = await checkMessageRateLimit(session);
      const voiceLimit = await checkVoiceRateLimit(session);

      res.json({
        tier: session.tier,
        tokenBalance: session.tokenBalance,
        walletAddress: session.walletAddress,
        messageLimit: {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetTime: rateLimit.resetTime,
        },
        voiceLimit: {
          remaining: voiceLimit.remaining,
          limit: voiceLimit.limit,
          resetTime: voiceLimit.resetTime,
        },
      });
    } catch (error) {
      console.error("Error getting session:", error);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });

  // Connect wallet and update token balance
  app.post("/api/wallet/connect", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const session = req.session!;

      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }

      // Get token balance from Solana
      const { balance, tier } = await getTokenBalance(walletAddress);

      // Update session with wallet info
      const updatedSession = await storage.updateSession(session.id, {
        walletAddress,
        tokenBalance: balance,
        tier,
      });

      res.json({
        walletAddress: updatedSession?.walletAddress,
        tokenBalance: updatedSession?.tokenBalance,
        tier: updatedSession?.tier,
      });
    } catch (error) {
      console.error("Error connecting wallet:", error);
      res.status(500).json({ error: "Failed to connect wallet" });
    }
  });

  // Disconnect wallet
  app.post("/api/wallet/disconnect", async (req, res) => {
    try {
      const session = req.session!;

      const updatedSession = await storage.updateSession(session.id, {
        walletAddress: null,
        tokenBalance: 0,
        tier: "Free Trial",
      });

      res.json({
        tier: updatedSession?.tier,
      });
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      res.status(500).json({ error: "Failed to disconnect wallet" });
    }
  });

  // Refresh wallet balance and tier
  app.post("/api/wallet/refresh", async (req, res) => {
    try {
      const session = req.session!;

      if (!session.walletAddress) {
        return res.status(400).json({ error: "No wallet connected" });
      }

      // Get current token balance from Solana
      const { balance, tier } = await getTokenBalance(session.walletAddress);

      // Update session with new balance and tier
      const updatedSession = await storage.updateSession(session.id, {
        tokenBalance: balance,
        tier,
      });

      res.json({
        walletAddress: updatedSession?.walletAddress,
        tokenBalance: updatedSession?.tokenBalance,
        tier: updatedSession?.tier,
      });
    } catch (error) {
      console.error("Error refreshing wallet:", error);
      res.status(500).json({ error: "Failed to refresh wallet balance" });
    }
  });

  // Get memory bank
  app.get("/api/memory-bank", async (req, res) => {
    try {
      const session = req.session!;
      res.json({ memoryBank: session.memoryBank || "" });
    } catch (error) {
      console.error("Error getting memory bank:", error);
      res.status(500).json({ error: "Failed to get memory bank" });
    }
  });

  // Update memory bank
  app.post("/api/memory-bank", async (req, res) => {
    try {
      const { memoryBank } = req.body;
      const session = req.session!;

      const updatedSession = await storage.updateSession(session.id, {
        memoryBank: memoryBank || null,
      });

      res.json({ memoryBank: updatedSession?.memoryBank || "" });
    } catch (error) {
      console.error("Error updating memory bank:", error);
      res.status(500).json({ error: "Failed to update memory bank" });
    }
  });

  // Get conversations for current session
  app.get("/api/conversations", async (req, res) => {
    try {
      const session = req.session!;
      const conversations = await storage.getConversationsBySession(session.id);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const session = req.session!;

      // Verify conversation belongs to this session
      const conversation = await storage.getConversation(id);
      if (!conversation || conversation.sessionId !== session.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessagesByConversation(id);
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    try {
      const { content, conversationId, requestImage = false, personality = 'AUtistic AI' } = req.body;
      const session = req.session!;

      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Check rate limit
      const rateLimit = await checkMessageRateLimit(session);
      if (!rateLimit.allowed) {
        return res.status(429).json({ 
          error: "Rate limit exceeded", 
          resetTime: rateLimit.resetTime 
        });
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation || conversation.sessionId !== session.id) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      } else {
        conversation = await storage.createConversation({
          sessionId: session.id,
          title: content.substring(0, 50),
        });
      }

      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content,
        isImage: false,
      });

      // Determine modality and get personality-specific webhook URL
      const { getWebhookUrl } = await import('./config/webhooks');
      const modality = requestImage ? 'IMAGE' : 'TEXT';
      const webhookUrl = getWebhookUrl(personality as any, modality);

      // Call personality-specific N8N webhook and get enhanced prompt
      let enhancedPrompt = content;
      try {
        const webhookPayload = {
          personality,
          modality,
          sessionId: session.id,
          conversationId: conversation.id,
          messageId: userMessage.id,
          content,
          metadata: {
            tier: session.tier,
            tokenBalance: session.tokenBalance,
            walletAddress: session.walletAddress,
            timestamp: Date.now(),
          },
        };

        const webhookResponse = await axios.post(webhookUrl, webhookPayload, {
          timeout: 10000,
        });
        
        // Use the enhanced prompt from N8N if provided
        if (webhookResponse.data && webhookResponse.data.status === 'ok') {
          if (webhookResponse.data.delivery === 'prompt' && webhookResponse.data.prompt?.full) {
            enhancedPrompt = webhookResponse.data.prompt.full;
            console.log('[N8N] Using enhanced prompt from webhook:', webhookResponse.data.metadata?.personaName);
          } else if (webhookResponse.data.fullPrompt) {
            // Backwards compatibility with old format
            enhancedPrompt = webhookResponse.data.fullPrompt;
            console.log('[N8N] Using legacy fullPrompt format');
          } else if (webhookResponse.data.systemPrompt) {
            // Backwards compatibility
            enhancedPrompt = `${webhookResponse.data.systemPrompt}\n\nUser: ${content}`;
            console.log('[N8N] Using legacy systemPrompt format');
          }
        }
        
        await storage.createWebhookLog({
          sessionId: session.id,
          conversationId: conversation.id,
          requestData: { personality, modality, content, requestImage },
          responseData: webhookResponse.data || { status: "sent", webhookUrl },
          status: "success",
        });
      } catch (webhookError) {
        console.error("Webhook error (will use original prompt):", webhookError);
        await storage.createWebhookLog({
          sessionId: session.id,
          conversationId: conversation.id,
          requestData: { personality, modality, content, requestImage },
          responseData: { error: String(webhookError) },
          status: "error",
        });
      }

      // Generate AI response using Gemini with enhanced prompt from N8N
      try {
        let aiResponseText: string;
        let imageUrl: string | undefined;

        if (requestImage) {
          // For image requests, generate a descriptive response
          const prompt = `Based on this request: "${enhancedPrompt}", provide a detailed description that could be used to generate an image. Focus on visual elements, composition, style, and mood.`;
          const result = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          aiResponseText = result.text || "I encountered an issue generating the image description.";
          // Note: Actual image generation would require additional API integration (DALL-E, Stable Diffusion, etc.)
        } else {
          const result = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: enhancedPrompt,
          });
          aiResponseText = result.text || "I apologize, but I couldn't generate a response.";
        }

        // Save AI response
        const aiMessage = await storage.createMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: aiResponseText,
          isImage: requestImage,
          imageUrl,
        });

        // Only increment message count after successful AI response
        await incrementMessageCount(session.id);

        res.json({
          conversation,
          userMessage,
          aiMessage,
          rateLimit: {
            remaining: rateLimit.remaining - 1,
            limit: rateLimit.limit,
            resetTime: rateLimit.resetTime,
          },
        });
      } catch (aiError) {
        console.error("AI generation error:", aiError);
        
        // Save error message
        const errorMessage = await storage.createMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request. Please try again.",
          isImage: false,
        });

        // Still increment even on error to prevent spam
        await incrementMessageCount(session.id);

        res.json({
          conversation,
          userMessage,
          aiMessage: errorMessage,
          rateLimit: {
            remaining: rateLimit.remaining - 1,
            limit: rateLimit.limit,
            resetTime: rateLimit.resetTime,
          },
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Generate voice with ElevenLabs
  app.post("/api/voice/generate", async (req, res) => {
    try {
      const { text, conversationId, messageId } = req.body;
      const session = req.session!;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      // Check voice rate limit (estimate 1 minute per request)
      const voiceLimit = await checkVoiceRateLimit(session, 1);
      if (!voiceLimit.allowed) {
        return res.status(429).json({ 
          error: "Voice limit exceeded", 
          resetTime: voiceLimit.resetTime 
        });
      }

      // Generate secure token for audio access
      const secureToken = generateSecureToken();

      // Integrate with ElevenLabs API
      let audioUrl = `https://example.com/audio/${secureToken}.mp3`;
      let duration = 60;

      if (process.env.ELEVENLABS_API_KEY) {
        try {
          const elevenLabsResponse = await axios.post(
            'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', // Default voice ID
            {
              text,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
              },
            },
            {
              headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
              },
              responseType: 'arraybuffer',
            }
          );

          // In production, you'd save this to cloud storage (S3, etc.)
          // For now, we're using a placeholder URL
          audioUrl = `https://example.com/audio/${secureToken}.mp3`;
          
          // Estimate duration (rough estimate: 150 words per minute)
          const wordCount = text.split(' ').length;
          duration = Math.ceil((wordCount / 150) * 60);
        } catch (elevenLabsError) {
          console.error("ElevenLabs API error:", elevenLabsError);
          // Continue with mock data if ElevenLabs fails
        }
      }

      // Save to audio cache
      const audioCache = await storage.createAudioCache({
        sessionId: session.id,
        conversationId,
        messageId: messageId || null,
        audioUrl,
        secureToken,
        text,
        duration,
        voiceSettings: { voice: "default" },
      });

      // Increment voice usage
      await incrementVoiceMinutes(session.id, 1);

      res.json({
        audioUrl,
        secureToken,
        duration: audioCache.duration,
        voiceLimit: {
          remaining: voiceLimit.remaining - 1,
          limit: voiceLimit.limit,
          resetTime: voiceLimit.resetTime,
        },
      });
    } catch (error) {
      console.error("Error generating voice:", error);
      res.status(500).json({ error: "Failed to generate voice" });
    }
  });

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !user.isAdmin || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Set admin cookie
      res.cookie("autism_admin", user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 180 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, username: user.username });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  // Admin routes (protected)
  app.use("/api/admin", adminMiddleware);

  // Get all sessions (admin only)
  app.get("/api/admin/sessions", async (req, res) => {
    try {
      // This would need a new storage method to get all sessions
      res.json({ message: "Admin sessions endpoint" });
    } catch (error) {
      console.error("Error getting sessions:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // Get all audio cache entries (admin only)
  app.get("/api/admin/audio", async (req, res) => {
    try {
      const { sessionId, conversationId, limit } = req.query;

      let audioEntries: any[] = [];
      if (sessionId) {
        audioEntries = await storage.getAudioCacheBySession(sessionId as string);
      } else if (conversationId) {
        audioEntries = await storage.getAudioCacheByConversation(conversationId as string);
      } else {
        const limitNum = parseInt(limit as string) || 100;
        audioEntries = await storage.getAllAudioCache(limitNum);
      }

      res.json(audioEntries);
    } catch (error) {
      console.error("Error getting audio:", error);
      res.status(500).json({ error: "Failed to get audio cache" });
    }
  });

  // Get webhook logs (admin only)
  app.get("/api/admin/webhooks", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getWebhookLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting webhook logs:", error);
      res.status(500).json({ error: "Failed to get webhook logs" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket endpoint for real-time voice streaming with session validation
  const { voiceStreamingService } = await import('./services/voiceStreaming');
  const WebSocketServer = (await import('ws')).WebSocketServer;
  const wsServer = new WebSocketServer({ 
    noServer: true // We'll handle upgrade manually to access session
  });

  // Handle WebSocket upgrade with session validation
  httpServer.on('upgrade', async (req: any, socket: any, head: any) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    if (url.pathname !== '/api/voice-stream') {
      socket.destroy();
      return;
    }

    try {
      // Parse session from cookies (same middleware used in HTTP)
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Get session from storage using fingerprint
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((cookie: string) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) cookies[key] = value;
      });

      const cookieToken = cookies['autism_session'];
      if (!cookieToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Get session from storage
      const session = await storage.getSessionByCookieToken(cookieToken);
      if (!session) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Get conversation and verify ownership
      const conversationId = url.searchParams.get('conversationId');
      const personality = url.searchParams.get('personality') || 'AUtistic AI';

      if (!conversationId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.sessionId !== session.id) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check voice rate limit
      const voiceLimit = await checkVoiceRateLimit(session);
      if (!voiceLimit.allowed) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      // All validation passed - complete WebSocket upgrade
      wsServer.handleUpgrade(req, socket, head, (ws: any) => {
        wsServer.emit('connection', ws, req, session, conversationId, personality);
      });

    } catch (error) {
      console.error('[WebSocket] Upgrade error:', error);
      socket.destroy();
    }
  });

  wsServer.on('connection', async (ws: any, req: any, session: any, conversationId: string, personality: string) => {
    console.log(`[WebSocket] Voice stream connection: ${session.id}, personality: ${personality}`);

    try {
      await voiceStreamingService.initializeVoiceSession(
        ws,
        session.id, // Use real session ID, not synthetic
        conversationId,
        personality
      );
    } catch (error) {
      console.error('[WebSocket] Voice stream error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  return httpServer;
}
