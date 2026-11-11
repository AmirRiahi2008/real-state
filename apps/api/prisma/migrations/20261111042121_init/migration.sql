-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Emirate" AS ENUM ('DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'RAS_AL_KHAIMAH', 'FUJAIRAH', 'UMM_AL_QUWAIN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'DUPLEX', 'STUDIO', 'OFFICE', 'RETAIL', 'LAND', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "ListingPurpose" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('READY', 'OFF_PLAN');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RENTED');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED');

-- CreateEnum
CREATE TYPE "RentalPeriod" AS ENUM ('YEAR', 'MONTH', 'WEEK', 'DAY');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('ENQUIRY', 'VIEWING', 'VALUATION', 'MORTGAGE', 'PROJECT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'AREA_GUIDE', 'MARKET_REPORT', 'BUYER_GUIDE', 'SERVICE');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" UUID NOT NULL,
    "to" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "text" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(160) NOT NULL,
    "nameAr" VARCHAR(160) NOT NULL,
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "descriptionAr" TEXT NOT NULL DEFAULT '',
    "emirate" "Emirate" NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "parentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Developer" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(160) NOT NULL,
    "nameAr" VARCHAR(160) NOT NULL,
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "descriptionAr" TEXT NOT NULL DEFAULT '',
    "website" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "nameAr" VARCHAR(120) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "bioEn" TEXT NOT NULL DEFAULT '',
    "bioAr" TEXT NOT NULL DEFAULT '',
    "publicEmail" VARCHAR(254),
    "phone" VARCHAR(24),
    "whatsapp" VARCHAR(24),
    "reraNumber" VARCHAR(40),
    "languages" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "areaId" UUID,
    "photoMediaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "titleEn" VARCHAR(200) NOT NULL,
    "titleAr" VARCHAR(200) NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "purpose" "ListingPurpose" NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "completion" "CompletionStatus" NOT NULL,
    "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
    "furnishing" "Furnishing" NOT NULL DEFAULT 'UNFURNISHED',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "priceAed" DECIMAL(16,2),
    "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
    "previousPriceAed" DECIMAL(16,2),
    "rentalPeriod" "RentalPeriod",
    "areaSqm" DECIMAL(12,2) NOT NULL,
    "plotAreaSqm" DECIMAL(12,2),
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "parking" INTEGER NOT NULL DEFAULT 0,
    "addressEn" VARCHAR(300) NOT NULL,
    "addressAr" VARCHAR(300) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "vacantOn" DATE,
    "handoverDate" DATE,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "permitNumber" VARCHAR(64),
    "permitUrl" VARCHAR(600),
    "areaId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "projectId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "nameEn" VARCHAR(200) NOT NULL,
    "nameAr" VARCHAR(200) NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "startingPriceAed" DECIMAL(16,2),
    "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
    "handoverDate" DATE,
    "minBedrooms" INTEGER NOT NULL,
    "maxBedrooms" INTEGER NOT NULL,
    "propertyTypes" "PropertyType"[],
    "paymentPlan" JSONB NOT NULL DEFAULT '[]',
    "floorPlans" JSONB NOT NULL DEFAULT '[]',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "developerId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" VARCHAR(100) NOT NULL,
    "mimeType" VARCHAR(40) NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingMedia" (
    "listingId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "altEn" VARCHAR(200) NOT NULL DEFAULT '',
    "altAr" VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "ListingMedia_pkey" PRIMARY KEY ("listingId","mediaId")
);

-- CreateTable
CREATE TABLE "ProjectMedia" (
    "projectId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "altEn" VARCHAR(200) NOT NULL DEFAULT '',
    "altAr" VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("projectId","mediaId")
);

-- CreateTable
CREATE TABLE "ListingAmenity" (
    "listingId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "ListingAmenity_pkey" PRIMARY KEY ("listingId","amenityId")
);

-- CreateTable
CREATE TABLE "ProjectAmenity" (
    "projectId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "ProjectAmenity_pkey" PRIMARY KEY ("projectId","amenityId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "type" "LeadType" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(24) NOT NULL,
    "message" VARCHAR(3000) NOT NULL,
    "preferredAt" TIMESTAMP(3),
    "consent" BOOLEAN NOT NULL,
    "listingId" UUID,
    "projectId" UUID,
    "assignedToId" UUID,
    "internalNotes" VARCHAR(5000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "type" "ContentType" NOT NULL,
    "titleEn" VARCHAR(200) NOT NULL,
    "titleAr" VARCHAR(200) NOT NULL,
    "excerptEn" VARCHAR(600) NOT NULL,
    "excerptAr" VARCHAR(600) NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "areaId" UUID,
    "coverMediaId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(100),
    "requestId" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_familyId_idx" ON "AuthSession"("familyId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimeToken_tokenHash_key" ON "OneTimeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OneTimeToken_userId_purpose_idx" ON "OneTimeToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "OneTimeToken_expiresAt_idx" ON "OneTimeToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_sentAt_nextAttemptAt_idx" ON "EmailOutbox"("sentAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Area_slug_key" ON "Area"("slug");

-- CreateIndex
CREATE INDEX "Area_emirate_isActive_idx" ON "Area"("emirate", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_slug_key" ON "Developer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_slug_key" ON "Amenity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_slug_key" ON "AgentProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_reference_key" ON "Listing"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_status_purpose_createdAt_idx" ON "Listing"("status", "purpose", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Listing_areaId_status_priceAed_idx" ON "Listing"("areaId", "status", "priceAed");

-- CreateIndex
CREATE INDEX "Listing_agentId_status_idx" ON "Listing"("agentId", "status");

-- CreateIndex
CREATE INDEX "Listing_propertyType_bedrooms_idx" ON "Listing"("propertyType", "bedrooms");

-- CreateIndex
CREATE INDEX "Listing_latitude_longitude_idx" ON "Listing"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Project_areaId_developerId_idx" ON "Project"("areaId", "developerId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_position_idx" ON "ListingMedia"("listingId", "position");

-- CreateIndex
CREATE INDEX "ProjectMedia_projectId_position_idx" ON "ProjectMedia"("projectId", "position");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_status_createdAt_idx" ON "Lead"("assignedToId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_type_publishedAt_idx" ON "Article"("status", "type", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeToken" ADD CONSTRAINT "OneTimeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAmenity" ADD CONSTRAINT "ListingAmenity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAmenity" ADD CONSTRAINT "ListingAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAmenity" ADD CONSTRAINT "ProjectAmenity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAmenity" ADD CONSTRAINT "ProjectAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
