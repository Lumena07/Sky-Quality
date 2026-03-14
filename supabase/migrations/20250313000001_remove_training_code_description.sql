-- Remove code and description from TrainingRecord; certificate/document link uses documentUrl.
ALTER TABLE "TrainingRecord" DROP COLUMN IF EXISTS "code";
ALTER TABLE "TrainingRecord" DROP COLUMN IF EXISTS "description";
