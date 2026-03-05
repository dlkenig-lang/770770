// =============================================
// QC Inspection Module
// =============================================

let signaturePad = null;
let pendingStageCompletion = null;

// Module-level state for active stage
let _activeStageIdx = 0;
let _qcStages = [];
let _qcStageItems = {};
let _qcPodId = null;

const STAGE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

async function loadQCStages(podId) {
  const container = document.getElementById('qc-stages-container');
  container.innerHTML = '<div class="loading-spinner" style="margin:40px auto"></div>';

  _qcPodId = podId;
  _activeStageIdx = 0;
  _qcStages = await ensureQCStages(podId);

  // Load all items in parallel
  const results = await Promise.all(
    _qcStages.map(s => supabaseClient.from('qc_items').select('*').eq('stage_id', s.id))
  );
  _qcStageItems = {};
  _qcStages.forEach((s, i) => { _qcStageItems[s.id] = results[i].data || []; });

  renderQCTabsUI();
}

function renderQCTabsUI() {
  const completedStages = _qcStages.filter(s => s.status === 'completed').length;
  const totalStages = _qcStages.length;
  const pct = totalStages > 0 ? Math.round(completedStages / totalStages * 100) : 0;
  const podProgressEl = document.getElementById('pod-progress-bar');
  if (podProgressEl) {
    podProgressEl.innerHTML = `
      <div class="page-progress-header">
        <span class="page-progress-label">התקדמות פוד &mdash; ${completedStages}/${totalStages} שלבים</span>
        <span class="page-progress-pct ${pct===100?'pct-done':''}">${pct}%</span>
      </div>
      <div class="progress-bar-outer progress-bar-lg">
        <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
      </div>
    `;
  }

  const container = document.getElementById('qc-stages-container');
  container.innerHTML = `
    <div class="qc-stage-tabs" id="qc-stage-tabs">
      ${_qcStages.map((stage, i) => `
        <button class="qc-tab-btn ${i === _activeStageIdx ? 'active' : ''}" data-idx="${i}">
          <span class="qc-tab-letter">${STAGE_LETTERS[i] || stage.stage_number}</span>
          <span class="qc-tab-name">${escHtml(stage.stage_name)}</span>
          <span class="qc-tab-dot qc-dot-${stage.status}"></span>
        </button>
      `).join('')}
    </div>
    <div id="qc-active-stage"></div>
  `;

  container.querySelectorAll('.qc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeStageIdx = parseInt(btn.dataset.idx);
      document.querySelectorAll('.qc-tab-btn').forEach((b, i) => b.classList.toggle('active', i === _activeStageIdx));
      renderActiveStage();
    });
  });

  renderActiveStage();
}

