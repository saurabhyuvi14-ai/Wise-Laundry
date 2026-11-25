# Wise Laundry — Frontend changes

> **Owner:** Utsav · **Folder:** `frontend/`
> Add a new entry at the top for every pull request that changes the frontend.

---

## 25 Nov 2026 — Final bill after pickup

**Branch:** `feature/final-bill`

### How it works
1. The rider picks up the clothes (order is **Picked up**).
2. Staff open **Weigh & bill** (`/staff`), type the order number (e.g. `WL-1001`), and enter the **weight in kg** (one decimal) or the **number of items** for Iron Only.
3. The backend works out the bill and saves it. The order moves to **At laundry**, and the customer sees **Your bill** on the order page straight away.
4. Staff can correct the bill until the order goes **out for delivery**. The customer sees "(updated)".
5. Customers can open **View / print bill** for a clean bill page and use **Print / Save as PDF**.

### Making someone staff
```bash
cd backend
npm run make-staff -- their@email.com          # give staff access
npm run make-staff -- their@email.com CUSTOMER # take it away
```
They must have signed up first. Staff see a **Weigh & bill** link in the menu.

### Extra charges (all off until you set them, in `backend/.env` / Vercel)
- `BILL_MIN_ORDER_PAISE`: minimum order (adds a "Minimum order top-up" line).
- `BILL_DELIVERY_FEE_PAISE`, `BILL_FREE_DELIVERY_ABOVE_PAISE`: delivery fee, free above an amount.
- `BILL_GST_PERCENT`: GST line on the total.
- Amounts are in paise: `4900` = ₹49.

### For the backend
- `GET /staff/orders/:id` and `POST /staff/orders/:id/bill` with `{ quantity, note? }` (STAFF or ADMIN only).
- Orders now include `bill: { lines[{ label, detail, amountPaise }], subtotalPaise, totalPaise, finalizedAt, revision }`. `totalPaise` comes from the bill when there is one.
- Bill maths: `src/services/billing.service.js`. Tests: `tests/billing.test.js` (7 tests).

---

## 25 Nov 2026 — Stay logged in

**Branch:** `feature/stay-logged-in`

- A login now lasts **30 days** (was 7) and **renews itself** every time the person uses the site (at most once a day), so regular customers don't get logged out.
- **Google auto sign-in:** on the Log in page, Google shows "Continue as …" by itself and signs returning people straight back in (`auto_select`, also on Safari via `itp_support`).
- After a deliberate **Log out**, auto sign-in is switched off for that browser, so logging out still works.
- Backend: `src/config/session.js` holds the login length and cookie settings in one place; `Session.renewIfNeeded()` does the renewal in `requireAuth`. Tests: `tests/session.test.js`.
- iPhone note: Google only offers accounts that are signed in **inside that browser**. Apps' built-in browsers (WhatsApp, Gmail) don't share Safari's Google login.

## 25 Nov 2026 — Reschedule and cancel a pickup

**Branch:** `feature/reschedule-cancel`

### Rules (the server enforces all of them, on its own clock)
- Customers can **reschedule or cancel until 2 hours before the pickup window starts**. After that the order page says "Changes closed" and points to support.
- Once the clothes are **picked up**, the order can't be changed in the app.
- **Reschedule:** at most **2 times** per order. The new slot must be at least 2 hours away, within the next 7 days, not the current slot, and must have room.
- **Cancel:** the customer picks a reason (plans changed, not home, booked by mistake, different service, something else) and can add a note. Pressing cancel twice is harmless.
- Every change is recorded on the order: `scheduleHistory` (old slot, new slot, when, by whom) and `cancellation` (reason, note, when, by whom). A cancelled or moved pickup frees its slot for someone else.
- Settings in `backend/.env`: `ORDER_CHANGE_CUTOFF_MINUTES=120`, `ORDER_MAX_RESCHEDULES=2`, `ORDER_RESCHEDULE_MAX_DAYS=7`.

### Website
- Order page: new **Change this pickup** card with the deadline, **Reschedule** and **Cancel pickup**, and how many reschedules are left.
- Reschedule opens the same date and time picker as booking, showing only slots that are allowed.
- Cancel asks for a reason and a final confirm. A cancelled order shows when and why.

### For the backend
- `POST /orders/:id/cancel` with `{ reason, note? }`
- `POST /orders/:id/reschedule` with `{ pickupScheduledAt, pickupSlotHours? }`
- Every order now includes `changeRules: { canCancel, canReschedule, changeDeadline, reschedulesLeft, cutoffMinutes, blockedReason }`.
- Error codes: `ORDER_CHANGE_TOO_LATE`, `ORDER_ALREADY_PICKED_UP`, `ORDER_ALREADY_CANCELLED`, `RESCHEDULE_LIMIT_REACHED`, `ORDER_CHANGED`.
- Tests: `backend/tests/order-changes.test.js` (11 tests).

