-- Migration: Add pipeline_stage to vendors table
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
--
-- This adds a dedicated CRM pipeline stage field so the dashboard can track
-- vendor progression independently from their approval status.
--
-- Current derivation logic (status → pipeline) conflates admin approval
-- with sales funnel position. A vendor can be "approved" but still in
-- "contacted" stage from a sales perspective.

-- Step 1: Create the enum type
DO $$ BEGIN
  CREATE TYPE vendor_pipeline_stage AS ENUM (
    'lead',        -- scraped/imported, not yet contacted
    'contacted',   -- WhatsApp message sent
    'responded',   -- vendor replied to outreach
    'claimed',     -- vendor created account / claimed listing
    'onboarding',  -- approved, setting up shop
    'active',      -- has products listed, actively selling
    'paid',        -- on a paid subscription tier
    'churned'      -- went inactive or cancelled
  );
EXCEPTION
  WHEN duplicate_object THEN NULL; -- idempotent: skip if already exists
END $$;

-- Step 2: Add the column with a sensible default
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS pipeline_stage vendor_pipeline_stage DEFAULT 'lead';

-- Step 3: Backfill existing vendors based on current state
-- (Run once after adding the column)
UPDATE vendors SET pipeline_stage = 'churned'
  WHERE status IN ('rejected', 'suspended') AND pipeline_stage = 'lead';

UPDATE vendors SET pipeline_stage = 'paid'
  WHERE status = 'approved' AND tier != 'free' AND pipeline_stage = 'lead';

UPDATE vendors SET pipeline_stage = 'active'
  WHERE status = 'approved' AND tier = 'free' AND "totalListings" > 0 AND pipeline_stage = 'lead';

UPDATE vendors SET pipeline_stage = 'onboarding'
  WHERE status = 'approved' AND "totalListings" = 0 AND pipeline_stage = 'lead';

UPDATE vendors SET pipeline_stage = 'claimed'
  WHERE "userId" IS NOT NULL AND "userId" != 0 AND status = 'pending' AND pipeline_stage = 'lead';

-- Step 4: Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_vendors_pipeline_stage ON vendors (pipeline_stage);
