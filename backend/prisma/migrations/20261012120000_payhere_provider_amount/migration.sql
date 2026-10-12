ALTER TABLE "PaymentAttempt"
  ADD COLUMN "providerAmount" DECIMAL(12, 2),
  ADD COLUMN "providerCurrency" CHAR(3);

ALTER TYPE "PaymentStatus" ADD VALUE 'CHARGEDBACK';
