ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS duplicate_acknowledged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_flag_reason TEXT;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS duplicate_acknowledged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_flag_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_registrations_phone
  ON registrations(phone);
CREATE INDEX IF NOT EXISTS idx_volunteers_phone
  ON volunteers(phone);
