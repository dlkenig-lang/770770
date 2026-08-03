-- =============================================
-- Product type per project: sanitary pod (default) vs. medical bed-head panel
-- =============================================
-- ⚠️ חובה להריץ ידנית ב-Supabase SQL Editor לפני פריסת גרסת הלקוח התומכת
-- בפאנלים. כל הפרויקטים הקיימים מקבלים 'pod' אוטומטית ושום התנהגות שלהם
-- לא משתנה. יצירת פרויקט פאנלים בלקוח שולחת product_type='medical_panel'
-- ותיכשל (בכוונה, עם הודעת שגיאה) אם המיגרציה לא הורצה.
--
-- הלקוח שולח product_type רק כשהוא שונה מ-'pod', ולכן יצירת פרויקטי פודים
-- ממשיכה לעבוד גם לפני הרצת המיגרציה.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'pod';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_product_type_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_product_type_check
      CHECK (product_type IN ('pod', 'medical_panel'));
  END IF;
END $$;
