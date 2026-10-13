CREATE TABLE "AdminNotificationRead" (
    "adminUserId" TEXT NOT NULL,
    "notificationId" VARCHAR(255) NOT NULL,
    "readAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("adminUserId", "notificationId"),
    CONSTRAINT "AdminNotificationRead_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AdminNotificationRead_adminUserId_readAt_idx" ON "AdminNotificationRead"("adminUserId", "readAt");
