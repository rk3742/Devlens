# DevLens AI

**Codebase intelligence for engineering teams.**

DevLens AI indexes any GitHub repository and uses Google Gemini to give you instant, deep understanding of your codebase — architecture overviews, data flow diagrams, security audits, onboarding guides, natural-language Q&A, and automated pull-request reviews.

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
- Docker & Docker Compose
- A [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

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
GITHUB_WEBHOOK_SECRET=a_random_secret_for_webhook_hmac
GEMINI_API_KEY=your_google_gemini_api_key
JWT_SECRET=a_long_random_string_for_jwt_signing
```

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

### Backend

```bash
cd backend
cp .env.example .env
# Fill in .env with your credentials
npm install
# Apply the DB schema first (requires a running MySQL 8 instance):
mysql -u root -p < ../database/schema.sql
npm run dev      # starts with nodemon on port 5000
```

### Frontend

```bash
cd frontend
cp .env.example .env   # optional – CRA proxy handles /api in dev
npm install
npm start        # starts on port 3000, proxies /api to localhost:5000
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

1. In your GitHub repository go to **Settings → Webhooks → Add webhook**.
2. Set **Payload URL** to `https://<your-server>/webhooks/github`.
3. Set **Content type** to `application/json`.
4. Set **Secret** to the same value as your `GITHUB_WEBHOOK_SECRET` env var.
5. Select **Pull requests** events (or "Let me select individual events").
6. DevLens will automatically post an AI review on every new/updated PR.

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
