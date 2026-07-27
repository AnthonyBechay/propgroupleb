-- Lebanon separated Keserwan and Jbeil from Mount Lebanon into their own
-- governorate (Keserwan-Jbeil) in 2017. Re-tag existing rows so filtering by
-- region keeps working. Data-only: no schema change (mohafazat is a String).

UPDATE "buildings"
   SET "mohafazat" = 'KESERWAN_JBEIL'
 WHERE "mohafazat" = 'MOUNT_LEBANON'
   AND "caza" IN ('Keserwan', 'Jbeil');

UPDATE "property_submissions"
   SET "mohafazat" = 'KESERWAN_JBEIL'
 WHERE "mohafazat" = 'MOUNT_LEBANON'
   AND "caza" IN ('Keserwan', 'Jbeil');

-- CRM leads store regions as an array; swap the value in place where the lead
-- only ever meant Keserwan/Jbeil areas is ambiguous, so leave leads alone and
-- let the team re-pick. (Regions there are a search preference, not a fact.)
