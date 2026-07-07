// =============================================
// i18n — Multi-language support (Hebrew / English)
// Language is persisted in localStorage ('app_lang').
// Hebrew = RTL, English = LTR (full layout flip).
// =============================================

const I18N_LANG_KEY = 'app_lang';
const I18N_DEFAULT = 'he';
const I18N_SUPPORTED = ['he', 'en'];

// ---- Translation dictionary ----
// Keys are namespaced (e.g. 'nav.logout'). Missing English keys fall
// back to Hebrew, then to the raw key, so partial translation is safe.
const I18N = {
  he: {
    // App / document
    'app.title': 'בקרת איכות - ייצור פודים',

    // Common
    'common.back': '← חזרה',
    'common.edit': 'עריכה',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.clear': 'נקה',
    'common.print': '🖨️ הדפס',
    'common.date': 'תאריך',
    'common.you': 'אתה',

    // Navbar
    'nav.editProfileTitle': 'ערוך שם תצוגה',
    'nav.logout': 'התנתק',
    'nav.menu': 'תפריט',
    'nav.dashboard': 'לוח בקרה',
    'nav.projects': 'פרויקטים',
    'nav.users': 'ניהול משתמשים',
    'nav.reports': 'דוחות',

    // Sidebar
    'sidebar.scan': '📷 סרוק',
    'sidebar.scanTitle': 'סרוק ברקוד פוד',
    'sidebar.logout': '🚪 התנתק',

    // Language switcher
    'lang.he': 'עב',
    'lang.en': 'EN',
    'lang.title': 'בחר שפה',

    // Dashboard
    'dashboard.title': 'לוח בקרה',
    'dashboard.activeProjects': 'פרויקטים פעילים',

    // Projects
    'projects.title': 'פרויקטים',
    'projects.new': '+ פרויקט חדש',
    'projects.archive': '📦 ארכיון פרויקטים',
    'projectDetail.title': 'פרויקט',
    'projectDetail.actionsTitle': 'ארכיון / מחיקה',

    // Tabs
    'tabs.pods': 'פודים',
    'tabs.groups': 'קבוצות ביצוע',
    'tabs.details': 'פרטים נוספים',
    'tabs.plans': 'תוכניות',

    // Filters
    'filter.allGroups': 'כל הקבוצות',
    'filter.allTypes': 'כל הטיפוסים',
    'filter.allDirections': 'כל הכיוונים',
    'filter.allStatuses': 'כל הסטטוסים',
    'filter.allPods': 'כל הפודים',
    'filter.castingApproved': 'מאושרים ליציקה',
    'filter.castingNotApproved': 'לא מאושרים ליציקה',

    // Status labels
    'status.pending': 'ממתין',
    'status.in_progress': 'בביצוע',
    'status.completed': 'הושלם',
    'status.failed': 'נכשל',
    'status.passed': 'עבר',

    // Role labels
    'role.admin': 'מנהל מערכת',
    'role.project_manager': 'מנהל פרויקט',
    'role.inspector': 'בודק',
    'role.viewer': 'צופה',

    // Directions
    'direction.R': 'ימין (R)',
    'direction.L': 'שמאל (L)',

    // Pods / barcodes
    'pods.printBarcodes': '🖨️ הדפס ברקודים',
    'pods.printBarcodesTitle': 'הדפס ברקודים לפי סינון',
    'groups.add': '+ הוסף קבוצה',

    // Pod detail
    'pod.backToProject': '← חזרה לפרויקט',
    'pod.castingApproved': '🏗️ מאושר ליציקה',
    'pod.castingApprovedTitle': 'מאושר ליציקה',
    'pod.comments': '💬 הערות',
    'pod.barcode': '🔲 ברקוד',
    'pod.exportPdf': '📄 ייצוא PDF',

    // Users
    'users.title': 'ניהול משתמשים',

    // Reports
    'reports.title': 'דוחות',

    // Auth
    'auth.loginSubtitle': 'כניסה למערכת',
    'auth.registerSubtitle': 'הרשמה למערכת',
    'auth.forgotSubtitle': 'שחזור סיסמה',
    'auth.resetSubtitle': 'הגדרת סיסמה חדשה',
    'auth.emailOrUsername': 'אימייל או שם משתמש',
    'auth.email': 'אימייל',
    'auth.password': 'סיסמה',
    'auth.login': 'כניסה',
    'auth.forgot': 'שכחתי סיסמה',
    'auth.register': 'הרשמה',
    'auth.fullName': 'שם מלא',
    'auth.fullNamePlaceholder': 'ישראל ישראלי',
    'auth.username': 'שם משתמש',
    'auth.usernameHint': 'ישמש לזיהוי בהערות ובדיקות QC · אנגלית בלבד, ללא רווחים',
    'auth.passwordMinPlaceholder': 'לפחות 6 תווים',
    'auth.confirmPassword': 'אימות סיסמה',
    'auth.repeatPassword': 'חזור על הסיסמה',
    'auth.backToLogin': 'חזרה לכניסה',
    'auth.sendReset': 'שלח קישור לאיפוס',
    'auth.newPassword': 'סיסמה חדשה',
    'auth.saveNewPassword': 'שמור סיסמה חדשה',

    // Modals
    'modal.barcodeTitle': 'ברקוד פוד',
    'modal.signatureTitle': 'חתימת בודק',
    'modal.commentsTitle': 'הערות לפוד',
    'modal.shareTitle': 'שיתוף שלב',
    'modal.profileTitle': 'עריכת שם תצוגה',
    'modal.scannerTitle': 'סריקת ברקוד פוד',

    // Signature modal
    'sig.inspectorName': 'שם הבודק *',
    'sig.fullNamePlaceholder': 'שם מלא',
    'sig.signature': 'חתימה *',
    'sig.confirm': 'אשר ושמור',

    // Comments modal
    'comments.addPlaceholder': 'הוסף הערה...',
    'comments.redFlag': 'סמן כדגל אדום (חייב להתייחס)',
    'comments.submit': 'שלח הערה',

    // Share modal
    'share.sendTo': 'שלח אל',
    'share.noteOptional': 'הערה (אופציונלי)',
    'share.sendEmail': '✉️ שלח מייל',

    // Profile modal
    'profile.displayName': 'שם תצוגה',
    'profile.displayNamePlaceholder': 'הכנס שם מלא',

    // Scanner modal
    'scanner.hint': 'הצב את ברקוד הפוד מול המצלמה',

    // QC screen
    'qc.stage': 'שלב',
    'qc.viewComments': 'צפה בהערות',
    'qc.commentsOpen': '{n} הערות פתוחות',
    'qc.podProgress': 'התקדמות פוד — {done}/{total} שלבים',
    'qc.pipeType': 'דגם צנרת:',
    'qc.lockedBanner': '🔒 שלב זה נעול עד לאישור סעיפים 1–7 ביציקת הרצפה (שלב A)',
    'qc.colItem': 'פרט לבדיקה',
    'qc.colPass': 'עבר ✓',
    'qc.colFail': 'נכשל ✗',
    'qc.colNotes': 'הערות',
    'qc.prevStage': '→ שלב קודם',
    'qc.nextStage': 'שלב הבא ←',
    'qc.stageSummary': '{passed}/{total} עברו · {failed} נכשלו',
    'qc.editForm': '✏️ עריכת טופס',
    'qc.clearForm': '🗑 ניקוי טופס',
    'qc.shareStagePage': '✉️ שיתוף עמוד שלב',
    'qc.time': 'שעה:',
    'qc.value': 'ערך',
    'qc.min': "(מינ' {min})",
    'qc.notesPlaceholder': 'הערות...',
    'qc.addImage': 'הוסף תמונה',
    'qc.image': 'תמונה',
    'qc.signature': 'חתימה',
    'qc.stageCompletedApproved': '✓ השלב הושלם ואושר',
    'qc.stageFailedApproved': '✓ השלב נכשל ואושר',
    'qc.inspectorName': 'שם הבודק',
    'qc.signApprove': '✍️ חתום ואשר שלב',
    'qc.needInspectorName': 'יש למלא שם בודק',
    'qc.confirmClear': 'האם לנקות את השלב ולאפשר עריכה מחדש? כל הנתונים שהוזנו יימחקו.',
    'qc.stageCleared': 'השלב נוקה — ניתן להזין נתונים מחדש',
    'qc.stageAlreadyOpen': 'השלב כבר פתוח לעריכה',
    'qc.confirmEdit': 'האם לפתוח את השלב לעריכה מחדש? הנתונים שהוזנו יישמרו, אך האישור והחתימה יוסרו.',
    'qc.stageReopened': 'השלב פתוח לעריכה — הנתונים נשמרו',
    'qc.podRemovedFromCasting': 'הפוד הוצא מרשימת מאושרי ליציקה — יש להשלים את שלב A',
    'qc.confirmCastingApproval': 'כל סעיפי הבסיס 1–7 אושרו ✓\nהאם לאשר את רצפת הפוד ליציקה?',
    'qc.castingSaveError': 'שגיאה בשמירת אישור יציקה',
    'qc.podCastingApproved': 'הפוד אושר ליציקה! 🏗️',
    'qc.selectUser': 'בחר משתמש...',
    'qc.pleaseSelectUser': 'יש לבחור משתמש',
    'qc.saveItemFirst': 'שמור את הפריט תחילה',
    'qc.fileTooLarge': 'הקובץ גדול מ-10MB',
    'qc.uploadingImage': 'מעלה תמונה...',
    'qc.uploadError': 'שגיאה בהעלאה: ',
    'qc.imageUploaded': 'תמונה הועלתה',
    'qc.confirmDeleteImage': 'למחוק את התמונה?',
    'qc.imageDeleted': 'תמונה נמחקה',
    'qc.cannotApproveStage': 'לא ניתן לאשר שלב זה — יש להשלים את כל פרטי שלב A (כולל סעיפים 7–9) תחילה',
    'qc.needSignature': 'יש לחתום בשדה החתימה',
    'qc.saveError': 'שגיאה בשמירה',
    'qc.stageCompletedToast': 'שלב {n} הושלם ואושר!',
    'qc.stageFailedToast': 'שלב {n} נכשל ואושר!',
    'qc.commentsFlaggedOne': 'הערה אחת מסומנת לטיפול',
    'qc.commentsFlaggedMany': '{n} הערות מסומנות לטיפול',
    'qc.emailShare': 'שיתוף',
    'qc.emailPod': 'פוד',
    'qc.emailGreeting': 'שלום,',
    'qc.emailBodyLine': 'שותף איתך עמוד בדיקה: {stage}',
    'qc.emailNote': 'הערה: {note}',
    'qc.emailSignature': '-- נשלח מאפליקציית בקרת האיכות',

    // Projects / dashboard / groups / pods
    'proj.loadingData': 'טוען נתונים...',
    'proj.loadingProjects': 'טוען פרויקטים...',
    'proj.loadTimeout': 'הטעינה לקחה יותר מדי זמן.',
    'proj.loadError': 'שגיאה בטעינת פרויקטים.',
    'proj.retry': 'נסה שוב',
    'proj.totalPods': 'סה"כ פודים',
    'proj.completedPods': 'פודים שהושלמו',
    'proj.failedPods': 'פודים שנכשלו',
    'proj.activeProjects': 'פרויקטים פעילים',
    'proj.noProjects': 'אין פרויקטים עדיין',
    'proj.noProjectsHint': 'אין פרויקטים עדיין. לחץ "+ פרויקט חדש" להוספה',
    'proj.noArchived': 'אין פרויקטים בארכיון',
    'proj.archiveBadge': '📦 ארכיון',
    'proj.restoreToActive': '♻️ שחזר לפעיל',
    'proj.deletePermanent': '🗑️ מחק לצמיתות',
    'proj.deletePermanentTitle': 'מחיקה לצמיתות',
    'proj.irreversibleWarning': '⚠️ פעולה זו אינה הפיכה!',
    'proj.typeNameToConfirm': 'כדי לאשר מחיקה לצמיתות, הקלד את שם הפרויקט:',
    'proj.typeNamePlaceholder': 'הקלד שם הפרויקט לאימות',
    'proj.deletePermanentBtn': 'מחק לצמיתות',
    'proj.deleting': 'מוחק...',
    'proj.deleteError': 'שגיאה במחיקה: ',
    'proj.deleteErrorSimple': 'שגיאה במחיקה',
    'proj.projectDeletedPermanent': 'הפרויקט נמחק לצמיתות',
    'proj.restoreError': 'שגיאה בשחזור הפרויקט',
    'proj.projectRestored': 'הפרויקט שוחזר לרשימה הפעילה',
    'proj.pods': 'פודים',
    'proj.podsLower': 'פודים',
    'proj.completed': 'הושלמו',
    'proj.pending': 'ממתינים',
    'proj.inProgress': 'בתהליך',
    'proj.failed': 'נכשלו',
    'proj.progress': 'התקדמות',
    'proj.projectProgress': 'התקדמות פרויקט — {done}/{total} שלבים',
    'proj.noPodsInProject': 'אין פודים בפרויקט זה',
    'proj.loadProjectError': 'שגיאה בטעינת פרויקט: ',
    'proj.loadProjectRefresh': 'שגיאה בטעינת פרויקט — רענן את הדף (F5)',
    'proj.projectNotFound': 'הפרויקט לא נמצא',
    'proj.code': 'קוד',
    'proj.name': 'שם',
    'proj.dateReceived': 'תאריך קבלה',
    'proj.location': 'מיקום',
    'proj.pipeType': 'סוג צנרת',
    'proj.dirRight': 'ימין',
    'proj.dirLeft': 'שמאל',
    'proj.unresolvedTitle': '{n} הערות לא טופלו',
    'proj.type': 'טיפוס',
    'proj.direction': 'כיוון',
    'proj.group': 'קבוצה',
    'proj.stagesCount': '{done}/6 שלבים',
    'proj.noGroups': 'אין קבוצות ביצוע עדיין',
    'proj.castingLabel': 'יציקה:',
    'proj.targetLabel': 'יעד:',
    'proj.dimsByType': 'מידות לפי טיפוס',
    'proj.length': 'אורך',
    'proj.width': 'רוחב',
    'proj.height': 'גובה',
    'proj.fullProjectName': 'שם פרויקט מלא',
    'proj.projectCode3': 'קוד פרויקט (3 אותיות)',
    'proj.selectPlaceholder': 'בחר...',
    'proj.onedriveLink': 'קישור OneDrive לתיקיית הפרויקט',
    'proj.onedriveHint': 'הדבק כאן את הקישור לתיקיית OneDrive של הפרויקט לשמירת PDF',
    'proj.saveChanges': 'שמור שינויים',
    'proj.podCodeUpdateError': 'שגיאה בעדכון קודי פודים: ',
    'proj.detailsUpdatedCode': 'הפרטים עודכנו, קוד הפודים עודכן ל-{code}',
    'proj.detailsUpdated': 'הפרטים עודכנו',
    'proj.noTypesInProject': 'אין טיפוסים בפרויקט זה',
    'proj.dimsLabel': 'מידות: ',
    'proj.addPdf': '📤 הוסף PDF',
    'proj.noPlansUploaded': 'אין תוכניות מועלות',
    'proj.pdfOnly': 'יש להעלות קובץ PDF בלבד',
    'proj.maxFileSize20': 'גודל הקובץ המקסימלי הוא 20MB',
    'proj.uploadingFile': 'מעלה קובץ...',
    'proj.saveErrorColon': 'שגיאה בשמירה: ',
    'proj.planUploaded': 'התוכנית הועלתה בהצלחה',
    'proj.confirmDeletePlan': 'האם למחוק תוכנית זו?',
    'proj.planDeleted': 'התוכנית נמחקה',
    'proj.newProjectTitle': 'פרויקט חדש',
    'proj.createProject': 'צור פרויקט',
    'proj.projectNamePlaceholder': 'שם הפרויקט',
    'proj.dateReceivedLabel': 'תאריך קבלת פרויקט',
    'proj.locationPlaceholder': 'עיר / כתובת',
    'proj.typeCount': 'מספר טיפוסים',
    'proj.dirsAndPodCount': 'כיוונים ומספר פודים',
    'proj.fillNameCodeDate': 'יש למלא שם, קוד ותאריך',
    'proj.codeMustBe3': 'הקוד חייב להיות 3 אותיות בדיוק',
    'proj.profileNotLoaded': 'שגיאה: פרופיל לא נטען. רענן את הדף (F5) ונסה שוב.',
    'proj.creatingProject': 'יוצר פרויקט...',
    'proj.savingType': 'שומר טיפוס {i}/{total}...',
    'proj.savingDirection': 'שומר כיוון {dir}...',
    'proj.creatingPods': 'יוצר פודים...',
    'proj.projectCreated': 'הפרויקט נוצר בהצלחה!',
    'proj.errorPrefix': 'שגיאה: ',
    'proj.errInsertStep': 'שלב 1 – insert: ',
    'proj.errCreateProject': 'שגיאה ביצירת פרויקט: ',
    'proj.errNotFoundAfterCreate': 'הפרויקט לא נמצא לאחר יצירה — נסה שוב',
    'proj.errTypeStep': 'שלב 2 – טיפוס {i}: ',
    'proj.errDirStep': 'שלב 3 – כיוון {dir}: ',
    'proj.errPodsStep': 'שלב 4 – פודים: ',
    'proj.editGroup': 'עריכת קבוצה',
    'proj.newGroup': 'קבוצת ביצוע חדשה',
    'proj.groupName': 'שם הקבוצה',
    'proj.podComposition': 'הרכב פודים בקבוצה',
    'proj.noCompositionDefined': 'לא הוגדר הרכב',
    'proj.noTypesDefined': 'אין טיפוסים מוגדרים בפרויקט',
    'proj.castingDate': 'תאריך יציקה',
    'proj.targetDate': 'תאריך יעד',
    'proj.enterName': 'יש להזין שם',
    'proj.errorCreatingPods': 'שגיאה ביצירת פודים: ',
    'proj.savedSuccess': 'נשמר בהצלחה',
    'proj.confirmDeleteGroup': 'האם למחוק קבוצה זו?',
    'proj.groupDeleted': 'הקבוצה נמחקה',
    'proj.addPod': 'הוסף פוד',
    'proj.selectDirection': 'בחר כיוון',
    'proj.serialNumber': 'מספר סידורי',
    'proj.noGroup': 'ללא קבוצה',
    'proj.podCodeToCreate': 'קוד פוד שייווצר',
    'proj.createPod': 'צור פוד',
    'proj.selectTypeDirection': 'יש לבחור טיפוס וכיוון',
    'proj.groupFull': 'הקבוצה מלאה — קיבולת מקסימלית: {max} פודים',
    'proj.podCreated': 'הפוד נוצר בהצלחה',
    'proj.confirmDeletePod': 'האם למחוק פוד זה? הפעולה אינה הפיכה',
    'proj.podDeleted': 'הפוד נמחק',
    'proj.projectActions': 'פעולות על הפרויקט',
    'proj.moveToArchive': 'העבר לארכיון',
    'proj.moveToArchiveDesc': 'הפרויקט יוסתר מהרשימה הפעילה אך ישמר במערכת. ניתן לשחזר בעתיד.',
    'proj.archiveBtn': 'ארכיון',
    'proj.permanentDeleteDesc': 'מחיקה בלתי הפיכה של הפרויקט וכל הנתונים הקשורים אליו.',
    'proj.deleteBtn': 'מחיקה',
    'proj.archiveError': 'שגיאה בהעברה לארכיון: ',
    'proj.projectArchived': 'הפרויקט הועבר לארכיון',
    'proj.nameMismatch': 'השם אינו תואם',
    'proj.back': 'חזרה',
    'proj.noPodsToPrint': 'אין פודים להדפסה לפי הסינון הנוכחי',
    'proj.noBarcodesFound': 'לא נמצאו קודי ברקוד',
    'proj.barcodesTitle': 'ברקודים',
    'proj.barcodesHeader': 'ברקודים — {name}  |  {count} מדבקות  |  Brother QL-700 · 62×150mm',
    'proj.popupBlocked': 'חסום חלונות קופצים — אפשר חלונות קופצים בדפדפן',

    // Common (extra)
    'common.error': 'שגיאה',

    // Pod detail (extra)
    'pod.loadError': 'שגיאה בטעינת פוד',
    'pod.projectLabel': 'פרויקט',
    'pod.dimensions': 'מידות',
    'pod.barcodeError': 'שגיאה ביצירת ברקוד',
    'pod.unresolvedBannerPre': 'לפוד זה יש',
    'pod.unresolvedBannerPost': 'הערות שלא טופלו',
    'pod.addressBtn': 'לטיפול',

    // Comments
    'comments.loadError': 'שגיאה בטעינת הערות',
    'comments.none': 'אין הערות עדיין',
    'comments.userFallback': 'משתמש',
    'comments.resolvedTag': '✓ טופל',
    'comments.resolveBtn': '✓ סמן כטופל',
    'comments.deleteBtn': '🗑 מחק',
    'comments.confirmDelete': 'האם למחוק הערה זו לצמיתות?',
    'comments.deleteError': 'שגיאה במחיקת הערה: ',
    'comments.deleteBlocked': 'המחיקה נחסמה — יש להפעיל את מדיניות RLS ב-Supabase',
    'comments.deleted': 'הערה נמחקה',
    'comments.resolved': 'ההערה סומנה כטופלה',
    'comments.enterContent': 'יש להזין תוכן',
    'comments.sendError': 'שגיאה בשליחת הערה: ',
    'comments.added': 'הערה נוספה',

    // Reports / PDF / Excel
    'rep.pdfTitle': 'דוח בקרת איכות',
    'rep.podLabel': 'פוד:',
    'rep.created': 'נוצר:',
    'rep.podDetails': 'פרטי פוד',
    'rep.projectColon': 'פרויקט:',
    'rep.codeColon': 'קוד:',
    'rep.groupMark': 'סימון קבוצה:',
    'rep.typeColon': 'טיפוס:',
    'rep.dirColon': 'כיוון:',
    'rep.pipeColon': 'צינור:',
    'rep.groupColon': 'קבוצה:',
    'rep.noteColon': 'הערה:',
    'rep.time1': 'זמן 1:',
    'rep.time2': 'זמן 2:',
    'rep.passedWord': 'עברו',
    'rep.inspectorColon': 'בודק:',
    'rep.dateColon': 'תאריך:',
    'rep.role': 'תפקיד',
    'rep.pdfSaved': 'PDF נוצר ונשמר',
    'rep.pdfError': 'שגיאה ביצירת PDF: ',
    'rep.hPodCode': 'קוד פוד',
    'rep.hProject': 'פרויקט',
    'rep.hType': 'טיפוס',
    'rep.hDirection': 'כיוון',
    'rep.hGroup': 'קבוצה',
    'rep.hStatus': 'סטטוס',
    'rep.hStage': 'שלב {n}',
    'rep.hProgress': 'התקדמות %',
    'rep.hInspector': 'בודק',
    'rep.hDate': 'תאריך',
    'rep.sheetSummary': 'סיכום',
    'rep.filterTitle': 'סינון פודים לייצוא',
    'rep.statusLabel': 'סטטוס',
    'rep.all': 'הכל',
    'rep.exportPdfSelected': '📄 ייצוא PDF לנבחרים',
    'rep.exportExcelSelected': '📊 ייצוא Excel לנבחרים',
    'rep.podsSelected': '{n} פודים נבחרו',
    'rep.noResults': 'אין תוצאות',
    'rep.noPodsSelected': 'אין פודים נבחרים',
    'rep.pdfExported': '{n} קבצי PDF יוצאו',
    'rep.excelCreated': 'קובץ Excel נוצר',
    'rep.filterLabel': 'סינון',
    'rep.allPodsLabel': 'כל_הפודים',

    // Auth messages
    'auth.usernameNotFound': 'שם משתמש לא נמצא',
    'auth.passwordsMismatch': 'הסיסמאות אינן תואמות',
    'auth.usernameTaken': 'שם המשתמש כבר תפוס, אנא בחר שם אחר',
    'auth.pwnedPassword': 'הסיסמה נמצאה {count} פעמים בדליפות מידע. אנא בחר סיסמה חזקה יותר — שלב אותיות גדולות וקטנות, מספרים וסימנים (למשל: Abc@2024).',
    'auth.registerSuccess': 'נרשמת בהצלחה! בדוק את האימייל שלך לאישור.',
    'auth.resetLinkSent': 'קישור לאיפוס סיסמה נשלח לאימייל שלך',
    'auth.passwordUpdated': 'הסיסמה עודכנה בהצלחה! מיד תועבר למערכת...',
    'auth.errInvalidCredentials': 'אימייל או סיסמה שגויים',
    'auth.errEmailNotConfirmed': 'יש לאמת את האימייל תחילה',
    'auth.errUserRegistered': 'משתמש עם אימייל זה כבר קיים',
    'auth.errPasswordShort': 'הסיסמה חייבת להיות לפחות 6 תווים',
    'auth.errInvalidEmail': 'כתובת האימייל אינה תקינה',
    'auth.errRateLimit': 'לצרכי אבטחה, יש להמתין מספר שניות לפני בקשה חדשה',
    'auth.errDbUser': 'שגיאה ביצירת המשתמש — ייתכן ששם המשתמש או האימייל כבר קיימים במערכת',
    'auth.errGeneric': 'אירעה שגיאה',

    // Scanner
    'scan.libLoading': 'הספרייה עדיין נטענת, נסה שוב עוד רגע',
    'scan.cameraError': 'לא ניתן לגשת למצלמה. ודא שהענקת הרשאת מצלמה.',
    'scan.searching': 'מחפש פוד: {code}…',
    'scan.podNotFound': 'פוד לא נמצא: {code}',

    // Users management
    'users.none': 'אין משתמשים',
    'users.hName': 'שם',
    'users.hUsername': 'שם משתמש',
    'users.hEmail': 'אימייל',
    'users.hRole': 'תפקיד',
    'users.hActive': 'פעיל',
    'users.hCreated': 'נוצר ב',
    'users.hActions': 'פעולות',
    'users.deactivate': 'השבת',
    'users.activate': 'הפעל',
    'users.roleUpdateError': 'שגיאה בעדכון תפקיד — אין הרשאה',
    'users.roleUpdated': 'תפקיד עודכן',
    'users.updated': 'עודכן',

    // Profile modal messages
    'profile.enterName': 'יש להזין שם תצוגה',
    'profile.updated': 'שם תצוגה עודכן',
  },

  en: {
    // App / document
    'app.title': 'Quality Control - Pod Production',

    // Common
    'common.back': '← Back',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.clear': 'Clear',
    'common.print': '🖨️ Print',
    'common.date': 'Date',
    'common.you': 'You',

    // Navbar
    'nav.editProfileTitle': 'Edit display name',
    'nav.logout': 'Log out',
    'nav.menu': 'Menu',
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.users': 'User Management',
    'nav.reports': 'Reports',

    // Sidebar
    'sidebar.scan': '📷 Scan',
    'sidebar.scanTitle': 'Scan pod barcode',
    'sidebar.logout': '🚪 Log out',

    // Language switcher
    'lang.he': 'עב',
    'lang.en': 'EN',
    'lang.title': 'Select language',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.activeProjects': 'Active Projects',

    // Projects
    'projects.title': 'Projects',
    'projects.new': '+ New Project',
    'projects.archive': '📦 Projects Archive',
    'projectDetail.title': 'Project',
    'projectDetail.actionsTitle': 'Archive / delete',

    // Tabs
    'tabs.pods': 'Pods',
    'tabs.groups': 'Production Groups',
    'tabs.details': 'More Details',
    'tabs.plans': 'Plans',

    // Filters
    'filter.allGroups': 'All groups',
    'filter.allTypes': 'All types',
    'filter.allDirections': 'All directions',
    'filter.allStatuses': 'All statuses',
    'filter.allPods': 'All pods',
    'filter.castingApproved': 'Casting approved',
    'filter.castingNotApproved': 'Casting not approved',

    // Status labels
    'status.pending': 'Pending',
    'status.in_progress': 'In progress',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.passed': 'Passed',

    // Role labels
    'role.admin': 'System Admin',
    'role.project_manager': 'Project Manager',
    'role.inspector': 'Inspector',
    'role.viewer': 'Viewer',

    // Directions
    'direction.R': 'Right (R)',
    'direction.L': 'Left (L)',

    // Pods / barcodes
    'pods.printBarcodes': '🖨️ Print Barcodes',
    'pods.printBarcodesTitle': 'Print barcodes by filter',
    'groups.add': '+ Add Group',

    // Pod detail
    'pod.backToProject': '← Back to project',
    'pod.castingApproved': '🏗️ Casting approved',
    'pod.castingApprovedTitle': 'Casting approved',
    'pod.comments': '💬 Comments',
    'pod.barcode': '🔲 Barcode',
    'pod.exportPdf': '📄 Export PDF',

    // Users
    'users.title': 'User Management',

    // Reports
    'reports.title': 'Reports',

    // Auth
    'auth.loginSubtitle': 'Sign in',
    'auth.registerSubtitle': 'Register',
    'auth.forgotSubtitle': 'Password recovery',
    'auth.resetSubtitle': 'Set a new password',
    'auth.emailOrUsername': 'Email or username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Sign in',
    'auth.forgot': 'Forgot password',
    'auth.register': 'Register',
    'auth.fullName': 'Full name',
    'auth.fullNamePlaceholder': 'John Doe',
    'auth.username': 'Username',
    'auth.usernameHint': 'Used to identify you in comments and QC checks · English only, no spaces',
    'auth.passwordMinPlaceholder': 'At least 6 characters',
    'auth.confirmPassword': 'Confirm password',
    'auth.repeatPassword': 'Repeat password',
    'auth.backToLogin': 'Back to sign in',
    'auth.sendReset': 'Send reset link',
    'auth.newPassword': 'New password',
    'auth.saveNewPassword': 'Save new password',

    // Modals
    'modal.barcodeTitle': 'Pod Barcode',
    'modal.signatureTitle': 'Inspector Signature',
    'modal.commentsTitle': 'Pod Comments',
    'modal.shareTitle': 'Share Stage',
    'modal.profileTitle': 'Edit Display Name',
    'modal.scannerTitle': 'Scan Pod Barcode',

    // Signature modal
    'sig.inspectorName': 'Inspector name *',
    'sig.fullNamePlaceholder': 'Full name',
    'sig.signature': 'Signature *',
    'sig.confirm': 'Confirm & save',

    // Comments modal
    'comments.addPlaceholder': 'Add a comment...',
    'comments.redFlag': 'Mark as red flag (must be addressed)',
    'comments.submit': 'Send comment',

    // Share modal
    'share.sendTo': 'Send to',
    'share.noteOptional': 'Note (optional)',
    'share.sendEmail': '✉️ Send email',

    // Profile modal
    'profile.displayName': 'Display name',
    'profile.displayNamePlaceholder': 'Enter full name',

    // Scanner modal
    'scanner.hint': 'Position the pod barcode in front of the camera',

    // QC screen
    'qc.stage': 'Stage',
    'qc.viewComments': 'View comments',
    'qc.commentsOpen': '{n} open comments',
    'qc.podProgress': 'Pod progress — {done}/{total} stages',
    'qc.pipeType': 'Pipe type:',
    'qc.lockedBanner': '🔒 This stage is locked until items 1–7 of the floor casting (Stage A) are approved',
    'qc.colItem': 'Inspection item',
    'qc.colPass': 'Pass ✓',
    'qc.colFail': 'Fail ✗',
    'qc.colNotes': 'Notes',
    'qc.prevStage': '← Previous stage',
    'qc.nextStage': 'Next stage →',
    'qc.stageSummary': '{passed}/{total} passed · {failed} failed',
    'qc.editForm': '✏️ Edit form',
    'qc.clearForm': '🗑 Clear form',
    'qc.shareStagePage': '✉️ Share stage page',
    'qc.time': 'Time:',
    'qc.value': 'Value',
    'qc.min': '(min {min})',
    'qc.notesPlaceholder': 'Notes...',
    'qc.addImage': 'Add image',
    'qc.image': 'Image',
    'qc.signature': 'Signature',
    'qc.stageCompletedApproved': '✓ Stage completed and approved',
    'qc.stageFailedApproved': '✓ Stage failed and approved',
    'qc.inspectorName': 'Inspector name',
    'qc.signApprove': '✍️ Sign & approve stage',
    'qc.needInspectorName': 'Inspector name is required',
    'qc.confirmClear': 'Clear this stage and allow re-editing? All entered data will be deleted.',
    'qc.stageCleared': 'Stage cleared — you can re-enter data',
    'qc.stageAlreadyOpen': 'The stage is already open for editing',
    'qc.confirmEdit': 'Reopen this stage for editing? Entered data is kept, but the approval and signature will be removed.',
    'qc.stageReopened': 'Stage reopened for editing — data was kept',
    'qc.podRemovedFromCasting': 'The pod was removed from the casting-approved list — Stage A must be completed',
    'qc.confirmCastingApproval': 'All base items 1–7 are approved ✓\nApprove the pod floor for casting?',
    'qc.castingSaveError': 'Error saving casting approval',
    'qc.podCastingApproved': 'The pod is approved for casting! 🏗️',
    'qc.selectUser': 'Select user...',
    'qc.pleaseSelectUser': 'Please select a user',
    'qc.saveItemFirst': 'Save the item first',
    'qc.fileTooLarge': 'File is larger than 10MB',
    'qc.uploadingImage': 'Uploading image...',
    'qc.uploadError': 'Upload error: ',
    'qc.imageUploaded': 'Image uploaded',
    'qc.confirmDeleteImage': 'Delete the image?',
    'qc.imageDeleted': 'Image deleted',
    'qc.cannotApproveStage': 'Cannot approve this stage — complete all Stage A items (including items 7–9) first',
    'qc.needSignature': 'Please sign in the signature field',
    'qc.saveError': 'Error saving',
    'qc.stageCompletedToast': 'Stage {n} completed and approved!',
    'qc.stageFailedToast': 'Stage {n} failed and approved!',
    'qc.commentsFlaggedOne': '1 flagged comment to address',
    'qc.commentsFlaggedMany': '{n} flagged comments to address',
    'qc.emailShare': 'Shared',
    'qc.emailPod': 'Pod',
    'qc.emailGreeting': 'Hello,',
    'qc.emailBodyLine': 'An inspection page was shared with you: {stage}',
    'qc.emailNote': 'Note: {note}',
    'qc.emailSignature': '-- Sent from the Quality Control app',

    // Projects / dashboard / groups / pods
    'proj.loadingData': 'Loading data...',
    'proj.loadingProjects': 'Loading projects...',
    'proj.loadTimeout': 'Loading took too long.',
    'proj.loadError': 'Error loading projects.',
    'proj.retry': 'Try again',
    'proj.totalPods': 'Total pods',
    'proj.completedPods': 'Completed pods',
    'proj.failedPods': 'Failed pods',
    'proj.activeProjects': 'Active projects',
    'proj.noProjects': 'No projects yet',
    'proj.noProjectsHint': 'No projects yet. Click "+ New Project" to add one',
    'proj.noArchived': 'No archived projects',
    'proj.archiveBadge': '📦 Archive',
    'proj.restoreToActive': '♻️ Restore to active',
    'proj.deletePermanent': '🗑️ Delete permanently',
    'proj.deletePermanentTitle': 'Permanent deletion',
    'proj.irreversibleWarning': '⚠️ This action is irreversible!',
    'proj.typeNameToConfirm': 'To confirm permanent deletion, type the project name:',
    'proj.typeNamePlaceholder': 'Type the project name to confirm',
    'proj.deletePermanentBtn': 'Delete permanently',
    'proj.deleting': 'Deleting...',
    'proj.deleteError': 'Error deleting: ',
    'proj.deleteErrorSimple': 'Error deleting',
    'proj.projectDeletedPermanent': 'Project permanently deleted',
    'proj.restoreError': 'Error restoring project',
    'proj.projectRestored': 'Project restored to the active list',
    'proj.pods': 'Pods',
    'proj.podsLower': 'pods',
    'proj.completed': 'Completed',
    'proj.pending': 'Pending',
    'proj.inProgress': 'In progress',
    'proj.failed': 'Failed',
    'proj.progress': 'Progress',
    'proj.projectProgress': 'Project progress — {done}/{total} stages',
    'proj.noPodsInProject': 'No pods in this project',
    'proj.loadProjectError': 'Error loading project: ',
    'proj.loadProjectRefresh': 'Error loading project — refresh the page (F5)',
    'proj.projectNotFound': 'Project not found',
    'proj.code': 'Code',
    'proj.name': 'Name',
    'proj.dateReceived': 'Date received',
    'proj.location': 'Location',
    'proj.pipeType': 'Pipe type',
    'proj.dirRight': 'Right',
    'proj.dirLeft': 'Left',
    'proj.unresolvedTitle': '{n} unresolved comments',
    'proj.type': 'Type',
    'proj.direction': 'Direction',
    'proj.group': 'Group',
    'proj.stagesCount': '{done}/6 stages',
    'proj.noGroups': 'No production groups yet',
    'proj.castingLabel': 'Casting:',
    'proj.targetLabel': 'Target:',
    'proj.dimsByType': 'Dimensions by type',
    'proj.length': 'Length',
    'proj.width': 'Width',
    'proj.height': 'Height',
    'proj.fullProjectName': 'Full project name',
    'proj.projectCode3': 'Project code (3 letters)',
    'proj.selectPlaceholder': 'Select...',
    'proj.onedriveLink': 'OneDrive link to the project folder',
    'proj.onedriveHint': 'Paste the OneDrive folder link here to save PDFs',
    'proj.saveChanges': 'Save changes',
    'proj.podCodeUpdateError': 'Error updating pod codes: ',
    'proj.detailsUpdatedCode': 'Details updated, pod code changed to {code}',
    'proj.detailsUpdated': 'Details updated',
    'proj.noTypesInProject': 'No types in this project',
    'proj.dimsLabel': 'Dimensions: ',
    'proj.addPdf': '📤 Add PDF',
    'proj.noPlansUploaded': 'No plans uploaded',
    'proj.pdfOnly': 'Only PDF files are allowed',
    'proj.maxFileSize20': 'Maximum file size is 20MB',
    'proj.uploadingFile': 'Uploading file...',
    'proj.saveErrorColon': 'Error saving: ',
    'proj.planUploaded': 'Plan uploaded successfully',
    'proj.confirmDeletePlan': 'Delete this plan?',
    'proj.planDeleted': 'Plan deleted',
    'proj.newProjectTitle': 'New Project',
    'proj.createProject': 'Create Project',
    'proj.projectNamePlaceholder': 'Project name',
    'proj.dateReceivedLabel': 'Project received date',
    'proj.locationPlaceholder': 'City / address',
    'proj.typeCount': 'Number of types',
    'proj.dirsAndPodCount': 'Directions and pod count',
    'proj.fillNameCodeDate': 'Fill in name, code and date',
    'proj.codeMustBe3': 'The code must be exactly 3 letters',
    'proj.profileNotLoaded': 'Error: profile not loaded. Refresh the page (F5) and try again.',
    'proj.creatingProject': 'Creating project...',
    'proj.savingType': 'Saving type {i}/{total}...',
    'proj.savingDirection': 'Saving direction {dir}...',
    'proj.creatingPods': 'Creating pods...',
    'proj.projectCreated': 'Project created successfully!',
    'proj.errorPrefix': 'Error: ',
    'proj.errInsertStep': 'Step 1 – insert: ',
    'proj.errCreateProject': 'Error creating project: ',
    'proj.errNotFoundAfterCreate': 'Project not found after creation — try again',
    'proj.errTypeStep': 'Step 2 – type {i}: ',
    'proj.errDirStep': 'Step 3 – direction {dir}: ',
    'proj.errPodsStep': 'Step 4 – pods: ',
    'proj.editGroup': 'Edit group',
    'proj.newGroup': 'New production group',
    'proj.groupName': 'Group name',
    'proj.podComposition': 'Pod composition in the group',
    'proj.noCompositionDefined': 'No composition defined',
    'proj.noTypesDefined': 'No types defined in the project',
    'proj.castingDate': 'Casting date',
    'proj.targetDate': 'Target date',
    'proj.enterName': 'Please enter a name',
    'proj.errorCreatingPods': 'Error creating pods: ',
    'proj.savedSuccess': 'Saved successfully',
    'proj.confirmDeleteGroup': 'Delete this group?',
    'proj.groupDeleted': 'Group deleted',
    'proj.addPod': 'Add pod',
    'proj.selectDirection': 'Select direction',
    'proj.serialNumber': 'Serial number',
    'proj.noGroup': 'No group',
    'proj.podCodeToCreate': 'Pod code to be created',
    'proj.createPod': 'Create pod',
    'proj.selectTypeDirection': 'Please select a type and direction',
    'proj.groupFull': 'The group is full — maximum capacity: {max} pods',
    'proj.podCreated': 'Pod created successfully',
    'proj.confirmDeletePod': 'Delete this pod? This action is irreversible',
    'proj.podDeleted': 'Pod deleted',
    'proj.projectActions': 'Project actions',
    'proj.moveToArchive': 'Move to archive',
    'proj.moveToArchiveDesc': 'The project will be hidden from the active list but kept in the system. It can be restored later.',
    'proj.archiveBtn': 'Archive',
    'proj.permanentDeleteDesc': 'Irreversible deletion of the project and all its related data.',
    'proj.deleteBtn': 'Delete',
    'proj.archiveError': 'Error archiving: ',
    'proj.projectArchived': 'Project moved to archive',
    'proj.nameMismatch': 'The name does not match',
    'proj.back': 'Back',
    'proj.noPodsToPrint': 'No pods to print for the current filter',
    'proj.noBarcodesFound': 'No barcode codes found',
    'proj.barcodesTitle': 'Barcodes',
    'proj.barcodesHeader': 'Barcodes — {name}  |  {count} labels  |  Brother QL-700 · 62×150mm',
    'proj.popupBlocked': 'Popups are blocked — allow popups in your browser',

    // Common (extra)
    'common.error': 'Error',

    // Pod detail (extra)
    'pod.loadError': 'Error loading pod',
    'pod.projectLabel': 'Project',
    'pod.dimensions': 'Dimensions',
    'pod.barcodeError': 'Error generating barcode',
    'pod.unresolvedBannerPre': 'This pod has',
    'pod.unresolvedBannerPost': 'unresolved comments',
    'pod.addressBtn': 'Address',

    // Comments
    'comments.loadError': 'Error loading comments',
    'comments.none': 'No comments yet',
    'comments.userFallback': 'User',
    'comments.resolvedTag': '✓ Resolved',
    'comments.resolveBtn': '✓ Mark resolved',
    'comments.deleteBtn': '🗑 Delete',
    'comments.confirmDelete': 'Permanently delete this comment?',
    'comments.deleteError': 'Error deleting comment: ',
    'comments.deleteBlocked': 'Deletion blocked — enable the RLS policy in Supabase',
    'comments.deleted': 'Comment deleted',
    'comments.resolved': 'Comment marked as resolved',
    'comments.enterContent': 'Please enter content',
    'comments.sendError': 'Error sending comment: ',
    'comments.added': 'Comment added',

    // Reports / PDF / Excel
    'rep.pdfTitle': 'Quality Control Report',
    'rep.podLabel': 'Pod:',
    'rep.created': 'Created:',
    'rep.podDetails': 'Pod details',
    'rep.projectColon': 'Project:',
    'rep.codeColon': 'Code:',
    'rep.groupMark': 'Group mark:',
    'rep.typeColon': 'Type:',
    'rep.dirColon': 'Direction:',
    'rep.pipeColon': 'Pipe:',
    'rep.groupColon': 'Group:',
    'rep.noteColon': 'Note:',
    'rep.time1': 'Time 1:',
    'rep.time2': 'Time 2:',
    'rep.passedWord': 'passed',
    'rep.inspectorColon': 'Inspector:',
    'rep.dateColon': 'Date:',
    'rep.role': 'Role',
    'rep.pdfSaved': 'PDF created and saved',
    'rep.pdfError': 'Error creating PDF: ',
    'rep.hPodCode': 'Pod code',
    'rep.hProject': 'Project',
    'rep.hType': 'Type',
    'rep.hDirection': 'Direction',
    'rep.hGroup': 'Group',
    'rep.hStatus': 'Status',
    'rep.hStage': 'Stage {n}',
    'rep.hProgress': 'Progress %',
    'rep.hInspector': 'Inspector',
    'rep.hDate': 'Date',
    'rep.sheetSummary': 'Summary',
    'rep.filterTitle': 'Filter pods for export',
    'rep.statusLabel': 'Status',
    'rep.all': 'All',
    'rep.exportPdfSelected': '📄 Export PDF for selected',
    'rep.exportExcelSelected': '📊 Export Excel for selected',
    'rep.podsSelected': '{n} pods selected',
    'rep.noResults': 'No results',
    'rep.noPodsSelected': 'No pods selected',
    'rep.pdfExported': '{n} PDF files exported',
    'rep.excelCreated': 'Excel file created',
    'rep.filterLabel': 'filter',
    'rep.allPodsLabel': 'all_pods',

    // Auth messages
    'auth.usernameNotFound': 'Username not found',
    'auth.passwordsMismatch': 'Passwords do not match',
    'auth.usernameTaken': 'Username is already taken, please choose another',
    'auth.pwnedPassword': 'This password was found {count} times in data breaches. Please choose a stronger password — mix uppercase and lowercase letters, numbers and symbols (e.g. Abc@2024).',
    'auth.registerSuccess': 'Registered successfully! Check your email to confirm.',
    'auth.resetLinkSent': 'A password reset link has been sent to your email',
    'auth.passwordUpdated': 'Password updated successfully! Redirecting you to the app...',
    'auth.errInvalidCredentials': 'Incorrect email or password',
    'auth.errEmailNotConfirmed': 'Please confirm your email first',
    'auth.errUserRegistered': 'A user with this email already exists',
    'auth.errPasswordShort': 'Password must be at least 6 characters',
    'auth.errInvalidEmail': 'The email address is invalid',
    'auth.errRateLimit': 'For security, please wait a few seconds before trying again',
    'auth.errDbUser': 'Error creating the user — the username or email may already exist',
    'auth.errGeneric': 'An error occurred',

    // Scanner
    'scan.libLoading': 'The library is still loading, try again in a moment',
    'scan.cameraError': 'Cannot access the camera. Make sure you granted camera permission.',
    'scan.searching': 'Searching for pod: {code}…',
    'scan.podNotFound': 'Pod not found: {code}',

    // Users management
    'users.none': 'No users',
    'users.hName': 'Name',
    'users.hUsername': 'Username',
    'users.hEmail': 'Email',
    'users.hRole': 'Role',
    'users.hActive': 'Active',
    'users.hCreated': 'Created',
    'users.hActions': 'Actions',
    'users.deactivate': 'Deactivate',
    'users.activate': 'Activate',
    'users.roleUpdateError': 'Error updating role — not permitted',
    'users.roleUpdated': 'Role updated',
    'users.updated': 'Updated',

    // Profile modal messages
    'profile.enterName': 'Please enter a display name',
    'profile.updated': 'Display name updated',
  },
};

