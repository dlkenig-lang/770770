// =============================================
// QC Stage Definitions (6 Control Groups)
// =============================================

const QC_STAGES = [
  {
    number: 1,
    name: 'יציקת רצפת בטון',
    nameEn: 'Concrete Floor Casting',
    items: [
      { key: 'length_dims', label: 'מידות אורך', instruction: 'סטיה תקינה של +- 2 ס"מ' },
      { key: 'width_dims', label: 'מידות רוחב', instruction: 'סטיה תקינה של +- 2 ס"מ' },
      { key: 'pipe_slope', label: 'שיפוע צינור 1.5%', instruction: null },
      { key: 'pipe_fixation', label: 'קיבוע צינור', instruction: null },
      { key: 'drainage_channel', label: 'תעלת ניקוז', instruction: 'לוודא התקנה שטוחה בתבנית' },
      { key: 'lifting_bolts', label: 'עיגון ברגי הרמה', instruction: null },
      { key: 'casting_approval', label: 'אישור יציקה', instruction: null },
      { key: 'drainage_test', label: 'בדיקת דלוחין עם בלון', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות', hasTwoTimes: true },
      { key: 'shower_parallel', label: 'מקבילות מקלחון', instruction: null },
      { key: 'segregation', label: 'סגרגציה', instruction: 'בדוק הפרדה תקינה' },
    ]
  },
  {
    number: 2,
    name: 'קונסטרוקציית קירות ותקרה וסגירה בגבס',
    nameEn: 'Walls, Ceiling & Drywall',
    items: [
      { key: 'diagonals', label: 'אלכסוני קונסטרוקציה', instruction: 'בדוק שוויון אלכסונים' },
      { key: 'lwh_dims', label: 'מידות אורך, רוחב וגובה', instruction: null },
      { key: 'door_opening', label: 'מידת פתח הדלת', instruction: null },
      { key: 'dowel_anchor', label: 'עיגון דיבלים סמוך לניצב', instruction: 'ודא עיגון תקין סמוך לניצב' },
    ]
  },
  {
    number: 3,
    name: 'הכנת מערכות אינסטלציה וחשמל',
    nameEn: 'Plumbing & Electrical Systems',
    items: [
      { key: 'water_pressure', label: 'בדיקת לחץ מים', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות. יש לסגור את כל החורים לפני הבדיקה', hasTwoTimes: true },
      { key: 'pressure_bar', label: 'לחץ בר (4 בר תקין)', instruction: 'ערך תקין: 4 בר ומעלה. מצב לא תקין: פחות מ-4 בר – יש לבצע ניתוקים', hasValue: true, unit: 'בר', minValue: 4 },
      { key: 'toilet_check', label: 'אסלה – בדיקה מדגמית', instruction: 'יש לבצע בדיקת מעקף. אסלה מדגמי לפני פס יצור חדש' },
      { key: 'ceiling_check', label: 'תקרה', instruction: 'יש לבדוק: מגשים, פתח אוורור, מקבילות' },
      { key: 'electrical', label: 'חשמל', instruction: 'יש לבדוק מעגלים חשמליים' },
    ]
  },
  {
    number: 4,
    name: 'איטום',
    nameEn: 'Waterproofing / Sealing',
    items: [
      { key: 'collars', label: 'קולרים', instruction: null },
      { key: 'corner_tapes', label: 'סרטים בפינות', instruction: null },
      { key: 'sealing_layer', label: 'שכבת איטום', instruction: null },
    ]
  },
  {
    number: 5,
    name: 'התקנת קרמיקה ורובה',
    nameEn: 'Ceramic Tile & Grouting',
    items: [
      { key: 'floor_walls', label: 'רצפה וקירות', instruction: 'יש לבדוק מישוריות ונראות' },
      { key: 'grout_spacing', label: 'רווח הפוגות', instruction: 'יש לבדוק אחידות' },
      { key: 'grout', label: 'רובה', instruction: 'יש לבדוק שלמות' },
      { key: 'wall_floor_junc', label: 'מפגש קיר-רצפה', instruction: 'יש לבדוק חומר גמיש' },
      { key: 'detail_junc', label: 'מפגש חיבור פרט', instruction: 'יש לבדוק חומר גמיש' },
    ]
  },
  {
    number: 6,
    name: 'התקנת אביזרי קצה',
    nameEn: 'Edge Accessories Installation',
    items: [
      { key: 'horizontality', label: 'אופקיות', instruction: null },
      { key: 'toilet', label: 'אסלה', instruction: 'יש לבדוק גובה 39 ± 1 ס"מ' },
      { key: 'shower', label: 'מקלחון', instruction: null },
      { key: 'faucet', label: 'ברז', instruction: null },
      { key: 'sink', label: 'כיור', instruction: null },
      { key: 'cabinet', label: 'ארון', instruction: null },
      { key: 'flush_btn', label: 'לחצן הדחה', instruction: null },
      { key: 'towel_rack', label: 'מתלה מגבות', instruction: null },
      { key: 'toilet_paper', label: 'מתקן נייר טואלט', instruction: null },
      { key: 'shower_head', label: 'ראש טוש', instruction: null },
      { key: 'sprayer', label: 'מזלף', instruction: null },
      { key: 'light_fixture', label: 'גוף תאורה', instruction: null },
      { key: 'vent_grille', label: 'גריל לוונטה', instruction: null },
      { key: 'flexible_toilet', label: 'חומר גמיש אסלה', instruction: null },
      { key: 'flexible_sink', label: 'חומר גמיש כיור', instruction: null },
    ]
  }
];

// Get stage by number
function getStage(num) {
  return QC_STAGES.find(s => s.number === num);
}

// Count total items in a stage
function stageItemCount(num) {
  const s = getStage(num);
  return s ? s.items.length : 0;
}

// Pipe type options
const PIPE_TYPES = ['HDPE', 'PVC'];

// Direction options
const DIRECTIONS = [
  { value: 'R', label: 'ימין (R)' },
  { value: 'L', label: 'שמאל (L)' },
];

// Group colors
const GROUP_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];
