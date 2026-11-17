# Wise Laundry

Wise Laundry is a modern doorstep laundry and dry cleaning management platform designed to deliver convenient on-demand laundry services, transparent pricing, real-time order tracking, and seamless customer account management.

---

## Architecture Overview

- **Frontend (`frontend/`)**: React 19, Vite, Tailwind CSS v4, Lucide icons, React Router v7. Includes public pages, booking wizard, address management, and live order tracking.
- **Backend (`backend/`)**: Node.js (ESM), Express, Mongoose, and **MongoDB Atlas**.
  - **Security**: Argon2id password hashing, revocable server-side sessions via `HttpOnly` cookies, CSRF protection, rate limiting, and AES-256-GCM managed field encryption for addresses and instructions.
  - **Layers**: Clean separation across routes, controllers, domain services, Mongoose models, and middleware.
  - **Capacity & Idempotency**: Atomic slot reservation guards and `Idempotency-Key` headers for safe booking retries.
- **Documentation (`docs/`)**:
  - [`docs/backend.md`](docs/backend.md): API contracts, security architecture, staff portal design, and Razorpay payment flow.
  - [`docs/database.md`](docs/database.md): Mongoose schemas, indexes, field-level encryption, and database separation.
  - [`docs/frontend.md`](docs/frontend.md): UI routes, design system, and client-side state.

---

## Getting Started

### Prerequisites

- Node.js `v20.x` or `v22.x` LTS
- npm `v10.x` or `v11.x`
- A MongoDB Atlas cluster connection string (`mongodb+srv://...`)

---

### Backend Setup

1. Switch to the `backend` directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Configure your environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `MONGODB_URI` to your MongoDB Atlas cluster connection string.

3. Start the backend development server:
   ```bash
   npm run dev
   ```
   The API will listen on `http://localhost:4000`.

4. Run the automated backend test suite:
   ```bash
   npm test
   ```
   *(All 18 tests run against an isolated in-memory test database with zero side-effects on your Atlas cluster).*

---

### Frontend Setup

1. In a separate terminal, switch to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```

2. Configure frontend environment:
   ```bash
   cp .env.example .env
   ```
   - Set `VITE_USE_DEMO=false` to connect to the live Express API.
   - Set `VITE_USE_DEMO=true` to use client-side demo fixtures.

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser. Local requests to `/api` are automatically proxied to `http://localhost:4000`.
