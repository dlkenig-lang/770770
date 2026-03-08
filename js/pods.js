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
      projects(id, name, code, date_received, pipe_type),
      project_types(type_number, dimensions),
      type_directions(direction),
      production_groups(name)
    `)
    .eq('id', podId)
    .single();

  if (error || !pod) { showToast('שגיאה בטעינת פוד', 'error'); return; }

  AppState.currentPod = pod;

  document.getElementById('pod-detail-code').textContent = pod.pod_code;
  const statusEl = document.getElementById('pod-detail-status');
  statusEl.textContent = STATUS_LABELS[pod.status] || pod.status;
  statusEl.className = `status-badge status-${pod.status}`;

  document.getElementById('pod-info-bar').innerHTML = `
    <div class="info-item">
      <div class="info-label">פרויקט</div>
      <div class="info-value">${escHtml(pod.projects?.name || '')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">טיפוס</div>
      <div class="info-value">T${pod.project_types?.type_number || ''}</div>
    </div>
    <div class="info-item">
      <div class="info-label">כיוון</div>
      <div class="info-value">${pod.type_directions?.direction || ''}</div>
    </div>
    <div class="info-item">
      <div class="info-label">מידות</div>
      <div class="info-value">${escHtml(pod.project_types?.dimensions || '—')}</div>
    </div>
    ${pod.production_groups?.name ? `
      <div class="info-item">
        <div class="info-label">קבוצה</div>
        <div class="info-value">${escHtml(pod.production_groups.name)}</div>
      </div>
    ` : ''}
    <div class="info-item">
      <div class="info-label">סוג צנרת</div>
      <div class="info-value">${escHtml(pod.projects?.pipe_type || '—')}</div>
    </div>
  `;

  showView('pod-detail');

  // Show unresolved comments banner
  const { data: unresolvedComments } = await supabaseClient
    .from('comments')
    .select('id')
    .eq('pod_id', podId)
    .eq('is_flagged', true)
    .eq('is_resolved', false);
  const unresolvedCount = unresolvedComments?.length || 0;
  let bannerEl = document.getElementById('pod-unresolved-banner');
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'pod-unresolved-banner';
    document.getElementById('pod-info-bar').insertAdjacentElement('afterend', bannerEl);
  }
  if (unresolvedCount > 0) {
    bannerEl.className = 'pod-unresolved-banner';
    bannerEl.innerHTML = `⚠️ לפוד זה יש <strong>${unresolvedCount}</strong> הערות שלא טופלו — <button class="btn btn-sm btn-ghost" onclick="showCommentsModal('${podId}')">לטיפול</button>`;
  } else {
    bannerEl.className = '';
    bannerEl.innerHTML = '';
  }

  await loadQCStages(podId);
}

// ---- BARCODE ----
function showBarcodeModal(podCode) {
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
    display.innerHTML = `<div style="color:var(--danger)">שגיאה ביצירת ברקוד</div>`;
  }

  codeEl.textContent = podCode;
  modal.classList.remove('hidden');

  document.getElementById('btn-print-barcode').onclick = () => {
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <html><head><title>ברקוד - ${podCode}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;}</style>
      </head><body>
        ${display.innerHTML}
        <div style="font-size:18px;font-weight:bold;margin-top:8px">${podCode}</div>
      </body></html>
    `);
    printWin.document.close();
    printWin.print();
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
    list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-state-text">שגיאה בטעינת הערות</div></div>';
    return;
  }
  if (!comments || comments.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-state-text">אין הערות עדיין</div></div>';
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="comment-item ${c.is_flagged ? 'flagged' : ''} ${c.is_resolved ? 'resolved' : ''}">
      <div class="comment-header">
        ${c.is_flagged ? '<span class="comment-flag-icon">🚩</span>' : ''}
        <span class="comment-author">${escHtml(c.author?.full_name || c.author?.username || 'משתמש')}</span>
        <span class="nav-role-badge" style="background:var(--primary-light);color:var(--primary)">${ROLE_LABELS[c.author?.role] || ''}</span>
        <span class="comment-time">${formatDateTime(c.created_at)}</span>
        ${c.is_resolved ? '<span style="color:var(--success);font-size:12px">✓ טופל</span>' : ''}
      </div>
      <div class="comment-content">${escHtml(c.content)}</div>
      ${(c.is_flagged && !c.is_resolved && canEdit()) || isAdmin() ? `
        <div class="comment-actions">
          ${c.is_flagged && !c.is_resolved && canEdit() ? `<button class="btn btn-success btn-sm btn-resolve-comment" data-comment-id="${c.id}">✓ סמן כטופל</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-danger btn-sm btn-delete-comment" data-comment-id="${c.id}">🗑 מחק</button>` : ''}
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
  if (!confirm('האם למחוק הערה זו לצמיתות?')) return;
  const { error, count } = await supabaseClient
    .from('comments').delete({ count: 'exact' }).eq('id', commentId);
  if (error) {
    console.error('deleteComment error:', error);
    showToast('שגיאה במחיקת הערה: ' + (error.message || error.code || ''), 'error');
    return;
  }
  if (count === 0) {
    showToast('המחיקה נחסמה — יש להפעיל את מדיניות RLS ב-Supabase', 'error');
    return;
  }
  showToast('הערה נמחקה', 'success');
  await loadComments(podId);
}

async function resolveComment(commentId, podId) {
  const { error } = await supabaseClient.from('comments').update({
    is_resolved: true, resolved_by: AppState.currentProfile.id, resolved_at: new Date().toISOString()
  }).eq('id', commentId);
  if (error) { showToast('שגיאה', 'error'); return; }
  showToast('הוערה סומנה כטופלה', 'success');
  await loadComments(podId);
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function initPodDetailButtons() {
  // Back to project
  document.getElementById('btn-back-project')?.addEventListener('click', () => {
    if (AppState.currentProject) {
      showView('project-detail');
      loadPodsTab(AppState.currentProject.id);
    }
  });

  // Barcode
  document.getElementById('btn-pod-barcode')?.addEventListener('click', () => {
    if (AppState.currentPod) showBarcodeModal(AppState.currentPod.pod_code);
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
    if (!text) { showToast('יש להזין תוכן', 'error'); return; }
    const { error } = await supabaseClient.from('comments').insert({
      pod_id: currentCommentsModal.podId,
      author_id: AppState.currentProfile.id,
      content: text,
      is_flagged: flagged,
    });
    if (error) { console.error('comment insert error:', error); showToast('שגיאה בשליחת הערה: ' + (error.message || error.code || ''), 'error'); return; }
    document.getElementById('new-comment-text').value = '';
    document.getElementById('comment-flag-cb').checked = false;
    showToast('הערה נוספה', 'success');
    await loadComments(currentCommentsModal.podId);
  });

  // PDF & Excel buttons
  document.getElementById('btn-pod-pdf')?.addEventListener('click', () => {
    if (AppState.currentPod) generatePodPDF(AppState.currentPod);
  });
  document.getElementById('btn-pod-excel')?.addEventListener('click', () => {
    if (AppState.currentProject) generateProjectExcel(AppState.currentProject.id, AppState.currentProject.name);
  });
}
