PRAGMA foreign_keys=OFF;

CREATE TABLE "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "repoUrl" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "configYaml" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Project_repoUrl_key" ON "Project"("repoUrl");
CREATE INDEX "Project_name_idx" ON "Project"("name");

CREATE TABLE "Run" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "specId" TEXT,
  "workflowId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled')),
  "currentPhase" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "initiatedBy" TEXT,
  "errorMessage" TEXT,
  "artifactPath" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Run_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Run_projectId_createdAt_idx" ON "Run"("projectId", "createdAt");
CREATE INDEX "Run_status_createdAt_idx" ON "Run"("status", "createdAt");

CREATE TABLE "Phase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
  "agentId" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Phase_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "Run" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Phase_runId_createdAt_idx" ON "Phase"("runId", "createdAt");
CREATE UNIQUE INDEX "Phase_runId_name_key" ON "Phase"("runId", "name");

CREATE TABLE "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "phaseId" TEXT NOT NULL,
  "githubIssueNumber" INTEGER,
  "githubIssueUrl" TEXT,
  "specSection" TEXT,
  "agentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'blocked', 'cancelled')),
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "restartCount" INTEGER NOT NULL DEFAULT 0,
  "branchName" TEXT,
  "resultJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "Run" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Task_phaseId_fkey"
    FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Task_runId_phaseId_createdAt_idx" ON "Task"("runId", "phaseId", "createdAt");
CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");

CREATE TABLE "Artifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT,
  "phaseId" TEXT,
  "taskId" TEXT,
  "path" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'json' CHECK ("type" IN ('json', 'md', 'sarif', 'patch', 'html', 'jsonl', 'xml', 'text', 'log')),
  "sizeBytes" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Artifact_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "Run" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Artifact_phaseId_fkey"
    FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Artifact_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Artifact_runId_createdAt_idx" ON "Artifact"("runId", "createdAt");
CREATE INDEX "Artifact_phaseId_createdAt_idx" ON "Artifact"("phaseId", "createdAt");
CREATE INDEX "Artifact_taskId_createdAt_idx" ON "Artifact"("taskId", "createdAt");

PRAGMA foreign_keys=ON;
