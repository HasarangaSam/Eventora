-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ATTENDEE', 'ORGANIZER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "OrganizerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYHERE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'CHECKED_IN', 'VOIDED');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR_SCAN', 'MANUAL_REFERENCE');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PURCHASE_CONFIRMATION', 'ORGANIZER_APPLICATION_DECISION', 'EVENT_CANCELLATION');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "imageUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ATTENDEE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerApplication" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "OrganizerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "organizationName" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewerId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OrganizerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL,
    "venue" VARCHAR(200) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "capacity" INTEGER,
    "ticketsReserved" INTEGER NOT NULL DEFAULT 0,
    "ticketsSold" INTEGER NOT NULL DEFAULT 0,
    "coverImageUrl" TEXT,
    "coverImagePublicId" VARCHAR(255),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "speaker" VARCHAR(200),
    "venue" VARCHAR(200),
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "salesStartAt" TIMESTAMPTZ(6),
    "salesEndAt" TIMESTAMPTZ(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(128),
    "confirmedAt" TIMESTAMPTZ(6),
    "expiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '10 minutes'),
    "committedAt" TIMESTAMPTZ(6),
    "releasedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYHERE',
    "merchantReference" VARCHAR(100) NOT NULL,
    "providerPaymentId" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "providerStatus" VARCHAR(80),
    "paidAt" TIMESTAMPTZ(6),
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentException" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "reasonCode" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "qrTokenHash" VARCHAR(64) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "checkedInById" TEXT NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "checkedInAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "recipient" VARCHAR(320) NOT NULL,
    "registrationId" TEXT,
    "organizerApplicationId" TEXT,
    "eventId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "OrganizerApplication_applicantId_status_idx" ON "OrganizerApplication"("applicantId", "status");

-- CreateIndex
CREATE INDEX "OrganizerApplication_status_submittedAt_idx" ON "OrganizerApplication"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_coverImagePublicId_key" ON "Event"("coverImagePublicId");

-- CreateIndex
CREATE INDEX "Event_status_startAt_idx" ON "Event"("status", "startAt");

-- CreateIndex
CREATE INDEX "Event_categoryId_status_startAt_idx" ON "Event"("categoryId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Event_organizerId_status_startAt_idx" ON "Event"("organizerId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Event_isFeatured_status_startAt_idx" ON "Event"("isFeatured", "status", "startAt");

-- CreateIndex
CREATE INDEX "EventSession_eventId_startAt_idx" ON "EventSession"("eventId", "startAt");

-- CreateIndex
CREATE INDEX "TicketType_eventId_isActive_salesStartAt_salesEndAt_idx" ON "TicketType"("eventId", "isActive", "salesStartAt", "salesEndAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketType_eventId_name_key" ON "TicketType"("eventId", "name");

-- CreateIndex
CREATE INDEX "Registration_userId_createdAt_idx" ON "Registration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_eventId_status_createdAt_idx" ON "Registration"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_ticketTypeId_status_idx" ON "Registration"("ticketTypeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_idempotencyKey_key" ON "Registration"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_registrationId_key" ON "InventoryReservation"("registrationId");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_eventId_status_expiresAt_idx" ON "InventoryReservation"("eventId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_ticketTypeId_status_expiresAt_idx" ON "InventoryReservation"("ticketTypeId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_merchantReference_key" ON "PaymentAttempt"("merchantReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerPaymentId_key" ON "PaymentAttempt"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_registrationId_createdAt_idx" ON "PaymentAttempt"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentException_registrationId_createdAt_idx" ON "PaymentException"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentException_paymentAttemptId_createdAt_idx" ON "PaymentException"("paymentAttemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrTokenHash_key" ON "Ticket"("qrTokenHash");

-- CreateIndex
CREATE INDEX "Ticket_registrationId_createdAt_idx" ON "Ticket"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_ticketId_key" ON "CheckIn"("ticketId");

-- CreateIndex
CREATE INDEX "CheckIn_eventId_checkedInAt_idx" ON "CheckIn"("eventId", "checkedInAt");

-- CreateIndex
CREATE INDEX "CheckIn_checkedInById_checkedInAt_idx" ON "CheckIn"("checkedInById", "checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_idempotencyKey_key" ON "EmailDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_type_createdAt_idx" ON "EmailDelivery"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizerApplication" ADD CONSTRAINT "OrganizerApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerApplication" ADD CONSTRAINT "OrganizerApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentException" ADD CONSTRAINT "PaymentException_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentException" ADD CONSTRAINT "PaymentException_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_organizerApplicationId_fkey" FOREIGN KEY ("organizerApplicationId") REFERENCES "OrganizerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business invariants that Prisma Schema Language cannot express as CHECK constraints.
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_time_order_check" CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT "Event_capacity_positive_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
  ADD CONSTRAINT "Event_inventory_nonnegative_check" CHECK ("ticketsReserved" >= 0 AND "ticketsSold" >= 0),
  ADD CONSTRAINT "Event_inventory_within_capacity_check" CHECK ("capacity" IS NULL OR "ticketsReserved" + "ticketsSold" <= "capacity");

ALTER TABLE "EventSession"
  ADD CONSTRAINT "EventSession_time_order_check" CHECK ("endAt" > "startAt");

ALTER TABLE "TicketType"
  ADD CONSTRAINT "TicketType_price_positive_check" CHECK ("price" > 0),
  ADD CONSTRAINT "TicketType_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "TicketType_inventory_nonnegative_check" CHECK ("quantityReserved" >= 0 AND "quantitySold" >= 0),
  ADD CONSTRAINT "TicketType_inventory_within_capacity_check" CHECK ("quantityReserved" + "quantitySold" <= "quantity"),
  ADD CONSTRAINT "TicketType_sales_window_check" CHECK ("salesStartAt" IS NULL OR "salesEndAt" IS NULL OR "salesEndAt" > "salesStartAt");

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "Registration_unit_price_positive_check" CHECK ("unitPrice" > 0),
  ADD CONSTRAINT "Registration_total_matches_snapshot_check" CHECK ("totalAmount" = "unitPrice" * "quantity"),
  ADD CONSTRAINT "Registration_confirmed_timestamp_check" CHECK ("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL),
  ADD CONSTRAINT "Registration_expired_timestamp_check" CHECK ("status" <> 'EXPIRED' OR "expiredAt" IS NOT NULL);

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "InventoryReservation_ten_minute_expiry_check" CHECK ("expiresAt" = "createdAt" + INTERVAL '10 minutes'),
  ADD CONSTRAINT "InventoryReservation_committed_timestamp_check" CHECK ("status" <> 'COMMITTED' OR "committedAt" IS NOT NULL),
  ADD CONSTRAINT "InventoryReservation_released_timestamp_check" CHECK ("status" NOT IN ('RELEASED', 'EXPIRED') OR "releasedAt" IS NOT NULL);

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "PaymentAttempt_success_timestamps_check" CHECK ("status" <> 'SUCCEEDED' OR ("paidAt" IS NOT NULL AND "verifiedAt" IS NOT NULL));

ALTER TABLE "EmailDelivery"
  ADD CONSTRAINT "EmailDelivery_attempt_count_nonnegative_check" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "EmailDelivery_sent_timestamp_check" CHECK ("status" <> 'SENT' OR "sentAt" IS NOT NULL);
