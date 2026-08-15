-- ============================================================
-- Migration: Normalize existing phone numbers in volunteers and registrations tables
-- Date: 2026-08-15
-- Description: Non-destructive normalization of phone numbers.
--   Strips +234 / 234 country code prefix, leading 0, spaces, dashes, parentheses.
--   Produces a canonical digits-only form for consistent duplicate detection.
--   Does NOT delete any records.
-- ============================================================

-- Normalize volunteers phone numbers
UPDATE volunteers
SET phone = regexp_replace(
    regexp_replace(
        regexp_replace(
            regexp_replace(phone, '[^0-9]', '', 'g'),  -- strip non-digits
            '^234', '', ''                               -- strip leading 234 country code
        ),
        '^0', '', ''                                     -- strip leading 0
    ),
    '^$', phone, ''                                      -- safety: if result is empty, keep original
)
WHERE phone IS NOT NULL
  AND phone != '';

-- Normalize registrations phone numbers
UPDATE registrations
SET phone = regexp_replace(
    regexp_replace(
        regexp_replace(
            regexp_replace(phone, '[^0-9]', '', 'g'),  -- strip non-digits
            '^234', '', ''                               -- strip leading 234 country code
        ),
        '^0', '', ''                                     -- strip leading 0
    ),
    '^$', phone, ''                                      -- safety: if result is empty, keep original
)
WHERE phone IS NOT NULL
  AND phone != '';

-- Normalize email addresses (lowercase, trim)
UPDATE volunteers
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email != '';

UPDATE registrations
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email != '';
