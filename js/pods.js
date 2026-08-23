// =============================================
// Pod Detail & Barcode Module
// =============================================

let currentPodId = null;

async function openPod(podId) {
  currentPodId = podId;

  const { data: pod, error } = await supabaseClient
    .from('pods')
    .select(`
      *,
      projects(*),
      project_types(*),
      type_directions(direction),
      production_groups(name, max_pods),
      qc_stages(stage_number, status),
      comments(id, is_resolved, is_flagged)
    `)
    .eq('id', podId)
    .single();

  if (error || !pod) { showToast(t('pod.loadError'), 'error'); return; }

  AppState.currentPod = pod;
  // 'projects(*)' above (not an explicit column list) keeps this query working
  // before the 20260803 migration adds product_type — it just comes back
  // undefined and podProductType() falls back to 'pod'.
  const isPanel = podProductType(pod) === 'medical_panel';

  // Delivery destination — fetched separately and never as an embed on the pod
  // query: before migration 20260824000000 the table and the FK do not exist,
  // and an embed would fail the whole query and break the pod screen. Without
  // the column `destination_id` is simply undefined and no lookup happens.
  let podDest = null;
  if (pod.destination_id) {
    const { data: d } = await supabaseClient
      .from('pod_destinations').select('*').eq('id', pod.destination_id).maybeSingle();
    podDest = d || null;
  }

  // Fetch groups for all users — needed for group label in barcode/PDF.
  // Panels have no production groups.
  let groups = [];
  if (!isPanel) {
    const { data: g } = await supabaseClient
      .from('production_groups')
      .select('id, name, max_pods')
      .eq('project_id', pod.projects.id)
      .order('name');
    groups = sortGroupsByOption(g || []);
  }

  document.getElementById('pod-detail-code').textContent = pod.pod_code;
  const statusEl = document.getElementById('pod-detail-status');
  statusEl.textContent = STATUS_LABELS[pod.status] || pod.status;
  statusEl.className = `status-badge status-${pod.status}`;

  // The badge says "waiting to be cast", so it follows podAwaitingCasting and
  // not the raw flag — a pod already past the casting gate keeps the flag but
  // is no longer on the casting list. loadQCStages refreshes it from the stage
  // rows it loads.
  const castingBadge = document.getElementById('pod-casting-badge');
  if (castingBadge) {
    castingBadge.style.display = (!isPanel && podAwaitingCasting(pod)) ? '' : 'none';
  }

  const selGroupIdx = groups.findIndex(g => g.id === pod.group_id);
  const dotColor = selGroupIdx >= 0 ? GROUP_COLORS[selGroupIdx % GROUP_COLORS.length] : '';
  const groupLetter = selGroupIdx >= 0 ? String.fromCharCode(65 + selGroupIdx) : '';
  AppState.currentPodGroupLabel = pod.production_groups?.name || '';

  const groupCell = `
    <div class="info-item">
      <div class="info-label">${t('proj.group')}</div>
      <div class="info-value" style="display:flex;align-items:center;gap:6px">
        <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${dotColor || 'transparent'};${dotColor ? '' : 'border:1px solid var(--border)'}"></span>
        <span style="font-weight:700;font-size:15px;color:var(--primary)">${escHtml(AppState.currentPodGroupLabel || pod.production_groups?.name || '—')}</span>
      </div>
    </div>
  `;

  document.getElementById('pod-info-bar').innerHTML = `
    <div class="info-item">
      <div class="info-label">${t('pod.projectLabel')}</div>
      <div class="info-value">${escHtml(pod.projects?.name || '')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${isPanel ? t('proj.model') : t('proj.type')}</div>
      <div class="info-value">${escHtml(typeLabel(pod.project_types))}</div>
    </div>
    ${isPanel ? '' : `
    <div class="info-item">
      <div class="info-label">${t('proj.direction')}</div>
      <div class="info-value">${pod.type_directions?.direction || ''}</div>
    </div>`}
    <div class="info-item">
      <div class="info-label">${t('pod.dimensions')}</div>
      <div class="info-value">${escHtml(pod.project_types?.dimensions || '—')}</div>
    </div>
    ${isPanel ? '' : groupCell}
    ${isPanel ? '' : `
    <div class="info-item">
      <div class="info-label">${t('proj.pipeType')}</div>
      <div class="info-value">${escHtml(pod.projects?.pipe_type || '—')}</div>
    </div>`}
    <div class="info-item">
      <div class="info-label">${t('pod.destination')}</div>
      <div class="info-value">${podDest ? escHtml(destAddressLabel(podDest)) : '—'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${t('pod.inspectionStarted')}</div>
      <div class="info-value">${pod.inspection_started_at ? formatDate(pod.inspection_started_at.split('T')[0]) : '—'}</div>
    </div>
  `;

  showView('pod-detail');

  // Unresolved-comments notice is rendered once by renderQCTabsUI (qc.js)
  // into #pod-comments-alert — a second banner here duplicated it.
  document.getElementById('pod-unresolved-banner')?.remove();

  await loadQCStages(podId);
}

