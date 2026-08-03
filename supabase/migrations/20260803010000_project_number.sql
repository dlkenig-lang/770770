-- =============================================
-- Sequential project number, used by the new unit-code format
-- =============================================
-- ⚠️ חובה להריץ ידנית ב-Supabase SQL Editor לפני יצירת פרויקט חדש כלשהו
-- (פודים ופאנלים כאחד). `createProject` בודק מראש שהעמודה קיימת ונעצר עם
-- הודעה ברורה אם לא — כדי לא לייצר קודים בפורמט הישן בשקט.
--
-- פורמט קוד היחידה:
--   פרויקטים קיימים (project_number IS NULL) — ABC-DDMMYY-T1-R-001 (ללא שינוי)
--   פרויקטים חדשים (project_number מוגדר)    — ABC-PPMMYY-T1-R-001
-- כאשר PP = מספר הפרויקט הרץ ו-MMYY = חודש ושנה של קבלת הפרויקט.
--
-- העמודה נשארת NULL עבור כל הפרויקטים הקיימים, ולכן הקודים שלהם ממשיכים
-- להיגזר מהתאריך המלא בדיוק כמו קודם. אין למלא אותה רטרואקטיבית: קודי
-- הפודים כבר כתובים ב-pods.pod_code ולא נגזרים מחדש.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_number INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_project_number_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_project_number_check
      CHECK (project_number IS NULL OR project_number > 0);
  END IF;
END $$;
