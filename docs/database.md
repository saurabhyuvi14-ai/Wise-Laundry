# Wise Laundry — Database Schema & Data Models (MongoDB / Mongoose)

> **Database:** MongoDB (Mongoose ODM)  
> **Encryption:** AES-256-GCM for sensitive fields at rest  
> **Target Collections:** `users`, `sessions`, `addresses`, `services`, `orders`, `slotcapacities`

---

## 1. Entity-Relationship & Data Flow Diagram

```
       ┌──────────────────┐
       │      User        │
       └────────┬─────────┘
                │ 1
                ├──────────────────────────┐
                │ 1..*                     │ 1..*
                ▼                          ▼
       ┌──────────────────┐       ┌──────────────────┐
       │     Session      │       │     Address      │
       └──────────────────┘       └────────┬─────────┘
                                           │
                                           │ (Snapshotted & Encrypted)
                                           ▼
       ┌──────────────────┐ 1..*  ┌──────────────────┐
       │     Service      ├──────>│      Order       │
       └──────────────────┘       └────────┬─────────┘
                                           │
                                           │ (Slot Reservation)
                                           ▼
                                  ┌──────────────────┐
                                  │   SlotCapacity   │
                                  └──────────────────┘
```

---

## 2. Collections & Mongoose Schemas

### `users`
Represents registered customers, delivery staff, and system administrators.

```javascript
{
  _id: ObjectId,
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true }, // Argon2id hash ($argon2id$v=19$m=65536,t=3,p=4...)
  role: { type: String, enum: ['CUSTOMER', 'STAFF', 'ADMIN'], default: 'CUSTOMER', required: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null }, // SHA-256 hash of token
  emailVerificationExpires: { type: Date, default: null },
  passwordResetToken: { type: String, default: null },     // SHA-256 hash of token
  passwordResetExpires: { type: Date, default: null },
  createdAt: Date,
  updatedAt: Date
}
```

- **Indexes:**
  - `email` (unique)

---

### `sessions`
Revocable, stateful sessions for active user logins.

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true }, // SHA-256(rawToken + secret)
  ipAddress: { type: String, default: 'unknown' },
  userAgent: { type: String, default: 'unknown' },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null, index: true },
  createdAt: Date,
  updatedAt: Date
}
```

- **Security Properties:**
  - `tokenHash` prevents plaintext token leakage if the database is read.
  - Revocable immediately via `/api/v1/auth/logout` or upon password reset via `revokedAt`.

---

### `addresses`
Saved pickup and delivery addresses with AES-256-GCM managed field encryption.

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, enum: ['HOME', 'WORK', 'OTHER'], default: 'HOME' },
  recipientName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  // Encrypted at rest using AES-256-GCM:
  addressLine1Encrypted: { type: String, required: true }, // v1:iv:tag:ciphertext
  addressLine2Encrypted: { type: String, required: true }, // v1:iv:tag:ciphertext
  landmark: { type: String, default: '', trim: true },
  city: { type: String, required: true, trim: true, default: 'Bengaluru' },
  postalCode: { type: String, required: true, trim: true },
  instructionsEncrypted: { type: String, default: '' },    // v1:iv:tag:ciphertext
  isDefault: { type: Boolean, default: false },
  createdAt: Date,
  updatedAt: Date
}
```

- **Managed Field Encryption:**
  - Address lines and driver instructions are never stored in plaintext in the database.
  - Serialized via `toJSON()` into clean, transparently decrypted JSON output for authorized requests.

---

### `services`
Laundry service catalogue pricing and turnaround configuration.

