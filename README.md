# AgriTech - Smart Agriculture Management Platform

AgriTech is an integrated full-stack agricultural management platform designed for precision agriculture, soil analytics, localized crop weather intelligence, and harvest yield forecasting.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, JavaScript, Bootstrap 5, Bootstrap Icons, React Router 7
- **Backend:** Node.js (v24), Express 4 (REST API), CORS, Morgan
- **Database (Target):** MongoDB Atlas with Mongoose ODM
- **Authentication (Target):** JWT (JSON Web Tokens) with bcrypt password hashing
- **Analytics & Dashboards:** Recharts
- **Version Control:** Git

---

## 📁 Project Structure

```
AgriTech/
├── client/                     # Frontend React (Vite) application
│   ├── public/                 # Static assets
│   ├── src/                    # React source code (components, pages, styles)
│   ├── .env.example            # Client environment template
│   ├── package.json            # Client dependencies & scripts
│   └── vite.config.js          # Vite config with API proxy
├── server/                     # Backend Node.js / Express API
│   ├── src/
│   │   ├── routes/             # Express API routes
│   │   │   └── health.js       # Health check route (/api/health)
│   │   ├── app.js              # Express app initialization & middleware
│   │   └── server.js           # Server entry point & listener
│   ├── .env.example            # Server environment template
│   └── package.json            # Server dependencies & scripts
├── .env.example                # Root environment template
├── .gitignore                  # Git ignore rules for node_modules, .env, build output
├── package.json                # Root orchestration scripts (concurrently)
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v18.0.0 or higher (v24+ recommended)
- **npm:** v9.0.0 or higher
- **Git**

### Installation

Clone the repository and install all dependencies:

```bash
# Install root orchestration tools
npm install

# Install client and server dependencies
npm run install:all
```

Alternatively, you can install dependencies individually:

```bash
cd server && npm install
cd ../client && npm install
```

### Environment Configuration

Copy the sample environment files:

```bash
# Server environment
cp server/.env.example server/.env

# Client environment
cp client/.env.example client/.env
```

Default server configuration:
- `PORT=5000`
- `NODE_ENV=development`
- `CLIENT_URL=http://localhost:5173`

Default client configuration:
- `VITE_API_URL=http://localhost:5000/api`

---

## 🏃 Running the Application

### Option A: Run Both Applications Concurrently (Recommended)

From the project root:

```bash
npm run dev
```

This starts:
- Express backend at **http://localhost:5000**
- React Vite frontend at **http://localhost:5173** (with `/api` proxy to `:5000`)

### Option B: Run Services Individually

In separate terminal tabs:

1. **Start Backend Server:**
   ```bash
   npm run server
   # or
   cd server && npm run dev
   ```

2. **Start Frontend Client:**
   ```bash
   npm run client
   # or
   cd client && npm run dev
   ```

---

## 🔍 Verification & Health Check

### 1. Backend Health Check
Send a GET request to the Express health endpoint:

```bash
# Terminal (curl / PowerShell)
curl http://localhost:5000/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "message": "AgriTech API Server is operational",
  "timestamp": "2026-10-20T18:25:00.000Z",
  "uptime": 12.34,
  "environment": "development"
}
```

### 2. Frontend Production Build
To verify the production build of the React application:

```bash
npm run build
```

This executes `vite build` inside `client/` and compiles optimized static assets into `client/dist/`.

---

## 📋 Milestone Roadmap

- [x] **Milestone 1: Working Scaffold** — Full project scaffolding, React landing page, Express health check, proxy, build verification.
- [ ] **Milestone 2: Database & Authentication** — MongoDB Atlas integration, Mongoose schemas (User, Farm), JWT auth endpoints (register/login/verify).
- [ ] **Milestone 3: Core AgriTech Domain Models** — Field management, soil telemetry, sensor logs, and crop tracking endpoints.
- [ ] **Milestone 4: Dashboard & Analytics** — Protected farmer portal, Recharts data visualization, real-time metrics.
- [ ] **Milestone 5: Production Deployment Readiness** — Containerization / production scripts, security headers (Helmet), validation.
