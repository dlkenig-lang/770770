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
let _qcCastingApproved = false;
let _castingBaseApproved = false; // never resets once set; used to lock casting items 1-6

const STAGE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Keys of Stage A items that must all pass before casting approval (items 1–7).
// Edit this list when adding/removing casting-check items from Stage A in qc-data.js.
const CASTING_ITEM_KEYS = ['length_dims', 'width_dims', 'pipe_slope', 'pipe_fixation', 'drainage_channel', 'lifting_bolts', 'shower_parallel'];

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

  // The qc-images bucket is private: swap stored URLs for fresh signed URLs
  // (1h expiry) so thumbnails keep working. Falls back to the stored URL for
  // legacy rows without a storage path.
  await signQcImageUrls(Object.values(_qcStageItems).flat());

  _qcCastingApproved = AppState.currentPod?.casting_approved || false;
  if (_qcCastingApproved) _castingBaseApproved = true;

  // If Stage A is already signed (completed/failed), unlock downstream stages
  // even if casting_approved flag was never explicitly set on the pod
  const stageA = _qcStages.find(s => s.stage_number === 1);
  if (stageA?.status === 'completed' || stageA?.status === 'failed') {
    _castingBaseApproved = true;
  }

  renderQCTabsUI();
}

// Replace item.image_url with a signed URL for every item that has a
// storage path (bucket is private since 20260712010000).
async function signQcImageUrls(items) {
  const withImages = (items || []).filter(i => i.image_storage_path);
  if (!withImages.length) return;
  try {
    const paths = withImages.map(i => i.image_storage_path);
    const { data: signed } = await supabaseClient.storage
      .from('qc-images').createSignedUrls(paths, 3600);
    const urlByPath = {};
    (signed || []).forEach(s => { if (s.signedUrl) urlByPath[s.path] = s.signedUrl; });
    withImages.forEach(i => {
      if (urlByPath[i.image_storage_path]) i.image_url = urlByPath[i.image_storage_path];
    });
  } catch (e) {
    console.warn('[signQcImageUrls] failed, falling back to stored URLs:', e);
  }
}

