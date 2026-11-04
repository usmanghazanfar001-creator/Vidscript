-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('SILENT_DRAFT', 'FINAL_RENDER');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CaptionFormat" AS ENUM ('SRT', 'VTT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "logoUrl" TEXT,
    "watermarkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "ProjectMode" NOT NULL DEFAULT 'SILENT_DRAFT',
    "visualStyle" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '16:9',
    "brandPresetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "wordsPerMinute" INTEGER NOT NULL DEFAULT 150,
    "estimatedDurationSeconds" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryboardVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryboardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenePlan" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScenePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "scenePlanId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voiceover" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voiceover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptionFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" "CaptionFormat" NOT NULL,
    "cueCount" INTEGER NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "validationErrors" JSONB,
    "storageKey" TEXT,
    "preset" TEXT NOT NULL DEFAULT 'boxed',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" "ProjectMode" NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "lambdaRenderId" TEXT,
    "storyboardVersion" INTEGER,
    "outputFiles" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Script_projectId_key" ON "Script"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardVersion_projectId_version_key" ON "StoryboardVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ScenePlan_storyboardId_key" ON "ScenePlan"("storyboardId");

-- CreateIndex
CREATE INDEX "Scene_scenePlanId_position_idx" ON "Scene"("scenePlanId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Voiceover_projectId_key" ON "Voiceover"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptionFile_projectId_key" ON "CaptionFile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_cacheKey_key" ON "Asset"("cacheKey");

-- CreateIndex
CREATE INDEX "RenderJob_projectId_idx" ON "RenderJob"("projectId");

-- AddForeignKey
ALTER TABLE "BrandPreset" ADD CONSTRAINT "BrandPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandPresetId_fkey" FOREIGN KEY ("brandPresetId") REFERENCES "BrandPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryboardVersion" ADD CONSTRAINT "StoryboardVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenePlan" ADD CONSTRAINT "ScenePlan_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "StoryboardVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_scenePlanId_fkey" FOREIGN KEY ("scenePlanId") REFERENCES "ScenePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voiceover" ADD CONSTRAINT "Voiceover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionFile" ADD CONSTRAINT "CaptionFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
