CREATE TABLE "OrganizerNotificationRead" (
    "organizerUserId" TEXT NOT NULL,
    "notificationId" VARCHAR(255) NOT NULL,
    "readAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerNotificationRead_pkey" PRIMARY KEY ("organizerUserId", "notificationId"),
    CONSTRAINT "OrganizerNotificationRead_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrganizerNotificationRead_organizerUserId_readAt_idx" ON "OrganizerNotificationRead"("organizerUserId", "readAt");