function renderQCTabsUI() {
  // Comments alert banner
  const alertEl = document.getElementById('pod-comments-alert');
  if (alertEl) {
    const pod = AppState.currentPod;
    const unresolved = (pod?.comments || []).filter(c => !c.is_resolved);
    const flagged = unresolved.filter(c => c.is_flagged);
    if (unresolved.length > 0) {
      const hasFlagged = flagged.length > 0;
      alertEl.innerHTML = `
        <div class="pod-comments-alert-banner ${hasFlagged ? 'alert-flagged' : 'alert-normal'}">
          <span class="alert-icon">${hasFlagged ? '🚩' : '💬'}</span>
          <span class="alert-text">
            ${hasFlagged
              ? (flagged.length > 1 ? t('qc.commentsFlaggedMany', { n: flagged.length }) : t('qc.commentsFlaggedOne'))
              : t('qc.commentsOpen', { n: unresolved.length })}
          </span>
          <button class="btn btn-sm alert-btn" onclick="showCommentsModal('${pod.id}')">${t('qc.viewComments')}</button>
        </div>`;
    } else {
      alertEl.innerHTML = '';
    }
  }

  const completedStages = _qcStages.filter(s => s.status === 'completed').length;
  const totalStages = _qcStages.length;
  const pct = totalStages > 0 ? Math.round(completedStages / totalStages * 100) : 0;
  const podProgressEl = document.getElementById('pod-progress-bar');
  if (podProgressEl) {
    podProgressEl.innerHTML = `
      <div class="page-progress-header">
        <span class="page-progress-label">${t('qc.podProgress', { done: completedStages, total: totalStages })}</span>
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
          <span class="qc-tab-name">${escHtml(qcStageName(stage.stage_number))}</span>
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
          <div class="qc-stage-panel-title">${t('qc.stage')} ${letter} – ${escHtml(qcStageName(stage.stage_number))}</div>
          ${stage.inspection_date ? `<div class="qc-stage-panel-subtitle">📅 ${formatDate(stage.inspection_date)}</div>` : ''}
        </div>
        <span class="status-badge status-${stage.status}">${STATUS_LABELS[stage.status] || stage.status}</span>
      </div>
      ${pod?.projects?.pipe_type ? `
        <div class="qc-pipe-type-bar">${t('qc.pipeType')} <strong>${escHtml(pod.projects.pipe_type)}</strong></div>
      ` : ''}
      ${!_castingBaseApproved && stage.stage_number > 1 ? `
        <div class="qc-casting-block-banner">
          ${t('qc.lockedBanner')}
        </div>
      ` : ''}
      <div class="qc-items-table-wrapper">
        <table class="qc-items-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>${t('qc.colItem')}</th>
              <th style="width:72px;text-align:center">${t('qc.colPass')}</th>
              <th style="width:72px;text-align:center">${t('qc.colFail')}</th>
              <th>${t('qc.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            ${(stageRef?.items || []).map((itemDef, rowIdx) => {
              const isCastingItem = CASTING_ITEM_KEYS.includes(itemDef.key);
              // Lock all non-casting items until casting is approved
              const lockedPreCasting = !_castingBaseApproved && !(stage.stage_number === 1 && isCastingItem);
              // Lock casting items 1-6 once approved
              const lockedByCasting = _castingBaseApproved && stage.stage_number === 1 && isCastingItem;
              return renderQCTableRow(itemDef, rowIdx, stage, items, readonly || lockedPreCasting || lockedByCasting);
            }).join('')}
          </tbody>
        </table>
      </div>
      ${renderInspectorSection(stage)}
      <div class="qc-stage-nav-row">
        ${_activeStageIdx > 0
          ? `<button class="btn btn-secondary btn-stage-nav" data-idx="${_activeStageIdx - 1}">${t('qc.prevStage')}</button>`
          : '<div></div>'}
        <div class="text-sm text-muted">${t('qc.stageSummary', { passed, total, failed })}</div>
        ${_activeStageIdx < _qcStages.length - 1
          ? `<button class="btn btn-primary btn-stage-nav" data-idx="${_activeStageIdx + 1}">${t('qc.nextStage')}</button>`
          : '<div></div>'}
      </div>
      ${canEdit() ? `
        <div class="qc-admin-actions">
          <button class="btn btn-ghost btn-sm btn-edit-stage" data-stage-id="${stage.id}">
            ${t('qc.editForm')}
          </button>
          <button class="btn btn-ghost btn-sm btn-clear-stage" data-stage-id="${stage.id}">
            ${t('qc.clearForm')}
          </button>
        </div>
      ` : ''}
      <div class="qc-share-row">
        <button class="btn btn-ghost btn-sm btn-share-stage" data-stage-idx="${_activeStageIdx}">
          ${t('qc.shareStagePage')}
        </button>
      </div>
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

    content.querySelectorAll('.qc-img-input').forEach(input => {
      input.addEventListener('change', () => uploadQcImage(input));
    });

    content.querySelectorAll('.qc-img-del').forEach(btn => {
      btn.addEventListener('click', () => deleteQcImage(btn));
    });

    content.querySelectorAll('.btn-complete-stage').forEach(btn => {
      btn.addEventListener('click', () => {
        const nameEl = document.getElementById(`qc-inspector-name-${btn.dataset.stageId}`);
        const name = nameEl?.value.trim() || '';
        const warningsEl = document.getElementById(`qc-stage-warnings-${btn.dataset.stageId}`);
        const warnings = [];
        if (!name) warnings.push(t('qc.needInspectorName'));
        if (warningsEl) {
          warningsEl.innerHTML = warnings.map(w => `<div class="qc-warning-msg">⚠️ ${w}</div>`).join('');
        }
        if (!name) return;
        showSignatureModal(_qcPodId, btn.dataset.stageId, parseInt(btn.dataset.stageNum), _qcStages, _qcStageItems, name);
      });
    });
  }

  // Image thumbnails — clickable for all roles
  content.querySelectorAll('.qc-img-thumb').forEach(img => {
    img.addEventListener('click', () => openImageLightbox(img.dataset.url));
  });

  // Admin actions (always visible to admin/PM)
  content.querySelectorAll('.btn-clear-stage').forEach(btn => {
    btn.addEventListener('click', () => clearStage(btn.dataset.stageId));
  });
  content.querySelectorAll('.btn-edit-stage').forEach(btn => {
    btn.addEventListener('click', () => editStage(btn.dataset.stageId));
  });

  // Share button
  content.querySelectorAll('.btn-share-stage').forEach(btn => {
    btn.addEventListener('click', () => openShareStageModal(parseInt(btn.dataset.stageIdx)));
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
  const imageUrl = item?.image_url || '';
  const imagePath = item?.image_storage_path || '';

  return `
    <tr class="qc-table-row qc-row-${status}" id="qc-row-${itemDef.key}-${stage.id}">
      <td class="qc-row-num">${rowIdx + 1}</td>
      <td class="qc-row-label">
        <div class="qc-row-label-text">${escHtml(qcItemLabel(itemDef))}</div>
        ${qcItemInstruction(itemDef) ? `<div class="qc-row-instruction">💡 ${escHtml(qcItemInstruction(itemDef))}</div>` : ''}
        ${itemDef.hasTwoTimes && !readonly ? `
          <div class="qc-time-inline">
            <label>${t('qc.time')}</label>
            <input type="time" class="qc-time-1 qc-time-input" value="${escHtml(time1)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
            <label>+60:</label>
            <input type="time" class="qc-time-2 qc-time-input" value="${escHtml(time2)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
          </div>
        ` : (itemDef.hasTwoTimes && time1 ? `<div class="qc-row-instruction">⏰ ${time1}${time2 ? ' → ' + time2 : ''}</div>` : '')}
        ${itemDef.hasValue && !readonly ? `
          <div class="qc-time-inline">
            <label>${t('qc.value')} (${qcItemUnit(itemDef)}):</label>
            <input type="number" step="0.1" class="qc-value-field qc-time-input" style="width:80px"
              value="${escHtml(val)}"
              data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}" />
            ${itemDef.minValue ? `<span class="text-sm ${parseFloat(val) >= itemDef.minValue ? 'text-success' : 'text-danger'}">${t('qc.min', { min: itemDef.minValue })}</span>` : ''}
          </div>
        ` : (itemDef.hasValue && val ? `<div class="qc-row-instruction">📊 ${val} ${qcItemUnit(itemDef)}</div>` : '')}
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
          <textarea class="qc-notes-inline" rows="1" placeholder="${t('qc.notesPlaceholder')}"
            data-stage-id="${stage.id}" data-item-key="${itemDef.key}" data-item-id="${itemId}"
          >${escHtml(notes)}</textarea>
          <div class="qc-img-row">
            <label class="btn-img-upload" title="${t('qc.addImage')}">
              📷
              <input type="file" accept="image/*" class="qc-img-input" hidden
                data-item-id="${itemId}" data-stage-id="${stage.id}" data-item-key="${itemDef.key}" />
            </label>
            ${imageUrl ? `
              <div class="qc-img-thumb-wrap">
                <img src="${imageUrl}" class="qc-img-thumb" alt="${t('qc.image')}" data-url="${escHtml(imageUrl)}" />
                <button type="button" class="qc-img-del" data-item-id="${itemId}" data-storage-path="${escHtml(imagePath)}">✕</button>
              </div>
            ` : ''}
          </div>
        ` : `
          ${notes ? `<span class="text-sm text-muted">${escHtml(notes)}</span>` : ''}
          ${imageUrl ? `<img src="${imageUrl}" class="qc-img-thumb qc-img-thumb--readonly" alt="${t('qc.image')}" data-url="${escHtml(imageUrl)}" style="margin-top:4px;display:block" />` : ''}
        `}
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
          ${stage.inspector_signature ? `<img src="${stage.inspector_signature}" class="signed-sig-preview" alt="${t('qc.signature')}" />` : ''}
        </div>
        <div class="text-sm mt-2" style="color:${stage.status === 'completed' ? 'var(--success)' : 'var(--danger)'}">
          ${stage.status === 'completed' ? t('qc.stageCompletedApproved') : t('qc.stageFailedApproved')}
        </div>
      </div>
    `;
  }
  if (!canEdit()) return '';
  return `
    <div class="qc-inspector-bar" id="qc-inspector-bar-${stage.id}">
      <div class="qc-inspector-fields">
        <div class="qc-inspector-field">
          <label>${t('qc.inspectorName')}</label>
          <input type="text" id="qc-inspector-name-${stage.id}" class="form-control"
            style="max-width:220px" readonly
            value="${escHtml(stage.inspector_name || AppState.currentProfile?.full_name || AppState.currentProfile?.username || '')}" />
        </div>
        <div class="qc-inspector-field" style="align-self:flex-end">
          <button class="btn btn-primary btn-complete-stage"
            data-stage-id="${stage.id}" data-stage-num="${stage.stage_number}">
            ${t('qc.signApprove')}
          </button>
        </div>
      </div>
      <div id="qc-stage-warnings-${stage.id}" class="qc-stage-warnings"></div>
    </div>
  `;
}

