// =============================================
// QC Inspection Module
// =============================================

let signaturePad = null;
let pendingStageCompletion = null;

async function loadQCStages(podId) {
  const container = document.getElementById('qc-stages-container');
  container.innerHTML = '<div class="loading-spinner" style="margin:40px auto"></div>';

  // Load or create stages
  const stages = await ensureQCStages(podId);

  // Load items for each stage
  const stageItems = {};
  for (const stage of stages) {
    const { data: items } = await supabaseClient
      .from('qc_items')
      .select('*')
      .eq('stage_id', stage.id);
    stageItems[stage.id] = items || [];
  }

  container.innerHTML = stages.map(stage =>
    renderStageCard(stage, stageItems[stage.id] || [])
  ).join('');

  // Bind events
  container.querySelectorAll('.stage-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.qc-stage-card');
      const body = card.querySelector('.stage-body');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      card.classList.toggle('stage-expanded', !isOpen);
    });
  });

  // Bind QC item controls
  if (canEdit()) {
    bindQCItemControls(podId, stages, stageItems);
  }

  // Bind stage complete buttons
  if (canEdit()) {
    container.querySelectorAll('.btn-complete-stage').forEach(btn => {
      btn.addEventListener('click', () => {
        const stageId = btn.dataset.stageId;
        const stageNum = parseInt(btn.dataset.stageNum);
        showSignatureModal(podId, stageId, stageNum, stages, stageItems);
      });
    });
  }
}

