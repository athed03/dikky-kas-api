# Backend API Specification: Dikky Kas

**Version**: 3.0  
**Last Updated**: 2026-02-22

---

## 1. General Info
-   **Base URL**: `/api/v1`
-   **Swagger Docs**: `/api/docs` (Swagger UI)
-   **Authentication**: Bearer Token (JWT) in `Authorization` header.
-   **Content-Type**: `application/json`
-   **Date Format**: ISO 8601 (`YYYY-MM-DD` for query params, full ISO for timestamps)
-   **ID Format**: Auto-increment integers — all entity IDs use Prisma `@default(autoincrement())`

### Tech Stack
-   **Runtime**: Node.js + Express
-   **ORM**: Prisma 7 with `@prisma/adapter-pg` (PostgreSQL)
-   **Database**: PostgreSQL (Neon)
-   **Validation**: Zod
-   **Auth**: JWT (`jsonwebtoken`) + `bcryptjs`
-   **Docs**: `swagger-jsdoc` + `swagger-ui-express`
-   **Config**: `prisma.config.ts` (Prisma 7 datasource config)

### Response Format
All responses are wrapped by the `success()` / `error()` helpers in `lib/response.js`:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## 2. Authentication

### 2.1. Login
**POST** `/auth/login`

> No authentication required.

**Request Body:**
```json
{
  "username": "kasir1",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhGciO...",
  "user": {
    "id": 1,
    "username": "kasir1",
    "role": "cashier",
    "name": "Budi Santoso"
  }
}
```

**Errors:**
- `401` — Invalid username or password

### Seeded Users
| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `kasir1` | `password123` | cashier |
| `kasir2` | `password123` | cashier |
| `supervisor1` | `super123` | supervisor |

---

## 3. Daily Operations

> All daily endpoints require JWT authentication.

### 3.1. Check Opening Balance
**GET** `/daily/opening-balance?date=YYYY-MM-DD`

Defaults to today if `date` is omitted.

**Response (200 OK) — has opening:**
```json
{
  "hasOpening": true,
  "amount": 500000,
  "openedAt": "2026-02-19T08:00:00.000Z",
  "openedBy": "kasir1"
}
```

**Response (200 OK) — no opening:**
```json
{
  "hasOpening": false
}
```

### 3.2. Set Opening Balance
**POST** `/daily/opening-balance`

**Request Body:**
```json
{
  "amount": 500000,
  "notes": "Modal awal kasir 1"
}
```

**Response (201 Created):**
```json
{
  "message": "Opening balance set successfully"
}
```

**Errors:**
- `409` — Opening balance already set for today

### 3.3. Closing Preview
**GET** `/daily/closing/preview?date=YYYY-MM-DD`

Aggregates ALL cash-affecting transactions from every module and calculates expected cash.

**Response (200 OK):**
```json
{
  "openingBalance": 500000,
  "transactions": [
    {
      "source": "resto",
      "type": "IN",
      "description": "Order cm7k5... - Meja 5",
      "amount": 55000,
      "createdAt": "2026-02-19T12:30:00.000Z"
    },
    {
      "source": "edc",
      "type": "OUT",
      "description": "EDC Tarik Tunai - BCA (Ref: REF123)",
      "amount": 995000,
      "createdAt": "2026-02-19T14:00:00.000Z"
    }
  ],
  "expectedCash": 560000
}
```

**Transaction sources:**
| Source | Type | Amount Field | Filter |
|---|---|---|---|
| `resto` | IN | `order.total` | status=SETTLED, paymentMethod=Cash |
| `mobil` | IN | `mobilTransaction.amount` | paymentMethod=Cash |
| `motor` | IN | `motorRental.amount` | paymentMethod=Cash |
| `edc` | OUT | `edcTransaction.cashOutAmount` | type=WITHDRAWAL, cashOutAmount > 0 |
| `money_changer` | IN/OUT | `moneyChangerTransaction.amountIdr` | SELL=IN, BUY=OUT |
| `log_kas` | IN/OUT | `cashTransaction.amount` | type=IN/OUT |

**Errors:**
- `404` — No opening balance found for this date

### 3.4. Daily Closing
**POST** `/daily/closing`

**Request Body:**
```json
{
  "actualCash": 1250000,
  "expectedCash": 1250000,
  "supervisorCode": "super123",
  "notes": "Closing aman"
}
```

-   `supervisorCode` is **required** if `difference !== 0`
-   Validated via `bcrypt.compare()` against passwords of users with `role: 'supervisor'`

**Response (200 OK):**
```json
{
  "id": "CLS-20260219-01",
  "status": "CLOSED",
  "difference": 0
}
```

**Errors:**
- `400` — Supervisor code required when difference is not zero
- `403` — Invalid supervisor code
- `404` — No open session found for today

---

## 4. Restaurant (Resto)

### 4.1. Get Orders
**GET** `/resto/orders?date=YYYY-MM-DD`

Returns orders sorted by `createdAt desc`. Defaults to today.

