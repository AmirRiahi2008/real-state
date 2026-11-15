CREATE TABLE "SiteContent" (
    "key" VARCHAR(40) NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);
