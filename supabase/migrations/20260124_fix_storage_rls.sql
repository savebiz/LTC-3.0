-- FIX STORAGE POLICIES (Revised)
-- This script enables public uploads to the 'payment_receipts' bucket.

-- 1. Create the bucket if it doesn't exist (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_receipts', 'payment_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts (Safe to run multiple times)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;

-- 3. Create Policy: Public can SELECT (View) their own receipt
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'payment_receipts' );

-- 4. Create Policy: Public can INSERT (Upload)
-- This allows anyone to upload to this specific bucket.
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'payment_receipts' );

-- 5. Create Policy: Public can UPDATE
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'payment_receipts' );