function renderActiveStage() {
  const stage = _qcStages[_activeStageIdx];
  const items = _qcStageItems[stage.id] || [];
  const stageRef = getStage(stage.stage_number);
  const pod = AppState.currentPod;
  const readonly = !canEdit() || stage.status === 'completed' || stage.status === 'failed';

  const passed = items.filter(i => i.status === 'passed').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const total = stageRef?.items.length || 0;
  const letter = STAGE_LETTERS[_activeStageIdx] || stage.stage_number;

  const content = document.getElementById('qc-active-stage');
  content.innerHTML = `
    <div class="qc-stage-panel">
      <div class="qc-stage-panel-header">
        <div>
          <div class="qc-stage-panel-title">שלב ${letter} – ${escHtml(stage.stage_name)}</div>
          ${stage.inspection_date ? `<div class="qc-stage-panel-subtitle">📅 ${formatDate(stage.inspection_date)}</div>` : ''}
        </div>
        <span class="status-badge status-${stage.status}">${STATUS_LABELS[stage.status] || stage.status}</span>
      </div>
      ${pod?.projects?.pipe_type ? `
        <div class="qc-pipe-type-bar">דגם צנרת: <strong>${escHtml(pod.projects.pipe_type)}</strong></div>
      ` : ''}
      <div class="qc-items-table-wrapper">
        <table class="qc-items-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>פרט לבדיקה</th>
              <th style="width:72px;text-align:center">עבר ✓</th>
              <th style="width:72px;text-align:center">נכשל ✗</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            ${(stageRef?.items || []).map((itemDef, rowIdx) =>
              renderQCTableRow(itemDef, rowIdx, stage, items, readonly)
            ).join('')}
          </tbody>
        </table>
      </div>
      ${renderInspectorSection(stage)}
      <div class="qc-stage-nav-row">
        ${_activeStageIdx > 0
          ? `<button class="btn btn-secondary btn-stage-nav" data-idx="${_activeStageIdx - 1}">→ שלב קודם</button>`
          : '<div></div>'}
        <div class="text-sm text-muted">${passed}/${total} עברו · ${failed} נכשלו</div>
        ${_activeStageIdx < _qcStages.length - 1
          ? `<button class="btn btn-primary btn-stage-nav" data-idx="${_activeStageIdx + 1}">שלב הבא ←</button>`
          : '<div></div>'}
      </div>
      ${canEdit() ? `
        <div class="qc-admin-actions">
          <button class="btn btn-ghost btn-sm btn-edit-stage" data-stage-id="${stage.id}">
            ✏️ עריכת טופס
          </button>
          <button class="btn btn-ghost btn-sm btn-clear-stage" data-stage-id="${stage.id}">
            🗑 ניקוי טופס
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // Bind item controls
  if (!readonly) {
    content.querySelectorAll('.qc-check-btn').forEach(btn => {
      btn.addEventListener('click', () => handleItemStatusChange(btn));
    });

    let notesTimers = {};
    content.querySelectorAll('.qc-notes-inline').forEach(field => {
      field.addEventListener('input', () => {
        const key = field.dataset.itemKey + field.dataset.stageId;
        clearTimeout(notesTimers[key]);
        notesTimers[key] = setTimeout(() => saveItemField(field, 'notes', field.value, _qcPodId), 800);
      });
    });

    content.querySelectorAll('.qc-time-1').forEach(f =>
      f.addEventListener('change', () => saveItemField(f, 'time_entry_1', f.value, _qcPodId))
    );
    content.querySelectorAll('.qc-time-2').forEach(f =>
      f.addEventListener('change', () => saveItemField(f, 'time_entry_2', f.value, _qcPodId))
    );
    content.querySelectorAll('.qc-value-field').forEach(f =>
      f.addEventListener('change', () => saveItemField(f, 'value_entry', f.value, _qcPodId))
    );

    content.querySelectorAll('.btn-complete-stage').forEach(btn => {
      btn.addEventListener('click', () => {
        const nameEl = document.getElementById(`qc-inspector-name-${btn.dataset.stageId}`);
        const name = nameEl?.value.trim() || '';
        const warningsEl = document.getElementById(`qc-stage-warnings-${btn.dataset.stageId}`);
        const warnings = [];
        if (!name) warnings.push('יש למלא שם בודק');
        if (warningsEl) {
          warningsEl.innerHTML = warnings.map(w => `<div class="qc-warning-msg">⚠️ ${w}</div>`).join('');
        }
        if (!name) return;
        showSignatureModal(_qcPodId, btn.dataset.stageId, parseInt(btn.dataset.stageNum), _qcStages, _qcStageItems, name);
      });
    });
  }

  // Admin actions (always visible to admin/PM)
  content.querySelectorAll('.btn-clear-stage').forEach(btn => {
    btn.addEventListener('click', () => clearStage(btn.dataset.stageId));
  });
  content.querySelectorAll('.btn-edit-stage').forEach(btn => {
    btn.addEventListener('click', () => editStage(btn.dataset.stageId));
  });

  // Navigation buttons
  content.querySelectorAll('.btn-stage-nav').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeStageIdx = parseInt(btn.dataset.idx);
      document.querySelectorAll('.qc-tab-btn').forEach((b, i) => b.classList.toggle('active', i === _activeStageIdx));
      renderActiveStage();
    });
  });
}