async function ensureQCStages(podId) {
  // Check existing stages
  let { data: existing } = await supabaseClient
    .from('qc_stages')
    .select('*')
    .eq('pod_id', podId)
    .order('stage_number');

  if (!existing || existing.length < 6) {
    // Create missing stages
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

async function ensureQCItems(stageId, stageNumber) {
  const stageDef = getStage(stageNumber);
  if (!stageDef) return [];

  let { data: existing } = await supabaseClient
    .from('qc_items')
    .select('*')
    .eq('stage_id', stageId);

  existing = existing || [];
  const existingKeys = existing.map(i => i.item_key);

  const toCreate = stageDef.items
    .filter(i => !existingKeys.includes(i.key))
    .map(i => ({
      stage_id: stageId,
      item_key: i.key,
      item_label: i.label,
      status: 'pending',
    }));

  if (toCreate.length > 0) {
    await supabaseClient.from('qc_items').insert(toCreate);
    const { data: refreshed } = await supabaseClient.from('qc_items').select('*').eq('stage_id', stageId);
    return refreshed || [];
  }

  return existing;
}

function renderStageCard(stage, items) {
  const stageRef = getStage(stage.stage_number);
  const totalItems = stageRef?.items.length || 0;
  const passedCount = items.filter(i => i.status === 'passed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const pendingCount = totalItems - passedCount - failedCount;
  const pct = totalItems > 0 ? Math.round(passedCount / totalItems * 100) : 0;

  const isCompleted = stage.status === 'completed';
  const isFailed = stage.status === 'failed';
  const statusClass = `stage-${stage.status}`;

  const allAnswered = items.length === totalItems && items.every(i => i.status !== 'pending');
  const hasItems = items.length > 0;

  return `
    <div class="qc-stage-card ${statusClass}" id="stage-card-${stage.id}">
      <div class="stage-header">
        <div class="stage-number">${stage.stage_number}</div>
        <div>
          <div class="stage-title">${escHtml(stage.stage_name)}</div>
          <div class="stage-progress">
            ${passedCount} עברו · ${failedCount} נכשלו · ${pendingCount} ממתינים
          </div>
        </div>
        <div style="margin-right:auto;display:flex;align-items:center;gap:12px">
          <span class="status-badge status-${stage.status}">${STATUS_LABELS[stage.status] || stage.status}</span>
          <div class="progress-bar-outer">
            <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
          </div>
          <span class="text-sm text-muted">${pct}%</span>
        </div>
        <span class="stage-toggle">▼</span>
      </div>
      <div class="stage-body" style="display:none">
        ${isCompleted || isFailed ? renderStageInspectorInfo(stage) : ''}
        <div class="qc-items-list" id="items-${stage.id}">
          ${renderQCItems(stage, items)}
        </div>
        ${canEdit() ? renderStageCompleteSection(stage, allAnswered) : ''}
      </div>
    </div>
  `;
}

function renderStageInspectorInfo(stage) {
  return `
    <div class="stage-inspector-info">
      <div class="info-item">
        <strong>בודק:</strong>
        <span>${escHtml(stage.inspector_name || '—')}</span>
      </div>
      <div class="info-item">
        <strong>תאריך:</strong>
        <span>${formatDate(stage.inspection_date)}</span>
      </div>
      ${stage.inspector_signature ? `
        <div class="info-item">
          <strong>חתימה:</strong>
          <img src="${stage.inspector_signature}" class="signed-sig-preview" alt="חתימה" />
        </div>
      ` : ''}
    </div>
  `;
}

function renderQCItems(stage, items) {
  const stageDef = getStage(stage.stage_number);
  if (!stageDef) return '';
  const readonly = !canEdit() || stage.status === 'completed';

  return stageDef.items.map(itemDef => {
    const item = items.find(i => i.item_key === itemDef.key);
    const status = item?.status || 'pending';
    const notes = item?.notes || '';
    const time1 = item?.time_entry_1 || '';
    const time2 = item?.time_entry_2 || '';
    const val = item?.value_entry || '';
    const itemId = item?.id || '';

    return `
      <div class="qc-item item-${status}" id="qc-item-${itemDef.key}-${stage.id}">
        <div class="qc-item-header">
          <div>
            <div class="qc-item-label">${escHtml(itemDef.label)}</div>
            ${itemDef.instruction ? `<div class="qc-item-instruction">💡 ${escHtml(itemDef.instruction)}</div>` : ''}
          </div>
          ${!readonly ? `
            <div class="qc-item-controls">
              <button class="qc-status-btn qc-btn-pass ${status==='passed'?'active':''}"
                data-stage-id="${stage.id}"
                data-item-key="${itemDef.key}"
                data-item-id="${itemId}"
                data-action="passed">✓ עבר</button>
              <button class="qc-status-btn qc-btn-fail ${status==='failed'?'active':''}"
                data-stage-id="${stage.id}"
                data-item-key="${itemDef.key}"
                data-item-id="${itemId}"
                data-action="failed">✗ נכשל</button>
            </div>
          ` : `
            <span class="status-badge ${status==='passed'?'status-passed':'status-failed'}">${status==='passed'?'✓ עבר':'✗ נכשל'}</span>
          `}
        </div>
        ${itemDef.hasTwoTimes && !readonly ? `
          <div class="qc-time-fields">
            <label>שעה נוכחית:</label>
            <input type="time" class="qc-time-1"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
              value="${escHtml(time1)}" />
            <label>שעה +60 דקות:</label>
            <input type="time" class="qc-time-2"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
              value="${escHtml(time2)}" />
          </div>
        ` : (itemDef.hasTwoTimes && time1) ? `
          <div class="qc-time-fields">
            <label>שעה 1:</label><span>${time1}</span>
            <label>שעה 2 (+60 דק'):</label><span>${time2 || '—'}</span>
          </div>
        ` : ''}
        ${itemDef.hasValue && !readonly ? `
          <div class="qc-time-fields">
            <label>ערך (${itemDef.unit || ''}):</label>
            <input type="number" step="0.1" class="qc-value-field"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
              value="${escHtml(val)}"
              style="width:100px" />
            ${itemDef.minValue ? `<span class="text-sm ${parseFloat(val) >= itemDef.minValue ? 'text-success' : 'text-danger'}">
              (מינימום ${itemDef.minValue} ${itemDef.unit || ''})
            </span>` : ''}
          </div>
        ` : (itemDef.hasValue && val) ? `
          <div class="qc-time-fields">
            <label>ערך:</label><span>${val} ${itemDef.unit || ''}</span>
          </div>
        ` : ''}
        ${!readonly ? `
          <div class="qc-item-notes">
            <textarea class="qc-notes-field" rows="2" placeholder="הערות..."
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
            >${escHtml(notes)}</textarea>
          </div>
        ` : (notes ? `<div class="text-sm text-muted mt-2" style="padding-top:6px">📝 ${escHtml(notes)}</div>` : '')}
      </div>
    `;
  }).join('');
}

function renderStageCompleteSection(stage, allAnswered) {
  if (stage.status === 'completed' || stage.status === 'failed') {
    return `
      <div class="stage-complete-section">
        <div style="color:var(--success);font-weight:600">
          ✓ השלב ${stage.status === 'completed' ? 'הושלם' : 'נכשל'} ואושר על ידי ${escHtml(stage.inspector_name || '')}
        </div>
      </div>
    `;
  }

  return `
    <div class="stage-complete-section">
      <h4>סיום ואישור שלב</h4>
      <p class="text-sm text-muted" style="margin-bottom:12px">
        לאחר מילוי כל הסעיפים, הזן את שמך וחתימתך לאישור השלב.
      </p>
      <button class="btn btn-primary btn-complete-stage"
        data-stage-id="${stage.id}"
        data-stage-num="${stage.stage_number}"
        ${!allAnswered ? '' : ''}>
        ✓ אשר ושלם שלב
      </button>
      ${!allAnswered ? `<div class="text-sm text-muted mt-2">⚠️ לא כל הסעיפים מולאו עדיין</div>` : ''}
    </div>
  `;
}

function bindQCItemControls(podId, stages, stageItems) {
  const container = document.getElementById('qc-stages-container');

  // Status buttons
  container.querySelectorAll('.qc-status-btn').forEach(btn => {
    btn.addEventListener('click', () => handleItemStatusChange(btn, podId, stages));
  });

  // Notes
  let notesTimers = {};
  container.querySelectorAll('.qc-notes-field').forEach(field => {
    field.addEventListener('input', () => {
      const key = field.dataset.itemKey + field.dataset.stageId;
      clearTimeout(notesTimers[key]);
      notesTimers[key] = setTimeout(() => saveItemField(field, 'notes', field.value, podId), 800);
    });
  });

  // Time fields
  container.querySelectorAll('.qc-time-1').forEach(field => {
    field.addEventListener('change', () => saveItemField(field, 'time_entry_1', field.value, podId));
  });
  container.querySelectorAll('.qc-time-2').forEach(field => {
    field.addEventListener('change', () => saveItemField(field, 'time_entry_2', field.value, podId));
  });

  // Value fields
  container.querySelectorAll('.qc-value-field').forEach(field => {
    field.addEventListener('change', () => saveItemField(field, 'value_entry', field.value, podId));
  });
}

async function handleItemStatusChange(btn, podId, stages) {
  const stageId = btn.dataset.stageId;
  const itemKey = btn.dataset.itemKey;
  const itemId = btn.dataset.itemId;
  const action = btn.dataset.action; // 'passed' or 'failed'

  // Toggle: if already active, set to pending
  const newStatus = btn.classList.contains('active') ? 'pending' : action;

  // Update UI optimistically
  const itemContainer = btn.closest('.qc-item');
  itemContainer.className = `qc-item item-${newStatus}`;
  itemContainer.querySelectorAll('.qc-status-btn').forEach(b => b.classList.remove('active'));
  if (newStatus !== 'pending') btn.classList.add('active');

  // Save to DB
  if (itemId) {
    await supabaseClient.from('qc_items').update({ status: newStatus }).eq('id', itemId);
  } else {
    const stageDef = getStage(stages.find(s => s.id === stageId)?.stage_number);
    const itemDef = stageDef?.items.find(i => i.key === itemKey);
    const { data } = await supabaseClient.from('qc_items').insert({
      stage_id: stageId, item_key: itemKey, item_label: itemDef?.label || itemKey, status: newStatus,
    }).select().single();
    if (data) btn.dataset.itemId = data.id;
  }

  // Update stage status
  await updateStageStatus(stageId, podId, stages);
}

async function saveItemField(field, fieldName, value, podId) {
  const stageId = field.dataset.stageId;
  const itemKey = field.dataset.itemKey;
  const itemId = field.dataset.itemId;

  if (itemId) {
    await supabaseClient.from('qc_items').update({ [fieldName]: value }).eq('id', itemId);
  }
}

async function updateStageStatus(stageId, podId, stages) {
  const { data: items } = await supabaseClient.from('qc_items').select('status').eq('stage_id', stageId);
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return;

  const stageDef = getStage(stage.stage_number);
  const total = stageDef?.items.length || 0;
  const answered = (items || []).filter(i => i.status !== 'pending').length;
  const failed = (items || []).filter(i => i.status === 'failed').length;

  let newStatus = 'pending';
  if (answered > 0 && answered < total) newStatus = 'in_progress';
  if (answered === total && failed === 0) newStatus = 'in_progress'; // still needs sign-off
  if (failed > 0) newStatus = 'in_progress';

  if (stage.status !== 'completed' && stage.status !== 'failed') {
    await supabaseClient.from('qc_stages').update({ status: newStatus }).eq('id', stageId);
    // Update pod status
    await updatePodStatus(podId);
  }

  // Update progress display
  const card = document.getElementById(`stage-card-${stageId}`);
  if (card && items) {
    const passed = items.filter(i => i.status === 'passed').length;
    const failedC = items.filter(i => i.status === 'failed').length;
    const pending = total - passed - failedC;
    const pct = total > 0 ? Math.round(passed / total * 100) : 0;
    const progressEl = card.querySelector('.stage-progress');
    const pbarEl = card.querySelector('.progress-bar-inner');
    const pctEl = card.querySelector('.stage-progress + div span.text-muted, .text-sm.text-muted');
    if (progressEl) progressEl.textContent = `${passed} עברו · ${failedC} נכשלו · ${pending} ממתינים`;
    if (pbarEl) { pbarEl.style.width = pct + '%'; pbarEl.classList.toggle('full', pct===100); }
  }
}

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

  // Update UI badge
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
function showSignatureModal(podId, stageId, stageNum, stages, stageItems) {
  pendingStageCompletion = { podId, stageId, stageNum };

  const modal = document.getElementById('signature-modal');
  modal.classList.remove('hidden');

  // Set today's date
  const dateInput = document.getElementById('sig-date');
  dateInput.value = new Date().toISOString().split('T')[0];

  // Init signature pad
  const canvas = document.getElementById('signature-canvas');
  if (signaturePad) signaturePad.clear();
  else {
    signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255,255,255)',
    });
  }

  // Resize canvas
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

    // Check if any items failed to determine stage status
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
    await loadQCStages(podId); // Refresh
  });
}
