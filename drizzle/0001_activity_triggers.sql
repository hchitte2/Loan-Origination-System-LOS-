-- The activity table is append-only (PLAN.md §5 "Audit log"; .claude/rules/db.md invariant 6).
-- Row-level BEFORE UPDATE OR DELETE triggers raise, so no connection string can rewrite
-- history. TRUNCATE does not fire row triggers; the demo reset relies on that, and the
-- README says so.
CREATE OR REPLACE FUNCTION activity_refuse_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity is append-only: % on activity is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_no_update ON "activity";--> statement-breakpoint
CREATE TRIGGER activity_no_update
  BEFORE UPDATE ON "activity"
  FOR EACH ROW EXECUTE FUNCTION activity_refuse_change();--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_no_delete ON "activity";--> statement-breakpoint
CREATE TRIGGER activity_no_delete
  BEFORE DELETE ON "activity"
  FOR EACH ROW EXECUTE FUNCTION activity_refuse_change();