function renderQCTableRow(itemDef, rowIdx, stage, items, readonly) {
  const item = items.find(i => i.item_key === itemDef.key);
  const status = item?.status || 'pending';
  const notes = item?.notes || '';
  const time1 = item?.time_entry_1 || '';
  const time2 = item?.time_entry_2 || '';
  const val = item?.value_entry || '';
  const itemId = item?.id || '';

  return `
    <tr class="qc-table-row qc-row-${status}" id="qc-row-${itemDef.key}-${stage.id}">
      <td class="qc-row-num">${rowIdx + 1}</td>
      <td class="qc-row-label">
        <div class="qc-row-label-text">${escHtml(itemDef.label)}</div>
        ${itemDef.instruction ? `<div class="qc-row-instruction">💡 ${escHtml(itemDef.instruction)}</div>` : ''}
        ${itemDef.hasTwoTimes && !readonly ? `
          <div class="qc-time-inline">
            <label>שעה:</label>
            <input type="time" class="qc-time-1 qc-time-input" value="${escHtml(time1)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
            <label>+60:</label>
            <input type="time" class="qc-time-2 qc-time-input" value="${escHtml(time2)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
          </div>
        ` : (itemDef.hasTwoTimes && time1 ? `<div class="qc-row-instruction">⏰ ${time1}${time2 ? ' → ' + time2 : ''}</div>` : '')}
        ${itemDef.hasValue && !readonly ? `
          <div class="qc-time-inline">
            <label>ערך (${itemDef.unit || ''}):</label>
            <input type="number" step="0.1" class="qc-value-field qc-time-input" style="width:80px"
              value="${escHtml(val)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
            ${itemDef.minValue ? `<span class="text-sm ${parseFloat(val) >= itemDef.minValue ? 'text-success' : 'text-danger'}">(מינ' ${itemDef.minValue})</span>` : ''}
          </div>
        ` : (itemDef.hasValue && val ? `<div class="qc-row-instruction">📊 ${val} ${itemDef.unit || ''}</div>` : '')}
      </td>
      <td class="qc-row-check">
        ${!readonly ? `
          <button class="qc-check-btn qc-pass-btn ${status === 'passed' ? 'active' : ''}"
            data-stage-id="${stage.id}" data-item-key="${itemDef.key}"
            data-item-id="${itemId}" data-action="passed">✓</button>
        ` : (status === 'passed' ? '<span class="qc-check-badge qc-pass-badge">✓</span>' : '')}
      </td>
      <td class="qc-row-check">
        ${!readonly ? `
          <button class="qc-check-btn qc-fail-btn ${status === 'failed' ? 'active' : ''}"
            data-stage-id="${stage.id}" data-item-key="${itemDef.key}"
            data-item-id="${itemId}" data-action="failed">✗</button>
        ` : (status === 'failed' ? '<span class="qc-check-badge qc-fail-badge">✗</span>' : '')}
      </td>
      <td class="qc-row-notes">
        ${!readonly ? `
          <textarea class="qc-notes-inline" rows="1" placeholder="הערות..."
            data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
          >${escHtml(notes)}</textarea>
        ` : (notes ? `<span class="text-sm text-muted">${escHtml(notes)}</span>` : '')}
      </td>
    </tr>
  `;
}

function renderInspectorSection(stage) {
  if (stage.status === 'completed' || stage.status === 'failed') {
    return `
      <div class="qc-inspector-bar qc-inspector-signed">
        <div class="qc-inspector-info-row">
          <span>👤 <strong>${escHtml(stage.inspector_name || '—')}</strong></span>
          <span>📅 ${formatDate(stage.inspection_date)}</span>
          ${stage.inspector_signature ? `<img src="${stage.inspector_signature}" class="signed-sig-preview" alt="חתימה" />` : ''}
        </div>
        <div class="text-sm mt-2" style="color:${stage.status === 'completed' ? 'var(--success)' : 'var(--danger)'}">
          ✓ השלב ${stage.status === 'completed' ? 'הושלם' : 'נכשל'} ואושר
        </div>
      </div>
    `;
  }
  if (!canEdit()) return '';
  return `
    <div class="qc-inspector-bar" id="qc-inspector-bar-${stage.id}">
      <div class="qc-inspector-fields">
        <div class="qc-inspector-field">
          <label>שם הבודק</label>
          <input type="text" id="qc-inspector-name-${stage.id}" class="form-control"
            style="max-width:220px" readonly
            value="${escHtml(stage.inspector_name || AppState.currentProfile?.full_name || AppState.currentProfile?.username || '')}" />
        </div>
        <div class="qc-inspector-field" style="align-self:flex-end">
          <button class="btn btn-primary btn-complete-stage"
            data-stage-id="${stage.id}" data-stage-num="${stage.stage_number}">
            ✍️ חתום ואשר שלב
          </button>
        </div>
      </div>
      <div id="qc-stage-warnings-${stage.id}" class="qc-stage-warnings"></div>
    </div>
  `;
}

// ---- CLEAR STAGE ----
async function clearStage(stageId) {
  if (!confirm('האם לנקות את השלב ולאפשר עריכה מחדש? כל הנתונים שהוזנו יימחקו.')) return;

  // Reset all items for this stage
  await supabaseClient.from('qc_items').update({
    status: 'pending', notes: null, time_entry_1: null, time_entry_2: null, value_entry: null,
  }).eq('stage_id', stageId);

  // Reset the stage itself
  await supabaseClient.from('qc_stages').update({
    status: 'pending',
    inspector_name: null,
    inspector_signature: null,
    inspection_date: null,
    completed_at: null,
  }).eq('id', stageId);

  showToast('השלב נוקה — ניתן להזין נתונים מחדש', 'success');
  await updatePodStatus(_qcPodId);
  await loadQCStages(_qcPodId);
}

