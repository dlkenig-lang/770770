// =============================================
// QC Stage Definitions (6 Control Groups)
// =============================================

const QC_STAGES = [
  {
    number: 1,
    name: 'יציקת רצפת בטון',
    nameEn: 'Concrete Floor Casting',
    items: [
      { key: 'length_dims', label: 'מידות אורך', instruction: 'סטיה תקינה של ± 2 מ"מ' },
      { key: 'width_dims', label: 'מידות רוחב', instruction: 'סטיה תקינה של ± 2 מ"מ' },
      { key: 'pipe_slope', label: 'שיפוע צינור 1.5%', instruction: null },
      { key: 'pipe_fixation', label: 'קיבוע צינור', instruction: null },
      { key: 'drainage_channel', label: 'תעלת ניקוז', instruction: 'לוודא התקנה שטוחה בתבנית + מקבילות ומיקום' },
      { key: 'lifting_bolts', label: 'עיגון ברגי הרמה', instruction: null },
      { key: 'shower_parallel', label: 'מקבילות אגנית מקלחון', instruction: null },
      { key: 'segregation', label: 'סגרגציה', instruction: 'לוודא היפרדות תקינה של התבנית מהבטון' },
      { key: 'drainage_test', label: 'בדיקת דלוחין עם בלון', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות', hasTwoTimes: true },
    ]
  },
  {
    number: 2,
    name: 'קונסטרוקציית קירות ותקרה וסגירה בגבס',
    nameEn: 'Walls, Ceiling & Drywall',
    items: [
      { key: 'diagonals', label: 'אלכסוני קונסטרוקציה', instruction: 'הבדיקה מתבצעת לאחר התקנת השלד' },
      { key: 'lwh_dims', label: 'מידות אורך, רוחב וגובה', instruction: null },
      { key: 'door_opening', label: 'מידת פתח הדלת', instruction: null },
      { key: 'dowel_anchor', label: 'עיגון דיבלים סמוך לניצב', instruction: null },
      { key: 'gypsum_walls', label: 'קירות גבס', instruction: 'לוודא מיישקים וברגים כל 40 ס"מ' },
      { key: 'ceiling_check', label: 'תקרה', instruction: 'יש לבדוק: מגשים/ גבס' },
    ]
  },
  {
    number: 3,
    name: 'הכנת מערכות אינסטלציה וחשמל',
    nameEn: 'Plumbing & Electrical Systems',
    items: [
      { key: 'water_pressure', label: 'בדיקת דלוחין', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות. יש לסגור את כל החורים לפני הבדיקה', hasTwoTimes: true },
      { key: 'pressure_bar', label: 'בדיקת לחץ מים (4 בר תקין)', instruction: 'ערך תקין: 4 בר ומעלה. מצב לא תקין: פחות מ-4 בר – יש לבצע ניתוקים', hasValue: true, unit: 'בר', minValue: 4 },
      { key: 'toilet_check', label: 'אסלה – בדיקה מדגמית', instruction: 'יש לבצע מעקף לאסלה' },
      { key: 'electrical', label: 'חשמל', instruction: 'לוודא נקודות, מיקום וכמויות' },
    ]
  },
  {
    number: 4,
    name: 'איטום',
    nameEn: 'Waterproofing / Sealing',
    items: [
      { key: 'collars', label: 'קולרים', instruction: 'לוודא שאין בועות' },
      { key: 'corner_tapes', label: 'סרטים בפינות', instruction: null },
      { key: 'sealing_layer', label: 'שכבת איטום', instruction: 'מינימום 2 שכבות איטום' },
    ]
  },
  {
    number: 5,
    name: 'התקנת קרמיקה ורובה',
    nameEn: 'Ceramic Tile & Grouting',
    items: [
      { key: 'floor_walls', label: 'רצפה וקירות', instruction: 'לוודא מישוריות ונראות' },
      { key: 'grout_spacing', label: 'רווח הפוגות', instruction: 'לוודא אחידות' },
      { key: 'grout', label: 'רובה', instruction: 'לוודא שלמות' },
      { key: 'wall_floor_junc', label: 'מפגש קיר-רצפה', instruction: 'לוודא חומר גמיש' },
      { key: 'detail_junc', label: 'מפגש חיבור פרט', instruction: 'לוודא חומר גמיש' },
    ]
  },
  {
    number: 6,
    name: 'התקנת אביזרי קצה',
    nameEn: 'Edge Accessories Installation',
    items: [
      { key: 'horizontality', label: 'בדיקת אופקיות כלל האביזרים', instruction: null },
      { key: 'trays', label: 'התקנת מגשים', instruction: null },
      { key: 'vent_opening', label: 'פתח אוורור', instruction: null },
      { key: 'vent_grille', label: 'גריל לוונטה', instruction: null },
      { key: 'toilet', label: 'אסלה', instruction: 'יש לבדוק גובה 39 ± 1 ס"מ | לבדוק חומר גמיש' },
      { key: 'shower', label: 'מקלחון', instruction: null },
      { key: 'faucet', label: 'ברז', instruction: null },
      { key: 'sink', label: 'כיור', instruction: 'לבדוק חומר גמיש' },
      { key: 'cabinet', label: 'ארון', instruction: 'לוודא מידת ארון' },
      { key: 'flush_btn', label: 'לחצן הדחה', instruction: null },
      { key: 'towel_rack', label: 'מתלה מגבות', instruction: null },
      { key: 'toilet_paper', label: 'מתקן נייר טואלט', instruction: null },
      { key: 'shower_head', label: 'ראש טוש', instruction: null },
      { key: 'sprayer', label: 'מזלף', instruction: null },
      { key: 'light_fixture', label: 'גוף תאורה', instruction: null },
      { key: 'electrical_circuits', label: 'מעגלים חשמליים', instruction: null },
      { key: 'outlets', label: 'שקעים', instruction: null },
      { key: 'mirror', label: 'מראה', instruction: null },
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
