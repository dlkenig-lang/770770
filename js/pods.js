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
      projects(id, name, code, date_received, pipe_type, onedrive_folder_url),
      project_types(type_number, dimensions),
      type_directions(direction),
      production_groups(name, max_pods),
      comments(id, is_resolved, is_flagged)
    `)
    .eq('id', podId)
    .single();

  if (error || !pod) { showToast(t('pod.loadError'), 'error'); return; }

  AppState.currentPod = pod;

  // Fetch groups for all users — needed for group label in barcode/PDF
  let groups = [];
  const { data: g } = await supabaseClient
    .from('production_groups')
    .select('id, name, max_pods')
    .eq('project_id', pod.projects.id)
    .order('name');
  groups = sortGroupsByOption(g || []);

  document.getElementById('pod-detail-code').textContent = pod.pod_code;
  const statusEl = document.getElementById('pod-detail-status');
  statusEl.textContent = STATUS_LABELS[pod.status] || pod.status;
  statusEl.className = `status-badge status-${pod.status}`;

  const castingBadge = document.getElementById('pod-casting-badge');
  if (castingBadge) {
    castingBadge.style.display = pod.casting_approved ? '' : 'none';
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
      <div class="info-label">${t('proj.type')}</div>
      <div class="info-value">T${pod.project_types?.type_number || ''}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${t('proj.direction')}</div>
      <div class="info-value">${pod.type_directions?.direction || ''}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${t('pod.dimensions')}</div>
      <div class="info-value">${escHtml(pod.project_types?.dimensions || '—')}</div>
    </div>
    ${groupCell}
    <div class="info-item">
      <div class="info-label">${t('proj.pipeType')}</div>
      <div class="info-value">${escHtml(pod.projects?.pipe_type || '—')}</div>
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
    } catch (e) { /* ignore */ }
    const svgHtml = psvg.outerHTML;
    document.body.removeChild(scratch);

    // Brother QL-700: 62mm tape, 150mm label — portrait (62×150), barcode rotated 90°
    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      @page{size:62mm 150mm;margin:0}
      html,body{width:62mm;height:150mm;overflow:hidden;background:#fff;font-family:monospace}
      body{position:relative}
      .content{
        position:absolute;top:50%;left:50%;
        width:142mm;height:56mm;
        transform:translate(-50%,-50%) rotate(-90deg);
        display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:2mm;
      }
      .bw{width:100%}
      .bw svg{width:100%;height:auto;max-height:34mm}
      .bottom-row{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:5mm}
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
      loadPodsTab(AppState.currentProject.id);
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
}
