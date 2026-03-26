# DevLens AI

**Codebase intelligence for engineering teams.**

DevLens AI indexes any GitHub repository and uses Google Gemini to give you instant, deep understanding of your codebase — architecture overviews, data flow diagrams, security audits, onboarding guides, natural-language Q&A, and automated pull-request reviews.

---

## ⚡ TL;DR — Open and Run in 3 Steps

> **Recommended editor:** [VS Code](https://code.visualstudio.com/)

**Step 1 — Clone the repo and open it**

```bash
git clone https://github.com/rk3742/Devlens.git
cd Devlens
code .           # opens the whole project in VS Code
```

**Step 2 — Set your credentials** (one-time setup)

```bash
cp backend/.env.example backend/.env
# Then open backend/.env in your editor and fill in:
#   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GEMINI_API_KEY, JWT_SECRET
```

> See [Prerequisites](#prerequisites) below if you don't have those keys yet.

**Step 3 — Install dependencies and start everything**

```bash
npm install           # installs the root dev tools (concurrently)
npm run install:all   # installs backend + frontend node_modules
npm run dev           # starts backend on :5000 AND frontend on :3000 together
```

Open your browser at **http://localhost:3000** — you will see the DevLens login page. ✅

> **Need a database?** The easiest path is Docker: `docker-compose up db` starts MySQL alone, or `docker-compose up --build` starts the whole stack. See [Quick Start (Docker)](#-quick-start-docker) below.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏗️ **Architecture Overview** | AI-generated summary of layers, entry points, tech stack |
| 🔀 **Data Flow Analysis** | Traces how data moves through the system |
| 🚀 **Start Here Guide** | Onboarding guide for new developers |
| 📊 **Code Complexity** | Hotspot detection and nesting analysis |
| 🪦 **Dead Code Detection** | Finds unused functions, variables, unreachable code |
| 🔄 **Circular Dependency Scan** | Detects and explains import cycles |
| 🔒 **Security Scan** | Identifies SQL injection, XSS, hardcoded secrets, and more |
| 💸 **Technical Debt** | Categorises and estimates remediation effort |
| 📄 **File Summary** | One-click AI explanation of any file |
| 💬 **Natural Language Q&A** | Ask any question about the codebase in plain English |
| 🤖 **PR Auto-Review** | Automatic AI review posted on every pull request via GitHub webhooks |
| 🔑 **GitHub OAuth** | Secure sign-in; tokens never stored in plaintext |

---

## 🗂️ Project Structure

```
Devlens/
├── backend/          # Express.js API
│   ├── src/
│   │   ├── app.js
│   │   ├── config/       # DB connection pool
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Auth (JWT), error handler
│   │   ├── routes/       # Express routers
│   │   ├── services/     # Business logic
│   │   └── utils/        # Logger
│   ├── Dockerfile
│   └── .env.example
├── frontend/         # React 18 SPA
│   ├── src/
│   │   ├── components/   # Navbar, RepoConnect
│   │   ├── hooks/        # useAuth
│   │   ├── pages/        # Dashboard, Analysis, Q&A, PR Reviews, Login, AuthCallback
│   │   └── services/     # axios API wrappers
│   ├── Dockerfile
│   └── .env.example
├── database/
│   └── schema.sql    # MySQL 8.0 schema
└── docker-compose.yml
```

---

## 🚀 Quick Start (Docker)

### Prerequisites

Before you can run DevLens AI you need three things:

| Prerequisite | Where to get it | Takes ~2 min |
|---|---|---|
| **GitHub OAuth App** | [github.com → Settings → Developer settings → OAuth Apps → New](https://github.com/settings/developers) | Set callback URL to `http://localhost:5000/auth/github/callback` |
| **Google Gemini API key** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Free tier is sufficient |
| **MySQL 8** | Install locally _or_ use `docker-compose up db` (no local MySQL needed) | Docker is the easiest option |

### 1. Clone and configure

```bash
git clone https://github.com/rk3742/Devlens.git
cd Devlens
```

Copy the backend environment template and fill in your credentials:

```bash
cp backend/.env.example .env   # docker-compose reads from root .env
```

Required variables (in your root `.env`):

```env
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
GITHUB_WEBHOOK_SECRET=a_long_random_string_you_create_yourself
GEMINI_API_KEY=your_google_gemini_api_key
JWT_SECRET=a_long_random_string_for_jwt_signing
```

> **What is `GITHUB_WEBHOOK_SECRET`?**
> It is a secret string that **you create yourself** — GitHub does not issue it.
> You choose any long random value (generate one with `openssl rand -hex 32`), set it here,
> and then paste the **same value** into the **Secret** field when you add a webhook in your
> GitHub repository settings (Settings → Webhooks → Add webhook).
> GitHub uses it to sign every payload it sends; DevLens verifies the signature so it only
> processes genuine payloads. See the [PR Auto-Review Setup](#-pr-auto-review-setup) section below.

### 2. Set up your GitHub OAuth App

In your GitHub OAuth App settings set:
- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:5000/auth/github/callback`

### 3. Start the stack

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| MySQL | localhost:3306 |

---

## 🔧 Manual Setup (without Docker)

This is the recommended approach for active development.

### Recommended editor: VS Code

1. Install [VS Code](https://code.visualstudio.com/) and open the project root:
   ```bash
   code /path/to/Devlens
   ```
2. Use VS Code's **integrated terminal** (`Ctrl+`` ` `` or `Terminal → New Terminal`) — you can split it into two panes: one for the backend, one for the frontend.
3. Suggested VS Code extensions:
   - **ESLint** (`dbaeumer.vscode-eslint`)
   - **Prettier** (`esbenp.prettier-vscode`)
   - **REST Client** (`humao.rest-client`) – for testing API endpoints directly in VS Code

---

### Step-by-step

#### 1 — Database (MySQL 8)

Option A – Docker (recommended, no local MySQL needed):
```bash
docker-compose up db -d      # starts MySQL on localhost:3306 in background
```

Option B – Local MySQL:
```bash
mysql -u root -p < database/schema.sql
```

#### 2 — Backend (Express.js API on port 5000)

```bash
cd backend
cp .env.example .env         # copy the template
# Open .env and fill in: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
#                          GEMINI_API_KEY, JWT_SECRET (all required)
npm install
npm run dev                  # starts with nodemon – auto-restarts on save
```

You should see:
```
[DevLens] Server running on port 5000
[DevLens] Database connection pool ready
```

#### 3 — Frontend (React app on port 3000)

Open a **second terminal** (keep the backend running):
```bash
cd frontend
npm install
npm start                    # opens http://localhost:3000 in your browser automatically
```

> The CRA dev proxy forwards all `/api/*` and `/auth/*` requests to `http://localhost:5000` — no extra config needed.

#### 4 — Run both at once (shortcut)

From the **project root** (after completing step 2 setup):
```bash
npm install           # installs concurrently dev dependency
npm run dev           # starts backend + frontend simultaneously with colour-coded output
```

### Tests (backend)

```bash
cd backend && npm test
```

---

## 🔌 API Reference

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/github` | Initiate GitHub OAuth flow |
| `GET` | `/auth/github/callback` | OAuth callback – issues JWT, redirects to SPA |
| `GET` | `/auth/me` | Returns current user profile (JWT required) |

### Repositories

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/repos` | List all indexed repositories |
| `POST` | `/api/repos/connect` | Connect & index a new repository |
| `GET` | `/api/repos/:id` | Get repository summary |
| `GET` | `/api/repos/:id/pr-reviews` | List AI PR reviews for a repo |

### Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/analysis/:repoId/run` | Run an analysis job (`type` in body) |
| `POST` | `/api/analysis/:repoId/file-summary` | Summarise a single file |
| `GET` | `/api/analysis/:repoId/jobs` | List analysis jobs |
| `GET` | `/api/analysis/jobs/:jobId` | Get job result |

**Analysis types:** `architecture_overview` · `data_flow` · `start_here` · `complexity` · `dead_code` · `circular_deps` · `security_scan` · `tech_debt`

### Q&A

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/qa/:repoId/sessions` | Create a conversation session |
| `GET` | `/api/qa/:repoId/sessions` | List sessions |
| `GET` | `/api/qa/sessions/:id/messages` | Get session messages |
| `POST` | `/api/qa/sessions/:id/ask` | Ask a question |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhooks/github` | Receive GitHub events (HMAC-verified) |

---

## 🤖 PR Auto-Review Setup

DevLens automatically posts an AI-generated review to every pull request by receiving a GitHub webhook.

### What is the GitHub Webhook Secret?

The **Webhook Secret** (`GITHUB_WEBHOOK_SECRET`) is a string that **you invent** — GitHub does not
give it to you. You create it once, put it in two places, and GitHub uses it to prove every
payload it sends is genuine:

| Place | What to do |
|---|---|
| Your `.env` file | Set `GITHUB_WEBHOOK_SECRET=<your secret>` |
| GitHub webhook form | Paste the **same value** into the **Secret** field |

**How to generate a strong secret:**

```bash
openssl rand -hex 32
# example output: 4b7e9c3f1a2d8e6b0f5c9a7d3e1b4f8c2d6a0e4b8f3c7a1d5e9b2f6a0c4e8b1f
```

Copy that output, paste it into your `.env` as `GITHUB_WEBHOOK_SECRET=...`, then paste it again
into the GitHub webhook Secret field below.

### Steps to enable webhook

1. In your GitHub repository go to **Settings → Webhooks → Add webhook**.
2. Set **Payload URL** to `https://<your-server>/webhooks/github`.
3. Set **Content type** to `application/json`.
4. Set **Secret** to the same value you put in `GITHUB_WEBHOOK_SECRET`.
5. Under **Which events**, select **Pull requests** (or "Let me select individual events" → Pull requests).
6. Click **Add webhook** — DevLens will automatically post an AI review on every new/updated PR.

---

## 🗃️ Database Schema

```
users            – GitHub OAuth users (token encrypted at rest in production)
repositories     – indexed repos (status: pending → indexing → indexed / error)
repo_files       – metadata per file
file_chunks      – chunked file content for AI context windows
analysis_jobs    – per-repo AI analysis results
qa_sessions      – named Q&A conversations
qa_messages      – user + assistant turns
pr_reviews       – AI PR review results (upserted per PR number)
```

---

## 🔐 Security

- GitHub access tokens are stored in the database; **use encrypted columns or a secrets manager in production**.
- JWTs are signed with `JWT_SECRET` (HS256). Use a long random value.
- Webhook payloads are verified with HMAC-SHA256 (`crypto.timingSafeEqual`).
- Auth routes are rate-limited (20 req / 15 min per IP).
- All API routes are protected by JWT middleware.
- Helmet and CORS are configured on the Express server.

---

## 📄 License

MIT
