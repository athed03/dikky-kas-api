-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'cashier',
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySession" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "openingAmount" DOUBLE PRECISION NOT NULL,
    "openingNotes" TEXT,
    "openedBy" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualCash" DOUBLE PRECISION,
    "expectedCash" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "closingNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "DailySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "paymentMethod" TEXT,
    "amountPaid" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilTransaction" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "vehicleId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotorRental" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotorRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdcTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cashOutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refNumber" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdcTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyChangerTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountForeign" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amountIdr" DOUBLE PRECISION NOT NULL,
    "notaNumber" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyChangerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'operational',
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "plate" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'bike',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "DailySession_date_openedBy_key" ON "DailySession"("date", "openedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "DailySession" ADD CONSTRAINT "DailySession_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
