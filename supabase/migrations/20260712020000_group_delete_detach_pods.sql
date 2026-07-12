/*
  # מחיקת קבוצת ביצוע — ניתוק פודים במקום כשל FK

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor.

  ה-FK של pods.group_id נוצר בלי ON DELETE, כך שמחיקת קבוצה שיש בה פודים
  נכשלה תמיד (הקוד גם לא בדק את השגיאה והציג "נמחקה בהצלחה" — תוקן בצד
  הלקוח). מעכשיו מחיקת קבוצה מנתקת את הפודים שלה (group_id=NULL) —
  הפודים ונתוני ה-QC שלהם נשמרים.
*/

ALTER TABLE pods DROP CONSTRAINT IF EXISTS pods_group_id_fkey;
ALTER TABLE pods ADD CONSTRAINT pods_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES production_groups(id) ON DELETE SET NULL;
