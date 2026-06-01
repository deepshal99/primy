-- Drop the project_diagrams table.
--
-- The diagrams entity was cut as part of the Primy v1.0 cleanup. Run the
-- one-off `npx tsx scripts/archive-diagrams.ts` script first to dump the
-- contents to .archive/ before applying this migration.
--
-- The cascade rule on the `project_id` foreign key would have wiped these
-- rows when the parent project was deleted, but here we drop the table
-- itself. The DROP is idempotent so the migration is safe to re-run.

DROP TABLE IF EXISTS "project_diagrams";
