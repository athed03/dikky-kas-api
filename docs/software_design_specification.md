# Software Design Specification: Dikky Kas

**Version**: 2.1  
**Last Updated**: 2026-02-21

---

## 1. Project Overview
**Dikky Kas** is a multi-platform financial recording system for the Aditya Group. It consists of a **React Native (Expo) mobile app** as the frontend and a **Node.js/Express backend API** with PostgreSQL as the persistence layer.

**Key Features**:
-   **Multi-Unit Support**: Resto, Mobil (Car Services), Motor (Bike Rental), EDC, Money Changer, and General Expenses.
-   **Cash Flow Management**: Real-time tracking of cash in drawer vs. system calculations.
-   **Daily Closing**: Automated reconciliation of daily transactions with supervisor approval.
-   **API Docs**: Interactive Swagger UI at `/api/docs`.

---

## 2. System Architecture

### 2.1. Backend
-   **Runtime**: Node.js + Express
-   **ORM**: Prisma 7 with `@prisma/adapter-pg`
-   **Database**: PostgreSQL (hosted on Neon)
-   **Auth**: JWT (`jsonwebtoken`) + `bcryptjs`
-   **Validation**: Zod schemas
-   **API Docs**: `swagger-jsdoc` + `swagger-ui-express`
-   **Deployment**: Vercel (serverless)
-   **Config**: `prisma.config.ts` (Prisma 7 datasource config with `env()` helper)

### 2.2. Frontend (Mobile App)
-   **Framework**: React Native (Expo Managed Workflow)
-   **Navigation**: React Navigation (Stack)
-   **State Management**: React Context (`AppContext`, `AuthContext`)
-   **UI Library**: Custom components + `@expo/vector-icons`
-   **Styling**: `StyleSheet` with centralized Theme System

---

## 3. Project Structure (Backend)

```
dikky-kas-api/
├── api/
│   └── index.js              # Express entry point + middleware + Swagger mount
├── routes/
│   ├── auth.js                # POST /auth/login
│   ├── daily.js               # Daily opening/closing/preview
│   ├── resto.js               # Restaurant orders
│   ├── mobil.js               # Car service transactions
│   ├── motor.js               # Bike rentals + vehicles
│   ├── transactions.js        # EDC, Money Changer, Cash (Log Kas)
│   └── masterdata.js          # Products
├── lib/
│   ├── auth.js                # JWT generate + authenticate middleware
│   ├── prisma.js              # PrismaClient singleton (with PrismaPg adapter)
│   ├── response.js            # success/error helpers + date utils
│   ├── validate.js            # Zod validation middleware
│   └── swagger.js             # OpenAPI 3.0 spec config
├── __tests__/
│   ├── setup.js               # Shared test setup
│   ├── helpers/
│   │   ├── mockPrisma.js      # Prisma mock factory (all models)
│   │   └── authHelper.js      # JWT token helper for tests
│   ├── lib/
│   │   ├── response.test.js   # Tests for response helpers
│   │   ├── validate.test.js   # Tests for Zod middleware
│   │   └── auth.test.js       # Tests for JWT auth
│   └── routes/
│       ├── auth.test.js       # Login endpoint tests
│       ├── daily.test.js      # Daily operations tests
│       ├── resto.test.js      # Restaurant order tests
│       ├── mobil.test.js      # Car service tests
│       ├── motor.test.js      # Bike rental tests
│       ├── transactions.test.js # EDC/MC/Cash tests
│       └── masterdata.test.js # Product tests
├── prisma/
│   ├── schema.prisma          # Data models
│   ├── seed.js                # Seed data (users, products, vehicles)
│   └── migrations/            # Prisma migrations
├── generated/
│   └── prisma/                # Generated Prisma Client (gitignored)
├── jest.config.js             # Jest test configuration
├── prisma.config.ts           # Prisma 7 CLI config (datasource URL)
├── vercel.json                # Vercel deployment config
└── package.json
```

---

## 4. Data Models

All models defined in `prisma/schema.prisma`.

### User
| Field | Type | Notes |
|---|---|---|
| id | Int (auto) | Primary key |
| username | String | Unique |
| password | String | bcrypt hashed |
| role | String | `admin`, `cashier`, `supervisor` |
| name | String | |

### DailySession
| Field | Type | Notes |
|---|---|---|
| id | Int (auto) | Primary key |
| date | Date | Unique per user |
| openingAmount | Float | Starting cash |
| actualCash | Float? | Set at closing |
| expectedCash | Float? | Computed at closing |
| difference | Float? | actual - expected |
| status | String | `OPEN` / `CLOSED` |

### Order (Resto)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| customer | String | e.g., "Meja 5" |
| items | Json | Array of `{ productId, name, qty, price }` |
| subtotal, tax, total | Float | |
| status | String | `OPEN` / `SETTLED` / `VOID` |
| paymentMethod | String? | `Cash`, `QRIS`, `Debit`, `Credit` |

### MobilTransaction
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| customerName | String | |
| serviceType | String | `wash`, `parking`, `other` |
| amount | Float | |
| paymentMethod | String | Default: `Cash` |

