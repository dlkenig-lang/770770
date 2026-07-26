/*
  # צפייה בהיסטוריית השינויים לכל המשתמשים

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260713000000 —
  מחליף את הפוליסה שנוצרה שם).

  עד כה הצפייה ב-qc_audit_log הייתה לאדמין בלבד. מעתה כל משתמש **פעיל**
  יכול לראות את היסטוריית השינויים (כפתור 📜 במסך פוד ובכרטיס בדיקת
  תבנית) — כולל viewer. השקיפות הזו היא כל מטרת ה-audit trail: מי חתם,
  מי פתח מחדש, מי ניקה טופס ומי שינה סימון.

  הפוליסה משתמשת ב-current_user_role() IS NOT NULL — הפונקציה מחזירה
  את התפקיד רק כש-is_active=true, ולכן משתמש שממתין לאישור אדמין או
  שנוטרל לא רואה כלום, בהתאמה לשאר מודל האבטחה.

  הכתיבה נשארת חסומה לחלוטין: אין פוליסות INSERT/UPDATE/DELETE, והרישום
  נעשה רק ע"י ה-triggers (SECURITY DEFINER). כלומר משתמש יכול לקרוא את
  ההיסטוריה אך לא לשנות או למחוק רשומה — גם לא רשומה שלו.
*/

DROP POLICY IF EXISTS "Admins can view audit log" ON qc_audit_log;
DROP POLICY IF EXISTS "Active users can view audit log" ON qc_audit_log;
CREATE POLICY "Active users can view audit log" ON qc_audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);
-- אין פוליסות INSERT/UPDATE/DELETE בכוונה — הרשומות חסינות לשינוי מהלקוח.
