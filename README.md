# AgriTech — Smart Agriculture Management & Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B%20%7C%2022%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square)]()

**AgriTech** is an enterprise-grade Smart Agriculture Management and Precision Farm Intelligence Platform designed to empower modern farmers, agricultural cooperatives, and platform governance teams. Built on a robust full-stack foundation (React 19, Vite, Express, and MongoDB Atlas), AgriTech bridges field-level IoT telemetry with administrative governance, visual crop journals, live agricultural meteorological forecasts, and multi-regional localization across India's primary agricultural belts.

---

## Live Deployments

- **Frontend Application (Vercel)**: [https://agritech-bay.vercel.app](https://agritech-bay.vercel.app)
- **Backend API Server (Render)**: [https://agritech-server-y2px.onrender.com](https://agritech-server-y2px.onrender.com)
- **API Health & Diagnostics**: [https://agritech-server-y2px.onrender.com/api/health](https://agritech-server-y2px.onrender.com/api/health)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Dual-Portal Ecosystem](#dual-portal-ecosystem)
3. [Key Modules & Capabilities](#key-modules--capabilities)
   - [Farmer Intelligence Workspace](#1-farmer-intelligence-workspace)
   - [Enterprise Governance Gateway (8 Domains)](#2-enterprise-governance-gateway-8-domains)
   - [Authentication & Identity System](#3-authentication--identity-system)
   - [Multilingual Localization Engine](#4-multilingual-localization-engine)
4. [Technology Stack](#technology-stack)
5. [Repository Structure](#repository-structure)
6. [Getting Started & Local Setup](#getting-started--local-setup)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running Locally](#running-locally)
7. [Comprehensive API Reference](#comprehensive-api-reference)
8. [Automated Testing & Quality Assurance](#automated-testing--quality-assurance)
9. [Production Deployment Guide](#production-deployment-guide)
10. [Security & Isolation Guarantees](#security--isolation-guarantees)
11. [License](#license)

---

## System Architecture

AgriTech enforces strict separation of concerns, multi-tenant owner isolation, and role-based access control (RBAC).

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React 19 + Vite SPA)"]
        UI["Modern UI (Bootstrap 5 + Icons)"]
        Router["React Router v6 Navigation"]
        AuthCtx["AuthContext & Session Vault"]
        LangCtx["LanguageContext (9 Indian Languages)"]
        GIS["Google Identity Services (GSI)"]
    end

    subgraph CDN ["Edge & Routing Layer"]
        Vercel["Vercel Edge SPA Hosting"]
        Rewrites["client/vercel.json (SPA Rewrites)"]
    end

    subgraph Backend ["Backend API Layer (Express.js on Render)"]
        App["Express 4 Application"]
        CORS["Strict Dynamic CORS & Security Headers"]
        AuthGuard["JWT & RBAC Middleware"]
        Tenancy["Owner-Isolation Tenancy Filters"]
        Controllers["Domain Controllers"]
    end

    subgraph Storage ["Persistence & External Services"]
        Atlas[("MongoDB Atlas Cluster")]
        Blob[("Vercel Blob Storage - Photos")]
        Weather["Open-Meteo API - Live Telemetry"]
        GoogleAuth["Google OAuth Token Verifier"]
    end

    Client -->|HTTPS / API Requests| Vercel
    Vercel -->|Reverse Proxy / Direct| Backend
    Backend -->|Mongoose ODM| Atlas
    Backend -->|Multipart Streaming| Blob
    Backend -->|Weather Telemetry| Weather
    Backend -->|Token Validation| GoogleAuth
```

---

## Dual-Portal Ecosystem

AgriTech features two purpose-built environments sharing a unified authentication backbone:

1. **Farmer Workspace**:
   - Tailored for field managers and growers.
   - Streamlined navigation: Dashboard, Farms, Operations, Monitoring, Inventory, Analytics, and Profile.
   - Private and tenant-isolated: farmers can only see, create, and manage records belonging to their account.
2. **Enterprise Governance Gateway (Admin Console)**:
   - Dedicated governance suite with isolated navigation and high-density administration panels.
   - 8 comprehensive administrative domains for platform operators, agronomists, and regulators.
   - Enforces last-active-admin safeguards and administrator access controls.

---

## Key Modules & Capabilities

### 1. Farmer Intelligence Workspace

- **Farm & Field Management**:
  - Hierarchical structure: Farm $\rightarrow$ Fields.
  - Multi-attribute tracking: total land acreage, soil classification (Alluvial, Black Soil, Red Sandy, Loamy, Clay), and water source infrastructure (Canal, Borewell, Drip Irrigation, Rainfed).
  - Geographic coordinates (latitude/longitude) with automatic field boundary calculation.
  - Deletion safeguards: Farms with active fields cannot be deleted until fields are cleared or re-assigned.
- **Crop Cycle Lifecycle**:
  - Full-season cycle planning from sowing to harvest.
  - Stage tracking: Germination, Vegetative, Flowering, Grain Filling, Maturity, and Harvested.
  - Yield targets versus actual harvested output comparisons with variance analytics.
- **Field Photo Journal & Visual History**:
  - Multipart image uploads with MIME-type and magic-byte verification (JPEG, PNG, WebP).
  - Direct integration with `@vercel/blob` cloud storage with local disk fallback in development.
  - Chronological photo timeline linked to specific fields, dates, and crop cycles.
- **Operations & Task Scheduling**:
  - Operational dispatch for irrigation, chemical applications, tillage, fertilization, and harvesting.
  - Priority levels (`low`, `medium`, `urgent`), due dates, and completion status.
- **Live Weather & IoT Telemetry**:
  - Real-time weather data powered by Open-Meteo (temperature, relative humidity, wind speed, precipitation, pressure).
  - 7-day agricultural meteorological forecasts with precipitation likelihood.
  - IoT Telemetry simulation: simulated sensor nodes delivering soil moisture, ambient temperature, and leaf wetness readings.
- **Inventory & Supply Management**:
  - Track on-farm supplies across seeds, fertilizers, pesticides, fuel, and machinery parts.
  - Low-stock visual thresholds and automated reorder alerts.
- **Strategic Analytics**:
  - Yield forecasting, input consumption trends, and seasonal expense breakdowns.

### 2. Enterprise Governance Gateway (8 Domains)

Platform administrators have access to an isolated governance console covering:

1. **Platform Overview**: Real-time KPI summaries, active farmer counts, total hectares under management, and system-wide activity feeds.
2. **User Management & Support**: User lifecycle administration, account status toggles (`active`, `suspended`), user support assistance (password resets and email verification), and farmer inquiry ticketing.
3. **Content & Advisory Hub**: Creation and publication of regional crop guidelines, pest advisories, and best management practices.
4. **Resource Management**: Global supplier directories, platform-wide input inventory coordination, and automated replenishment orders.
5. **Service Management**: Agricultural service offerings (e.g., Drone Spraying, Soil Testing, Harvester Rental) and booking schedule dispatch.
6. **Strategic Analytics**: Regional crop distribution matrices, platform adoption growth curves, and downloadable strategic reports.
7. **Security & Policies**: Security audit log inspection, IP blocklisting/unblocking, policy violation recording, and regulatory compliance enforcement.
8. **System Maintenance**: Database connectivity diagnostics, system health checks, cache clearance, and emergency maintenance mode toggles.

### 3. Authentication & Identity System

- **Dual-Mode Sign In**: Seamless support for standard Email/Password authentication and one-click Google Sign-In via Google Identity Services (GIS).
- **Session Restoration & Token Security**:
  - JWT-based authentication with cryptographic signatures and expiration.
  - Optimized non-blocking session restoration on public routes to eliminate layout shift and page flickering.
  - Passwords hashed with `bcryptjs` (salt rounds: 12) with a strict length constraint of 10–128 characters.
- **Email Verification & Self-Service Recovery**:
  - Automated verification link delivery via `nodemailer`.
  - Rate-limited resend mechanisms with dynamic cooldown countdowns.
  - Cryptographically secure password reset tokens with time-to-live (TTL) expiration.
- **Strict Account & Role Model**:
  - Public registration creates `farmer` accounts exclusively.
  - Server-side authorization strictly protects governance endpoints and rejects client-supplied role elevation.

### 4. Multilingual Localization Engine

AgriTech features first-class regional language support covering India's major agricultural belts with instantaneous client-side switching:

| Language | Code | Region & Agricultural Context |
| :--- | :---: | :--- |
| **English** | `en` | Pan-India & Global Platform Default |
| **हिन्दी (Hindi)** | `hi` | Northern & Central India (UP, MP, Bihar, Rajasthan, Haryana) |
| **ਪੰਜਾਬੀ (Punjabi)** | `pa` | Punjab & Haryana (Wheat & Paddy Granary) |
| **मराठी (Marathi)** | `mr` | Maharashtra (Cotton, Sugarcane, Soybean, Pulses, Onion) |
| **ગુજરાતી (Gujarati)** | `gu` | Gujarat (Cotton, Groundnut, Spices, Castor) |
| **తెలుగు (Telugu)** | `te` | Andhra Pradesh & Telangana (Rice, Cotton, Chili) |
| **ಕನ್ನಡ (Kannada)** | `kn` | Karnataka (Ragi, Maize, Sugarcane, Pulses, Coffee) |
| **தமிழ் (Tamil)** | `ta` | Tamil Nadu (Cauvery Delta Rice, Coconut, Banana) |
| **বাংলা (Bengali)** | `bn` | West Bengal (Paddy, Jute, Horticulture) |

The user's language preference is stored locally and synchronized with their profile upon login.

---

## Technology Stack

### Frontend Architecture
- **Core Framework**: React 19 (`react` 19.3, `react-dom` 19.3)
- **Build System**: Vite 8 (`vite` 8.3) with `@vitejs/plugin-react`
- **Routing**: React Router v6 (`react-router-dom` 7.18)
- **Styling**: Bootstrap 5.3, Bootstrap Icons 1.13, and custom CSS design system
- **Third-Party Identity**: Google Identity Services (`https://accounts.google.com/gsi/client`)

### Backend Architecture
- **Runtime Environment**: Node.js (ES Modules, `node:test` native test runner)
- **Web Framework**: Express.js 4.21
- **Database & ODM**: MongoDB Atlas via Mongoose 8.9
- **Media Storage**: `@vercel/blob` for field photographs
- **Security & Cryptography**: `jsonwebtoken`, `bcryptjs`, `google-auth-library`
- **Utility & Middleware**: `cors`, `morgan`, `multer`, `nodemailer`, `dotenv`

---

## Repository Structure

```
AgriTech/
├── client/                     # Frontend Vite + React application
│   ├── public/                 # Static assets, icons, and hero photography
│   │   ├── images/             # Farm visual hero assets
│   │   ├── favicon.svg         # Application brand icon
│   │   └── icons.svg           # Sprite definitions
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── GoogleSignInButton.jsx # Flicker-free GIS button with single-init
│   │   │   ├── LanguageToggle.jsx     # Regional language selector dropdown
│   │   │   └── ProtectedRoute.jsx     # Route authentication guard
│   │   ├── context/            # React context providers & hooks
│   │   │   ├── AuthContext.jsx        # Auth state, actions, session validation
│   │   │   ├── LanguageContext.jsx    # 9-language localization provider
│   │   │   ├── useAuth.js             # Auth consumption hook
│   │   │   └── useLanguage.js         # Translation & language hook
│   │   ├── lib/                # Client utilities and translations
│   │   │   ├── api.js                 # API request wrapper with JWT injection
│   │   │   └── translations.js        # 3,700+ line localization dictionary
│   │   ├── pages/              # Primary route views (14 comprehensive pages)
│   │   │   ├── AdminPage.jsx          # 8-domain governance console
│   │   │   ├── AnalyticsPage.jsx      # Agricultural trends and metrics
│   │   │   ├── AuthPage.jsx           # Unified Farmer & Admin auth gateway
│   │   │   ├── DashboardPage.jsx      # Farmer home overview
│   │   │   ├── FarmDetailPage.jsx     # Field manager, crops, photo gallery
│   │   │   ├── FarmsPage.jsx          # Farm creation and listing
│   │   │   ├── InventoryPage.jsx      # Supplies and stock alerts
│   │   │   ├── LandingPage.jsx        # Public showcase and feature tour
│   │   │   ├── MonitoringPage.jsx     # Live weather & IoT telemetry
│   │   │   ├── OperationsPage.jsx     # Tasks, irrigation & operational logs
│   │   │   ├── ProfilePage.jsx        # User account & security preferences
│   │   │   └── ...                    # Password reset & verification pages
│   │   ├── App.jsx             # Main router & environment isolation shell
│   │   ├── main.jsx            # React root with StrictMode enabled
│   │   └── App.css             # Platform styling tokens and design system
│   ├── package.json
│   ├── vercel.json             # Client-side SPA routing fallback
│   └── vite.config.js
│
├── server/                     # Backend Express.js REST API
│   ├── src/
│   │   ├── config/             # Environment, DB, and connection diagnostics
│   │   │   ├── db.js           # Mongoose connection with sanitized diagnostics
│   │   │   └── env.js          # Production environment validation
│   │   ├── controllers/        # Request handlers (Admin, Farms, Auth, etc.)
│   │   ├── middleware/         # Auth verification, rate limiting, error handlers
│   │   ├── models/             # Mongoose schemas (User, Farm, Field, etc.)
│   │   ├── routes/             # REST endpoint route definitions
│   │   ├── scripts/            # Bootstrap and database utilities
│   │   ├── services/           # Business logic (Weather, Simulator, Email, Auth)
│   │   ├── storage/            # Data stores and photo storage adapters
│   │   ├── app.js              # Express app factory & middleware stack
│   │   └── server.js           # HTTP server bootstrap entry point
│   ├── tests/                  # Automated test suites (native node:test)
│   │   ├── admin_domains_suite.test.js
│   │   ├── admin_permissions_security.test.js
│   │   ├── auth.test.js
│   │   └── monitoring_weather.test.js
│   └── package.json
│
├── package.json                # Root orchestration workspace
├── vercel.json                 # Vercel multi-service routing definition
└── README.md
```

---

## Getting Started & Local Setup

### Prerequisites

- **Node.js**: `v20.19+` or `v22.12+` (Node 22 LTS or newer recommended; Node 24 supported)
- **npm**: `v10+`
- **MongoDB**: A running MongoDB instance or a free MongoDB Atlas connection string

### Installation

Clone the repository and install all dependencies across the workspace:

```bash
git clone https://github.com/shravan-arch/AgriTech.git
cd AgriTech

# Install root dependencies
npm install

# Install client and server dependencies concurrently
npm run install:all
```

### Environment Configuration

Create environment configuration files from the provided templates:

#### 1. Server Configuration (`server/.env`)
```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your settings:

```env
# Runtime Mode & Networking
PORT=5000
NODE_ENV=development

# Database Persistence
# Required for persistent mode. Use your MongoDB Atlas or local MongoDB URI.
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/agritech?retryWrites=true&w=majority

# Optional: Set to 'local-json' ONLY for explicit offline local development without MongoDB
STORAGE_MODE=

# Security & Tokens (Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d

# CORS Allowed Origins (Comma-separated for multiple origins)
CLIENT_URL=http://localhost:5173

# Third-Party Google Sign-In (Optional for local dev)
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# Email Service (Optional for local dev; uses console fallback if unset)
EMAIL_SERVICE_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=AgriTech <no-reply@agritech.com>

# Vercel Blob Cloud Storage (Optional for field photos; local fallback active if unset)
BLOB_READ_WRITE_TOKEN=
```

#### 2. Client Configuration (`client/.env`)
```bash
cp client/.env.example client/.env
```

Edit `client/.env`:

```env
# Backend API Base Path (Vite dev server proxies /api to http://localhost:5000)
VITE_API_URL=/api

# Google Identity Services Client ID
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

### Running Locally

Run both frontend and backend concurrently with one command from the project root:

```bash
npm run dev
```

- **Client**: `http://localhost:5173`
- **API Server**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

Alternatively, you can run services independently:
```bash
# Terminal 1 (Backend API)
npm run server

# Terminal 2 (Frontend Client)
npm run client
```

---

## Comprehensive API Reference

All requests and responses use JSON formatting (`Content-Type: application/json`). Authenticated requests must supply an `Authorization: Bearer <JWT>` header.

### 1. Health & Diagnostics
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | Public | Returns server readiness, uptime, and database persistence status. |

### 2. Authentication & Account
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Register new farmer account (`name`, `email`, `password`, `language`). |
| `POST` | `/api/auth/login` | Public | Authenticate with credentials and receive JWT session token. |
| `POST` | `/api/auth/google` | Public | Authenticate via Google Identity Services ID credential. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile and role details. |
| `PUT` | `/api/auth/profile` | Authenticated | Update user profile information and preferred regional language. |
| `POST` | `/api/auth/verify-email` | Public | Verify email address using cryptographic token. |
| `POST` | `/api/auth/resend-verification` | Public | Resend email verification link with cooldown. |
| `POST` | `/api/auth/forgot-password` | Public | Request a password reset link. |
| `POST` | `/api/auth/reset-password` | Public | Set new password using reset token. |

### 3. Farms & Field Management
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/farms` | Authenticated | List all farms owned by the authenticated user. |
| `POST` | `/api/farms` | Authenticated | Create a new farm (`name`, `location`). |
| `GET` | `/api/farms/:farmId` | Owner | Retrieve detailed farm profile and summary statistics. |
| `PATCH` | `/api/farms/:farmId` | Owner | Update farm metadata. |
| `DELETE` | `/api/farms/:farmId` | Owner | Delete farm (requires all associated fields to be deleted first). |
| `GET` | `/api/farms/:farmId/fields` | Owner | List fields belonging to the specified farm. |
| `POST` | `/api/farms/:farmId/fields` | Owner | Add field (`name`, `areaHectares`, `soilType`, `waterSource`). |
| `PATCH` | `/api/farms/fields/:fieldId` | Owner | Update field attributes. |
| `DELETE` | `/api/farms/fields/:fieldId` | Owner | Delete field and associated records. |

### 4. Operations, Tasks & Crop Cycles
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/farms/:farmId/crop-cycles` | Owner | Retrieve crop cycles on owned fields. |
| `POST` | `/api/farms/:farmId/crop-cycles` | Owner | Create and schedule crop cycle. |
| `PATCH` | `/api/farms/crop-cycles/:cycleId`| Owner | Update crop cycle stage or record yield. |
| `GET` | `/api/farms/:farmId/tasks` | Owner | List farm activities, tasks, and operational logs. |
| `POST` | `/api/farms/:farmId/tasks` | Owner | Create operational task (irrigation, spraying, fertilizing). |
| `PATCH` | `/api/farms/tasks/:taskId` | Owner | Update task status or mark complete. |

### 5. Field Photography & Visual Journal
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/farms/:farmId/photos` | Owner | Upload field photograph (`multipart/form-data`, magic-byte verified). |
| `GET` | `/api/farms/:farmId/photos` | Owner | List chronological field photographs. |
| `DELETE` | `/api/farms/photos/:photoId` | Owner | Remove photograph record and delete stored blob bytes. |

### 6. Weather & Telemetry Sensors
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/weather/:farmId` | Owner | Retrieve live Open-Meteo weather and agricultural forecast for farm. |
| `GET` | `/api/weather/:farmId/history` | Owner | Fetch historical weather range (24h, 7d, 30d). |
| `GET` | `/api/sensors/:farmId` | Owner | List sensor nodes and live telemetry readings. |
| `POST` | `/api/sensors/simulator/start`| Dev/Owner | Start simulated telemetry feed (disabled in production). |
| `POST` | `/api/sensors/simulator/stop` | Dev/Owner | Stop active telemetry simulation session. |

### 7. Inventory & Farm Finances
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/inventory` | Authenticated | List all inventory items and stock levels. |
| `POST` | `/api/inventory` | Authenticated | Log new inventory item and low-stock threshold. |
| `PATCH` | `/api/inventory/:id` | Authenticated | Update stock quantities or record usage. |
| `GET` | `/api/finances/:farmId` | Owner | Retrieve operational expense and revenue ledger. |

### 8. Enterprise Governance (Admin Only)
| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/admin/system-health` | Admin | Comprehensive system health & diagnostics. |
| `GET` | `/api/admin/users` | Admin | List all platform users with filtering and pagination. |
| `POST` | `/api/admin/users/:id/verify-email` | Admin | Manually verify a user's email address. |
| `POST` | `/api/admin/users/:id/reset-password` | Admin | Generate a secure password reset link for user assistance. |
| `PUT` | `/api/admin/users/:id/status` | Admin | Toggle user account status (`active`, `suspended`). |
| `GET` | `/api/admin/support-tickets` | Admin | Retrieve farmer support queries and inquiries. |
| `PUT` | `/api/admin/support-tickets/:id`| Admin | Reply to and resolve support inquiry. |
| `POST` | `/api/admin/content` | Admin | Publish crop advisory and agricultural knowledge article. |
| `GET` | `/api/admin/security/overview` | Admin | Threat radar and security policy overview. |
| `POST` | `/api/admin/security/block-ip` | Admin | Block or unblock an IP address. |
| `GET` | `/api/admin/audit-logs` | Admin | View immutable security audit logs. |
| `POST` | `/api/admin/maintenance/mode` | Admin | Toggle platform maintenance mode. |

---

## Automated Testing & Quality Assurance

AgriTech includes a comprehensive automated test suite powered by the native Node.js test runner (`node:test` and `node:assert`). Tests cover authentication, owner isolation, field photo security, database failure fallbacks, admin permissions, and live weather services.

Run the entire test suite:
```bash
npm test
```

Individual test suites can be executed independently:
```bash
# 1. Core Authentication & Tenant Management (52 tests)
npm --prefix server test tests/auth.test.js

# 2. Administrative Role & Permission Security Suite (11 tests)
node --test server/tests/admin_permissions_security.test.js

# 3. Enterprise 8-Domain Governance Suite (12 tests)
node --test server/tests/admin_domains_suite.test.js

# 4. Monitoring, Weather & Sensor Simulator Suite (14 tests)
node --test server/tests/monitoring_weather.test.js
```

### Frontend Build Verification
Verify that the client builds cleanly without bundle warnings or syntax errors:
```bash
npm --prefix client run build
```

---

## Production Deployment Guide

### Architecture Topology
- **Frontend SPA**: Hosted on [Vercel](https://vercel.com/) with global edge CDN caching and SPA rewrite fallbacks.
- **Backend API Server**: Hosted on [Render](https://render.com/) running Node.js / Express with persistent connection pooling to MongoDB Atlas.

### 1. Deploying the Backend API (Render)
1. Create a new **Web Service** on Render connected to this repository.
2. Configure settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Configure Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default assigned by Render)
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/agritech?retryWrites=true&w=majority`
   - `JWT_SECRET`: A secure random string (minimum 32 characters)
   - `CLIENT_URL`: `https://agritech-bay.vercel.app` (your frontend production domain)
   - `BLOB_READ_WRITE_TOKEN`: (Optional) Vercel Blob token for cloud photo storage
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID

### 2. Deploying the Frontend Client (Vercel)
1. Import the repository into Vercel.
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
3. Configure Environment Variables in Vercel:
   - `VITE_API_URL`: `https://agritech-server-y2px.onrender.com/api` (your Render backend URL)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
4. The included [client/vercel.json](client/vercel.json) automatically routes all SPA paths (e.g., `/login`, `/dashboard`, `/admin`) to `/index.html` to eliminate 404s on page reload.

---

## Security & Isolation Guarantees

- **Multi-Tenant Data Isolation**: Database queries and mutations strictly incorporate the authenticated user's ID (`owner: req.user._id`). Users cannot view, modify, or delete farms, fields, crop cycles, or operational logs belonging to other farmers.
- **Last Active Administrator Protection**: The system prevents suspending the sole active administrator account, eliminating accidental lockout scenarios.
- **Credential Sanitization**: Startup logs and error diagnostics redact database credentials (`mongodb+srv://***:***@...`) to prevent credential leakage in application log streams.
- **Production Safety Guards**: The IoT telemetry simulator and debug development storage modes are strictly disabled in production environments (`NODE_ENV === 'production'`).
- **HTTP Security Headers**: Express automatically disables `X-Powered-By` and configures `nosniff`, `DENY` frame options, and strict cross-origin referrer policies.

---

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

---

<p align="center">
  Built with precision for sustainable agricultural management.
</p>
