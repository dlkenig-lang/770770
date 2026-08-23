/*
  # יעדי משלוח לפודים — בניין / קומה / חדר

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor. **חובה** לפני שימוש בטאב
  "יעדי משלוח" ובתעודת המשלוח.

  הרקע: בפרויקט מעונות כל פוד מיועד לחדר ספציפי באתר — בניין (A–E),
  קומה (0 = קרקע, 1–5) וקוד חדר שמסופק ע"י המזמין. הכתובת נדרשת על
  תעודת המשלוח של כל פוד.

  המודל: טבלת יעדים לפרויקט + מצביע מהפוד ליעד — ולא שלושה שדות טקסט
  על הפוד. כך רשימת החדרים של המזמין מיובאת פעם אחת, אפשר לראות אילו
  חדרים עדיין בלי פוד, ו-UNIQUE מונע שליחת שני פודים לאותו חדר.

  `floor` הוא INTEGER ו-0 הוא קומת הקרקע — כדי שמיון הקומות יהיה נכון
  (טקסט היה ממיין '10' לפני '2'). התצוגה נגזרת ב-`destFloorLabel`.

  `type_number` / `direction` הם ה*ציפייה* של המזמין לחדר, ומשמשים את
  השיוך האוטומטי בלבד. הם אינם אילוץ: אפשר לשייך ידנית כל פוד לכל חדר.
*/

CREATE TABLE IF NOT EXISTS pod_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 0,
  room_code TEXT NOT NULL,
  type_number INTEGER,
  direction TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod_destinations_unique_room UNIQUE (project_id, building, floor, room_code)
);

CREATE INDEX IF NOT EXISTS idx_pod_destinations_project ON pod_destinations(project_id);

-- מצביע מהפוד ליעד. מחיקת יעד מנתקת את הפוד ולא מוחקת אותו, באותה
-- קונבנציה של pods.group_id (מיגרציה 20260712020000).
ALTER TABLE pods ADD COLUMN IF NOT EXISTS destination_id UUID;
ALTER TABLE pods DROP CONSTRAINT IF EXISTS pods_destination_id_fkey;
ALTER TABLE pods ADD CONSTRAINT pods_destination_id_fkey
  FOREIGN KEY (destination_id) REFERENCES pod_destinations(id) ON DELETE SET NULL;

-- חדר אחד = פוד אחד. אינדקס חלקי, כך שאין הגבלה על פודים ללא יעד.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pods_destination
  ON pods(destination_id) WHERE destination_id IS NOT NULL;

-- =============================================
-- RLS — צפייה לכל משתמש פעיל, ניהול לאדמין ומנהל פרויקט
-- (אותה חלוקה כמו production_groups; זו נתוני תכנון, לא בדיקות QC)
-- =============================================
ALTER TABLE pod_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Destinations viewable" ON pod_destinations;
CREATE POLICY "Destinations viewable" ON pod_destinations
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins and PMs can manage destinations" ON pod_destinations;
CREATE POLICY "Admins and PMs can manage destinations" ON pod_destinations
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));
