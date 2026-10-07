/*
  # פודים שסומנו "הושלם" לפני הוספת שלב G

  ⚠️ להריץ ידנית ב-Supabase SQL Editor (אחרי 20261007000000_qc_stage_g.sql).

  pods.status מחושב בקוד (updatePodStatus ב-qc.js) רק כשמשנים משהו בפוד.
  פודים שכל ששת השלבים A–F שלהם נחתמו נשארו 'completed' — אף שחסר להם
  שלב G. המיגרציה מחזירה אותם ל-'in_progress'.

  נוגעת רק בפרויקטי פודים (לא פאנלים, שם 5 שלבים זה מלא), ורק בפודים
  שאין להם 7 שלבים חתומים. פוד עם שלב שנכשל נשאר כמו שהוא.
*/

-- כמה פודים יושפעו (להריץ קודם לבדיקה)
SELECT COUNT(*) AS pods_to_reopen
  FROM public.pods p
  JOIN public.projects pr ON pr.id = p.project_id
 WHERE p.status = 'completed'
   AND COALESCE(pr.product_type, 'pod') = 'pod'
   AND (SELECT COUNT(*) FROM public.qc_stages s
         WHERE s.pod_id = p.id AND s.status = 'completed') < 7;

UPDATE public.pods p
   SET status = 'in_progress'
  FROM public.projects pr
 WHERE pr.id = p.project_id
   AND p.status = 'completed'
   AND COALESCE(pr.product_type, 'pod') = 'pod'
   AND (SELECT COUNT(*) FROM public.qc_stages s
         WHERE s.pod_id = p.id AND s.status = 'completed') < 7;
