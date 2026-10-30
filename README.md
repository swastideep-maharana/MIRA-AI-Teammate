# MIRA - AI Teammate Platform

MIRA is a multi-agent AI collaboration platform built with Next.js, Trigger.dev, and the Daytona Cloud SDK. It allows users to create specialized AI teammates, run isolated cloud sandboxes for autonomous computer use, engage in 1:1 and multi-agent group chats, and maintain persistent cross-chat memory.

---

## Overview

MIRA gives each AI teammate a dedicated cloud environment (Daytona sandbox) with full computer use capabilities (GUI interaction, terminal execution, filesystem access). Teammates can collaborate in group chats, autonomously hand off tasks to specialists, retain memories across both private and group interactions, inspect multimodal documents, and search the web for visual references.

---

## Features

### 1. AI Teammate Management
- Create custom AI bots with distinct names, roles, job descriptions, and custom instructions.
- Dynamic avatar generation using the DiceBear Thumbs style.
- Edit and update bot profiles and instructions at any time.
- Deletion workflow that removes the bot, its associated direct chat, and cleans up its dedicated cloud sandbox.

### 2. Isolated Cloud Sandboxes and Live Remote Desktop
- Each bot is provisioned with a dedicated Daytona Cloud sandbox upon creation.
- Integrated live remote desktop preview (noVNC) rendered in a collapsible, resizable side panel.
- Fullscreen dialog view for the remote desktop with input capture, anti-blur scaling, and minimize/restore controls.
- Automatic startup and health checking of the sandbox and its computer use stack (Xvfb, Xfce4, x11vnc, noVNC).

### 3. Computer Use and Sandbox Tools
Each agent has direct access to tools executed within its sandbox:
- bash: Execute shell commands, install packages, and run background processes.
- readFile: Inspect and read file contents from the sandbox filesystem.
- writeFile: Create and modify files in the sandbox filesystem.
- listFiles: Enumerate files and directories across the workspace.
- mouseClick: Perform left, right, and double clicks at coordinate points.
- mouseMove: Move the cursor to exact coordinates on the virtual display.
- mouseScroll: Scroll vertically up or down at specific coordinates.
- keyboardType: Type text into active windows or input elements.
- keyboardPress: Send keyboard keys and hotkey combinations (such as Enter, Tab, Escape, Ctrl+C).
- viewScreen: Capture screenshots internally for agent inspection (not rendered in chat).
- showScreen: Capture and render screenshots directly into the user conversation.
- searchImages: Query and retrieve relevant images from Wikimedia Commons and Wikipedia PageImages.

### 4. Cross-Chat Persistent Memory
- Automatic initialization of a MEMORY.md file inside the bot's sandbox upon bot creation.
- getMemory tool: Allows the bot to retrieve the latest contents of MEMORY.md.
- setMemory tool: Allows the bot to append or update facts, user secrets, passwords, and preferences with timestamps.
- Memory Preloading: The contents of MEMORY.md are automatically fetched and injected into the agent system prompt on every turn.
- Continuity: Memories recorded in private 1:1 conversations persist and remain accessible when speaking with the agent in group chats.

### 5. Multi-Agent Group Chats
- Create group chats with custom names and multiple participating bot teammates.
- Responsive Group Chat Avatar:
  - 2 bots: overlapping horizontal pair.
  - 3 bots: triangular arrangement.
  - 4+ bots: 2x2 grid with avatar slots and a numeric overflow badge.
- Bot-per-turn interaction model: Users choose which bot to address via an integrated composer selector.
- Inline Tag Badges: User messages in group chats feature an inline badge displaying the targeted bot's avatar and name.
- Responding Bot Attribution: Assistant messages render the responding bot's avatar and name label.
- Group Chat Header Management: The header is an interactive button that opens an edit dialog to rename the group, add or remove bot members, or delete the group chat.

### 6. Autonomous Task Handoff
- handoff tool: Bots in group chats can autonomously delegate user requests to other teammates whose roles or skills are better suited.
- Interactive Handoff UI: Renders a dedicated card displaying the target teammate, role, reason, and an instant switch action.
- Automatic Composer Sync: The message composer automatically updates the active bot dropdown to the delegated teammate upon completion of the handoff turn.

### 7. Realtime Streaming Chat Experience
- Powered by Trigger.dev AI Chat agents and the Vercel AI SDK.
- Streaming responses with real-time thinking states, reasoning dropdowns, and execution inspection.
- Thinking loader animation with pulsing avatar indicator and staggered glow dots during model deliberation.
- Real-time typewriter streaming cursor effect on active assistant turns.
- Rich markdown rendering using Streamdown with code syntax highlighting, CJK support, mathematical equations, and Mermaid diagrams.