**Response (200 OK):**
```json
[
  {
    "id": "cm7k5x...",
    "customer": "Meja 5",
    "items": [{ "productId": 1, "qty": 2, "price": 25000 }],
    "subtotal": 50000,
    "tax": 5000,
    "total": 55000,
    "status": "SETTLED",
    "paymentMethod": "Cash",
    "amountPaid": 60000,
    "date": "2026-02-19T00:00:00.000Z",
    "createdAt": "2026-02-19T12:30:00.000Z",
    "updatedAt": "2026-02-19T12:35:00.000Z"
  }
]
```

### 4.2. Create Order
**POST** `/resto/orders`

**Request Body:**
```json
{
  "customer": "Meja 5",
  "items": [
    { "productId": 1, "qty": 2, "price": 25000 }
  ],
  "subtotal": 50000,
  "tax": 5000,
  "total": 55000
}
```

**Response (201 Created):**
```json
{
  "id": "cm7k5x...",
  "status": "OPEN"
}
```

### 4.3. Settle Order
**POST** `/resto/orders/{id}/settle`

> **Balance Side Effect**: If `paymentMethod` is `Cash`, automatically updates the `resto` balance.

**Request Body:**
```json
{
  "paymentMethod": "Cash",
  "amountPaid": 60000
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "status": "SETTLED"
}
```

**Errors:**
- `404` — Order not found
- `400` — Order already SETTLED/VOID

---

## 5. Mobil (Car Services)
> **Note**: Mobil is NOT a rental. It is a separate business unit for car-related transactions.

### 5.1. Record Car Service Transaction
**POST** `/mobil/transactions`

> **Balance Side Effect**: If `paymentMethod` is `Cash`, automatically updates the `mobil` balance per `vehicleId`.

**Request Body:**
```json
{
  "customerName": "Pak Ahmad",
  "serviceType": "wash",
  "vehicleId": "B 1234 XYZ",
  "amount": 150000,
  "paymentMethod": "Cash",
  "notes": "Cuci mobil + interior"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "status": "COMPLETED"
}
```

### 5.2. Get Car Service Transactions
**GET** `/mobil/transactions?date=YYYY-MM-DD`

Returns transactions sorted by `createdAt desc`. Defaults to today.

---

## 6. Motor (Bike Rental)
> **Note**: Motor is the ONLY rental module in the system.

### 6.1. Create Bike Rental
**POST** `/motor/rentals`

> **Balance Side Effect**: If `paymentMethod` is `Cash`, automatically updates the `motor` balance per `vehicleId`.

**Request Body:**
```json
{
  "customerName": "Pak Budi",
  "vehicleId": "MTR-001",
  "duration": 2,
  "amount": 200000,
  "paymentMethod": "Cash",
  "notes": "Deposit KTP"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "status": "ACTIVE"
}
```

### 6.2. Get Bike Rentals
**GET** `/motor/rentals?date=YYYY-MM-DD`

Returns rentals sorted by `createdAt desc`. Defaults to today.

### 6.3. Get Available Vehicles
**GET** `/motor/vehicles`

Returns bike vehicles sorted by name.

---

## 7. EDC Transactions

### 7.1. Record EDC
**POST** `/transactions/edc`

> **Balance Side Effect**: If `cashOutAmount > 0`, automatically updates the `edc` balance (cash out + fee).

**Request Body:**
```json
{
  "type": "WITHDRAWAL",
  "cardType": "VISA",
  "provider": "BCA",
  "amount": 1000000,
  "cashOutAmount": 995000,
  "fee": 5000,
  "refNumber": "REF123456"
}
```

- `type`: `WITHDRAWAL` or `PAYMENT`
- `cardType`: `VISA` or `MASTER`

**Response (201 Created):**
```json
{
  "id": 1,
  "message": "Transaction recorded"
}
```

### 7.2. Get EDC Transactions
**GET** `/transactions/edc?date=YYYY-MM-DD`

Returns EDC transactions sorted by `createdAt desc`. Defaults to today.

---

## 8. Money Changer

### 8.1. Record Currency Exchange
**POST** `/transactions/money-changer`

> **Balance Side Effect**: Automatically updates the `moneychanger` balance with `amountIdr`.

**Request Body:**
```json
{
  "type": "BUY",
  "currency": "USD",
  "amountForeign": 100,
  "rate": 15000,
  "amountIdr": 1500000,
  "notaNumber": "MC-2024-001"
}
```

-   `BUY` = We buy foreign currency → Cash Out (IDR leaves drawer)
-   `SELL` = We sell foreign currency → Cash In (IDR enters drawer)

**Response (201 Created):**
```json
{
  "id": 1,
  "cashFlowType": "OUT"
}
```

### 8.2. Get Money Changer Transactions
**GET** `/transactions/money-changer?date=YYYY-MM-DD`

Returns transactions sorted by `createdAt desc`. Defaults to today.

---

## 9. General Cash Flow (Log Kas)

### 9.1. Record Cash Transaction
**POST** `/transactions/cash`

> **Balance Side Effect**: Automatically updates the balance for the given `category`.

**Request Body:**
```json
{
  "type": "OUT",
  "category": "lainnya",
  "amount": 50000,
  "description": "Beli Alat Tulis Kantor"
}
```