// ---- EDIT STAGE (unlock without clearing data) ----
async function editStage(stageId) {
  const stage = _qcStages.find(s => s.id === stageId);
  if (!stage) return;
  if (stage.status !== 'completed' && stage.status !== 'failed') {
    showToast('השלב כבר פתוח לעריכה', 'success');
    return;
  }
  if (!confirm('האם לפתוח את השלב לעריכה מחדש? הנתונים שהוזנו יישמרו, אך האישור והחתימה יוסרו.')) return;

  await supabaseClient.from('qc_stages').update({
    status: 'in_progress',
    inspector_name: null,
    inspector_signature: null,
    inspection_date: null,
    completed_at: null,
  }).eq('id', stageId);

  showToast('השלב פתוח לעריכה — הנתונים נשמרו', 'success');
  await updatePodStatus(_qcPodId);
  await loadQCStages(_qcPodId);
}

// ---- ENSURE STAGES ----
async function ensureQCStages(podId) {
  let { data: existing } = await supabaseClient
    .from('qc_stages')
    .select('*')
    .eq('pod_id', podId)
    .order('stage_number');

  if (!existing || existing.length < 6) {
    const existingNums = (existing || []).map(s => s.stage_number);
    const toCreate = QC_STAGES.filter(s => !existingNums.includes(s.number)).map(s => ({
      pod_id: podId,
      stage_number: s.number,
      stage_name: s.name,
      status: 'pending',
    }));

    if (toCreate.length > 0) {
      await supabaseClient.from('qc_stages').insert(toCreate);
      const { data: refreshed } = await supabaseClient
        .from('qc_stages').select('*').eq('pod_id', podId).order('stage_number');
      existing = refreshed || [];
    }
  }

  return existing || [];
}

// ---- HANDLE ITEM STATUS CHANGE ----
async function handleItemStatusChange(btn) {
  const stageId = btn.dataset.stageId;
  const itemKey = btn.dataset.itemKey;
  const itemId = btn.dataset.itemId;
  const action = btn.dataset.action;
  const newStatus = btn.classList.contains('active') ? 'pending' : action;

  // Optimistic UI
  const row = document.getElementById(`qc-row-${itemKey}-${stageId}`);
  if (row) {
    row.className = `qc-table-row qc-row-${newStatus}`;
    row.querySelectorAll('.qc-check-btn').forEach(b => b.classList.remove('active'));
  }
  if (newStatus !== 'pending') btn.classList.add('active');

  // Save to DB
  if (itemId) {
    await supabaseClient.from('qc_items').update({ status: newStatus }).eq('id', itemId);
  } else {
    const stage = _qcStages.find(s => s.id === stageId);
    const stageDef = getStage(stage?.stage_number);
    const itemDef = stageDef?.items.find(i => i.key === itemKey);
    const { data } = await supabaseClient.from('qc_items').insert({
      stage_id: stageId,
      item_key: itemKey,
      item_label: itemDef?.label || itemKey,
      status: newStatus,
    }).select().single();
    if (data) {
      if (row) row.querySelectorAll('[data-item-id]').forEach(el => el.dataset.itemId = data.id);
      if (!_qcStageItems[stageId]) _qcStageItems[stageId] = [];
      _qcStageItems[stageId].push(data);
    }
  }

  // Update local cache
  const cachedItem = (_qcStageItems[stageId] || []).find(i => i.item_key === itemKey);
  if (cachedItem) cachedItem.status = newStatus;

  await updateStageStatus(stageId, _qcPodId, _qcStages);
}

// ---- SAVE ITEM FIELD ----
async function saveItemField(field, fieldName, value, podId) {
  const itemId = field.dataset.itemId;
  if (itemId) {
    await supabaseClient.from('qc_items').update({ [fieldName]: value }).eq('id', itemId);
  }
}

// ---- UPDATE STAGE STATUS ----
async function updateStageStatus(stageId, podId, stages) {
  const { data: items } = await supabaseClient.from('qc_items').select('status').eq('stage_id', stageId);
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return;

  const stageDef = getStage(stage.stage_number);
  const total = stageDef?.items.length || 0;
  const answered = (items || []).filter(i => i.status !== 'pending').length;

  let newStatus = 'pending';
  if (answered > 0 && answered < total) newStatus = 'in_progress';
  if (answered === total) newStatus = 'in_progress'; // still needs sign-off

  if (stage.status !== 'completed' && stage.status !== 'failed') {
    await supabaseClient.from('qc_stages').update({ status: newStatus }).eq('id', stageId);
    stage.status = newStatus;

    // Update tab dot
    const stageIdx = stages.indexOf(stage);
    const tabBtns = document.querySelectorAll('.qc-tab-btn');
    const dot = tabBtns[stageIdx]?.querySelector('.qc-tab-dot');
    if (dot) dot.className = `qc-tab-dot qc-dot-${newStatus}`;

    await updatePodStatus(podId);
  }
}