---

## 18 Nov 2026 — Backend on Vercel, so the live site works

**Branch:** `feature/vercel-backend` (on top of `feature/google-sign-in`)

### What changed
- `frontend/vercel.json`: requests to `/api/...` on the website are forwarded to the backend at `https://wise-laundry1.vercel.app`. The browser only ever talks to `wise-laundry.vercel.app`, so the login cookie works on every phone and browser. If the backend project gets a different address, change it here.
- `backend/api/index.js` (new): how Vercel runs the backend. It connects to MongoDB once per running copy and reuses it. If the database can't be reached it answers `503 DATABASE_UNAVAILABLE` instead of crashing. `npm run dev` on a laptop is unchanged.
- `backend/vercel.json` (new): sends every request to that entry point.
- `backend/.vercelignore` (new): the Vercel CLI never uploads `.env` or the tests.

### Setup (once, free)
**Backend project (Vercel CLI, from a laptop):**
1. `cd backend` then `npx vercel` and log in. Answer: new project, name `wise-laundry1`, directory `./`.
2. Vercel dashboard → `wise-laundry1` → Settings → Environment Variables. Add for Production:
   `MONGODB_URI`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID` (same as in `backend/.env`) and
   `ALLOWED_ORIGINS=https://wise-laundry.vercel.app`.
3. `npx vercel --prod`. Check `https://wise-laundry1.vercel.app/api/v1/health` shows `"connected"`.

**MongoDB Atlas:** Network Access → Add IP Address → `0.0.0.0/0` (Vercel has no fixed IP; the database password still protects it).

**Google Cloud:** your OAuth client → Authorized JavaScript origins → add `https://wise-laundry.vercel.app`.

**Frontend project (`wise-laundry` on Vercel):** Settings → Environment Variables → `VITE_GOOGLE_CLIENT_ID` (same Client ID), then redeploy after this branch is merged.

---

## 18 Nov 2026 — Sign in with Google

**Branch:** `feature/google-sign-in` (on top of `feature/remove-demo`)

