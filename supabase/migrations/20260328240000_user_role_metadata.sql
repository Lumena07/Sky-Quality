-- Sub-attributes for operational roles (pilot seat + aircraft types, dispatcher aircraft types).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "roleMetadata" JSONB DEFAULT NULL;

COMMENT ON COLUMN "User"."roleMetadata" IS 'Per-role JSON: PILOT { aircraftTypeCodes, pilotSeat }, FLIGHT_DISPATCHERS { aircraftTypeCodes }; keys pruned when roles removed.';