// ---- CLEAR STAGE ----
async function clearStage(stageId) {
  if (!confirm(t('qc.confirmClear'))) return;

  // Remove uploaded images from storage before wiping their references
  const imagePaths = (_qcStageItems[stageId] || [])
    .map(i => i.image_storage_path).filter(Boolean);
  if (imagePaths.length) {
    await supabaseClient.storage.from('qc-images').remove(imagePaths);
  }

  // Reset all items for this stage (including image references)
  await supabaseClient.from('qc_items').update({
    status: 'pending', notes: null, time_entry_1: null, time_entry_2: null, value_entry: null,
    image_url: null, image_storage_path: null,
  }).eq('stage_id', stageId);

  // Reset the stage itself
  await supabaseClient.from('qc_stages').update({
    status: 'pending',
    inspector_name: null,
    inspector_signature: null,
    inspection_date: null,
    completed_at: null,
  }).eq('id', stageId);

  // If clearing stage A, also reset casting approval
  const clearedStage = _qcStages.find(s => s.id === stageId);
  if (clearedStage?.stage_number === 1) {
    await supabaseClient.from('pods').update({
      casting_approved: false,
      casting_approved_at: null,
    }).eq('id', _qcPodId);
    _qcCastingApproved = false;
    _castingBaseApproved = false;
    if (AppState.currentPod) {
      AppState.currentPod.casting_approved = false;
    }
    const castingBadge = document.getElementById('pod-casting-badge');
    if (castingBadge) castingBadge.style.display = 'none';
  }

  showToast(t('qc.stageCleared'), 'success');
  await updatePodStatus(_qcPodId);
  await loadQCStages(_qcPodId);
}