// ---- BARCODE ----
function showBarcodeModal(podCode, groupLabel = '') {
  const modal = document.getElementById('barcode-modal');
  const display = document.getElementById('barcode-display');
  const codeEl = document.getElementById('barcode-pod-code');

  display.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'barcode-svg-' + Date.now();
  display.appendChild(svg);

  try {
    JsBarcode(svg, podCode, {
      format: 'CODE128',
      width: 2, height: 80,
      displayValue: false,
      margin: 10,
    });
  } catch (e) {
    display.innerHTML = `<div style="color:var(--danger)">${t('pod.barcodeError')}</div>`;
  }

  codeEl.textContent = podCode;
  const groupLabelEl = document.getElementById('barcode-group-label');
  if (groupLabelEl) {
    groupLabelEl.textContent = groupLabel || '';
    groupLabelEl.style.display = groupLabel ? '' : 'none';
  }
  modal.classList.remove('hidden');

  document.getElementById('btn-print-barcode').onclick = () => {
    // Re-render SVG for print with optimal dimensions
    const scratch = document.createElement('div');
    scratch.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;';
    document.body.appendChild(scratch);
    const psvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scratch.appendChild(psvg);
    try {
      JsBarcode(psvg, podCode, { format: 'CODE128', width: 3, height: 110, displayValue: false, margin: 0 });
      // Let the barcode stretch to fill the print area vertically (equal margins).
      psvg.setAttribute('preserveAspectRatio', 'none');
    } catch (e) { /* ignore */ }
    const svgHtml = psvg.outerHTML;
    document.body.removeChild(scratch);

    // Print area 145mm (14.5cm) wide, 57.2mm tall (proportional to the original
    // 142×56 layout), centered on the page with an equal 5mm (0.5cm) margin on
    // all four sides. The barcode fills the remaining height so the top/bottom
    // margins match the sides instead of leaving extra white space.
    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:155mm 67.2mm;margin:0}
      html,body{width:155mm;height:67.2mm;overflow:hidden;background:#fff;font-family:monospace}
      body{display:flex;align-items:center;justify-content:center}
      .content{
        width:145mm;height:57.2mm;
        display:flex;flex-direction:column;align-items:stretch;gap:2mm;
      }
      .bw{flex:1 1 auto;min-height:0;display:flex;align-items:stretch}
      .bw svg{width:100%;height:100%;display:block}
      .bottom-row{flex:0 0 auto;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:5mm}
      .group-marker{font-size:32pt;font-weight:900;line-height:1;white-space:nowrap}
      .bc{font-size:18pt;font-weight:bold;letter-spacing:1.5px;white-space:nowrap}
    `;
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const groupPart = groupLabel ? `<div class="group-marker">${esc(groupLabel)}</div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${podCode}</title><style>${css}</style></head><body>
      <div class="content">
        <div class="bw">${svgHtml}</div>
        <div class="bottom-row">
          ${groupPart}
          <div class="bc">${esc(podCode)}</div>
        </div>
      </div>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const pw = window.open(url, '_blank');
    if (!pw) { showToast(t('proj.popupBlocked'), 'error'); return; }
    pw.addEventListener('load', () => { pw.print(); URL.revokeObjectURL(url); });
  };
}

// ---- COMMENTS ----
let currentCommentsModal = { podId: null };

async function showCommentsModal(podId) {
  currentCommentsModal.podId = podId;
  const modal = document.getElementById('comments-modal');
  modal.classList.remove('hidden');
  await loadComments(podId);
}

