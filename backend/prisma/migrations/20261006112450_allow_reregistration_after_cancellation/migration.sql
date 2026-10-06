-- DropIndex
DROP INDEX "Registration_userId_eventId_key";

-- CreateIndex
CREATE INDEX "Registration_userId_eventId_idx" ON "Registration"("userId", "eventId");