// ---- EDIT STAGE (unlock without clearing data) ----
async function editStage(stageId) {
  const stage = _qcStages.find(s => s.id === stageId);
  if (!stage) return;
  if (stage.status !== 'completed' && stage.status !== 'failed') {
    showToast(t('qc.stageAlreadyOpen'), 'success');
    return;
  }
  if (!confirm(t('qc.confirmEdit'))) return;

  await supabaseClient.from('qc_stages').update({
    status: 'in_progress',
    inspector_name: null,
    inspector_signature: null,
    inspection_date: null,
    completed_at: null,
  }).eq('id', stageId);

  showToast(t('qc.stageReopened'), 'success');
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
  await checkCastingApprovalTrigger(stageId, itemKey);

  // If one of the post-casting items (7-9) in stage A is answered, remove casting approval
  const postCastingKeys = ['segregation', 'drainage_test'];
  const stageForItem = _qcStages.find(s => s.id === stageId);
  if (
    _qcCastingApproved &&
    stageForItem?.stage_number === 1 &&
    postCastingKeys.includes(itemKey) &&
    newStatus !== 'pending'
  ) {
    await supabaseClient.from('pods').update({
      casting_approved: false,
      casting_approved_at: null,
    }).eq('id', _qcPodId);
    _qcCastingApproved = false;
    if (AppState.currentPod) AppState.currentPod.casting_approved = false;
    const castingBadge = document.getElementById('pod-casting-badge');
    if (castingBadge) castingBadge.style.display = 'none';
    showToast(t('qc.podRemovedFromCasting'), 'warning');
  }
}

// ---- CASTING APPROVAL TRIGGER ----
async function checkCastingApprovalTrigger(stageId, itemKey) {
  if (_qcCastingApproved || _castingBaseApproved) return;
  const stage = _qcStages.find(s => s.id === stageId);
  if (!stage || stage.stage_number !== 1) return;

  if (!CASTING_ITEM_KEYS.includes(itemKey)) return;
  const stageItems = _qcStageItems[stageId] || [];
  const allPassed = CASTING_ITEM_KEYS.every(key => {
    const item = stageItems.find(i => i.item_key === key);
    return item?.status === 'passed';
  });

  if (!allPassed) return;

  const confirmed = confirm(t('qc.confirmCastingApproval'));
  if (!confirmed) return;

  const { error } = await supabaseClient.from('pods').update({
    casting_approved: true,
    casting_approved_at: new Date().toISOString(),
  }).eq('id', _qcPodId);

  if (error) { showToast(t('qc.castingSaveError'), 'error'); return; }

  _qcCastingApproved = true;
  _castingBaseApproved = true;
  if (AppState.currentPod) AppState.currentPod.casting_approved = true;
  showToast(t('qc.podCastingApproved'), 'success');

  // Update casting badge in pod header if visible
  const castingBadge = document.getElementById('pod-casting-badge');
  if (castingBadge) castingBadge.style.display = '';
}