- `category`: `resto`, `mobil`, `motor`, `edc`, `moneychanger`, or `lainnya` (default: `lainnya`)

**Response (201 Created):**
```json
{
  "id": 1,
  "balanceAfter": 1550000
}
```

`balanceAfter` = opening balance + net of all cash transactions for the day. Returns `null` if no opening balance set.

### 9.2. Get Cash Transactions
**GET** `/transactions/cash?date=YYYY-MM-DD`

Returns cash transactions sorted by `createdAt desc`. Defaults to today.

---

## 10. Balance Tracking

The Balance table tracks running totals per category. It is automatically updated by module APIs (resto, mobil, motor, edc, moneychanger, log kas).

### 10.1. Get Balances
**GET** `/transactions/balance?category=motor`

- `category` (optional): Filter by `resto`, `mobil`, `motor`, `edc`, `moneychanger`, or `lainnya`. Returns all if omitted.

**Response (200 OK):**
```json
[
  { "id": 1, "category": "resto", "amount": 550000, "vehicleId": "", "totalFee": 0, "updatedAt": "2026-02-22T08:00:00Z" },
  { "id": 2, "category": "motor", "amount": 200000, "vehicleId": "MTR-001", "totalFee": 0, "updatedAt": "2026-02-22T09:00:00Z" },
  { "id": 3, "category": "motor", "amount": 150000, "vehicleId": "MTR-002", "totalFee": 0, "updatedAt": "2026-02-22T09:30:00Z" },
  { "id": 4, "category": "edc", "amount": -995000, "vehicleId": "", "totalFee": 5000, "updatedAt": "2026-02-22T10:00:00Z" }
]
```

**Key fields:**
- `amount`: Running balance (positive = cash in, negative = cash out)
- `vehicleId`: License plate for `motor`/`mobil` (empty for other categories)
- `totalFee`: Accumulated fee (only relevant for `edc`)
- Unique constraint: `(category, vehicleId)` — motor/mobil have one entry per vehicle

## 11. Central Balance (Kluis / Akun Utama)

Central Balance manages main accounts (e.g., Cash, Bank) separate from module-level balance tracking.

### 11.1. Get Accounts
**GET** `/central/accounts`

Returns all central accounts. If no accounts exist, automatically creates defaults (`cash`, `bank`).

**Response (200 OK):**
```json
[
  { "id": 1, "name": "cash", "label": "Cash", "amount": 500000, "updatedAt": "2026-03-27T10:00:00Z" },
  { "id": 2, "name": "bank", "label": "Bank", "amount": 1000000, "updatedAt": "2026-03-27T10:00:00Z" }
]
```

### 11.2. Create Movement
**POST** `/central/movements`

> **Balance Side Effect**: Atomically updates account balance(s) based on type.

**Types:**
| Type | Effect |
|------|--------|
| `EXPENSE` | Decreases `account` balance |
| `INCOME` | Increases `account` balance |
| `TRANSFER` | Decreases `fromAccount`, increases `toAccount` |

**Request Body (EXPENSE/INCOME):**
```json
{
  "type": "EXPENSE",
  "account": "cash",
  "amount": 100000,
  "description": "Modal outlet"
}
```

**Request Body (TRANSFER):**
```json
{
  "type": "TRANSFER",
  "fromAccount": "bank",
  "toAccount": "cash",
  "amount": 500000,
  "description": "Top up kas dari bank"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "message": "Movement recorded"
}
```

**Errors:**
- `400` — Validation failed (missing account/fromAccount/toAccount, invalid type)
- `400` — Account not found (Prisma P2025)

### 11.3. Get Movements (History)
**GET** `/central/movements?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Returns movements within date range. Defaults to today if omitted.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "type": "EXPENSE",
    "account": "cash",
    "fromAccount": null,
    "toAccount": null,
    "amount": 100000,
    "description": "Modal outlet",
    "createdBy": "dikky",
    "date": "2026-03-27T00:00:00.000Z",
    "createdAt": "2026-03-27T08:30:00.000Z"
  }
]
```

---

## 12. Master Data

### 12.1. Get Products (Menu)
**GET** `/products`

Returns active products sorted by name.

---

## 13. Cash Flow Logic Summary

```
Expected Cash =
  + Opening Balance
  + Resto (SETTLED + Cash)         .total
  + Mobil (Cash)                   .amount
  + Motor (Cash)                   .amount
  + Money Changer (SELL)           .amountIdr
  - Money Changer (BUY)            .amountIdr
  + Log Kas (IN)                   .amount
  - Log Kas (OUT)                  .amount
  - EDC (WITHDRAWAL)               .cashOutAmount
```

This logic is implemented in `GET /daily/closing/preview`.

### Balance Tracking
In addition to the closing preview, each module API automatically updates the `Balance` table via `updateBalance()` in `lib/balance.js`. This provides real-time per-category balance tracking accessible via `GET /transactions/balance`.

### Central Balance
Central Balance is separate from module balance tracking. It manages main accounts (cash, bank) and tracks movements via `CentralAccount` and `CentralMovement` tables, accessible via `/central/*` endpoints.

---

**End of Specification**
