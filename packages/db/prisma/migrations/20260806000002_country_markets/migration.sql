-- The Country enum only had LEBANON, so this database could not physically
-- store a Georgian property. Bringing it in step with the Georgia system.

ALTER TYPE "Country" ADD VALUE IF NOT EXISTS 'GEORGIA';
ALTER TYPE "Country" ADD VALUE IF NOT EXISTS 'CYPRUS';
ALTER TYPE "Country" ADD VALUE IF NOT EXISTS 'GREECE';
