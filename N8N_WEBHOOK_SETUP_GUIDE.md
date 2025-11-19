# N8N Webhook Setup Guide for AUtism GOLD

## Quick Start: Complete Workflow in 5 Steps

**Visual Workflow:**
```
Webhook (Trigger) 
    ↓
Code Node #1: Extract Data
    ↓
Code Node #2: Customize Personality Prompt
    ↓
HTTP Request: Call Gemini AI
    ↓
Code Node #3: Format Response
    ↓
Return to App (automatic)
```

**Time to setup:** 10-15 minutes per webhook

**Total webhooks needed:** 9 (3 personalities × 3 modalities)

---

## Overview

AUtism GOLD routes every AI personality request to **separate N8N webhooks**, allowing you to customize and enhance prompts for each personality and modality type. This architecture gives you complete control over how each AI character responds.

## Webhook Architecture

### Personality Types
1. **AUtistic AI** - Casual, fun, meme coin specialist
2. **Level 1 ASD** - Analytical, educational, fact-focused
3. **Savantist** - Expert-level trading insights with deep analysis

### Modality Types
Each personality supports three modalities:
- **TEXT** - Standard text-based responses
- **VOICE** - Voice conversation responses (uses ElevenLabs TTS)
- **IMAGE** - Image generation requests

### Total Webhooks Required
**9 webhooks total**: 3 personalities × 3 modalities = 9 unique webhook URLs

## Webhook URL Configuration

### Default Placeholder URLs
The application is pre-configured with placeholder URLs following this pattern:
```
https://n8n.io/webhook/autism/prompt-{personality}-{modality}
```

### Example Placeholder URLs
```
https://n8n.io/webhook/autism/prompt-autistic-ai-text
https://n8n.io/webhook/autism/prompt-autistic-ai-voice
https://n8n.io/webhook/autism/prompt-autistic-ai-image
https://n8n.io/webhook/autism/prompt-level-1-asd-text
https://n8n.io/webhook/autism/prompt-level-1-asd-voice
https://n8n.io/webhook/autism/prompt-level-1-asd-image
https://n8n.io/webhook/autism/prompt-savantist-text
https://n8n.io/webhook/autism/prompt-savantist-voice
https://n8n.io/webhook/autism/prompt-savantist-image
```

### Setting Your Real Webhook URLs

You can override these placeholders using environment variables:

#### **Development (Replit)**
Add these to **Replit Secrets** (the lock icon in the sidebar):

```bash
# AUtistic AI Webhooks
N8N_AUTISTIC_AI_TEXT=https://your-n8n.cloud/webhook/autistic-ai-text
N8N_AUTISTIC_AI_VOICE=https://your-n8n.cloud/webhook/autistic-ai-voice
N8N_AUTISTIC_AI_IMAGE=https://your-n8n.cloud/webhook/autistic-ai-image

# Level 1 ASD Webhooks
N8N_LEVEL1_ASD_TEXT=https://your-n8n.cloud/webhook/level1-asd-text
N8N_LEVEL1_ASD_VOICE=https://your-n8n.cloud/webhook/level1-asd-voice
N8N_LEVEL1_ASD_IMAGE=https://your-n8n.cloud/webhook/level1-asd-image

# Savantist Webhooks
N8N_SAVANTIST_TEXT=https://your-n8n.cloud/webhook/savantist-text
N8N_SAVANTIST_VOICE=https://your-n8n.cloud/webhook/savantist-voice
N8N_SAVANTIST_IMAGE=https://your-n8n.cloud/webhook/savantist-image

# Base URL (optional - sets default base for all webhooks)
N8N_BASE_URL=https://autism.app.n8n.cloud/webhook/autism
```

#### **Production (Spaceship Hosting at app.autism.ai)**
Add these to your **Spaceship hosting dashboard Environment Variables section**:

