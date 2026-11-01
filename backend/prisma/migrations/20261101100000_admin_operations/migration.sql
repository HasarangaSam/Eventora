ALTER TABLE "PaymentException"
  ADD COLUMN "reviewedAt" TIMESTAMPTZ(6),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewNote" TEXT;

CREATE INDEX "PaymentException_reviewedAt_createdAt_idx"
  ON "PaymentException"("reviewedAt", "createdAt");
ALTER TABLE "PaymentException"
  ADD CONSTRAINT "PaymentException_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "targetType" VARCHAR(80) NOT NULL,
  "targetId" VARCHAR(255) NOT NULL,
  "beforeValue" TEXT,
  "afterValue" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx"
  ON "AdminAuditLog"("targetType", "targetId", "createdAt");
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx"
  ON "AdminAuditLog"("actorId", "createdAt");
