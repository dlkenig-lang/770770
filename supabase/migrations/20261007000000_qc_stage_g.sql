/*
  # שלב G — הכנות סופיות וסגירה לפני עיטוף

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor **לפני** פריסת הקוד.
  בלי המיגרציה, פתיחת פוד אחרי הפריסה תנסה ליצור שורת qc_stages עם
  stage_number = 7 ותיכשל על ה-CHECK (BETWEEN 1 AND 6) — הטאב של שלב G
  לא ייווצר והשלבים A–F ימשיכו לעבוד.

  מה המיגרציה עושה: מרחיבה את טווח stage_number ל-1..7. שום שורה קיימת
  לא משתנה. שורת שלב G נוצרת לכל פוד בעצלתיים (ensureQCStages ב-qc.js)
  בפעם הראשונה שפותחים אותו.

  שם האילוץ לא מובטח (נוצר אוטומטית מ-schema.sql), לכן הוא מאותר לפי
  ההגדרה ולא לפי שם.
*/

DO $$
DECLARE
  v_con TEXT;
BEGIN
  FOR v_con IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.qc_stages'::regclass
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%stage_number%'
  LOOP
    EXECUTE format('ALTER TABLE public.qc_stages DROP CONSTRAINT %I', v_con);
  END LOOP;
END $$;

ALTER TABLE public.qc_stages
  ADD CONSTRAINT qc_stages_stage_number_check CHECK (stage_number BETWEEN 1 AND 7);

-- בדיקה: אמורה להחזיר שורה אחת עם BETWEEN 1 AND 7
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'public.qc_stages'::regclass AND contype = 'c'
   AND pg_get_constraintdef(oid) ILIKE '%stage_number%';
