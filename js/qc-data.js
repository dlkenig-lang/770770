// =============================================
// QC Stage Definitions (6 Control Groups)
// Each item carries Hebrew (label/instruction/unit) and English
// (labelEn/instructionEn/unitEn) text. Use the qc* helpers below to read the
// value for the active language.
// =============================================

const QC_STAGES = [
  {
    number: 1,
    name: 'יציקת רצפת בטון',
    nameEn: 'Concrete Floor Casting',
    items: [
      { key: 'length_dims', label: 'מידות אורך', labelEn: 'Length dimensions', instruction: 'סטיה תקינה של ± 2 מ"מ', instructionEn: 'Acceptable tolerance of ± 2 mm' },
      { key: 'width_dims', label: 'מידות רוחב', labelEn: 'Width dimensions', instruction: 'סטיה תקינה של ± 2 מ"מ', instructionEn: 'Acceptable tolerance of ± 2 mm' },
      { key: 'pipe_slope', label: 'שיפוע צינור 1.5%', labelEn: 'Pipe slope 1.5%', instruction: null, instructionEn: null },
      { key: 'pipe_fixation', label: 'קיבוע צינור', labelEn: 'Pipe fixation', instruction: null, instructionEn: null },
      { key: 'drainage_channel', label: 'תעלת ניקוז', labelEn: 'Drainage channel', instruction: 'לוודא התקנה שטוחה בתבנית + מקבילות ומיקום', instructionEn: 'Verify flat installation in the mold + parallelism and position' },
      { key: 'lifting_bolts', label: 'עיגון ברגי הרמה', labelEn: 'Lifting-bolt anchoring', instruction: null, instructionEn: null },
      { key: 'shower_parallel', label: 'מקבילות אגנית מקלחון', labelEn: 'Shower-tray parallelism', instruction: null, instructionEn: null },
      { key: 'segregation', label: 'סגרגציה', labelEn: 'Segregation', instruction: 'לוודא היפרדות תקינה של התבנית מהבטון', instructionEn: 'Verify proper separation of the mold from the concrete' },
      { key: 'drainage_test', label: 'בדיקת דלוחין עם בלון', labelEn: 'Drainage leak test with balloon plug', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות', instructionEn: 'Perform the test at 2 time points: enter the current time and the time after 60 minutes', hasTwoTimes: true },
    ]
  },
  {
    number: 2,
    name: 'קונסטרוקציית קירות ותקרה וסגירה בגבס',
    nameEn: 'Walls, Ceiling & Drywall',
    items: [
      { key: 'diagonals', label: 'אלכסוני קונסטרוקציה', labelEn: 'Structure diagonals', instruction: 'הבדיקה מתבצעת לאחר התקנת השלד', instructionEn: 'Performed after the frame is installed' },
      { key: 'lwh_dims', label: 'מידות אורך, רוחב וגובה', labelEn: 'Length, width & height dimensions', instruction: null, instructionEn: null },
      { key: 'door_opening', label: 'מידת פתח הדלת', labelEn: 'Door-opening dimension', instruction: null, instructionEn: null },
      { key: 'dowel_anchor', label: 'עיגון דיבלים סמוך לניצב', labelEn: 'Dowel anchoring near the stud', instruction: null, instructionEn: null },
      { key: 'gypsum_walls', label: 'קירות גבס', labelEn: 'Gypsum walls', instruction: 'לוודא מיישקים וברגים כל 40 ס"מ', instructionEn: 'Verify joints and screws every 40 cm' },
      { key: 'ceiling_check', label: 'תקרה', labelEn: 'Ceiling', instruction: 'יש לבדוק: מגשים/ גבס', instructionEn: 'Check: trays / gypsum' },
    ]
  },
  {
    number: 3,
    name: 'הכנת מערכות אינסטלציה וחשמל',
    nameEn: 'Plumbing & Electrical Systems',
    items: [
      { key: 'water_pressure', label: 'בדיקת דלוחין', labelEn: 'Drainage test', instruction: 'יש לבצע בדיקה ב-2 זמנים: הזן שעה נוכחית ושעה אחרי 60 דקות. יש לסגור את כל החורים לפני הבדיקה', instructionEn: 'Perform the test at 2 time points: enter the current time and the time after 60 minutes. Seal all openings before the test', hasTwoTimes: true },
      { key: 'pressure_bar', label: 'בדיקת לחץ מים (4 בר תקין)', labelEn: 'Water-pressure test (4 bar OK)', instruction: 'ערך תקין: 4 בר ומעלה. מצב לא תקין: פחות מ-4 בר – יש לבצע ניתוקים', instructionEn: 'Acceptable value: 4 bar or higher. Not acceptable: below 4 bar – disconnections required', hasValue: true, unit: 'בר', unitEn: 'bar', minValue: 4 },
      { key: 'toilet_check', label: 'אסלה – בדיקה מדגמית', labelEn: 'Toilet – sample check', instruction: 'יש לבצע מעקף לאסלה', instructionEn: 'Perform a bypass for the toilet' },
      { key: 'electrical', label: 'חשמל', labelEn: 'Electrical', instruction: 'לוודא נקודות, מיקום וכמויות', instructionEn: 'Verify points, location and quantities' },
    ]
  },
  {
    number: 4,
    name: 'איטום',
    nameEn: 'Waterproofing / Sealing',
    items: [
      { key: 'collars', label: 'קולרים', labelEn: 'Collars', instruction: 'לוודא שאין בועות', instructionEn: 'Verify there are no bubbles' },
      { key: 'corner_tapes', label: 'סרטים בפינות', labelEn: 'Corner tapes', instruction: null, instructionEn: null },
      { key: 'sealing_layer', label: 'שכבת איטום', labelEn: 'Sealing layer', instruction: 'מינימום 2 שכבות איטום', instructionEn: 'Minimum 2 sealing layers' },
    ]
  },
  {
    number: 5,
    name: 'התקנת קרמיקה ורובה',
    nameEn: 'Ceramic Tile & Grouting',
    items: [
      { key: 'floor_walls', label: 'רצפה וקירות', labelEn: 'Floor and walls', instruction: 'לוודא מישוריות ונראות', instructionEn: 'Verify flatness and appearance' },
      { key: 'grout_spacing', label: 'רווח הפוגות', labelEn: 'Grout-joint spacing', instruction: 'לוודא אחידות', instructionEn: 'Verify uniformity' },
      { key: 'grout', label: 'רובה', labelEn: 'Grout', instruction: 'לוודא שלמות', instructionEn: 'Verify integrity' },
      { key: 'wall_floor_junc', label: 'מפגש קיר-רצפה', labelEn: 'Wall–floor junction', instruction: 'לוודא חומר גמיש', instructionEn: 'Verify flexible material' },
      { key: 'detail_junc', label: 'מפגש חיבור פרט', labelEn: 'Detail-connection junction', instruction: 'לוודא חומר גמיש', instructionEn: 'Verify flexible material' },
    ]
  },
  {
    number: 6,
    name: 'התקנת אביזרי קצה',
    nameEn: 'Edge Accessories Installation',
    items: [
      { key: 'horizontality', label: 'בדיקת אופקיות כלל האביזרים', labelEn: 'Horizontality check of all fixtures', instruction: null, instructionEn: null },
      { key: 'trays', label: 'התקנת מגשים', labelEn: 'Tray installation', instruction: null, instructionEn: null },
      { key: 'vent_opening', label: 'פתח אוורור', labelEn: 'Ventilation opening', instruction: null, instructionEn: null },
      { key: 'vent_grille', label: 'גריל לוונטה', labelEn: 'Vent grille', instruction: null, instructionEn: null },
      { key: 'toilet', label: 'אסלה', labelEn: 'Toilet', instruction: 'יש לבדוק גובה 39 ± 1 ס"מ | לבדוק חומר גמיש', instructionEn: 'Check height 39 ± 1 cm | check flexible material' },
      { key: 'shower', label: 'מקלחון', labelEn: 'Shower', instruction: null, instructionEn: null },
      { key: 'faucet', label: 'ברז', labelEn: 'Faucet', instruction: null, instructionEn: null },
      { key: 'sink', label: 'כיור', labelEn: 'Sink', instruction: 'לבדוק חומר גמיש', instructionEn: 'Check flexible material' },
      { key: 'cabinet', label: 'ארון', labelEn: 'Cabinet', instruction: 'לוודא מידת ארון', instructionEn: 'Verify cabinet dimensions' },
      { key: 'flush_btn', label: 'לחצן הדחה', labelEn: 'Flush button', instruction: null, instructionEn: null },
      { key: 'towel_rack', label: 'מתלה מגבות', labelEn: 'Towel rack', instruction: null, instructionEn: null },
      { key: 'toilet_paper', label: 'מתקן נייר טואלט', labelEn: 'Toilet-paper holder', instruction: null, instructionEn: null },
      { key: 'shower_head', label: 'ראש טוש', labelEn: 'Shower head', instruction: null, instructionEn: null },
      { key: 'sprayer', label: 'מזלף', labelEn: 'Hand mixer', instruction: null, instructionEn: null },
      { key: 'light_fixture', label: 'גוף תאורה', labelEn: 'Light fixture', instruction: null, instructionEn: null },
      { key: 'electrical_circuits', label: 'מעגלים חשמליים', labelEn: 'Electrical circuits', instruction: null, instructionEn: null },
      { key: 'outlets', label: 'שקעים', labelEn: 'Outlets', instruction: null, instructionEn: null },
      { key: 'mirror', label: 'מראה', labelEn: 'Mirror', instruction: null, instructionEn: null },
      { key: 'sink_siphon', label: 'סיפון כיור', labelEn: 'Sink siphon (P-trap)', instruction: null, instructionEn: null },
    ]
  }
];

// ---- Language-aware readers for QC definitions ----
// getLang() comes from i18n.js (loaded first). Fall back to Hebrew if the
// English value is missing.
function _qcIsEn() { return (typeof getLang === 'function' ? getLang() : 'he') === 'en'; }

// Stage display name by stage number (ignores the Hebrew name persisted in the
// DB so the label follows the active language).
function qcStageName(stageNumber) {
  const s = getStage(stageNumber);
  if (!s) return '';
  return _qcIsEn() ? (s.nameEn || s.name) : s.name;
}
function qcItemLabel(itemDef) {
  if (!itemDef) return '';
  return _qcIsEn() ? (itemDef.labelEn || itemDef.label) : itemDef.label;
}
function qcItemInstruction(itemDef) {
  if (!itemDef) return null;
  return _qcIsEn() ? (itemDef.instructionEn ?? itemDef.instruction) : itemDef.instruction;
}
function qcItemUnit(itemDef) {
  if (!itemDef) return '';
  return _qcIsEn() ? (itemDef.unitEn || itemDef.unit || '') : (itemDef.unit || '');
}

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

// Direction options (label is language-aware via direction.* i18n keys)
const DIRECTIONS = [
  { value: 'R', label: 'ימין (R)' },
  { value: 'L', label: 'שמאל (L)' },
];

// Group colors
const GROUP_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];
