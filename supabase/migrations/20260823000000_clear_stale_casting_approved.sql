/*
  # ניקוי דגל "מאושר ליציקה" מפודים ששלב A שלהם כבר נחתם

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor. **המיגרציה אינה חובה** —
  התצוגה כבר לא מציגה את התג לפודים שעברו את שער היציקה (`podAwaitingCasting`
  ב-`qc-data.js`). היא מיישרת את ה-DB עצמו כדי שהעמודה תשקף את המציאות.

  הרקע: `pods.casting_approved` מסמן "מאושר וממתין ליציקה". הוא התאפס רק
  כשסעיפי הפוסט-יציקה של שלב A (סגרגציה / בדיקת דלוחין) נענו. בודק שענה
  עליהם *לפני* שסעיפים 1–7 הפעילו את האישור לא חזר אליהם, ואחרי חתימת שלב A
  הסעיפים מוקפאים ע"י `protect_signed_stage_items` — ולכן שום מסלול לא יכול
  היה לאפס את הדגל, והפוד נשאר "מאושר ליציקה" לנצח.

  מכאן ואילך חתימה על שלב A מאפסת את הדגל (`qc.js`, מסלול החתימה). כאן
  מטופלים הפודים שכבר נחתמו לפני התיקון.

  מה לא נכלל בכוונה: פודים ששלב A שלהם עדיין פתוח אך שלבים מאוחרים
  התקדמו. שם הדגל עדיין דרוש — הוא מה שמשחרר את הנעילה של שלבים B–F כל עוד
  שלב A לא נחתם (`_castingBaseApproved` ב-`qc.js`), ואיפוסו היה נועל מחדש
  פוד שכבר עובדים עליו. התג ממילא אינו מוצג להם.

  ה-trigger `log_pod_casting_change` יתעד כל שורה כ-`casting_removed`
  בהיסטוריית הפוד. ההרצה מה-SQL Editor אינה מזוהה כמשתמש, ולכן
  `changed_by` יישאר NULL ברשומות האלה (העמודה nullable).
*/

UPDATE pods p
SET casting_approved = false,
    casting_approved_at = NULL
WHERE p.casting_approved = true
  AND EXISTS (
    SELECT 1 FROM qc_stages s
    WHERE s.pod_id = p.id
      AND s.stage_number = 1
      AND s.status IN ('completed', 'failed')
  );
