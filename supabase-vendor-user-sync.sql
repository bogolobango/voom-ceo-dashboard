-- ============================================================
-- VOOM: Vendor ↔ User auto-sync trigger
-- Run this once in the Supabase SQL Editor (project: hdinubnlkfqlxtrdgsne)
-- ============================================================
-- What it does:
--   Whenever a vendor row gets a userId assigned (INSERT or UPDATE),
--   the linked user is automatically promoted to role='vendor',
--   isVerified=true, and their phone is back-filled if missing.
--   The vendor's claimStatus is flipped from 'unclaimed' to 'claimed'.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_vendor_user_on_link()
RETURNS TRIGGER AS $$
BEGIN
  -- Act only when userId is being set (or changed) to a non-null value
  IF NEW."userId" IS NOT NULL
     AND (OLD."userId" IS DISTINCT FROM NEW."userId") THEN

    -- Promote the linked user to vendor role and mark as verified
    UPDATE users
    SET
      role        = 'vendor',
      "isVerified" = true,
      phone        = COALESCE(phone, NEW.phone),
      "updatedAt"  = NOW()
    WHERE id = NEW."userId";

    -- Flip claimStatus to 'claimed' if it was still 'unclaimed'
    IF NEW."claimStatus" IS NULL OR NEW."claimStatus" = 'unclaimed' THEN
      NEW."claimStatus" := 'claimed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS trg_vendor_user_link ON vendors;

CREATE TRIGGER trg_vendor_user_link
BEFORE INSERT OR UPDATE OF "userId"
ON vendors
FOR EACH ROW
EXECUTE FUNCTION sync_vendor_user_on_link();

-- ── Verify it's installed ─────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_vendor_user_link';
