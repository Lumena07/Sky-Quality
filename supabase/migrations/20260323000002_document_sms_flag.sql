ALTER TABLE public."Document"
  ADD COLUMN IF NOT EXISTS "smsDocument" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public."Document"."smsDocument" IS 'Flag indicating this controlled document is part of SMS register.';
