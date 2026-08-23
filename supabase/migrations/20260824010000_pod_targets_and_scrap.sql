/*
  # יעד ייצור לפרויקט + סימון פוד פסול

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor. בלעדיה: טבלת היעד לא תוצג
  (העמודה חסרה), ושמירת יעדים / סימון פסילה ייכשלו עם הודעה — שאר
  המערכת ממשיכה לעבוד.

  שני חלקים:

  1. `type_directions.target_quantity` — כמות היעד הסופית של הפרויקט,
     לפי טיפוס+כיוון (לפאנלים: שורת הכיוון היחידה של כל דגם). נערך בטאב
     "פרטים נוספים". מזה נגזרת בטאב הפודים טבלת "יעד ייצור": כמה הוזנו,
     כמה נפסלו, וכמה נשארו לבצע.

  2. `pods.is_scrapped` — פוד שנפסל במהלך הייצור. הפוד **לא נמחק**:
     היסטוריית ה-QC שלו נשמרת והסיריאל שלו לא ממוחזר (globalSerial
     ממשיך כרגיל). הוא רק מסומן, מוחרג מספירת "הוזנו" בטבלת היעד,
     ונספר בנפרד בעמודת "נפסלו" — פוד חלופי שייווצר יקבל סיריאל חדש.

  כל שינוי בדגל מתועד ב-qc_audit_log ע"י trigger ברמת ה-DB
  (pod_scrapped / pod_unscrapped), באותה קונבנציה של log_pod_casting_change —
  אי אפשר לפסול פוד בלי להשאיר עקבות.
*/

ALTER TABLE type_directions ADD COLUMN IF NOT EXISTS target_quantity INTEGER;

ALTER TABLE pods ADD COLUMN IF NOT EXISTS is_scrapped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pods ADD COLUMN IF NOT EXISTS scrapped_reason TEXT;
ALTER TABLE pods ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMPTZ;

-- =============================================
-- Audit: כל שינוי של is_scrapped נרשם עם המשתמש והסיבה
-- =============================================
CREATE OR REPLACE FUNCTION public.log_pod_scrap_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_scrapped IS DISTINCT FROM OLD.is_scrapped THEN
    INSERT INTO public.qc_audit_log
      (table_name, record_id, pod_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (
      'pods', NEW.id, NEW.id,
      CASE WHEN NEW.is_scrapped THEN 'pod_scrapped' ELSE 'pod_unscrapped' END,
      auth.uid(),
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      jsonb_build_object('is_scrapped', OLD.is_scrapped, 'scrapped_reason', OLD.scrapped_reason),
      jsonb_build_object('is_scrapped', NEW.is_scrapped, 'scrapped_reason', NEW.scrapped_reason, 'pod_code', NEW.pod_code)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_pod_scrap_change ON pods;
CREATE TRIGGER log_pod_scrap_change
  AFTER UPDATE ON pods
  FOR EACH ROW EXECUTE FUNCTION public.log_pod_scrap_change();
