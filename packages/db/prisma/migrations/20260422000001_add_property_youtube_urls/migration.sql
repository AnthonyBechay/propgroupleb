-- Migration: Add youtubeUrls column to properties
--
-- Replaces the single-upload `videoUrl` field with a flexible list of
-- YouTube URLs. `videoUrl` is retained (not dropped) so legacy data is
-- preserved and old admin payloads don't break validation.

ALTER TABLE "properties"
    ADD COLUMN IF NOT EXISTS "youtubeUrls" TEXT[] NOT NULL DEFAULT '{}';