// ---- SAVE ITEM FIELD ----
// The qc_items row is normally created on the first ✓/✗ click. If the user
// types notes / times / values BEFORE marking pass/fail, create the row on
// the fly — otherwise the input is silently lost.
async function saveItemField(field, fieldName, value, podId) {
  const itemId = field.dataset.itemId;
  const stageId = field.dataset.stageId;
  const itemKey = field.dataset.itemKey;

  if (itemId) {
    await supabaseClient.from('qc_items').update({ [fieldName]: value }).eq('id', itemId);
  } else {
    const stage = _qcStages.find(s => s.id === stageId);
    const stageDef = getStage(stage?.stage_number);
    const itemDef = stageDef?.items.find(i => i.key === itemKey);
    // upsert: safe against a concurrent ✓/✗ click creating the same row
    const { data, error } = await supabaseClient.from('qc_items').upsert({
      stage_id: stageId,
      item_key: itemKey,
      item_label: itemDef?.label || itemKey,
      [fieldName]: value,
    }, { onConflict: 'stage_id,item_key' }).select().single();
    if (error) {
      console.error('[saveItemField] create error:', error);
      showToast(t('qc.saveError'), 'error');
      return;
    }
    if (data) {
      const row = document.getElementById(`qc-row-${itemKey}-${stageId}`);
      row?.querySelectorAll('[data-item-id]').forEach(el => el.dataset.itemId = data.id);
      if (!_qcStageItems[stageId]) _qcStageItems[stageId] = [];
      if (!_qcStageItems[stageId].some(i => i.item_key === itemKey)) {
        _qcStageItems[stageId].push(data);
      }
    }
  }

  // Keep the in-memory cache in sync so tab switches don't lose the value
  const cachedItem = (_qcStageItems[stageId] || []).find(i => i.item_key === itemKey);
  if (cachedItem) cachedItem[fieldName] = value;
}

// ---- SHARE STAGE MODAL ----
async function openShareStageModal(stageIdx) {
  const stage = _qcStages[stageIdx];
  const stageRef = QC_STAGES[stageIdx];
  const letter = STAGE_LETTERS[stageIdx] || (stageIdx + 1);
  const stageName = `${t('qc.stage')} ${letter} – ${qcStageName(stage?.stage_number ?? stageRef?.number) || ''}`;

  // Fetch active users with email
  const { data: users } = await supabaseClient
    .from('profiles')
    .select('id, full_name, username, email')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  const modal = document.getElementById('share-stage-modal');
  document.getElementById('share-stage-title').textContent = stageName;

  const sel = document.getElementById('share-user-select');
  sel.innerHTML = `<option value="">${t('qc.selectUser')}</option>`;
  (users || []).forEach(u => {
    if (!u.email) return;
    const opt = document.createElement('option');
    opt.value = u.email;
    opt.textContent = `${u.full_name || u.username} (${u.email})`;
    sel.appendChild(opt);
  });

  document.getElementById('share-note-text').value = '';

  // Store stage info for send action
  modal.dataset.stageIdx = stageIdx;
  modal.dataset.stageName = stageName;
  modal.classList.remove('hidden');
}

function sendShareEmail() {
  const modal = document.getElementById('share-stage-modal');
  const toEmail = document.getElementById('share-user-select').value;
  const note = document.getElementById('share-note-text').value.trim();
  const stageName = modal.dataset.stageName;
  const stageIdx = modal.dataset.stageIdx;

  if (!toEmail) {
    alert(t('qc.pleaseSelectUser'));
    return;
  }

  // Use pod-only URL (no & in query string) so email clients detect it as a hyperlink
  const podUrl = `${window.location.origin}${window.location.pathname}?pod=${_qcPodId}`;
  const podCode = AppState.currentPod?.pod_code || '';
  const subject = encodeURIComponent(`${t('qc.emailShare')}: ${stageName}${podCode ? ` [${podCode}]` : ''}`);
  const body = encodeURIComponent(
    `${t('qc.emailGreeting')}\n\n${t('qc.emailBodyLine', { stage: stageName })}${podCode ? `\n${t('qc.emailPod')}: ${podCode}` : ''}\n\n${podUrl}` +
    (note ? `\n\n${t('qc.emailNote', { note })}` : '') +
    `\n\n${t('qc.emailSignature')}`
  );

  window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
  modal.classList.add('hidden');
}

