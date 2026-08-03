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
      { key: 'shower', label: 'מקלחון זכוכית', labelEn: 'Shower glass', instruction: null, instructionEn: null },
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
      { key: 'ac_siphon', label: 'סיפון מזגן', labelEn: 'AC condensate siphon', instruction: null, instructionEn: null },
    ]
  }
];

// =============================================
// Medical bed-head panel stages (product_type = 'medical_panel')
// A separate stage set from QC_STAGES — panel projects have no concrete
// casting, water or drainage. Stages unlock sequentially (each stage opens
// only after the previous one is signed) — see the seq-lock logic in qc.js.
// Quantities and mounting heights are NOT hardcoded here: the same fixture
// sits at different heights on different panels, and box contents differ
// between models (A100 basic / A100 short 220cm / B100 enhanced). Instructions
// therefore point at the panel's own drawing and ask for the measured value in
// the notes field. DB writes keep the Hebrew label as canonical, same as
// QC_STAGES.
// =============================================
const PANEL_STAGES = [
  {
    number: 1,
    name: 'שלד וקונסטרוקציה',
    nameEn: 'Frame & Structure',
    items: [
      { key: 'panel_dims', label: 'מידות כלליות לפי דגם', labelEn: 'Overall dimensions per model', instruction: 'A100 / B100: ‏120×244 ס"מ | A100 קצר: ‏120×220 ס"מ. סטיה תקינה של ± 2 מ"מ', instructionEn: 'A100 / B100: 120×244 cm | A100 short: 120×220 cm. Acceptable tolerance ± 2 mm' },
      { key: 'tracks_studs', label: 'מסלולים וניצבים לפי תוכנית', labelEn: 'Tracks and studs per drawing', instruction: 'מסלולים וניצבים 37/100 מ"מ — מיקום וקיבוע לפי פריסת הקונסטרוקציה', instructionEn: '37/100 mm tracks and studs — position and fixation per the construction layout' },
      { key: 'squareness', label: 'ניצבות ואלכסונים', labelEn: 'Squareness and diagonals', instruction: null, instructionEn: null },
      { key: 'hanging_plate', label: 'פלח חיזוק ותלייה', labelEn: 'Hanging reinforcement plate', instruction: null, instructionEn: null },
      { key: 'tv_arm_plate', label: 'פלח חיזוק זרוע טלוויזיה', labelEn: 'TV-arm reinforcement plate', instruction: 'מידות 30×50 לפי פרט 1 בתוכנית', instructionEn: '30×50 per detail 1 in the drawing' },
      { key: 'monitor_reinforce', label: 'חיזוק מוניטור', labelEn: 'Monitor reinforcement', instruction: 'לוודא הרחקת תשתיות מחיזוק המוניטור', instructionEn: 'Verify infrastructure is kept clear of the monitor reinforcement' },
      { key: 'wall_ears', label: 'אוזני וזוויות חיבור לקיר', labelEn: 'Wall-connection ears and angles', instruction: 'כולל זווית חיבור קיר IPC', instructionEn: 'Including the IPC wall-connection angle' },
    ]
  },
  {
    number: 2,
    name: 'תשתיות צנרת וחיווט',
    nameEn: 'Piping & Wiring Infrastructure',
    items: [
      { key: 'gas_piping', label: 'צנרת גזים רפואיים', labelEn: 'Medical-gas piping', instruction: 'צינורות נחושת 5/8 — תוואי וקיבוע לפי תוכנית', instructionEn: '5/8" copper pipes — routing and fixation per drawing' },
      { key: 'gas_shield', label: 'פח הגנה לצנרת הגז', labelEn: 'Gas-piping protection sheet', instruction: 'בין הגבס לצינורות הגז', instructionEn: 'Between the gypsum and the gas pipes' },
      { key: 'top_entries', label: 'חדירות צנרת מלמעלה', labelEn: 'Pipe entries from the top', instruction: 'כלל חדירות הצנרת בכניסה מלמעלה לפי מודול מתאים', instructionEn: 'All pipe penetrations enter from the top per the matching module' },
      { key: 'elec_conduits', label: 'צנרת חשמל וחוטי משיכה', labelEn: 'Electrical conduits and pull wires', instruction: 'לפי קוד הצבעים בתוכנית (כחול/לבן 25 מ"מ, ירוק 20 מ"מ)', instructionEn: 'Per the drawing color code (blue/white 25 mm, green 20 mm)' },
      { key: 'cabling', label: 'כבלי חשמל, תקשורת וחירום', labelEn: 'Power, communication and emergency cables', instruction: 'השחלה וסימון לפי תוכנית', instructionEn: 'Pulled and labeled per drawing' },
      { key: 'junction_boxes', label: 'קופסאות חיבורים 15/20', labelEn: '15/20 junction boxes', instruction: null, instructionEn: null },
      { key: 'cable_tray', label: 'תעלת חשמל 60 ס"מ', labelEn: '60 cm electrical tray', instruction: null, instructionEn: null },
      { key: 'no_drill_sticker', label: 'מדבקת סימון "אסור לקדוח"', labelEn: '"Do not drill" marking sticker', instruction: 'לסמן עם מדבקה היכן אסור לקדוח', instructionEn: 'Mark with a sticker where drilling is forbidden' },
    ]
  },
  {
    number: 3,
    name: 'סגירת גבס וגימור',
    nameEn: 'Drywall Closing & Finish',
    items: [
      { key: 'gypsum_board', label: 'לוח גבס', labelEn: 'Gypsum board', instruction: 'קיבוע וברגים לפי תוכנית', instructionEn: 'Fixation and screws per drawing' },
      { key: 'sponge_detail', label: 'פרט ספוג בתחתית הפאנל', labelEn: 'Sponge detail at the panel bottom', instruction: null, instructionEn: null },
      { key: 'headboard_sheet', label: 'ראש מיטה — פח מגולוון', labelEn: 'Bed head — galvanized sheet', instruction: 'פח עובי 1.2 מ"מ, צבע לבן תואם IPC גוון Feather 0238, ללא פגמים', instructionEn: '1.2 mm sheet, white matching IPC shade Feather 0238, free of defects' },
      { key: 'ipc_cladding', label: 'ציפוי וסרגלי IPC', labelEn: 'IPC cladding and strips', instruction: null, instructionEn: null },
      { key: 'bed_guard', label: 'מגן מיטה', labelEn: 'Bed guard', instruction: 'מיקום וקיבוע לפי תוכנית', instructionEn: 'Position and fixation per drawing' },
      { key: 'low_panel_mark', label: 'סימון פאנל נמוך לשטיפת רצפה', labelEn: 'Low-panel marking for floor washing', instruction: null, instructionEn: null },
    ]
  },
  {
    number: 4,
    name: 'התקנת אביזרי קצה',
    nameEn: 'End Fixtures Installation',
    items: [
      { key: 'box_d14_upper', label: 'קופסה D14 עליונה', labelEn: 'Upper D14 box', instruction: '2 תקשורת, 1 שקע UPS, והשאר ריק — לוודא מול תוכנית הפאנל', instructionEn: '2 communication, 1 UPS socket, rest empty — verify against the panel drawing' },
      { key: 'gas_panel', label: 'פאנל גזים', labelEn: 'Gas panel', instruction: 'סוג ומספר המחברים לפי תוכנית הפאנל (O2 / Air / Vac)', instructionEn: 'Outlet type and count per the panel drawing (O2 / Air / Vac)' },
      { key: 'panic_button', label: 'לחצן מצוקה', labelEn: 'Emergency button', instruction: 'לוודא גובה לפי התוכנית הספציפית של הפאנל (משתנה בין פאנלים) — יש לרשום את הגובה שנמדד בהערה', instructionEn: 'Verify the height against this specific panel\'s drawing (varies between panels) — record the measured height in the notes' },
      { key: 'nurse_call', label: 'לחצן קריאת אחות', labelEn: 'Nurse-call button', instruction: 'לוודא גובה לפי התוכנית הספציפית של הפאנל (משתנה בין פאנלים) — יש לרשום את הגובה שנמדד בהערה', instructionEn: 'Verify the height against this specific panel\'s drawing (varies between panels) — record the measured height in the notes' },
      { key: 'box_d20', label: 'קופסה D20', labelEn: 'D20 box', instruction: '2 מפסקים, 1 Type-C, ‏6 שקע חיוני, 2 שקע UPS, הארקה, והשאר ריק — לוודא מול תוכנית הפאנל', instructionEn: '2 switches, 1 Type-C, 6 essential sockets, 2 UPS sockets, grounding, rest empty — verify against the panel drawing' },
      { key: 'box_d14_comm', label: 'קופסה D14 תקשורת', labelEn: 'D14 communication box', instruction: 'נקודות תקשורת לפי תוכנית הפאנל והשאר ריק', instructionEn: 'Communication points per the panel drawing, rest empty' },
      { key: 'box_4place', label: 'קופסה 4 מקום', labelEn: '4-gang box', instruction: 'שקע והארקה', instructionEn: 'Socket and grounding' },
      { key: 'fixtures_level', label: 'בדיקת אופקיות וגבהים של כלל האביזרים', labelEn: 'Horizontality and height check of all fixtures', instruction: null, instructionEn: null },
    ]
  },
  {
    number: 5,
    name: 'בדיקה סופית ומסירה',
    nameEn: 'Final Inspection & Handover',
    items: [
      { key: 'elec_function', label: 'בדיקת תפקוד שקעים ומפסקים', labelEn: 'Socket and switch function test', instruction: null, instructionEn: null },
      { key: 'comm_continuity', label: 'בדיקת רציפות תקשורת', labelEn: 'Communication continuity test', instruction: null, instructionEn: null },
      { key: 'final_visual', label: 'בדיקה חזותית כוללת', labelEn: 'Overall visual inspection', instruction: 'גימור, ניקיון ושילוט', instructionEn: 'Finish, cleanliness and labeling' },
      { key: 'packing', label: 'הגנות ואריזה למשלוח', labelEn: 'Protection and packing for shipment', instruction: null, instructionEn: null },
    ]
  }
];

// ---- Product-type helpers ----
// A project's product_type selects which stage set applies to its units.
// 'pod' (or missing — legacy rows) → QC_STAGES; 'medical_panel' → PANEL_STAGES.
function qcStageSet(productType) {
  return productType === 'medical_panel' ? PANEL_STAGES : QC_STAGES;
}

// Product type of a pod row that embeds its project (pods.js/qc.js/reports.js
// queries select projects(product_type)).
function podProductType(pod) {
  return pod?.projects?.product_type || 'pod';
}

// ---- Language-aware readers for QC definitions ----
// getLang() comes from i18n.js (loaded first). Fall back to Hebrew if the
// English value is missing.
function _qcIsEn() { return (typeof getLang === 'function' ? getLang() : 'he') === 'en'; }

// Stage display name by stage number (ignores the Hebrew name persisted in the
// DB so the label follows the active language).
function qcStageName(stageNumber, productType) {
  const s = getStage(stageNumber, productType);
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

// Get stage by number. productType is optional — omitted (legacy call sites)
// means the sanitary-pod set.
function getStage(num, productType) {
  return qcStageSet(productType).find(s => s.number === num);
}

// Count total items in a stage
function stageItemCount(num, productType) {
  const s = getStage(num, productType);
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