### 8. Multimodal Context Ingestion and Document Analysis
- Direct multimodal ingestion leveraging Gemini 3 Flash native 1-million+ token context window, avoiding retrieval fragmentation and vector database chunking loss.
- Attachment composer supporting PDF, plain text, Markdown, CSV, JSON, and source code files (.ts, .js, .py).
- Dedicated attachment trigger button, selected file badge chips with removal controls, and inline file badge previews in user message streams.
- Dual execution: Direct base64 inline multimodal parsing for Gemini alongside automated sandbox filesystem synchronization to `/workspace/uploads/`.

### 9. Autonomous Image Search and Visual Rendering
- searchImages tool integrated into the Trigger.dev agent loop, retrieving high-resolution images from Wikipedia PageImages and Wikimedia Commons.
- Interactive image gallery cards in chat with responsive layouts, thumbnail previews, hover zoom inspection, and direct source attribution links.
- Tool accordion stream preview showing live search progress and thumbnail previews during agent execution.

### 10. Deterministic Tool Guardrails and Self-Correction Loop
- Strict parameter boundary validation using Zod schemas across all agent tools.
- Command filtering: Blacklisted destructive command patterns in bash (such as `rm -rf /`, fork bombs, and system directory mutations).
- Execution timeout protection: 30-second execution timeout failsafe on shell operations with Promise-wrapped abort triggers.
- Filesystem safety: Enforced file payload limits (2MB maximum) and directory path boundary checks.
- Coordinate boundaries: Screen dimension validation (0 <= x <= 1920, 0 <= y <= 1080) for mouse interactions.
- Structured error interception: Tool failures return standardized JSON responses (VALIDATION_ERROR, COMMAND_REJECTED, TIMEOUT) with correction hints, enabling Gemini 3 Flash to self-correct in subsequent turns rather than terminating task runners.

### 11. Visual Context Optimization and Ephemeral Screenshot Pruning
- Ephemeral visual history: Autonomous computer-use loops retain only the single most recent visual desktop screenshot in active LLM context.
- Prior desktop frames are pruned in-memory to compact text markers (`[Screenshot taken: Desktop state at step N observed]`), preventing multi-megabyte context bloat during multi-turn automation.
- High-resolution display captures (1920x1080) downscaled to 1024x768 JPEG via Sharp to minimize payload overhead.
- Bidirectional coordinate normalization mapping so mouse clicks and movements accurately resolve to native display coordinates.

### 12. Sliding Window Context Truncation
- Context management for extended debugging and programming sessions.
- Sessions exceeding 20 message turns automatically slide to preserve the initial system instructions and user task definition, condense intermediate turns into a rolling summary, and keep the latest 6 active turns intact.

### 13. Multi-Tenant Usage Metering and Cost Ledger
- Database-backed usage accounting via the `usage_ledgers` table in Neon PostgreSQL.
- Per-turn recording of prompt tokens, completion tokens, total tokens, execution latency, and estimated USD compute costs.
- Attributed to individual user, bot, and chat sessions for multi-tenant analytics and billing transparency.

### 14. Sandbox Lifecycle Management
- Auto-hibernation: Automatic transition of idle Daytona cloud sandboxes into suspended state after 15 minutes of inactivity to optimize cloud resources.
- Wake-on-interaction: On-demand sandbox resumption whenever a user or agent initiates interaction.
- Task crash cleanup hooks to terminate hanging background processes and reset runtime state.

---

## Technology Stack

### Frontend and Application Framework
- Next.js 16 (App Router, Server Actions)
- React 19 and React DOM 19
- TypeScript 5
- Tailwind CSS 4 with PostCSS
- Base UI and Shadcn UI component primitives
- Class Variance Authority (CVA)
- Lucide React icon library
- React Resizable Panels
- DiceBear Core and DiceBear Thumbs style
- Streamdown (with @streamdown/code, @streamdown/cjk, @streamdown/math, @streamdown/mermaid)
- Shiki code highlighter
- React Hook Form with Zod resolvers
- Motion (Framer Motion)
- Embla Carousel React
- Recharts and XYFlow

### Backend, Database, and Infrastructure
- Neon Serverless PostgreSQL
- Drizzle ORM and Drizzle Kit
- Clerk Next.js (Authentication and user management)
- Trigger.dev v3 (Background agent execution, task scheduling, realtime chat streaming)
- Daytona SDK (Cloud sandboxes, container lifecycle, remote desktop services)
- Sharp (High-performance image processing and screenshot downscaling)
- Tokenlens (Token and usage analytics)

