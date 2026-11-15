ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'NEWS';
ALTER TABLE "Article" ADD COLUMN "bodyRichEn" JSONB, ADD COLUMN "bodyRichAr" JSONB;
ALTER TABLE "Listing" ADD COLUMN "descriptionRichEn" JSONB, ADD COLUMN "descriptionRichAr" JSONB;
ALTER TABLE "Project" ADD COLUMN "descriptionRichEn" JSONB, ADD COLUMN "descriptionRichAr" JSONB;

CREATE TABLE "ListingRichMedia" (
  "listingId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  CONSTRAINT "ListingRichMedia_pkey" PRIMARY KEY ("listingId", "mediaId")
);
CREATE INDEX "ListingRichMedia_mediaId_idx" ON "ListingRichMedia"("mediaId");
ALTER TABLE "ListingRichMedia" ADD CONSTRAINT "ListingRichMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingRichMedia" ADD CONSTRAINT "ListingRichMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProjectRichMedia" (
  "projectId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  CONSTRAINT "ProjectRichMedia_pkey" PRIMARY KEY ("projectId", "mediaId")
);
CREATE INDEX "ProjectRichMedia_mediaId_idx" ON "ProjectRichMedia"("mediaId");
ALTER TABLE "ProjectRichMedia" ADD CONSTRAINT "ProjectRichMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRichMedia" ADD CONSTRAINT "ProjectRichMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ArticleRichMedia" (
  "articleId" UUID NOT NULL,
  "mediaId" UUID NOT NULL,
  CONSTRAINT "ArticleRichMedia_pkey" PRIMARY KEY ("articleId", "mediaId")
);
CREATE INDEX "ArticleRichMedia_mediaId_idx" ON "ArticleRichMedia"("mediaId");
ALTER TABLE "ArticleRichMedia" ADD CONSTRAINT "ArticleRichMedia_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleRichMedia" ADD CONSTRAINT "ArticleRichMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