- Same variables as above
- Ensure all URLs use `https://` (secure connections required)
- Test webhooks after deployment to verify connectivity
- See `DEPLOYMENT_SPACESHIP_GUIDE.md` for complete deployment instructions

**Security Note**: Never commit environment variables to Git. They are securely stored in:
- Replit: Secrets panel (encrypted at rest)
- Spaceship: Environment Variables dashboard (encrypted)

## Webhook Payload Structure

Every webhook receives a JSON payload with this structure:

```json
{
  "personality": "AUtistic AI",
  "modality": "TEXT",
  "sessionId": "uuid-session-id",
  "conversationId": "uuid-conversation-id",
  "messageId": "uuid-message-id",
  "content": "User's actual message content",
  "metadata": {
    "tier": "Free Trial",
    "tokenBalance": 0,
    "walletAddress": "B1oEzGes1QxVZoxR3abiwAyL4jcPRF2s2ok5Yerrpump",
    "timestamp": 1700000000000
  }
}
```

### Payload Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `personality` | string | Which AI character: "AUtistic AI", "Level 1 ASD", or "Savantist" |
| `modality` | string | Request type: "TEXT", "VOICE", or "IMAGE" |
| `sessionId` | string | Unique user session identifier |
| `conversationId` | string | Conversation thread ID |
| `messageId` | string | Individual message ID |
| `content` | string | The user's actual message/prompt |
| `metadata.tier` | string | User's subscription tier |
| `metadata.tokenBalance` | number | User's $AU token holdings |
| `metadata.walletAddress` | string | User's Solana wallet (if connected) |
| `metadata.timestamp` | number | Unix timestamp in milliseconds |

## N8N Workflow Setup Guide

### Step 1: Create Webhook Trigger Node

1. In N8N, create a new workflow
2. Add a **Webhook** node as the trigger
3. Set **HTTP Method** to `POST`
4. Set **Path** to match your chosen URL pattern (e.g., `/autistic-ai-text`)
5. Set **Response Mode** to `Last Node`

### Step 2: Extract Webhook Data

Add a **Code** node to extract the payload:

**📋 HOW TO ADD CODE TO N8N:**
1. Click the **+** button after your Webhook node
2. Search for **"Code"** and select the **Code** node
3. In the Code node settings:
   - **Mode**: Select "Run Once for All Items"
   - **Language**: JavaScript (default)
4. **Copy the code below** and **paste** it into the Code editor
5. Click **Execute Node** to test

**✂️ COPY THIS CODE:**
```javascript
// Extract webhook payload from incoming request
const payload = $input.first().json.body;

return [{
  json: {
    personality: payload.personality,
    modality: payload.modality,
    userMessage: payload.content,
    tier: payload.metadata.tier,
    sessionId: payload.sessionId,
    conversationId: payload.conversationId,
    messageId: payload.messageId
  }
}];
```

### Step 3: Customize Prompt Based on Personality

Add another **Code** node to create personality-specific system prompts:

**📋 HOW TO ADD THIS CODE:**
1. Click **+** after your previous Code node
2. Add another **Code** node
3. **Mode**: "Run Once for All Items"
4. **Copy the code below** and **paste** it into the editor
5. Click **Execute Node** to test

**✂️ COPY THIS CODE:**
```javascript
// Get data from previous node
const data = $input.first().json;
const personality = data.personality;
const modality = data.modality;
const userMessage = data.userMessage;

// Create personality-specific system prompts
let systemPrompt = '';

if (personality === "AUtistic AI") {
  // Casual, fun tone with crypto slang
  systemPrompt = `You're AUtistic AI, the fun crypto degen. Talk like you're in the trenches with meme coins. Use phrases like "gm", "ser", "wagmi", "ngmi". Keep it casual and entertaining.`;
}
else if (personality === "Level 1 ASD") {
  // Educational, analytical tone
  systemPrompt = `You're Level 1 ASD, the analytical teacher. Provide detailed explanations with facts and logic. Be thorough and educational. Break down complex topics clearly.`;
}
else if (personality === "Savantist") {
  // Expert, professional tone
  systemPrompt = `You're Savantist, the trading expert. Provide deep market analysis and insights. Be precise and data-driven. Use technical terminology when appropriate.`;
}

