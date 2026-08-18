-- A role that runs the CRM without seeing what the office earns.
--
-- Commission is stripped server-side for this role rather than merely hidden in
-- the UI: a hidden field is still in the API response, and anyone can open the
-- network tab.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CRM_MANAGER' BEFORE 'ADMIN';