### MotorRental
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| customerName | String | |
| vehicleId | String | License plate or Motor ID |
| duration | Int | Days |
| amount | Float | |
| paymentMethod | String | Default: `Cash` |
| status | String | `ACTIVE` / `RETURNED` |

### EdcTransaction
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| type | String | `WITHDRAWAL` / `PAYMENT` |
| cardType | String | `DEBIT` / `CREDIT` |
| provider | String | e.g., `BCA`, `BRI` |
| amount | Float | Total swipe amount |
| cashOutAmount | Float | Amount given to customer |
| fee | Float | Admin fee |

### MoneyChangerTransaction
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| type | String | `BUY` (Cash Out) / `SELL` (Cash In) |
| currency | String | `USD`, `SGD`, etc. |
| amountForeign | Float | |
| rate | Float | |
| amountIdr | Float | IDR equivalent |

### CashTransaction (Log Kas)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| type | String | `IN` / `OUT` |
| category | String | `operational`, `equity`, `misc` |
| amount | Float | |
| description | String? | |

> All transaction models include `date` (Date) and `createdAt` (DateTime) fields.

---

## 5. Cash Flow Formula

```
Expected Cash =
  + Opening Balance
  + Resto (SETTLED + Cash)          → order.total
  + Mobil (Cash)                    → mobilTransaction.amount
  + Motor (Cash)                    → motorRental.amount
  + Money Changer SELL              → moneyChangerTransaction.amountIdr
  - Money Changer BUY               → moneyChangerTransaction.amountIdr
  + Log Kas IN                      → cashTransaction.amount
  - Log Kas OUT                     → cashTransaction.amount
  - EDC WITHDRAWAL                  → edcTransaction.cashOutAmount
```

Implemented in `GET /daily/closing/preview`.

---

## 6. Module Details

### Authentication
-   Login with username/password → JWT token
-   Token required for all endpoints except `/auth/login` and `/api/health`

### Daily Operations
-   **Opening Balance**: Must be set once per day before transactions
-   **Closing Preview**: Aggregates all cash-affecting transactions chronologically
-   **Closing**: Requires supervisor code (validated via bcrypt) if there is a cash difference

### Mobil (Car Services)
-   **NOT** a rental module — separate business unit for car services (wash, parking, etc.)

### Motor (Bike Rental)
-   The **ONLY** rental module — tracks customer, vehicle, duration, and amount

### EDC
-   `WITHDRAWAL` = customer withdraws cash at register → cash leaves drawer
-   `PAYMENT` = customer pays via card → no cash movement

### Money Changer
-   `SELL` (Jual) = We sell foreign currency → IDR enters drawer (Cash In)
-   `BUY` (Beli) = We buy foreign currency → IDR leaves drawer (Cash Out)

### Log Kas
-   General cash flow for miscellaneous income/expenses

---

## 7. Development Setup

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Generate Prisma Client
npx prisma generate

# Run migration
npx prisma migrate dev

# Seed database
node prisma/seed.js

# Start dev server
npm run dev
```

-   **Dev server**: `http://localhost:3000`
-   **Swagger docs**: `http://localhost:3000/api/docs`
-   **Health check**: `http://localhost:3000/api/health`

---

## 8. Unit Testing

### Stack
-   **Test Runner**: Jest
-   **HTTP Testing**: supertest (against Express app)
-   **Mocking**: jest.fn() mocks for all Prisma models (no real database needed)

### Test Coverage
| Suite | File | Tests |
|---|---|---|
| **Lib** | `response.test.js` | `success()`, `error()`, `getTodayDate()`, `parseDate()` |
| **Lib** | `validate.test.js` | Valid body, invalid body, missing fields, wrong types |
| **Lib** | `auth.test.js` | `generateToken()`, `authenticateToken()` (valid/invalid/expired) |
| **Route** | `auth.test.js` | Login: valid, user not found, wrong password, validation |
| **Route** | `daily.test.js` | Opening balance, closing preview (cash flow calc), daily closing |
| **Route** | `resto.test.js` | Orders: list, create, settle (+ 404, already settled) |
| **Route** | `mobil.test.js` | Car service: create, list |
| **Route** | `motor.test.js` | Bike rental: create, list, vehicles |
| **Route** | `transactions.test.js` | EDC, Money Changer (BUY/SELL), Cash (balanceAfter) |
| **Route** | `masterdata.test.js` | Products: auth check, list, empty |

**Total: 10 suites, 59 tests**

### Running Tests
```bash
npm test
```

---

## 9. Constraints
1.  **Do NOT** change the `calculateExpectedCash` formula without explicit user request.
2.  **Do NOT** revert the "Money Changer" or "Log Kas" naming conventions.
3.  **Prisma 7**: Client generated to `generated/prisma/` (not `node_modules`). Imports must use `../generated/prisma`.
4.  **Prisma 7**: Database URL configured in `prisma.config.ts`, NOT in `schema.prisma`.

---

**End of Specification**