async function loadComments(podId) {
  const { data: comments, error: commentsErr } = await supabaseClient
    .from('comments')
    .select('*, author:profiles!author_id(full_name, username, role)')
    .eq('pod_id', podId)
    .order('created_at', { ascending: false });

  const list = document.getElementById('comments-list');

  if (commentsErr) {
    console.error('loadComments error:', commentsErr);
    list.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-text">${t('comments.loadError')}</div></div>`;
    return;
  }
  if (!comments || comments.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-text">${t('comments.none')}</div></div>`;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="comment-item ${c.is_flagged ? 'flagged' : ''} ${c.is_resolved ? 'resolved' : ''}">
      <div class="comment-header">
        ${c.is_flagged ? '<span class="comment-flag-icon">🚩</span>' : ''}
        <span class="comment-author">${escHtml(c.author?.full_name || c.author?.username || t('comments.userFallback'))}</span>
        <span class="nav-role-badge" style="background:var(--primary-light);color:var(--primary)">${ROLE_LABELS[c.author?.role] || ''}</span>
        <span class="comment-time">${formatDateTime(c.created_at)}</span>
        ${c.is_resolved ? `<span style="color:var(--success);font-size:12px">${t('comments.resolvedTag')}</span>` : ''}
      </div>
      <div class="comment-content">${escHtml(c.content)}</div>
      ${(!c.is_resolved && (canEdit() || isAdminOrPM())) || isAdmin() ? `
        <div class="comment-actions">
          ${!c.is_resolved && (canEdit() || isAdminOrPM()) ? `<button class="btn btn-success btn-sm btn-resolve-comment" data-comment-id="${c.id}">${t('comments.resolveBtn')}</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-danger btn-sm btn-delete-comment" data-comment-id="${c.id}">${t('comments.deleteBtn')}</button>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.btn-resolve-comment').forEach(btn => {
    btn.addEventListener('click', () => resolveComment(btn.dataset.commentId, podId));
  });
  list.querySelectorAll('.btn-delete-comment').forEach(btn => {
    btn.addEventListener('click', () => deleteComment(btn.dataset.commentId, podId));
  });
}

async function deleteComment(commentId, podId) {
  if (!(await uiConfirm(t('comments.confirmDelete')))) return;
  const { error, count } = await supabaseClient
    .from('comments').delete({ count: 'exact' }).eq('id', commentId);
  if (error) {
    console.error('deleteComment error:', error);
    showToast(t('comments.deleteError') + (error.message || error.code || ''), 'error');
    return;
  }
  if (count === 0) {
    showToast(t('comments.deleteBlocked'), 'error');
    return;
  }
  showToast(t('comments.deleted'), 'success');
  await loadComments(podId);
}

