# Spaceship Hosting Deployment Guide
## Deploying AUtism GOLD to app.autism.ai

This guide covers deploying your application from Replit to Spaceship hosting at `app.autism.ai`.

---

## Overview

Your application is currently configured to run on Replit, but you'll be deploying to Spaceship hosting. This guide explains how to securely manage environment variables and deploy your application.

---

## Environment Variables for Production

### Required Environment Variables

When deploying to Spaceship, you'll need to configure these environment variables in your hosting provider's dashboard:

#### **1. Database Connection**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```
- This is your PostgreSQL database connection string
- Spaceship may provide this automatically if using their database service
- Or use an external PostgreSQL provider (Neon, Supabase, Railway, etc.)

#### **2. AI Services (Required)**
```bash
GEMINI_API_KEY=AIza...your-key-here
```
- Get from: https://aistudio.google.com/app/apikey
- Required for all AI chat functionality

#### **3. Voice Features (Optional)**
```bash
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=your-voice-id
```
- Get from: https://elevenlabs.io/app/speech-synthesis
- Only needed if using voice chat features

#### **4. N8N Webhooks (Optional but Recommended)**

Set your custom N8N webhook URLs to override the defaults:

```bash
# Base URL for all webhooks (optional)
N8N_BASE_URL=https://autism.app.n8n.cloud/webhook/autism

# Or set individual webhook URLs:
N8N_AUTISTIC_AI_TEXT=https://your-n8n-instance/webhook/autistic-ai-text
N8N_AUTISTIC_AI_VOICE=https://your-n8n-instance/webhook/autistic-ai-voice
N8N_AUTISTIC_AI_IMAGE=https://your-n8n-instance/webhook/autistic-ai-image

N8N_LEVEL1_ASD_TEXT=https://your-n8n-instance/webhook/level1-asd-text
N8N_LEVEL1_ASD_VOICE=https://your-n8n-instance/webhook/level1-asd-voice
N8N_LEVEL1_ASD_IMAGE=https://your-n8n-instance/webhook/level1-asd-image

N8N_SAVANTIST_TEXT=https://your-n8n-instance/webhook/savantist-text
N8N_SAVANTIST_VOICE=https://your-n8n-instance/webhook/savantist-voice
N8N_SAVANTIST_IMAGE=https://your-n8n-instance/webhook/savantist-image
```

#### **5. Blockchain (Optional)**
```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```
- Default is Solana mainnet public RPC
- For better performance, use a paid RPC provider (Helius, QuickNode, etc.)

#### **6. Production Settings**
```bash
NODE_ENV=production
PORT=5000
```
- `NODE_ENV=production` enables production optimizations
- `PORT` may be set automatically by Spaceship

---

## Deployment Methods

### Option 1: Direct Git Deployment (Recommended)

Most hosting providers support deploying directly from GitHub:

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Connect repository to Spaceship**:
   - Log into your Spaceship hosting dashboard
   - Create a new project
   - Connect your GitHub repository
   - Select the branch (typically `main`)

3. **Configure build settings**:
   ```bash
   Build Command: npm run build
   Start Command: npm start
   Node Version: 20.x
   ```

4. **Add environment variables**:
   - In Spaceship dashboard, go to Environment Variables
   - Add all variables listed above
   - Save and deploy

### Option 2: Manual Deployment

If Spaceship doesn't support Git deployment:

1. **Build locally**:
   ```bash
   npm install
   npm run build
   ```

2. **Upload files**:
   - Upload the entire project directory via FTP/SFTP
   - Ensure `node_modules` is included or run `npm install` on server

3. **Configure environment variables**:
   - Create a `.env` file on the server (or use hosting panel)
   - Add all required environment variables

4. **Start the application**:
   ```bash
   NODE_ENV=production npm start
   ```

---

## Secure Environment Variable Management

### Development (Replit)
- Use **Replit Secrets** (the lock icon in the sidebar)
- Never commit secrets to Git
- Secrets are automatically injected as environment variables

### Production (Spaceship)
- Use **Spaceship's Environment Variables dashboard**
- Most hosting providers have a secure env var storage
- Common locations:
  - Vercel: Project Settings → Environment Variables
  - Netlify: Site Settings → Environment Variables
  - Railway: Project → Variables
  - Render: Environment → Environment Variables

### Best Practices

1. **Never commit `.env` files to Git**
   - Already in your `.gitignore`
   - If you accidentally committed secrets, rotate them immediately

2. **Use different keys for dev/prod**
   - Development: Lower limits, test API keys
   - Production: Production API keys with proper limits

3. **Rotate sensitive keys regularly**
   - Especially API keys with billing attached
   - Set up API key rotation schedule

4. **Limit API key permissions**
   - Gemini: Restrict to specific APIs
   - Database: Use credentials with minimal required permissions

---

## Database Migration

### If Using Existing PostgreSQL Database

1. **Export schema from Replit**:
   ```bash
   npm run db:push
   ```

2. **Get your production DATABASE_URL** from Spaceship

3. **Update environment variable**:
   - In Spaceship dashboard, set `DATABASE_URL` to production database

4. **Push schema to production database**:
   ```bash
   DATABASE_URL="your-production-db-url" npm run db:push
   ```

### If Starting Fresh

Your Drizzle schema (`shared/schema.ts`) will automatically create all tables on first deployment when you run:

