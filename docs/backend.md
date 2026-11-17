# Wise Laundry — Backend Architecture & API Specification

> **Branch:** `feature/backend-atlas-rebuild`  
> **Status:** Rebuilt from scratch with Controller-Service-Model architecture, strict MongoDB Atlas connectivity, isolated test database, and 18 Automated Tests passing  
> **Stack:** Node.js (ESM), Express, Mongoose, MongoDB Atlas, Argon2id, Zod, AES-256-GCM, Pino

---

## 1. System & Integration Architecture

The integration architecture follows a decoupled, secure client-server design with clean layer boundaries:

```
[ Customer (Android / iOS / Desktop) ]
                │
                ▼
    [ React (Vite + Tailwind) ]
                │
     HTTPS /api/v1 (JSON, HttpOnly Session Cookie, CSRF Token)
     (Local: Vite Proxy :5173/api -> :4000/api; Staging/Prod: Same-Origin)
                │
                ▼
    [ Node.js + Express API (:4000) ]
        ├── Security & Middleware (Helmet, CORS, Rate Limiter, CSRF, Cache-Control)
        ├── Routes Layer (/routes: auth, users, addresses, catalog, slots, orders, health)
        ├── Controllers Layer (/controllers: HTTP response shaping, status codes)
        ├── Domain Services Layer (/services: booking, slot capacity, tracking, auth, crypto)
        ├── Models Layer (/models: User, Session, Address, Service, SlotCapacity, Order)
        └── Utilities (/utils: AES-256-GCM crypto, Zod validation, ApiError, seed helpers)
                │
         Mongoose over TLS
                │
                ▼
    [ MongoDB Atlas Cluster (users, sessions, addresses, services, orders, slotcapacities) ]
```

---

## 2. Existing Demo Store Analysis & Migration Strategy

### Existing Demo Store (`frontend/src/demo/`)
- During earlier prototyping, all interactions were held in browser memory and `localStorage` via `demo-api.js`, seeded with mock accounts (`demoUser`), pre-baked addresses (`demoAddresses`), fixed mock orders (`orders.js`), and static service pricing (`services.js`).
- Data structures lacked password security, server validation, encryption, atomic capacity locks, and multi-tenant privacy.

