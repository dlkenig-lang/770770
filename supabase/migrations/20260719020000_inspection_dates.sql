/*
  # תיעוד תאריכים: תחילת בדיקה לפוד + תאריך תיקון סעיף שנכשל

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260719010000).

  1. pods.inspection_started_at — נקבע אוטומטית (trigger) ברגע הסימון
     הראשון של סעיף כלשהו (passed/failed) בפוד, פעם אחת בלבד.
     Backfill לפודים קיימים לפי created_at המוקדם ביותר של סעיפיהם.

  2. qc_items.fixed_at — נקבע אוטומטית כשסעיף עובר מ-'failed' ל-'passed'
     (תיקון). מתאפס אם הסעיף חוזר ל-'failed' או ל-'pending' (ניקוי טופס).

  התאריכים נכתבים ב-trigger ברמת ה-DB — אמינים גם מטאבים ישנים ולא
  תלויים בקוד הלקוח.
*/

ALTER TABLE pods ADD COLUMN IF NOT EXISTS inspection_started_at TIMESTAMPTZ;
ALTER TABLE qc_items ADD COLUMN IF NOT EXISTS fixed_at TIMESTAMPTZ;

-- =============================================
-- 1. fixed_at — BEFORE trigger על qc_items
-- =============================================
CREATE OR REPLACE FUNCTION public.track_qc_item_fix_date()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'failed' AND NEW.status = 'passed' THEN
      NEW.fixed_at := now();                    -- הסעיף תוקן
    ELSIF NEW.status IN ('failed', 'pending') THEN
      NEW.fixed_at := NULL;                     -- נכשל שוב / ניקוי טופס
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_qc_item_fix_date ON qc_items;
CREATE TRIGGER track_qc_item_fix_date
  BEFORE UPDATE ON qc_items
  FOR EACH ROW EXECUTE FUNCTION public.track_qc_item_fix_date();

-- =============================================
-- 2. inspection_started_at — AFTER trigger על qc_items
-- =============================================
CREATE OR REPLACE FUNCTION public.track_pod_inspection_start()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('passed', 'failed') THEN
    UPDATE public.pods p
    SET inspection_started_at = now()
    FROM public.qc_stages s
    WHERE s.id = NEW.stage_id
      AND p.id = s.pod_id
      AND p.inspection_started_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_pod_inspection_start ON qc_items;
CREATE TRIGGER track_pod_inspection_start
  AFTER INSERT OR UPDATE ON qc_items
  FOR EACH ROW EXECUTE FUNCTION public.track_pod_inspection_start();

-- =============================================
-- 3. Backfill לפודים קיימים — לפי הסעיף המוקדם ביותר שנוצר
--    (שורת qc_items נוצרת בסימון/הזנה הראשונים של הסעיף)
-- =============================================
UPDATE pods p
SET inspection_started_at = sub.first_item
FROM (
  SELECT s.pod_id, MIN(i.created_at) AS first_item
  FROM qc_items i
  JOIN qc_stages s ON s.id = i.stage_id
  GROUP BY s.pod_id
) sub
WHERE sub.pod_id = p.id
  AND p.inspection_started_at IS NULL;