```bash
npm run db:push
```

---

## Domain Configuration

### Setting up app.autism.ai

1. **DNS Configuration**:
   - Go to your domain registrar (where you bought autism.ai)
   - Add an A record or CNAME:
     ```
     Type: A or CNAME
     Name: app
     Value: [Spaceship IP or hostname]
     TTL: 3600
     ```

2. **SSL/HTTPS**:
   - Spaceship likely provides automatic SSL via Let's Encrypt
   - Ensure "Force HTTPS" is enabled in settings

3. **Verify deployment**:
   - Visit https://app.autism.ai
   - Check SSL certificate is valid (green padlock)

---

## Post-Deployment Checklist

- [ ] Application loads at https://app.autism.ai
- [ ] Database connection working (no errors in logs)
- [ ] Gemini API key working (AI chat responds)
- [ ] N8N webhooks configured and receiving requests
- [ ] Voice streaming works (if using ElevenLabs)
- [ ] Solana wallet connection works
- [ ] SSL certificate is valid
- [ ] Environment variables are secure (not in code)
- [ ] Monitor logs for errors
- [ ] Set up error monitoring (Sentry, LogRocket, etc.)

---

## N8N Webhook Setup for Production

### Recommended N8N Hosting Options

1. **N8N Cloud** (Easiest):
   - https://n8n.cloud
   - Fully managed, automatic SSL
   - Example URLs: `https://autism.app.n8n.cloud/webhook/...`

2. **Self-hosted N8N**:
   - Deploy on separate server (Railway, DigitalOcean, etc.)
   - More control, but requires setup
   - Example URLs: `https://n8n.autism.ai/webhook/...`

### Securing Your Webhooks

1. **Use HTTPS only**:
   - All webhook URLs must use `https://`
   - Never use plain HTTP in production

2. **Add authentication headers** (optional):
   ```javascript
   // In N8N webhook node
   {
     "Authentication": "Header Auth",
     "Header Name": "X-Webhook-Secret",
     "Header Value": "your-secret-key"
   }
   ```

3. **Validate payload signatures**:
   - Add a secret token to webhook payload
   - Verify in N8N workflow before processing

### Testing Production Webhooks

Use this test command after deployment:

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

---

## Monitoring & Logging

### Application Logs

Monitor your application logs on Spaceship:

```bash
# Check for errors
grep "Error" logs/production.log

# Check API responses
grep "GET\|POST" logs/production.log
```

### Database Logs

Check `webhook_logs` table for N8N webhook activity:

```sql
SELECT * FROM webhook_logs 
ORDER BY created_at DESC 
LIMIT 100;
```

### Performance Monitoring

Consider adding:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **Vercel Analytics** for performance metrics
- **PostHog** for user analytics

---

## Troubleshooting

### Common Deployment Issues

**Issue**: Database connection fails  
**Solution**: Verify `DATABASE_URL` format and credentials

**Issue**: AI not responding  
**Solution**: Check `GEMINI_API_KEY` is set correctly

**Issue**: N8N webhooks timing out  
**Solution**: Increase N8N workflow timeout to 30s

**Issue**: Build fails on deployment  
**Solution**: Check Node.js version matches (20.x required)

**Issue**: Port already in use  
**Solution**: Ensure Spaceship assigns port via `process.env.PORT`

---

## Environment Variable Reference

### Complete Production `.env` Template

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AI Services
GEMINI_API_KEY=AIza...your-key-here

# Voice (Optional)
ELEVENLABS_API_KEY=sk_...your-key-here
ELEVENLABS_VOICE_ID=voice_id_here

# N8N Webhooks (Optional - uses defaults if not set)
N8N_BASE_URL=https://autism.app.n8n.cloud/webhook/autism
N8N_AUTISTIC_AI_TEXT=https://...
N8N_AUTISTIC_AI_VOICE=https://...
N8N_AUTISTIC_AI_IMAGE=https://...
N8N_LEVEL1_ASD_TEXT=https://...
N8N_LEVEL1_ASD_VOICE=https://...
N8N_LEVEL1_ASD_IMAGE=https://...
N8N_SAVANTIST_TEXT=https://...
N8N_SAVANTIST_VOICE=https://...
N8N_SAVANTIST_IMAGE=https://...

# Blockchain (Optional)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Production Settings
NODE_ENV=production
PORT=5000
```

---

## Security Recommendations

1. **Never expose API keys in client-side code**
   - All keys stay server-side only
   - Already implemented correctly in your app

2. **Use rate limiting**
   - Already implemented per-session
   - Consider adding IP-based rate limiting

3. **Enable CORS properly**
   - Only allow requests from `app.autism.ai`
   - Update Express CORS configuration

4. **Regular security updates**
   ```bash
   npm audit
   npm audit fix
   ```

5. **Backup database regularly**
   - Set up automated daily backups
   - Test restore procedure

---

## Support & Resources

- **Replit Docs**: https://docs.replit.com
- **N8N Docs**: https://docs.n8n.io
- **Gemini API**: https://ai.google.dev/docs
- **ElevenLabs Docs**: https://docs.elevenlabs.io
- **Drizzle ORM**: https://orm.drizzle.team/docs

---

**Remember**: After deployment to Spaceship, your application will run at `https://app.autism.ai` with all the same functionality, just with production-grade hosting and your custom domain!
