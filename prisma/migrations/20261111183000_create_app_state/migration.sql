-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL DEFAULT 'fieldworker',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "household" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "verificationTone" TEXT NOT NULL,
    "subsidy" TEXT NOT NULL,
    "subsidyTone" TEXT NOT NULL,
    "readiness" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    "members" INTEGER NOT NULL,
    "site" TEXT NOT NULL,
    "sources" JSONB,
    "intakeId" TEXT,
    "latestVisitSummary" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "form" JSONB,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "reviewedBy" TEXT,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitEvidence" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "label" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "provenance" JSONB,
    "legibilityStatus" TEXT,
    "legibilityNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitGrievance" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionOwner" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitGrievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppState" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_caseId_idx" ON "Visit"("caseId");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "VisitEvidence_visitId_idx" ON "VisitEvidence"("visitId");

-- CreateIndex
CREATE INDEX "VisitGrievance_visitId_idx" ON "VisitGrievance"("visitId");

-- CreateIndex
CREATE INDEX "Blocker_caseId_idx" ON "Blocker"("caseId");

-- CreateIndex
CREATE INDEX "Activity_caseId_idx" ON "Activity"("caseId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitEvidence" ADD CONSTRAINT "VisitEvidence_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitGrievance" ADD CONSTRAINT "VisitGrievance_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Visit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisitEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisitGrievance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Blocker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Intake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppState" ENABLE ROW LEVEL SECURITY;
