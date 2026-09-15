-- =============================================================================
-- Remove machine-generated property views, keep the legitimate ones.
--
-- Plain SQL — no psql meta-commands, so it runs anywhere: psql, TablePlus,
-- pgAdmin, DBeaver, or a Coolify database console.
--
-- WHY
--   The Georgia storefront's list page hydrated every project through
--   GET /api/buildings/slug/:slug, and that endpoint incremented `views` on
--   every read. One render of propgrp.com/properties bumped ALL 18 Georgian
--   projects by exactly 1. With ISR and crawlers on top, each reached ~37,000.
--
-- HOW THE SPLIT WORKS
--   Machine increments were uniform; human views are not. Lebanon was never
--   hydrated, and shows what organic traffic looks like:
--
--     Lebanon:  65 buildings,     4 - 128 views,  ~97% spread   <- organic
--     Georgia:  18 buildings, 37018 - 37363,       ~1% spread   <- plateau
--
--   So the minimum count in the affected market IS the machine component, and
--   what sits above it is differential human interest. Real detail-page views
--   went through the same increment path, so they sit inside that differential
--   and are preserved.
--
--       corrected = views - MIN(views among the INFLATED rows)
--
--   "Inflated" matters. Hydration only ever touched PUBLIC projects, because
--   that is all the storefront lists. A non-public Georgian building sat at 21
--   views, so a naive MIN() over the whole market returned 21 and the
--   correction subtracted almost nothing. The cohort is selected by
--   `views >= 1000`: the gap between untouched (21) and inflated (37,011) is
--   three orders of magnitude, so the split is unambiguous.
--
-- WHAT IS LOST
--   The least-viewed project ends at 0 — its differential is zero by
--   definition. Every project loses that same hidden baseline, so relative
--   ranking stays correct while absolute numbers are slightly understated.
--
-- BEFORE RUNNING
--   Deploy the `shouldCountView` fix first, or the counts re-inflate at once.
--
-- HOW TO RUN
--   1. Run the whole file as-is. It ends in ROLLBACK, so nothing is written.
--   2. Read the NOTICE output and the two result sets.
--   3. If it looks right, change the final ROLLBACK to COMMIT and run again.
-- =============================================================================

BEGIN;

-- ── Correct, with guards ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_country      text    := 'GEORGIA';  -- the affected market, and ONLY this one
  v_inflated_min integer := 1000;      -- above this = hydrated; below = genuine
  v_count      integer;
  v_floor      integer;
  v_peak       integer;
  v_spread_pct numeric;
  v_rows       integer;
BEGIN
  -- Only the inflated cohort. A project that was never hydrated (non-public,
  -- or added after the fix) must not set the floor, and must not be adjusted.
  SELECT COUNT(*), MIN(views), MAX(views)
    INTO v_count, v_floor, v_peak
    FROM buildings
   WHERE country = v_country::"Country"
     AND views >= v_inflated_min;

  IF v_count = 0 THEN
    RAISE EXCEPTION
      'No inflated buildings (views >= %) found for country=%. Nothing to do.',
      v_inflated_min, v_country;
  END IF;

  RAISE NOTICE 'Before: % projects, floor=%, peak=%, total=%',
    v_count, v_floor, v_peak,
    (SELECT SUM(views) FROM buildings WHERE country = v_country::"Country");

  -- Guard 1: already corrected. Fail loudly rather than silently no-op.
  IF v_floor = 0 THEN
    RAISE EXCEPTION
      'Floor is already 0 for % — these views look corrected already.', v_country;
  END IF;

  -- Guard 2: refuse anything that does not look machine-inflated. A uniform
  -- floor is the signature of automated increments; a wide spread means the
  -- views are organic and must not be touched. Lebanon reads ~97% here.
  v_spread_pct := 100.0 * (v_peak - v_floor) / NULLIF(v_peak, 0);
  IF v_spread_pct > 10 THEN
    RAISE EXCEPTION
      'Spread for % is % percent of peak — that looks organic, not machine-generated. Refusing.',
      v_country, ROUND(v_spread_pct, 1);
  END IF;

  RAISE NOTICE 'Subtracting a machine floor of % from each of % projects.',
    v_floor, v_count;

  UPDATE buildings
     SET views = GREATEST(0, views - v_floor)
   WHERE country = v_country::"Country"
     AND views >= v_inflated_min;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE 'Updated % row(s); removed % views. Kept % legitimate views.',
    v_rows,
    v_floor * v_rows,
    (SELECT SUM(views) FROM buildings WHERE country = v_country::"Country");
END $$;

-- ── Result: Georgia, per project ─────────────────────────────────────────────
SELECT ref,
       views,
       LEFT(title, 44) AS title
FROM buildings
WHERE country = 'GEORGIA'
ORDER BY views DESC;

-- ── Result: every market, so you can confirm Lebanon is untouched ────────────
SELECT country,
       COUNT(*)                AS projects,
       MIN(views)              AS floor,
       MAX(views)              AS peak,
       MAX(views) - MIN(views) AS spread,
       SUM(views)              AS total
FROM buildings
GROUP BY country
ORDER BY country;

-- Nothing is written until you change this to COMMIT.
ROLLBACK;