// ---- IMAGE LIGHTBOX ----
function openImageLightbox(url) {
  const existing = document.getElementById('img-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'img-lightbox';
  lb.innerHTML = `<img src="${url}" alt="${t('qc.image')}" />`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// ---- QC IMAGE UPLOAD / DELETE ----
async function uploadQcImage(input) {
  const file = input.files[0];
  if (!file) return;
  const itemId = input.dataset.itemId;
  if (!itemId) { showToast(t('qc.saveItemFirst'), 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast(t('qc.fileTooLarge'), 'error'); return; }

  showToast(t('qc.uploadingImage'), 'info');
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `${itemId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabaseClient.storage.from('qc-images').upload(storagePath, file);
  if (upErr) { showToast(t('qc.uploadError') + upErr.message, 'error'); return; }

  // Bucket is private — the stored URL is a legacy fallback; display uses a signed URL
  const { data: { publicUrl } } = supabaseClient.storage.from('qc-images').getPublicUrl(storagePath);
  await supabaseClient.from('qc_items').update({ image_url: publicUrl, image_storage_path: storagePath }).eq('id', itemId);

  let displayUrl = publicUrl;
  try {
    const { data: signed } = await supabaseClient.storage.from('qc-images').createSignedUrl(storagePath, 3600);
    if (signed?.signedUrl) displayUrl = signed.signedUrl;
  } catch (e) { /* fall back to stored URL */ }

  // Keep the in-memory cache in sync so tab switches keep showing the image
  const stageId = input.dataset.stageId;
  const cachedItem = (_qcStageItems[stageId] || []).find(i => i.id === itemId || i.item_key === input.dataset.itemKey);
  if (cachedItem) {
    cachedItem.image_url = displayUrl;
    cachedItem.image_storage_path = storagePath;
  }

  // Update UI
  const row = input.closest('.qc-img-row');
  row.querySelector('.qc-img-thumb-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'qc-img-thumb-wrap';
  wrap.innerHTML = `
    <img src="${displayUrl}" class="qc-img-thumb" alt="${t('qc.image')}" data-url="${displayUrl}" />
    <button type="button" class="qc-img-del" data-item-id="${itemId}" data-storage-path="${storagePath}">✕</button>
  `;
  wrap.querySelector('.qc-img-thumb').addEventListener('click', (e) => window.open(e.target.dataset.url, '_blank'));
  wrap.querySelector('.qc-img-del').addEventListener('click', (e) => deleteQcImage(e.currentTarget));
  row.appendChild(wrap);

  input.value = '';
  showToast(t('qc.imageUploaded'), 'success');
}

async function deleteQcImage(btn) {
  if (!confirm(t('qc.confirmDeleteImage'))) return;
  const itemId = btn.dataset.itemId;
  const storagePath = btn.dataset.storagePath;

  await supabaseClient.from('qc_items').update({ image_url: null, image_storage_path: null }).eq('id', itemId);
  if (storagePath) await supabaseClient.storage.from('qc-images').remove([storagePath]);

  // Keep the in-memory cache in sync so tab switches don't resurrect the thumb
  Object.values(_qcStageItems).flat().forEach(i => {
    if (i.id === itemId) { i.image_url = null; i.image_storage_path = null; }
  });

  btn.closest('.qc-img-thumb-wrap').remove();
  showToast(t('qc.imageDeleted'), 'success');
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

    // Block B+ stages if casting_approved but stage A not completed
    if (pendingStageCompletion.stageNum > 1) {
      const stageA = _qcStages.find(s => s.stage_number === 1);
      if (stageA && stageA.status !== 'completed' && _qcCastingApproved) {
        errEl.textContent = t('qc.cannotApproveStage');
        errEl.classList.remove('hidden');
        return;
      }
    }

    if (!inspectorName) {
      errEl.textContent = t('qc.needInspectorName');
      errEl.classList.remove('hidden');
      return;
    }
    if (!signaturePad || signaturePad.isEmpty()) {
      errEl.textContent = t('qc.needSignature');
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

    if (error) { showToast(t('qc.saveError'), 'error'); return; }

    document.getElementById('signature-modal').classList.add('hidden');
    pendingStageCompletion = null;

    showToast(anyFailed ? t('qc.stageFailedToast', { n: stageNum }) : t('qc.stageCompletedToast', { n: stageNum }), anyFailed ? 'warning' : 'success');
    await updatePodStatus(podId);
    await loadQCStages(podId); // Full re-render
  });
}