### Website
- **Continue with Google** on the Log in page and **Sign up with Google** on the Create account page, above the email form.
- A new person picks their Google account, then sees **One last step** and adds their mobile number once (the backend needs one for every customer). Then they're signed in.
- Someone who already has an account with the same email is signed straight in, and their email is marked verified.
- If Google can't load (or `VITE_GOOGLE_CLIENT_ID` is empty), the button and the "or" line are hidden and the email form works as before.
- If the person takes too long on the phone step (Google's proof lasts about an hour), they're sent back with "That took too long. Please continue with Google again."

### Backend (needed for this, please review — Saurabh)
- New route `POST /api/v1/auth/google` with `{ credential, phone? }`.
  - Checks Google's ID token with `google-auth-library` (new dependency) against `GOOGLE_CLIENT_ID`.
  - Existing user (same Google account or same email): signs in, links the Google account, sets `isEmailVerified: true`.
  - New person without `phone`: returns `{ data: { user: null, needsPhone: true, profile: { fullName, email } } }` and saves nothing.
  - New person with `phone`: creates the customer and signs in. Returns `{ data: { user, needsPhone: false } }`.
  - Errors: `401` bad or expired Google proof, `400` Google email not verified or bad phone, `503 GOOGLE_NOT_CONFIGURED` when `GOOGLE_CLIENT_ID` is empty.
- `User` model: new `googleId` field (unique when set, never sent to the browser). `passwordHash` is only required when there's no `googleId`. A Google-only account can't log in with email and password.
- `tests/google.test.js`: 9 tests. `tests/helpers/testDb.js` now uses `MONGODB_TEST_URI` when it's set, as `.env.example` already says.

### Setup (once, free, no card)
1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**: External, app name "Wise Laundry", your email.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. **Authorized JavaScript origins:** `http://localhost:5173` and `http://localhost` (later also the Vercel address). No redirect URI is needed.
4. Copy the **Client ID** into `backend/.env` as `GOOGLE_CLIENT_ID=` and into `frontend/.env` as `VITE_GOOGLE_CLIENT_ID=`. Restart both.

---

## 18 Nov 2026 — Demo removed, Vercel page links fixed

**Branch:** `feature/remove-demo`

### Demo removed
- The website always uses the real backend and database now. There is no demo mode.
- Removed: the `src/demo/` folder, "Continue with demo account", "Demo data" badges, demo prices, "Simulate next stage" on Live Tracking, and "Reset demo data" on Profile.
- `VITE_USE_DEMO` is no longer used. Only `VITE_API_BASE_URL` (default `/api/v1`) remains.

### Vercel
- Added `frontend/vercel.json` so opening a link like `/login` or `/customer/orders` directly loads the app instead of Vercel's 404 page.
- Addresses starting with `/api/` are left alone so they can go to the backend.
- **Still needed:** the backend has to be hosted online. Then add this as the first rewrite in `frontend/vercel.json`, with the real backend address:
  `{ "source": "/api/:path*", "destination": "https://<backend-address>/api/:path*" }`
  This keeps the login cookie on the same site, so login works on phones and Safari too.

---

## 18 Nov 2026 — OTP login built, switched off for now

**Branch:** `feature/otp-login`

> **Status: switched off.** The login screen shows email and password only. The OTP screens are in the code but commented out in `LoginForm.jsx` until the backend has the OTP endpoints below. To turn it on, remove the comments marked `OTP` in that file.

### What is built
- Mobile number (+91, 10 digits) and a **Send OTP** button.
- Six boxes for the code. Typing moves to the next box, Backspace goes back, and pasting or SMS autofill fills all six. The code is checked as soon as the sixth digit is in.
- **Resend code** unlocks after 30 seconds. **Change number** goes back with the number still filled in.
- A wrong code clears the boxes and shows how many tries are left (5 in total). After that, a new code is needed.
- A **new number** gets one more screen, "Tell us your name", then goes into the app.
- Email and password stays as a second option.

### Demo
- No SMS is sent. The code is always **123456**, and the screen says so.
- 98765 43210 is the demo customer. Any other number signs up as a new customer.

### For the backend
- The frontend calls two new endpoints:
  - `POST /auth/otp/request` with `{ phone }`, returns `{ data: { phone, expiresAt, resendAvailableAt } }`
  - `POST /auth/otp/verify` with `{ phone, code }`, returns `{ data: { user, isNewUser } }` and sets the login cookie
- Error codes it expects: `INVALID_OTP`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_TOO_SOON`.
- A new customer's name is saved with the existing `PATCH /users/me`.

---

## 4 Nov 2026 — Phone layout, new menu, horizontal tracking

**Branch:** `feature/mobile-nav-tracking`

### Layout
- Fixed pages that were wider than the screen on phones. The date row on Book a Pickup was stretching the whole page sideways.
- Checked every page at 320, 360, 375, 390, 414, 430, 768, 1024 and 1440 px wide.
- Public header fits small phones: Home and Services links hide on narrow screens, and the Book a Pickup button never gets cut off.
- Home page buttons are full width on phones.
- Book a Pickup shows the three services in one row on wider screens.

### Menu
- New menu: **Dashboard · My Orders · + · Tracking · Profile**.
- Phones: bottom tab bar with a round **+** button in the middle for Book a Pickup.
- Desktop: sidebar with a Book a Pickup button above the menu.
- The Tracking tab (`/customer/tracking`) opens the latest active order. If there is none, it shows a "Nothing to track right now" screen.

### Tracking
- Steps now sit side by side on every screen size, phones included.
- Steps: Scheduled → Picked up → At laundry → Washing → On the way → Delivered.
- Removed the **Ironing** and **Ready** steps.
- Iron Only orders skip the Washing step.
- Step names never split mid-word. On the smallest phones (under 360 px) "Scheduled" shows as "Booked".

### Services
- Removed **Dry Cleaning**. Services are now Wash & Fold, Wash & Iron and Iron Only.
- Updated demo orders and text that mentioned dry cleaning, ironing or "Ready".

### Login
- Continue with demo account always opens the Dashboard.
- Log out goes to a plain login page, so logging back in no longer returns you to Profile.

---

## 4 Nov 2026 — Customer frontend, phases 1–5 (PR #1, merged)

**Branch:** `feature/customer-frontend`

- Filled the agreed folder skeleton with React 19, Vite, Tailwind CSS 4 and React Router 7.
- Pages:
  - Home and Services
  - Login and Register
  - Dashboard
  - Book a Pickup and Booking confirmation
  - My Orders and Order details
  - Live Tracking
  - Profile
  - Not found
- Works end to end on labelled demo data. Setting `VITE_USE_DEMO=false` switches to the real API.
- All API calls go through `src/services/api-client.js`.
- **Booking:** pick a service, then an address, then a date and 2-hour window, then notes.
  - There is no quantity box; staff confirm weight or count after pickup.
  - The draft is kept if booking fails, and a retry never books twice.
- **Addresses** live inside Profile: add, edit, delete and set a default. The old `/customer/addresses` link opens Profile.
- **Iron Only** service added.
- **Every page** has loading, empty and error states, works with the keyboard, and has a phone layout.
- **`package.json`:** added `dev`, `build`, `preview` and `lint` scripts only. No new dependencies.

---

## How to run

```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

Log in with **Continue with demo account**.
