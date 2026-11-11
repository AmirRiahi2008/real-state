-- Keep the core scalar invariants intact for every writer, including CLI tools.
-- These checks intentionally avoid relationships and current-time comparisons.
BEGIN;

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_price_or_on_request_check" CHECK (
    ("priceOnRequest" AND "priceAed" IS NULL)
    OR (NOT "priceOnRequest" AND "priceAed" IS NOT NULL AND "priceAed" > 0 AND "priceAed" <> 'NaN'::numeric)
  ),
  ADD CONSTRAINT "Listing_previous_price_check" CHECK (
    "previousPriceAed" IS NULL
    OR ("priceAed" IS NOT NULL AND "previousPriceAed" > "priceAed" AND "previousPriceAed" <> 'NaN'::numeric)
  ),
  ADD CONSTRAINT "Listing_positive_areas_check" CHECK (
    "areaSqm" > 0 AND "areaSqm" <> 'NaN'::numeric
    AND ("plotAreaSqm" IS NULL OR ("plotAreaSqm" > 0 AND "plotAreaSqm" <> 'NaN'::numeric))
  ),
  ADD CONSTRAINT "Listing_room_counts_check" CHECK (
    "bedrooms" BETWEEN 0 AND 50 AND "bathrooms" BETWEEN 0 AND 50 AND "parking" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "Listing_coordinate_pair_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "Listing_rental_period_check" CHECK (
    ("purpose" = 'SALE' AND "rentalPeriod" IS NULL)
    OR ("purpose" = 'RENT' AND "rentalPeriod" IS NOT NULL)
  ),
  ADD CONSTRAINT "Listing_studio_bedrooms_check" CHECK ("propertyType" <> 'STUDIO' OR "bedrooms" = 0),
  ADD CONSTRAINT "Listing_positive_version_check" CHECK ("version" > 0);

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_price_or_on_request_check" CHECK (
    ("priceOnRequest" AND "startingPriceAed" IS NULL)
    OR (NOT "priceOnRequest" AND "startingPriceAed" IS NOT NULL AND "startingPriceAed" > 0 AND "startingPriceAed" <> 'NaN'::numeric)
  ),
  ADD CONSTRAINT "Project_bedroom_range_check" CHECK (
    "minBedrooms" BETWEEN 0 AND 50 AND "maxBedrooms" BETWEEN 0 AND 50 AND "minBedrooms" <= "maxBedrooms"
  ),
  ADD CONSTRAINT "Project_coordinate_pair_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "Project_positive_version_check" CHECK ("version" > 0);

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_positive_dimensions_check" CHECK ("size" > 0 AND "width" > 0 AND "height" > 0);

ALTER TABLE "Article"
  ADD CONSTRAINT "Article_positive_version_check" CHECK ("version" > 0);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_consent_required_check" CHECK ("consent" IS TRUE);

COMMIT;
