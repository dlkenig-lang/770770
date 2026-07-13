/*
  # תיעוד טבלת mold_checks (בדיקות תבניות) ב-repo

  הטבלה נוצרה במקור דרך Bolt וקיימת ב-DB החי — ההגדרה כאן משחזרת אותה
  כפי שיוצאה מה-DB (information_schema) כדי לסגור את סחיפת הסכמה.
  ב-DB החי ההרצה היא no-op (IF NOT EXISTS); בסביבה חדשה היא יוצרת את
  הטבלה מאפס. הפוליסות מוגדרות ב-20260712040000.

  מהות: בדיקת QC לתבנית יציקה — לפי טיפוס (type_id), מספר תבנית וכיוון.
  9 סעיפי בדיקה (סטטוס+הערות לכל אחד; אורך/רוחב גם עם ערך נמדד),
  סטטוס כולל, וחתימת בודק כמו בשלבי ה-QC של פוד.
*/

CREATE TABLE IF NOT EXISTS mold_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  mold_number INTEGER NOT NULL,
  direction CHAR(1),

  length_status TEXT DEFAULT 'pending',
  length_notes TEXT,
  length_value TEXT,
  width_status TEXT DEFAULT 'pending',
  width_notes TEXT,
  width_value TEXT,
  concrete_height_status TEXT DEFAULT 'pending',
  concrete_height_notes TEXT,
  belt_height_status TEXT DEFAULT 'pending',
  belt_height_notes TEXT,
  door_opening_status TEXT DEFAULT 'pending',
  door_opening_notes TEXT,
  elec_cabinet_status TEXT DEFAULT 'pending',
  elec_cabinet_notes TEXT,
  drainage_channel_status TEXT DEFAULT 'pending',
  drainage_channel_notes TEXT,
  lifting_bolts_status TEXT DEFAULT 'pending',
  lifting_bolts_notes TEXT,
  shower_parallel_status TEXT DEFAULT 'pending',
  shower_parallel_notes TEXT,

  status TEXT DEFAULT 'pending',
  inspector_name TEXT,
  inspector_signature TEXT,
  inspection_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at אוטומטי, כמו בשאר הטבלאות
DROP TRIGGER IF EXISTS update_mold_checks_updated_at ON mold_checks;
CREATE TRIGGER update_mold_checks_updated_at
  BEFORE UPDATE ON mold_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
