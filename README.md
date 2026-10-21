# AgriTech

AgriTech is a farm-records application for managing farms and their fields. Atlas is the normal persistence mode and all MongoDB operations use Mongoose. Offline JSON storage is available only when explicitly selected in development. The app does not create sample farms, fields, weather, market prices, or financial statistics.

## Stack

- React 19, Vite, Bootstrap 5, Bootstrap Icons, React Router
- Node.js, Express, Mongoose, MongoDB Atlas
- JWT authentication and bcrypt password hashing

## Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm
- MongoDB connection string

## Local setup

Install dependencies from the repository root:

```powershell
npm install
npm run install:all
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Set `MONGODB_URI` and a private `JWT_SECRET` in `server\.env`. A secret can be generated locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

For production, also set `NODE_ENV=production` and `CLIENT_URL` to the HTTPS origin of the deployed frontend. Multiple allowed origins may be comma-separated. Production startup requires a valid MongoDB URI, a unique JWT secret of at least 32 characters, and a valid client origin. The server will not start if Atlas cannot be reached, and production rejects local storage settings.

For intentionally offline development only, `STORAGE_MODE=local-json` selects the JSON store. This mode is never automatic, is rejected outside development, and does not sync with Atlas. It uses the existing local users file without seeding, migrating, or deleting records; farm and field records are stored in separate files. An Atlas connection failure does not switch the application into this mode.

Run the frontend and API together:

```powershell
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`

Vite proxies `/api` requests to the local API. In production, configure the hosting platform or reverse proxy to route `/api` to Express. `CLIENT_URL` controls the backend CORS allowlist; it is not a database setting.

## Farmer workflow

1. Register with your name, email, and password.
2. Add a farm and optionally specify its region and country.
3. Open the farm and add fields with their area; soil and water-source details are optional.
4. Edit or delete farms and fields. A farm with fields cannot be deleted until those fields have been removed.

Records are scoped to the authenticated account. New accounts are not prefilled with farms or agricultural data. Existing local user records are never automatically migrated or deleted; the JSON store remains unused unless offline development mode is explicitly enabled.

## API

All request bodies are JSON. Authenticated endpoints require `Authorization: Bearer <token>`.

### Authentication

- `POST /api/auth/register` — create a farmer account (`name`, `email`, `password`)
- `POST /api/auth/login` — authenticate (`email`, `password`)
- `GET /api/auth/me` — return the signed-in profile
- `GET /api/auth/user/:id` — return the caller’s profile only

Passwords must be 10–128 characters. Public registration always assigns the farmer role.

### Farms and fields

- `GET /api/farms` — list the caller’s farms
- `POST /api/farms` — create a farm (`name`, optional `location` with `region`, `country`, or `city`)
- `GET /api/farms/:farmId` — get a farm the caller owns
- `PATCH /api/farms/:farmId` — update its name or location
- `DELETE /api/farms/:farmId` — delete a farm that has no fields
- `GET /api/farms/:farmId/fields` — list fields belonging to an owned farm
- `POST /api/farms/:farmId/fields` — create a field (`name`, positive `areaHectares`, optional `soilType` and `waterSource`)
- `PATCH /api/farms/fields/:fieldId` — update an owned field
- `DELETE /api/farms/fields/:fieldId` — delete an owned field
- `GET /api/health` — API and database readiness status

The current release does not include crop cycles, tasks, irrigation/fertilizer logs, finance, weather, market prices, or crop-health diagnosis.

## Configuration

Server environment variables:

- `MONGODB_URI` — MongoDB/Atlas connection string; required unless explicit offline development storage is enabled
- `JWT_SECRET` — private token-signing key; required in every runtime mode and must be at least 32 characters
- `CLIENT_URL` — allowed frontend origin(s), comma-separated; required in production
- `PORT` — optional HTTP port, defaults to `5000`
- `NODE_ENV` — set to `production` for deployment
- `JWT_EXPIRES_IN` — optional token lifetime, defaults to `7d`
- `STORAGE_MODE` — set to `local-json` only for explicit offline development; omit for Atlas
- `LOCAL_DATA_DIR` — optional local-store directory override, only relevant to `local-json`

Client environment variable:

- `VITE_API_URL` — optional API base path; defaults to `/api`

Never commit `.env` files or share their contents. The `.env.example` files contain configuration keys, not working credentials.

## Checks

```powershell
npm test
npm --prefix client run lint
npm run build
```

The server tests use injected in-memory stores or a temporary isolated local-store directory and a test-only JWT secret. They do not connect to Atlas or read/write the legacy JSON user store.

The optional Atlas integration suite is separate from `npm test` and requires `MONGODB_TEST_URI`:

```powershell
npm --prefix server run test:integration
```

Configure `MONGODB_TEST_URI` through a protected local environment or CI secret store. It must target a dedicated Atlas database named `agritech_test`, using credentials restricted to that test database. The integration suite never falls back to `MONGODB_URI`, never drops or clears a database, and cleans up only the uniquely identified users and records it creates. Do not point it at production or a shared database.
