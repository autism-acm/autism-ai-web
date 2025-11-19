# AUtism GOLD - AI-Powered Web3 dApp

## Overview
AUtism GOLD is a Web3 decentralized application (dApp) that integrates AI-powered chat functionality with the Solana blockchain. It features a tiered token system where users interact with an AI assistant, powered by Google's Gemini API, with service tiers determined by their token holdings. The project aims to provide an innovative AI chat experience within a Web3 ecosystem, leveraging blockchain for user authentication and token-based access.

## Recent Changes (November 19, 2025)
### Latest Updates - Conversation Management & Token Purchase
1. **Real Conversation History**: Replaced hardcoded mock conversations with real database-backed conversation system
2. **Conversation Management**: Added ability to create new chats, switch between conversations, and load conversation history
3. **Memory Bank Persistence**: Implemented backend endpoint (POST /api/memory-bank) to save and load Memory Bank data
4. **Token Purchase Flow**: Added "Buy $AU" button in UpgradeModal that redirects to Jupiter DEX for token purchases
5. **Wallet Refresh Polling**: Implemented automatic wallet balance checking every 60 seconds to update user tier after token purchase
6. **Database Schema Expansion**: Added memoryBank field to sessions table, summary and lastSummaryAt to conversations table
7. **API Endpoints**: Verified all conversation endpoints working (GET /api/conversations, GET /api/conversations/:id/messages, POST /api/messages)

### Previous Updates - Import Setup
1. **Gemini API Model Fix**: Updated model name from 'gemini-1.5-pro' to 'gemini-1.5-pro-latest' to fix 404 errors
2. **Admin User with Unlimited Messages**: Created admin user (username: admin, password: admin123) with unlimited message quota (999,999 messages)
3. **Session-Admin Linking**: Added userId field to sessions table to link admin users to their sessions
4. **Rate Limit Bypass**: Admin users automatically bypass all rate limits for both messages and voice
5. **Database Schema Updates**: Pushed schema changes to support admin user features
6. **AI Model Upgrade**: Changed from gemini-2.0-flash to gemini-1.5-pro for more in-depth AI responses (15 RPM free tier limit)
7. **Message Counter Fix**: Fixed sidebar display to show actual usage (messagesUsed/maxMessages) instead of incorrectly showing 0/5
8. **Optimistic UI**: Implemented instant message rendering with proper race condition handling for rapid sends

## Security Notes
- **CRITICAL**: Admin account uses temporary password "admin123" - must be rotated before production deployment
- All API keys managed through Replit secrets (GEMINI_API_KEY is configured)

## User Preferences
- Phased development approach: Get text chat working perfectly before implementing voice AI features

## System Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL (via Neon serverless) with Drizzle ORM
- **AI Integration**: Google Gemini API
- **Blockchain**: Solana Web3.js
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Session Management**: Express sessions with fingerprinting

### Project Structure
- `client/`: React frontend (components, hooks, utilities, pages, static assets)
- `server/`: Express backend (middleware, utilities, entry point, API routes)
- `shared/`: Shared TypeScript types and Drizzle database schema
- `attached_assets/`: Project assets and documentation

### Database Schema
The PostgreSQL database includes tables for:
- **users**: Admin accounts
- **sessions**: User sessions, wallet addresses, and tier information
- **conversations**: Chat threads
- **messages**: Individual chat messages
- **audioCache**: TTS audio file cache
- **rateLimits**: Usage tracking per tier
- **webhookLogs**: Integration logging

### Key Features
1.  **Tiered Token System**: Access levels (Free Trial, Electrum, Pro, Gold) based on $AU token holdings.
2.  **AI Chat Interface**: Conversation history powered by Google Gemini, with personality-based N8N webhooks.
3.  **Solana Wallet Integration**: Connects to verify token holdings.
4.  **Rate Limiting**: Per-session usage tracking with automatic resets based on tier.
5.  **Admin Dashboard**: For user management and system monitoring.
6.  **UI/UX**: Features a custom font (Be Vietnam Pro), collapsible sidebars with hover-expansion, dynamic chat input adjustments, Grok-inspired chatbox, and mobile enhancements including a swipeable suggested prompts carousel.
7.  **Routing**: Application accessible at both `/` and `/ai` routes.
8.  **Real-time Voice Streaming**: Bidirectional voice streaming with ElevenLabs integration for real-time text-to-speech.

### Deployment and Development
- The application runs on a single port (5000) for both frontend and backend within the Replit environment.
- Vite's development server is proxied through Express.
- HMR client port is configured for Replit compatibility.
- Deployment uses Replit Autoscale with `npm run build` and `npm start` commands.

## External Dependencies
-   **Google Gemini API**: For AI chat functionality.
-   **Solana Blockchain**: Integrated via Solana Web3.js for wallet connection and token verification.
-   **PostgreSQL (Neon serverless)**: Database solution.
-   **ElevenLabs API**: For text-to-speech functionality and real-time voice streaming.
-   **N8N**: For personality-based webhook routing and custom prompt enhancement.