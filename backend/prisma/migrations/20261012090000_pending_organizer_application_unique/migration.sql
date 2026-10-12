-- Prevent duplicate pending submissions even when requests arrive concurrently.
CREATE UNIQUE INDEX "OrganizerApplication_one_pending_per_applicant"
ON "OrganizerApplication"("applicantId")
WHERE "status" = 'PENDING';
