ALTER TYPE "Role" ADD VALUE 'TEAM_MEMBER';
CREATE TYPE "TeamMessageSender" AS ENUM ('VISITOR', 'STAFF');

CREATE TABLE "TeamProfile" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "titleEn" VARCHAR(80) NOT NULL,
  "titleAr" VARCHAR(80) NOT NULL,
  "bioEn" VARCHAR(2000) NOT NULL DEFAULT '',
  "bioAr" VARCHAR(2000) NOT NULL DEFAULT '',
  "avatarMediaId" UUID,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamProfile_plain_identity_check" CHECK (length(btrim("displayName")) > 0 AND length(btrim("titleEn")) > 0 AND length(btrim("titleAr"))
    > 0 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE UNIQUE INDEX "TeamProfile_userId_key" ON "TeamProfile"("userId");
CREATE UNIQUE INDEX "TeamProfile_slug_key" ON "TeamProfile"("slug");
ALTER TABLE "TeamProfile" ADD CONSTRAINT "TeamProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamProfile" ADD CONSTRAINT "TeamProfile_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TeamConversation" (
  "id" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "visitorName" VARCHAR(160) NOT NULL,
  "visitorEmail" VARCHAR(254) NOT NULL,
  "visitorTokenHash" VARCHAR(64) NOT NULL,
  "visitorTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamConversation_identity_check" CHECK (length(btrim("visitorName")) > 0 AND length(btrim("visitorEmail")) > 0 AND "visitorTokenHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "TeamConversation_visitorTokenHash_key" ON "TeamConversation"("visitorTokenHash");
CREATE INDEX "TeamConversation_memberId_updatedAt_id_idx" ON "TeamConversation"("memberId", "updatedAt" DESC, "id");
CREATE INDEX "TeamConversation_visitorTokenExpiresAt_idx" ON "TeamConversation"("visitorTokenExpiresAt");
ALTER TABLE "TeamConversation" ADD CONSTRAINT "TeamConversation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TeamMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "sender" "TeamMessageSender" NOT NULL,
  "body" VARCHAR(3000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMessage_nonempty_body_check" CHECK (length(btrim("body")) > 0)
);
CREATE INDEX "TeamMessage_conversationId_createdAt_id_idx" ON "TeamMessage"("conversationId", "createdAt" DESC, "id");
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TeamConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
