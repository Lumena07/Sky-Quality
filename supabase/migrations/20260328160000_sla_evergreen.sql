-- SLA evergreen: optional expiry when agreement has no end date
ALTER TABLE "ServiceLevelAgreement"
  ADD COLUMN IF NOT EXISTS "isEvergreen" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ServiceLevelAgreement"
  ALTER COLUMN "expiryDate" DROP NOT NULL;

ALTER TABLE "ServiceLevelAgreement"
  DROP CONSTRAINT IF EXISTS "ServiceLevelAgreement_evergreen_expiry_check";

ALTER TABLE "ServiceLevelAgreement"
  ADD CONSTRAINT "ServiceLevelAgreement_evergreen_expiry_check"
  CHECK (
    ("isEvergreen" = true AND "expiryDate" IS NULL)
    OR ("isEvergreen" = false AND "expiryDate" IS NOT NULL)
  );