### Migration Strategy
- Abstracted all frontend network communication behind a single shared client: [`frontend/src/services/api-client.js`](file:///Users/saurabhkumar/Desktop/Wise-Laundry/frontend/src/services/api-client.js).
- Maintained identical method signatures and response shapes (`{ data, meta, error: { code, message, fields } }`) between `demoApi` and `laundryApi`.
- A single environment toggle `VITE_USE_DEMO=false` flips the frontend from demo fixtures to the real Express backend without touching any UI component code.
- On logout, client storage (`sessionStorage`, booking draft) is cleared completely.

---

## 3. Implemented API Contracts (`/api/v1`)

### Authentication & User Endpoints

#### `POST /api/v1/auth/register`
- **Rate Limit:** 20 requests / 15 min.
- **Request Body:**
  ```json
  {
    "fullName": "Aarav Mehta",
    "email": "aarav@example.com",
    "phone": "9876543210",
    "password": "SecurePassword123"
  }
  ```
  *(Accepts both `fullName` and `name` for backwards compatibility; strictly rejects `role` injection).*
- **Response (201 Created):**
  - Sets `wise_session` HttpOnly cookie.
  - Sets `wise_csrf_token` cookie.
  ```json
  {
    "data": {
      "id": "6735a123...",
      "fullName": "Aarav Mehta",
      "name": "Aarav Mehta",
      "email": "aarav@example.com",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "isEmailVerified": false,
      "createdAt": "2026-11-17T00:00:00.000Z"
    }
  }
  ```

#### `POST /api/v1/auth/login`
- **Rate Limit:** 20 requests / 15 min.
- **Request Body:**
  ```json
  {
    "email": "aarav@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK):**
  - Sets `wise_session` HttpOnly cookie.
  - Returns authenticated user profile in `data`.

#### `POST /api/v1/auth/logout`
- **Description:** Revokes the session in MongoDB and clears the session cookie.
- **Response:** `204 No Content`.

#### `GET /api/v1/auth/me`
- **Headers:** `Cookie: wise_session=...`
- **Cache-Control:** `no-store, no-cache, must-revalidate, private`
- **Response (200 OK):** Returns current authenticated user record.

#### `PATCH /api/v1/users/me`
- **Request Body:**
  ```json
  {
    "fullName": "Aarav K. Mehta",
    "phone": "9876543219"
  }
  ```
- **Response (200 OK):** Returns updated user profile.

#### `POST /api/v1/auth/verify-email`
- **Request Body:** `{ "token": "..." }`
- **Response (200 OK):** `{ "data": { "message": "Email verified successfully." } }`

#### `POST /api/v1/auth/forgot-password`
- **Request Body:** `{ "email": "aarav@example.com" }`
- **Response (200 OK):** Generic message preventing account enumeration.

#### `POST /api/v1/auth/reset-password`
- **Request Body:** `{ "token": "...", "newPassword": "NewPassword123" }`
- **Response (200 OK):** Resets password with Argon2id and revokes all active sessions for the user.

---

### Addresses Endpoints

#### `GET /api/v1/addresses`
- **Cache-Control:** `private, no-cache, no-store`
- **Response (200 OK):** Returns list of addresses belonging exclusively to the authenticated customer. Sensitive address lines and instructions are transparently decrypted.

#### `POST /api/v1/addresses`
- **Request Body:**
  ```json
  {
    "label": "HOME",
    "recipientName": "Aarav Mehta",
    "phone": "9876543210",
    "addressLine1": "Flat 402, Sunshine Towers",
    "addressLine2": "12th Main, Koramangala 4th Block",
    "landmark": "Near Water Tank",
    "city": "Bengaluru",
    "postalCode": "560034",
    "instructions": "Call on arrival",
    "isDefault": true
  }
  ```
- **Response (201 Created):** Stored with AES-256-GCM encryption at rest; returns decrypted object with `id` and `pincode` alias.

#### `PATCH /api/v1/addresses/:id`
- **Description:** Updates address fields. Strictly enforces server-side ownership (`403 Forbidden` if accessed by another user).

#### `DELETE /api/v1/addresses/:id`
- **Description:** Deletes address. Automatically re-assigns default status to next address if deleted address was default.

---

### Services Catalogue & Slot Availability Endpoints

#### `GET /api/v1/services` (also aliased at `/api/v1/catalog`)
- **Description:** Returns active laundry services catalogue (`Wash & Fold`, `Wash & Iron`, `Iron Only`) with pricing units (`KG` / `PIECE`), unit prices in paise, turnaround hours, and lifecycle stages.

#### `GET /api/v1/slots?date=YYYY-MM-DD`
- **Description:** Returns pickup slot capacity for 2-hour windows (8, 10, 12, 14, 16, 18, 20), reporting `booked`, `maxCapacity`, `available`, and `isFull`.

---

### Orders & Tracking Endpoints

#### `POST /api/v1/orders`
- **Headers:** `Idempotency-Key: <client-uuid>`
- **Request Body:**
  ```json
  {
    "items": [{ "serviceId": "service_wash_fold" }],
    "addressId": "6735a456...",
    "pickupScheduledAt": "2026-11-20T08:00:00.000Z",
    "pickupSlotHours": 2,
    "instructions": "Leave laundry bag with security."
  }
  ```
- **Processing:**
  1. **Idempotency Check:** If an order exists with the same `idempotencyKey` and `userId`, returns existing order (`200 OK`) without re-creating.
  2. **Ownership Check:** Validates that `addressId` belongs to `req.user._id`.
  3. **Service Validation:** Validates `serviceId` is active.
  4. **Atomic Slot Reservation:** Atomically increments `bookedCount` under `maxCapacity` in `SlotCapacity`. Rejects overbooking with `409 Conflict`.
  5. **Snapshot Encryption:** Encrypts address snapshot with AES-256-GCM.
  6. **Initial History:** Seeds `statusHistory` with `BOOKED`.
- **Response (201 Created):**
  ```json
  {
    "data": {
      "id": "order_1001",
      "reference": "WL-1001",
      "items": [{ "serviceId": "service_wash_fold", "serviceName": "Wash & Fold", "pricingUnit": "KG", "quantity": null, "unitPricePaise": 6000 }],
      "addressSnapshot": { ... },
      "pickupScheduledAt": "2026-11-20T08:00:00.000Z",
      "pickupSlotHours": 2,
      "instructions": "Leave laundry bag with security.",
      "estimatedDeliveryAt": null,
      "statusHistory": [{ "status": "BOOKED", "changedAt": "...", "note": "Pickup requested by customer." }],
      "currentStatus": "BOOKED",
      "totalPaise": null,
      "currency": "INR",
      "createdAt": "..."
    }
  }
  ```

#### `GET /api/v1/orders?status=all&page=1&pageSize=10`
- **Description:** Lists customer's orders with pagination. Filterable by `all`, `active`, or `past`.

#### `GET /api/v1/orders/:id`
- **Description:** Fetches order details. Accessible via internal ID (`order_1001`) or reference (`WL-1001`). Enforces server-side ownership.

#### `GET /api/v1/orders/:id/tracking`
- **Description:** Returns live tracking timeline and milestone progress.

#### `POST /api/v1/orders/:id/advance`
- **Environment Restriction:** **Only available in `development` and `test` environments**. Rejects with `403 Forbidden` if called in `production`.
- **Description:** Simulates advancing an order through its service stages (`BOOKED` -> `PICKED_UP` -> `RECEIVED` -> `WASHING` -> `OUT_FOR_DELIVERY` -> `DELIVERED`). On reaching `RECEIVED`, populates weighed quantity and estimates turnaround delivery time.

#### `GET /api/v1/health`
- **Description:** Readiness and liveness check verifying MongoDB Atlas connectivity and database ready state.

---

## 4. Security Architecture

1. **Password Security:** Passwords hashed with **Argon2id** (`m=65536, t=3, p=4`) using the native `argon2` module.
2. **Session Security:**
   - Cryptographically random 32-byte tokens generated via `node:crypto`.
   - Stored in MongoDB as SHA-256 hashes (`tokenHash`).
   - Stored client-side in an `HttpOnly`, `SameSite=Lax` (or `Strict` in production), `Secure` cookie named `wise_session`.
   - Revocable on logout or password reset.
3. **CSRF & Origin Verification:**
   - Double-submit cookie with `wise_csrf_token`.
   - Origin / Referer validation against whitelist on all mutative requests (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Managed Field Encryption:**
   - Sensitive address lines (`addressLine1`, `addressLine2`) and instructions are encrypted using **AES-256-GCM** with a dedicated 256-bit key.
   - Every encryption operation generates a unique 12-byte IV and stores an authentication tag (`v1:iv:authTag:ciphertext`).
   - Tampered data fails authentication tag verification.
5. **Private Response Cache Controls:**
   - `Cache-Control: no-store, no-cache, must-revalidate, private`
   - `Pragma: no-cache`
   - `Expires: 0`
6. **Log Redaction:**
   - Pino structured logger redacts cookies, auth headers, passwords, tokens, addresses, and phone numbers.
7. **Database Connection Sanitization:**
   - `MONGODB_URI` connection strings are sanitized in all log outputs (`mongodb+srv:***@cluster.mongodb.net/...`) to prevent accidental credential leakage.

---

## 5. Future Shared Laundry Portal Architecture (Design)

```
[ Operations Manager / Admin ]           [ Delivery Driver / Workshop Staff ]
             │                                              │
             ▼                                              ▼
   [ Privileged MFA (TOTP) ]                      [ Role-Based Access Checks ]
             │                                              │
             └──────────────────────┬───────────────────────┘
                                    │
                                    ▼
                     [ Staff Operations API (/api/v1/staff) ]
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
             [ Assignment Verification ]   [ Audited Status Transition ]
```

1. **Staff Roles:**
   - `STAFF_DRIVER`: Pickup and delivery assignments.
   - `STAFF_OPERATOR`: Laundry sorting, weighing, washing, and iron processing.
   - `ADMIN`: Service catalogue pricing, user management, global slot overrides.
2. **Assignment Checks:**
   - Orders will carry an `assignedStaffId`.
   - A driver may only transition orders assigned to their active route (`PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`).
   - Operators transition workshop states (`RECEIVED`, `WASHING`, input confirmed weight/count).
3. **Privileged Multi-Factor Authentication (MFA):**
   - RFC 6238 Time-based One-Time Password (TOTP) required for Admin & Staff accounts before accessing the portal.
4. **Immutable Audit Trail:**
   - Every status transition creates an immutable `AuditLog` entry recording `operatorId`, `orderId`, `fromStatus`, `toStatus`, `metadata` (weights, count), `ipAddress`, and `timestamp`.

---

## 6. Future Razorpay Test-Mode Payment Flow (Design)

```
[ Customer ] ──1. Request Checkout──> [ Express Backend ]
                                             │ 2. Calculates exact amount from items
                                             ▼
[ Razorpay Checkout Modal ] <──3. order_id── [ Razorpay Orders API ]
      │
 4. Customer Authorizes Payment
      │
      ├──5. Client Success Handler──> [ /api/v1/payments/verify ]
      │                                (Verifies HMAC-SHA256 signature)
      │
      └──6. Asynchronous Webhook───> [ /api/v1/payments/webhook ]
                                       (Verified signature, deduplication table)
```

1. **Server-Calculated Amounts:**
   - Client never supplies the amount. The server calculates `totalPaise = sum(quantity * unitPricePaise)` once staff confirms count/weight on `RECEIVED` status.
2. **Order Creation:** Backend calls Razorpay `/v1/orders` with `amount: totalPaise` and `currency: "INR"`.
3. **Cryptographic Verification:**
   - When client returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`:
   - Server computes: `generatedSignature = hmac_sha256(order_id + "|" + payment_id, key_secret)`.
   - Timing-safe comparison ensures validity.
4. **Signed Webhooks & Duplicate-Event Handling:**
   - Webhook endpoint validates `X-Razorpay-Signature` against raw body.
   - Events are recorded in a `PaymentEventDeduplication` table by `event_id` to prevent double-crediting or duplicate status changes.

---

## 7. Startup & Local Development Commands

### Prerequisites
- Node.js `v20.x` or `v22.x` LTS
- npm `v10.x` or `v11.x`
- A MongoDB Atlas cluster connection string (`mongodb+srv://...`)

### Running the Backend
```bash
cd backend
cp .env.example .env
# Edit .env and set MONGODB_URI to your MongoDB Atlas cluster URI
npm install
npm run dev     # Runs on http://localhost:4000
```

> **Important:** The backend strictly requires a reachable MongoDB Atlas database on startup. Local database defaults and in-memory fallbacks have been removed from the server startup flow. If the Atlas database is unreachable or credentials are missing, the server will terminate immediately (`process.exit(1)`).

### Running the Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev     # Runs on http://localhost:5173
```
- The Vite dev server proxies `/api` directly to `http://localhost:4000`.

### Running Automated Backend Tests
```bash
cd backend
npm test
```
All 18 automated integration tests run against an isolated in-memory test database runner (`mongodb-memory-server`), ensuring zero side-effects on development or production Atlas clusters.
