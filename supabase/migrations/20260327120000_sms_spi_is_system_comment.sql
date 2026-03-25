-- Clarify: seeded defaults are not deletion-protected; Director of Safety may remove them in-app.

COMMENT ON COLUMN public.sms_spis.is_system_spi IS
  'True for rows inserted by default seed migration; marks built-in auto/metric SPIs. Director of Safety may edit metadata and SPTs and may delete these rows like any other SPI.';
