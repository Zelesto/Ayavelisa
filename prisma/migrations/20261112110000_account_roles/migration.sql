ALTER TABLE "User"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'fieldworker',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserAudit" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAudit_subjectUserId_idx" ON "UserAudit"("subjectUserId");
CREATE INDEX "UserAudit_actorUserId_idx" ON "UserAudit"("actorUserId");

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAudit" ENABLE ROW LEVEL SECURITY;
