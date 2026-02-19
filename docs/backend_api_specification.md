# Backend API Specification: Dikky Kas

**Version**: 2.0  
**Last Updated**: 2026-02-19

---

## 1. General Info
-   **Base URL**: `/api/v1`
-   **Swagger Docs**: `/api/docs` (Swagger UI)
-   **Authentication**: Bearer Token (JWT) in `Authorization` header.
-   **Content-Type**: `application/json`
-   **Date Format**: ISO 8601 (`YYYY-MM-DD` for query params, full ISO for timestamps)
-   **ID Format**: `cuid` (e.g., `cm7k5x0z20001...`) — all entity IDs use Prisma `@default(cuid())`

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
  "id": "cm7k5x...",
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
  "id": "cm7k5x...",
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
  "id": "cm7k5x...",
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

**Request Body:**
```json
{
  "type": "WITHDRAWAL",
  "cardType": "DEBIT",
  "provider": "BCA",
  "amount": 1000000,
  "cashOutAmount": 995000,
  "fee": 5000,
  "refNumber": "REF123456"
}
```

**Response (201 Created):**
```json
{
  "id": "cm7k5x...",
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
  "id": "cm7k5x...",
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

**Request Body:**
```json
{
  "type": "OUT",
  "category": "operational",
  "amount": 50000,
  "description": "Beli Alat Tulis Kantor"
}
```

**Response (201 Created):**
```json
{
  "id": "cm7k5x...",
  "balanceAfter": 1550000
}
```

`balanceAfter` = opening balance + net of all cash transactions for the day. Returns `null` if no opening balance set.

### 9.2. Get Cash Transactions
**GET** `/transactions/cash?date=YYYY-MM-DD`

Returns cash transactions sorted by `createdAt desc`. Defaults to today.

---

## 10. Master Data

### 10.1. Get Products (Menu)
**GET** `/products`

Returns active products sorted by name.

---

## 11. Cash Flow Logic Summary

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

---

**End of Specification**