async function resolveComment(commentId, podId) {
  const { error } = await supabaseClient.from('comments').update({
    is_resolved: true, resolved_by: AppState.currentProfile.id, resolved_at: new Date().toISOString()
  }).eq('id', commentId);
  if (error) { showToast(t('common.error'), 'error'); return; }
  showToast(t('comments.resolved'), 'success');
  await loadComments(podId);
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function initPodDetailButtons() {
  // Back to project. When the pod was opened via deep link (?pod=) or a
  // barcode scan there is no currentProject yet — open it from the pod's
  // project_id instead of doing nothing.
  document.getElementById('btn-back-project')?.addEventListener('click', async () => {
    if (AppState.currentProject) {
      showView('project-detail');
      // Keep the active filter selection — reloading without it shows an
      // unfiltered list while the selects still display the old filter
      loadPodsTab(AppState.currentProject.id, getCurrentPodFilters());
    } else if (AppState.currentPod?.project_id || AppState.currentPod?.projects?.id) {
      await openProject(AppState.currentPod.project_id || AppState.currentPod.projects.id);
    } else {
      showView('projects');
      loadProjects();
    }
  });

  // Barcode
  document.getElementById('btn-pod-barcode')?.addEventListener('click', () => {
    if (AppState.currentPod) showBarcodeModal(AppState.currentPod.pod_code, AppState.currentPodGroupLabel || '');
  });
  document.getElementById('barcode-modal-close')?.addEventListener('click', () => {
    document.getElementById('barcode-modal').classList.add('hidden');
  });

  // Comments
  document.getElementById('btn-pod-comments')?.addEventListener('click', () => {
    if (AppState.currentPod) showCommentsModal(AppState.currentPod.id);
  });
  document.getElementById('comments-modal-close')?.addEventListener('click', () => {
    document.getElementById('comments-modal').classList.add('hidden');
  });

  // Submit comment
  document.getElementById('btn-submit-comment')?.addEventListener('click', async () => {
    const text = document.getElementById('new-comment-text')?.value.trim();
    const flagged = document.getElementById('comment-flag-cb')?.checked;
    if (!text) { showToast(t('comments.enterContent'), 'error'); return; }
    const { error } = await supabaseClient.from('comments').insert({
      pod_id: currentCommentsModal.podId,
      author_id: AppState.currentProfile.id,
      content: text,
      is_flagged: flagged,
    });
    if (error) { console.error('comment insert error:', error); showToast(t('comments.sendError') + (error.message || error.code || ''), 'error'); return; }
    document.getElementById('new-comment-text').value = '';
    document.getElementById('comment-flag-cb').checked = false;
    showToast(t('comments.added'), 'success');
    await loadComments(currentCommentsModal.podId);
  });

  // PDF button
  document.getElementById('btn-pod-pdf')?.addEventListener('click', () => {
    if (AppState.currentPod) generatePodPDF(AppState.currentPod);
  });

  // Delivery note — the site address the unit is shipped to (destinations.js)
  document.getElementById('btn-pod-delivery')?.addEventListener('click', () => {
    if (AppState.currentPod) generateDeliveryNote(AppState.currentPod);
  });

  // Audit history — open to every active user (migration 20260726000000)
  document.getElementById('btn-pod-history')?.addEventListener('click', showPodHistory);
}

// ---- AUDIT HISTORY ----
async function showPodHistory() {
  const podId = AppState.currentPod?.id;
  if (!podId) return;

  const { data: logs, error } = await supabaseClient
    .from('qc_audit_log')
    .select('*')
    .eq('pod_id', podId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    showToast(t('proj.errorPrefix') + error.message, 'error');
    return;
  }

  const body = (!logs || logs.length === 0)
    ? `<div class="empty-state" style="padding:24px"><div class="empty-state-text">${t('audit.none')}</div></div>`
    : logs.map(l => {
        const stageNum = l.new_values?.stage_number;
        const letter = stageNum ? (STAGE_LETTERS[stageNum - 1] || stageNum) : null;
        const inspector = l.new_values?.inspector_name || l.old_values?.inspector_name;
        // Item-level events (item_status_changed) carry item_key — resolve the
        // language-aware label and show the old→new status transition
        let itemInfo = '';
        if (l.table_name === 'qc_items' && l.new_values?.item_key) {
          const itemDef = getStage(stageNum, podProductType(AppState.currentPod))?.items.find(it => it.key === l.new_values.item_key);
          const label = itemDef ? qcItemLabel(itemDef) : (l.new_values.item_label || l.new_values.item_key);
          const oldSt = l.old_values?.status;
          const newSt = l.new_values?.status;
          const transition = oldSt && newSt ? ` (${t('status.' + oldSt)} → ${t('status.' + newSt)})` : '';
          itemInfo = `: ${escHtml(label)}${transition}`;
        }
        return `
        <div style="padding:10px 4px;border-bottom:1px solid var(--border);font-size:13px">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <strong>${escHtml(t('audit.' + l.action))}${letter ? ` — ${t('qc.stage')} ${letter}` : ''}${itemInfo}</strong>
            <span class="text-muted">${formatDateTime(l.created_at)}</span>
          </div>
          <div class="text-muted" style="margin-top:2px">
            ${l.changed_by_name ? t('audit.by', { name: escHtml(l.changed_by_name) }) : ''}
            ${inspector && inspector !== l.changed_by_name ? ` · ${t('rep.hInspector')}: ${escHtml(inspector)}` : ''}
          </div>
        </div>`;
      }).join('');

  openModal(t('audit.title'), `<div style="max-height:60vh;overflow-y:auto">${body}</div>`, [
    { label: t('common.close'), cls: 'btn-ghost', id: 'btn-audit-close' },
  ]);
  document.getElementById('btn-audit-close')?.addEventListener('click', closeModal);
}