// ---- Core API ----

function getLang() {
  const stored = localStorage.getItem(I18N_LANG_KEY);
  return I18N_SUPPORTED.includes(stored) ? stored : I18N_DEFAULT;
}

// Translate a key. Optional params object substitutes {name} placeholders.
function t(key, params) {
  const lang = getLang();
  let str = (I18N[lang] && I18N[lang][key]);
  if (str === undefined) str = (I18N[I18N_DEFAULT] && I18N[I18N_DEFAULT][key]);
  if (str === undefined) str = key;
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
    });
  }
  return str;
}

// Direction is derived from language: Hebrew RTL, everything else LTR.
function langDir(lang) {
  return lang === 'he' ? 'rtl' : 'ltr';
}

function applyDirection(lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', langDir(lang));
}

// Apply translations to all static [data-i18n*] elements under root.
function applyStaticTranslations(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
}

// Reflect the active language on the switcher buttons.
function updateLangSwitcher(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// Apply everything for a language: direction, static text, switcher,
// then re-render the active dynamic view (if the app exposes one).
function applyLang(lang) {
  applyDirection(lang);
  // Rebuild language-aware data label maps (roles, statuses, ...) first.
  if (typeof refreshI18nLabels === 'function') refreshI18nLabels();
  applyStaticTranslations(document);
  updateLangSwitcher(lang);
  // Let other modules react to a direction/language change (e.g. mobile drawer).
  window.dispatchEvent(new CustomEvent('languagechange:app', { detail: { lang } }));
  if (typeof window.rerenderCurrentView === 'function') {
    try { window.rerenderCurrentView(); } catch (e) { /* view not ready */ }
  }
}

// Switch language, persist, and re-apply.
function setLang(lang) {
  if (!I18N_SUPPORTED.includes(lang)) return;
  localStorage.setItem(I18N_LANG_KEY, lang);
  applyLang(lang);
}

// Wire up the language switcher buttons.
function initLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setLang(btn.dataset.lang);
    });
  });
  updateLangSwitcher(getLang());
}

// ---- Boot ----
// Set direction immediately (before DOM ready) to minimise flash.
applyDirection(getLang());

document.addEventListener('DOMContentLoaded', () => {
  initLangSwitcher();
  applyLang(getLang());
});
