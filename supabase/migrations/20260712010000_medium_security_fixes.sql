/*
  # Medium Security Fixes

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor, אחרי (או יחד עם)
  20260712000000_critical_security_fixes.sql — הפוליסות כאן משתמשות
  ב-public.current_user_role() שמוגדרת שם.

  ⚠️ סדר פריסה: למזג ולפרוס קודם את שינויי צד-הלקוח (signed URLs) ורק אז
  להריץ את המיגרציה. הקוד החדש עובד גם מול buckets ציבוריים, אבל הקוד
  הישן לא יציג תמונות/תוכניות אחרי שה-buckets יהפכו פרטיים.

  ## מה מתוקן

  1. **Buckets ציבוריים → פרטיים** — 'plans' (תוכניות אדריכליות) ו-'qc-images'
     (תמונות בדיקה) היו נגישים לכל מי שמחזיק URL, ללא התחברות. מעכשיו הם
     פרטיים והצפייה נעשית עם Signed URLs (שעה תוקף) שנוצרים רק למשתמש
     פעיל ומחובר.

  2. **חשיפת אימיילים בהרשמה** — בדיקת "שם משתמש תפוס" בטופס ההרשמה קראה
     ל-get_email_by_username שמחזירה את האימייל המלא לקורא אנונימי. נוספה
     username_exists שמחזירה boolean בלבד, והלקוח עבר אליה.
     הערה: get_email_by_username נשארת עבור התחברות עם שם משתמש — זהו
     trade-off מובנה של הפיצ'ר; מומלץ להפעיל CAPTCHA של Supabase Auth
     אם רוצים להקשיח עוד.

  3. **עריכת הערות של אחרים** — פוליסת ה-UPDATE על comments איפשרה
     ל-inspector/PM לשנות גם את *תוכן* ההערה של כל משתמש. נוסף trigger
     שמתיר לשנות רק את שדות הטיפול (is_resolved/resolved_by/resolved_at);
     שינוי תוכן/דגל/מחבר — אדמין בלבד.
*/

-- =============================================
-- 1. PRIVATE STORAGE BUCKETS + AUTHENTICATED READ
-- =============================================
UPDATE storage.buckets SET public = false WHERE id IN ('plans', 'qc-images');

DROP POLICY IF EXISTS "Plans are publicly readable" ON storage.objects;
CREATE POLICY "Active users can read plans" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'plans'
    AND (SELECT public.current_user_role()) IS NOT NULL
  );

DROP POLICY IF EXISTS "QC images are publicly readable" ON storage.objects;
CREATE POLICY "Active users can read QC images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qc-images'
    AND (SELECT public.current_user_role()) IS NOT NULL
  );

-- =============================================
-- 2. USERNAME AVAILABILITY CHECK WITHOUT LEAKING EMAILS
-- =============================================
CREATE OR REPLACE FUNCTION public.username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.username_exists TO anon, authenticated;

-- =============================================
-- 3. COMMENTS: NON-ADMINS MAY ONLY UPDATE RESOLUTION FIELDS
-- =============================================
CREATE OR REPLACE FUNCTION public.protect_comment_content()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- No JWT context (service role / SQL editor) — trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.content    IS DISTINCT FROM OLD.content
   OR NEW.author_id  IS DISTINCT FROM OLD.author_id
   OR NEW.pod_id     IS DISTINCT FROM OLD.pod_id
   OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged
   OR NEW.created_at IS DISTINCT FROM OLD.created_at)
   AND public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only resolution fields (is_resolved/resolved_by/resolved_at) may be updated';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_comment_content ON comments;
CREATE TRIGGER protect_comment_content
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION public.protect_comment_content();
