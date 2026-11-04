# Wise Laundry — Frontend changes

> **Owner:** Utsav · **Folder:** `frontend/`
> Add a new entry at the top for every pull request that changes the frontend.

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
