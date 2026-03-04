-- Fix: PostgREST "Could not find a relationship between 'Finding' and 'CorrectiveAction'"
-- PostgREST needs the FK from CorrectiveAction.findingId -> Finding.id so it can embed CorrectiveAction in Finding.
-- Run this in Supabase SQL editor. After running, reload schema: Supabase Dashboard -> Settings -> API -> "Reload schema cache" (or restart).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CorrectiveAction_findingId_fkey'
  ) THEN
    ALTER TABLE "CorrectiveAction"
      ADD CONSTRAINT "CorrectiveAction_findingId_fkey"
      FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE;
  END IF;
END $$;