// Customize for voice modality (shorter, more conversational)
if (modality === "VOICE") {
  systemPrompt += `\n\nIMPORTANT: Keep responses concise for voice. Use conversational language. Avoid markdown formatting.`;
}

// Return data with system prompt
return [{
  json: {
    ...data,
    systemPrompt: systemPrompt,
    fullPrompt: `${systemPrompt}\n\nUser: ${userMessage}`
  }
}];
```

**💡 TIP:** This code node takes the personality type and creates a custom system prompt. You can edit the prompt text directly in the code to match your brand voice!

### Step 4: Call AI Service (Gemini/OpenAI)

Add an **HTTP Request** node to call your AI API:

**📋 HOW TO SET UP HTTP REQUEST NODE:**
1. Click **+** after your previous Code node
2. Search for **"HTTP Request"** and select it
3. Configure the node with these settings:

**⚙️ HTTP REQUEST SETTINGS:**

**Method:** `POST`

**URL:** 
```
https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent
```
*(Use `gemini-2.0-flash` stable model, NOT `gemini-2.0-flash-exp` which requires v1alpha API)*

**Authentication:** 
- Select **"Generic Credential Type"**
- Choose **"Header Auth"**
- **Header Name:** `x-goog-api-key`
- **Header Value:** `{{ $env.GEMINI_API_KEY }}`
  - *(Add GEMINI_API_KEY to your N8N environment variables)*

**Send Body:** `Yes` (toggle on)

**Body Content Type:** `JSON`

**JSON Body** - ✂️ **COPY THIS:**
```json
{
  "contents": [{
    "parts": [{
      "text": "{{ $json.fullPrompt }}"
    }]
  }]
}
```

**💡 ALTERNATIVE - Using OpenAI Instead:**
If you prefer OpenAI, use the **OpenAI** node instead:
- Model: `gpt-4` or `gpt-3.5-turbo`
- System Message: `{{ $json.systemPrompt }}`
- User Message: `{{ $json.userMessage }}`

### Step 5: Format Response

Add a final **Code** node to format the AI response:

**📋 HOW TO ADD THIS CODE:**
1. Click **+** after your HTTP Request node
2. Add a **Code** node
3. **Mode**: "Run Once for All Items"
4. **Copy the code below** and **paste** it

**✂️ COPY THIS CODE:**
```javascript
// Get AI response from Gemini
const geminiResponse = $input.first().json;
const previousData = $('Code').first().json; // Get data from first Code node

// Extract AI text from Gemini response
let aiText = '';
if (geminiResponse.candidates && geminiResponse.candidates[0]) {
  aiText = geminiResponse.candidates[0].content.parts[0].text;
}

// Format final response
return [{
  json: {
    success: true,
    response: aiText,
    personality: previousData.personality,
    modality: previousData.modality,
    messageId: previousData.messageId
  }
}];
```

**📝 NOTE:** This is the last node in your workflow. The Webhook node (set to "Last Node" response mode) will automatically return this data to your application.

### Step 6: Test Your Workflow

**🧪 HOW TO TEST:**
1. Click **Execute Workflow** button at the top
2. Your webhook URL will be shown (e.g., `https://your-n8n.cloud/webhook/autistic-ai-text`)
3. Use the test command below to send a test request

**✂️ TEST COMMAND - Copy and run in your terminal:**
```bash
curl -X POST https://autism.app.n8n.cloud/webhook/autistic-ai-text \
  -H "Content-Type: application/json" \
  -d '{
    "personality": "AUtistic AI",
    "modality": "TEXT",
    "sessionId": "test-session",
    "conversationId": "test-convo",
    "messageId": "test-msg",
    "content": "explain meme coins like im sped",
    "metadata": {
      "tier": "Free Trial",
      "tokenBalance": 0,
      "timestamp": 1700000000000
    }
  }'
```