// ---- UPDATE POD STATUS ----
async function updatePodStatus(podId) {
  const { data: stages } = await supabaseClient.from('qc_stages').select('status').eq('pod_id', podId);
  if (!stages) return;
  const allCompleted = stages.every(s => s.status === 'completed');
  const anyFailed = stages.some(s => s.status === 'failed');
  const anyInProgress = stages.some(s => s.status === 'in_progress' || s.status === 'completed');

  let newStatus = 'pending';
  if (allCompleted) newStatus = 'completed';
  else if (anyFailed) newStatus = 'failed';
  else if (anyInProgress) newStatus = 'in_progress';

  await supabaseClient.from('pods').update({ status: newStatus }).eq('id', podId);

  if (AppState.currentPod?.id === podId) {
    AppState.currentPod.status = newStatus;
    const statusEl = document.getElementById('pod-detail-status');
    if (statusEl) {
      statusEl.textContent = STATUS_LABELS[newStatus] || newStatus;
      statusEl.className = `status-badge status-${newStatus}`;
    }
  }
}

// ---- SIGNATURE MODAL ----
function showSignatureModal(podId, stageId, stageNum, stages, stageItems, inspectorName = '') {
  pendingStageCompletion = { podId, stageId, stageNum };

  const modal = document.getElementById('signature-modal');
  modal.classList.remove('hidden');

  const nameEl = document.getElementById('sig-inspector-name');
  if (nameEl) {
    nameEl.value = AppState.currentProfile?.full_name?.trim() || AppState.currentProfile?.username || inspectorName;
    nameEl.readOnly = true;
  }

  const dateInput = document.getElementById('sig-date');
  dateInput.value = new Date().toISOString().split('T')[0];

  const canvas = document.getElementById('signature-canvas');
  if (signaturePad) signaturePad.clear();
  else {
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
  }

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
  signaturePad.clear();
}

function initSignatureModal() {
  document.getElementById('sig-clear')?.addEventListener('click', () => {
    signaturePad?.clear();
  });

  document.getElementById('sig-cancel')?.addEventListener('click', () => {
    document.getElementById('signature-modal').classList.add('hidden');
    pendingStageCompletion = null;
  });

  document.getElementById('sig-modal-close')?.addEventListener('click', () => {
    document.getElementById('signature-modal').classList.add('hidden');
    pendingStageCompletion = null;
  });

  document.getElementById('sig-confirm')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('sig-inspector-name');
    const dateEl = document.getElementById('sig-date');
    const errEl = document.getElementById('sig-error');

    errEl.classList.add('hidden');

    const inspectorName = nameEl?.value.trim();
    const inspectionDate = dateEl?.value;

    if (!inspectorName) {
      errEl.textContent = 'יש להזין שם בודק';
      errEl.classList.remove('hidden');
      return;
    }
    if (!signaturePad || signaturePad.isEmpty()) {
      errEl.textContent = 'יש לחתום בשדה החתימה';
      errEl.classList.remove('hidden');
      return;
    }

    const signature = signaturePad.toDataURL('image/png');
    const { podId, stageId, stageNum } = pendingStageCompletion;

    const { data: items } = await supabaseClient.from('qc_items').select('status').eq('stage_id', stageId);
    const anyFailed = (items || []).some(i => i.status === 'failed');

    const btn = document.getElementById('sig-confirm');
    setLoading(btn, true);

    const { error } = await supabaseClient.from('qc_stages').update({
      status: anyFailed ? 'failed' : 'completed',
      inspector_name: inspectorName,
      inspector_signature: signature,
      inspection_date: inspectionDate,
      completed_at: new Date().toISOString(),
    }).eq('id', stageId);

    setLoading(btn, false);

    if (error) { showToast('שגיאה בשמירה', 'error'); return; }

    document.getElementById('signature-modal').classList.add('hidden');
    pendingStageCompletion = null;

    showToast(`שלב ${stageNum} ${anyFailed ? 'נכשל' : 'הושלם'} ואושר!`, anyFailed ? 'warning' : 'success');
    await updatePodStatus(podId);
    await loadQCStages(podId); // Full re-render
  });
}