```javascript
{
  _id: ObjectId,
  serviceId: { type: String, required: true, unique: true, index: true }, // 'service_wash_fold', ...
  code: { type: String, required: true, unique: true, enum: ['WASH_FOLD', 'WASH_IRON', 'IRON_ONLY'] },
  name: { type: String, required: true },
  description: { type: String, required: true },
  pricingUnit: { type: String, enum: ['KG', 'PIECE'], required: true },
  unitPricePaise: { type: Number, required: true }, // e.g. 6000 = ₹60.00
  turnaroundHours: { type: Number, required: true },
  active: { type: Boolean, default: true, index: true },
  stages: [{ type: String }],
  createdAt: Date,
  updatedAt: Date
}
```

- **Default Seed Catalogue:**
  1. `Wash & Fold`: ₹60 / kg (`6000` paise), 48h turnaround, stages: `['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED']`.
  2. `Wash & Iron`: ₹90 / kg (`9000` paise), 48h turnaround, stages: `['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED']`.
  3. `Iron Only`: ₹15 / piece (`1500` paise), 24h turnaround, stages: `['BOOKED', 'PICKED_UP', 'RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED']`.

---

### `orders`
Customer bookings, status history, and immutable encrypted address snapshots.

```javascript
{
  _id: ObjectId,
  orderIdString: { type: String, unique: true, index: true }, // 'order_1001'
  reference: { type: String, required: true, unique: true, index: true }, // 'WL-1001'
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  items: [
    {
      serviceId: String,
      serviceName: String,
      pricingUnit: String,
      quantity: Number, // null until weighed/counted by workshop staff
      unitPricePaise: Number
    }
  ],
  addressSnapshot: {
    label: String,
    recipientName: String,
    phone: String,
    addressLine1Encrypted: String,
    addressLine2Encrypted: String,
    landmark: String,
    city: String,
    postalCode: String,
    instructionsEncrypted: String
  },
  pickupScheduledAt: { type: Date, required: true, index: true },
  pickupSlotHours: { type: Number, default: 2 },
  instructionsEncrypted: { type: String, default: '' },
  estimatedDeliveryAt: { type: Date, default: null },
  statusHistory: [
    {
      status: { type: String, enum: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] },
      changedAt: { type: Date, default: Date.now },
      note: String
    }
  ],
  currentStatus: { type: String, enum: ['BOOKED', 'PICKED_UP', 'RECEIVED', 'WASHING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'], default: 'BOOKED', index: true },
  idempotencyKey: { type: String, index: true, sparse: true },
  currency: { type: String, default: 'INR' },
  createdAt: Date,
  updatedAt: Date
}
```

- **Order Identifier Consistency:**
  - `order.id` (mapped to `order_1001` or ObjectId string) and `order.reference` (`WL-1001`) are identical across Booking Confirmation, Dashboard, My Orders, and Live Tracking.

---

### `slotcapacities`
Atomic tracking of customer bookings per 2-hour window to prevent overbooking.

```javascript
{
  _id: ObjectId,
  slotKey: { type: String, required: true, unique: true, index: true }, // 'YYYY-MM-DD_HH'
  date: { type: String, required: true, index: true },
  slotHour: { type: Number, required: true, index: true },
  bookedCount: { type: Number, default: 0 },
  maxCapacity: { type: Number, default: 10 },
  createdAt: Date,
  updatedAt: Date
}
```

- **Concurrency Control:**
  - Reservations use an atomic `findOneAndUpdate({ slotKey, bookedCount: { $lt: maxCapacity } }, { $inc: { bookedCount: 1 } })` operation, completely preventing race conditions under high concurrent demand.

---

## 3. Database Separation Strategy

1. **Local Development:**
   - Default URI: `mongodb://127.0.0.1:27017/wise_laundry_dev`.
   - Automatic fallback to an embedded in-memory database (`mongodb-memory-server`) if a local standalone MongoDB instance is not detected.
2. **Automated Testing:**
   - Isolated database instance (`wise_laundry_test` or dynamic in-memory MongoMemoryServer).
   - Zero side-effects on development or production databases.
3. **Production:**
   - Mongoose TLS connection to MongoDB Atlas / Managed Cluster.
   - Enforced authentication and server-side secret management.