**Expected response:**
```json
{
  "success": true,
  "response": "gm ser! meme coins are...",
  "personality": "AUtistic AI",
  "modality": "TEXT",
  "messageId": "test-msg"
}
```

**✅ If successful:** Copy your webhook URL and add it to your environment variables (see "Setting Your Real Webhook URLs" section above)

**❌ If it fails:** Check the execution log in N8N to see which node failed and why

## Advanced Use Cases

### 1. Tier-Based Prompt Enhancement

```javascript
if (tier === "Gold") {
  // Enhanced prompts for premium users
  systemPrompt += "\nProvide extra detailed analysis with charts and data.";
}
```

### 2. Image Generation Routing

For IMAGE modality requests:

```javascript
if (modality === "IMAGE") {
  // Route to DALL-E, Stable Diffusion, or Midjourney
  // Extract image description from user prompt
  // Generate image
  // Return image URL
}
```

### 3. Voice-Specific Customization

For VOICE modality requests:

```javascript
if (modality === "VOICE") {
  // Make responses more conversational
  // Remove markdown formatting
  // Add natural pauses with punctuation
  systemPrompt += "\nKeep responses concise for voice. Use conversational language.";
}
```

### 4. Wallet-Based Personalization

```javascript
if (walletAddress) {
  // Look up user's token holdings on-chain
  // Personalize based on their portfolio
  // Mention their specific holdings
}
```

## Testing Your Webhooks

### Test Payload Example

Send this to your webhook URL to test:

```bash
curl -X POST https://your-n8n.cloud/webhook/autistic-ai-text \
  -H "Content-Type: application/json" \
  -d '{
    "personality": "AUtistic AI",
    "modality": "TEXT",
    "sessionId": "test-session",
    "conversationId": "test-conversation",
    "messageId": "test-message",
    "content": "explain meme coins like im sped",
    "metadata": {
      "tier": "Free Trial",
      "tokenBalance": 0,
      "timestamp": 1700000000000
    }
  }'
```

## Webhook Logging

All webhook calls are logged in the database (`webhook_logs` table) for monitoring:

- Request data (personality, modality, content)
- Response data
- Success/error status
- Timestamp

Access logs via the admin panel at `/admin`

## Best Practices

1. **Always validate** the incoming payload structure
2. **Set timeouts** on AI API calls (recommend 30s max)
3. **Handle errors gracefully** and return useful error messages
4. **Log all interactions** for debugging and improvement
5. **Test each personality** separately before going live
6. **Use environment variables** for API keys in N8N
7. **Monitor webhook logs** in the admin dashboard

## Example N8N Workflow Templates

### Simple Text Response Workflow

```
Webhook (Trigger)
  ↓
Extract Payload (Code)
  ↓
Switch by Personality (Switch)
  ↓
Call Gemini API (HTTP Request)
  ↓
Format Response (Set)
  ↓
Respond (Webhook Response)
```

### Advanced Image Generation Workflow

```
Webhook (Trigger)
  ↓
Extract Payload (Code)
  ↓
IF modality === "IMAGE" (IF)
  ↓
Generate Image Description (HTTP - Gemini)
  ↓
Generate Image (HTTP - DALL-E/Midjourney)
  ↓
Upload to Storage (S3/Cloudinary)
  ↓
Return Image URL (Set)
  ↓
Respond (Webhook Response)
```

## Support & Questions

- Check webhook logs in admin panel: `/admin`
- Monitor database `webhook_logs` table
- Test webhooks with curl or Postman
- Ensure all 9 webhooks are configured before going live

---

**Remember**: Each personality can have completely different prompts, tones, and behaviors. This is your opportunity to create truly unique AI characters!