### AI and LLM Integration
- Vercel AI SDK (ai, @ai-sdk/react)
- Google Generative AI Provider (@ai-sdk/google) running Gemini models (gemini-3-flash-preview)

---

## Architecture

```
+--------------------------------------------------------------+
|                       Next.js Client                         |
|  - Chat Interface & Streamdown Markdown                      |
|  - Multi-Agent Composer Selector & File Attachments          |
|  - Embedded noVNC Remote Desktop Panel                       |
|  - Bot & Group Chat Dialogs                                  |
|  - Thinking Loader & Interactive Image Galleries             |
+------------------------------+-------------------------------+
                               |
                               | Server Actions / HTTP
                               v
+--------------------------------------------------------------+
|                      Next.js Backend                         |
|  - Clerk Authentication                                      |
|  - Neon PostgreSQL (Chats, Bots, Chat Members, Usage Ledger) |
|  - Trigger.dev Session Management & Token Minting            |
|  - Sandbox Lifecycle Management (Auto-Hibernate & Wake)      |
+------------------------------+-------------------------------+
                               |
                               | Trigger Task Dispatch
                               v
+--------------------------------------------------------------+
|                  Trigger.dev Background Agent                |
|  - chat-agent Task with Gemini 3 Flash                       |
|  - Dynamic System Prompt Generation & Memory Auto-Preload    |
|  - Ephemeral Visual Pruning & Sliding Window Truncation      |
|  - Tool Guardrails & Self-Correction Feedback Loop           |
|  - Handoff & Tool Routing (Sandbox Tools + searchImages)     |
|  - Usage & Cost Ledger Persistence                           |
+------------------------------+-------------------------------+
                               |
                               | Daytona SDK / API
                               v
+--------------------------------------------------------------+
|                   Daytona Cloud Sandboxes                    |
|  - Isolated Linux Compute Runtime                            |
|  - Persistent Filesystem & MEMORY.md                         |
|  - Bash Execution & Development Tools                        |
|  - Xvfb + Xfce4 + x11vnc + noVNC (Port 6080)                 |
+--------------------------------------------------------------+
```

---

## Database Schema

The database is managed with Drizzle ORM on Neon Serverless PostgreSQL:

### bots
- id: Primary key (text nanoid)
- userId: Clerk user identifier
- name: Bot display name
- avatar: Seed string for DiceBear avatar generation
- job: Role or title (e.g. Frontend Engineer, DevOps Specialist)
- instructions: Custom system guidelines
- sandboxId: Associated Daytona sandbox identifier
- createdAt: Timestamp

### chats
- id: Primary key (text nanoid)
- userId: Clerk user identifier
- kind: Enum ("direct" | "group")
- name: Group chat name (null for direct chats)
- lastMessagesPreview: Text preview of recent activity
- lastMessageAt: Timestamp of latest message
- createdAt: Timestamp

### chat_members
- chatId: Foreign key referencing chats.id (cascade delete)
- botId: Foreign key referencing bots.id (cascade delete)
- joinedAt: Timestamp

### usage_ledgers
- id: Primary key (text nanoid)
- userId: Clerk user identifier
- botId: Foreign key referencing bots.id (set null on delete)
- chatId: Foreign key referencing chats.id (cascade delete)
- promptTokens: Integer (count of input tokens consumed)
- completionTokens: Integer (count of output tokens generated)
- totalTokens: Integer (sum of prompt and completion tokens)
- estimatedCostUsd: Numeric (estimated compute cost in USD)
- durationMs: Integer (execution duration in milliseconds)
- createdAt: Timestamp

---

## Getting Started

### Prerequisites
- Node.js 20 or higher
- npm, pnpm, or yarn
- Neon PostgreSQL database instance
- Daytona Cloud account and API key
- Trigger.dev v3 account and project
- Clerk application keys
- Google Gemini API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/mira.git
   cd mira/Mira-ai-teammate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env.local`:
   ```env
   DATABASE_URL="postgresql://..."
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
   CLERK_SECRET_KEY="sk_..."
   TRIGGER_SECRET_KEY="tr_..."
   NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY="pk_..."
   DAYTONA_API_KEY="daytona_..."
   DAYTONA_SERVER_URL="https://app.daytona.io/api"
   DAYTONA_TARGET="us"
   GOOGLE_GENERATIVE_AI_API_KEY="AIza..."
   ```

4. Push the database schema to Neon:
   ```bash
   npm run db:push
   ```

5. Start the development server and Trigger.dev agent runner:
   ```bash
   npm run dev
   # In a separate terminal
   npx trigger.dev@latest dev
   ```
