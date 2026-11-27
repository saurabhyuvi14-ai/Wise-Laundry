# Wise Laundry — Frontend changes

> **Owner:** Utsav · **Folder:** `frontend/`
> Add a new entry at the top for every pull request that changes the frontend.

---

## 28 Nov 2026 — Staff & rider panel (steps 1–3)

- **Work list (`/staff`)**: orders grouped as To pick up (Today / Tomorrow, late ones flagged), At the laundry, To deliver — with name, phone, address (opens Maps), Express tag and instructions. `GET /api/v1/staff/work`.
- **Status buttons**: one tap moves an order to its next step (follows the service's own steps). Double taps are refused; "Out for delivery" needs a bill first. `POST /api/v1/staff/orders/:id/status { from }`.
- **Roles**: `RIDER` added. One login page for everyone; riders, staff and admins land on `/staff` after login. Riders see only jobs given to them, can mark Picked up / Reached laundry / Out for delivery / Delivered, and can't open customer or staff-only pages.
- **Team (`/staff/team`, admin only)**: add someone by the email they signed up with, change their role, or remove them (removed riders lose their jobs). `GET/POST /api/v1/staff/team`.
- **Assign riders**: staff pick a rider on each order card. Orders have `riderId`. `GET /api/v1/staff/riders`, `POST /api/v1/staff/orders/:id/rider`.
- **Weighing at the doorstep (step 4)**: tapping "Picked up" opens a weight (kg) / item-count box. Riders must fill it; staff can leave it empty to weigh later. The bill is made on the spot and shown to the customer; staff can still correct it in Weigh & bill. `POST /staff/orders/:id/status { from, quantity }`.
- First admin: `npm run make-staff -- you@email.com ADMIN` (once).

---

## 27 Nov 2026 — Express delivery

**Branch:** `feature/express-delivery`

- **Booking:** after picking a service, customers choose **Standard** (normal time, no extra) or **Express** (faster, extra charge). Shown only for services where express is actually faster. The booking summary shows the choice.
- **Default rules:** express = half the normal time, at most 24 hours (Wash & Fold / Wash & Iron: 2 days → 1 day; Iron Only: 1 day → 12 hours), for +50% on the washing amount. The terms are saved on the order when booking, so later setting changes don't change old orders.
- **Bill:** an "Express delivery" line is added when staff weigh the order, and the delivery estimate uses the express time.
- **Shown in:** order list (Express tag), order page, staff "Weigh & bill" page (with the express price in the preview), Help FAQ. "Book again" keeps the same speed.
- **Switch after booking:** for **3 hours after booking**, the order page shows a "Need it faster?" card with a countdown. Customers can switch a standard order to Express (with a confirm step), or switch back. Allowed until the order is out for delivery. If staff already made the bill or set the delivery time, both are worked out again. Standard orders save the express price they were offered, so the switch costs the same as at booking. Endpoint: `POST /orders/:id/express { express: true|false }`; orders include `expressRules { canUpgrade, canDowngrade, deadline }`.
- **Settings (backend):** `EXPRESS_ENABLED=true`, `EXPRESS_SWITCH_WINDOW_MINUTES=180`, `EXPRESS_SURCHARGE_PERCENT=50`, `EXPRESS_TURNAROUND_HOURS=24`. Defaults work without adding them to Vercel.
- **Backend:** `GET /services` now includes `express { turnaroundHours, surchargePercent }` per service; `POST /orders` accepts `express: true`. Tests: `tests/express.test.js`. **Redeploy the backend.**

---

## 27 Nov 2026 — Updates (notifications), rating after delivery, animations

**Branch:** `feature/notifications-rating-polish`

### What customers get
- **Updates bell** — in the side menu and the phone top bar, with a red count of new updates. Every step of every order (picked up, washing, delivered, pickup moved…) shows on the new **Updates** page (`/customer/notifications`), grouped Today / Yesterday / Earlier. Opening it clears the count. While the app is open it checks every 45 seconds; when something new comes in, a toast pops up and the bell wiggles.
- **Rate your order** — delivered orders get a "How was your laundry?" card: tap 1–5 stars, pick quick tags (good ones for 4–5 stars, problem ones for 1–3), add a comment. Customers can also **report a problem** (item missing, damaged, stains, someone else's items, late, wrong bill, other) in the same card. One rating per order. The dashboard asks "How was order WL-…?" for the latest unrated delivery; tapping a star opens the order with that rating already picked.
- **Animations** — tracker lines fill in step by step and the ticks pop in; order lists and updates slide in one by one; dashboard numbers count up; stat tiles lift on hover. All of it turns off for people who have "reduce motion" on.

### Backend
- `GET /api/v1/notifications` (feed built from order history, last 30 days) and `POST /api/v1/notifications/seen`. User gets `notificationsSeenAt`.
- `POST /api/v1/orders/:id/feedback` — only when DELIVERED, only once (409 otherwise). Order gets `feedback { rating, tags, comment, issue, createdAt }`.
- Tests: `tests/feedback-notifications.test.js`. **Redeploy the backend.**

### Files
- New: `context/NotificationsContext.jsx`, `features/notifications/components/NotificationBell.jsx`, `pages/NotificationsPage.jsx`, `features/orders/components/OrderFeedback.jsx`
- Changed: `CustomerLayout.jsx`, `CustomerSidebar.jsx`, `MobileNavigation.jsx`, `OrderDetailsPage.jsx`, `DashboardPage.jsx`, `TrackingStep.jsx`, `TrackingTimeline.jsx`, `OrderList.jsx`, `styles/index.css`, `api-client.js`, `app/router.jsx`

---

## 27 Nov 2026 — Tracking: skipped-step fix and order slider

**Branch:** `feature/customer-quick-wins`

- **Fix:** the tracker showed a step as not done when the order jumped past it (for example straight from Scheduled to At laundry). Every step before the current one now shows as done; steps without a saved time just show no date.
- **Order slider:** the "Select order" dropdown is replaced by a swipeable row of order cards (active orders first, each with its status and a small progress bar). Tap a card to switch; on desktop there are also left/right arrows. Hidden when the customer has only one order.
- Files: `TrackingTimeline.jsx`, new `features/tracking/components/OrderSwitcher.jsx`, `LiveTrackingPage.jsx`

---

## 27 Nov 2026 — Book again, rider instructions, Help & support

**Branch:** `feature/customer-quick-wins`

### What customers get
- **Book again** — a button on finished orders (delivered or cancelled) and a "Book your usual" card on the dashboard. It opens the booking page with the same service, address and instructions already filled in; the customer only picks a time.
- **Pickup & delivery instructions** — one-tap chips ("Call before coming", "Ring the bell", "Leave with security", "Message on WhatsApp, don't call", "Pets at home") in the booking form and on saved addresses. A saved address's instructions fill the box automatically when it's empty.
- **Help & support** — new page at `/customer/help` with answers built from the real rules (live prices, turnaround, 2-hour change cutoff, Bengaluru only). Linked from the sidebar, the phone top bar, the order page and the tracking page (these used a fake support email before). Opening it from an order adds the order number to the WhatsApp/email message.

### Settings
- `VITE_SUPPORT_WHATSAPP` (digits with country code, e.g. `919876543210`), `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_EMAIL` in the frontend Vercel project. Each button only shows when its value is set; with none set the page says contact details are coming soon.

### Backend
- Orders now save `addressId` (the saved address used), so "Book again" picks the same one. Older orders fall back to matching the address text. Redeploy the backend.

### Files
- New: `pages/HelpPage.jsx`, `features/orders/components/BookAgainButton.jsx`, `features/orders/components/InstructionChips.jsx`
- Changed: `useBooking.js` (`useBookAgain`), `BookingForm.jsx`, `AddressForm.jsx`, `BookLaundryPage.jsx`, `DashboardPage.jsx`, `OrderDetailsPage.jsx`, `LiveTrackingPage.jsx`, `CustomerSidebar.jsx`, `MobileNavigation.jsx`, `Button.jsx` (`href`), `app/router.jsx`, `.env.example`

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
