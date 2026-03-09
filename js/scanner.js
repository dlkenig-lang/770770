// =============================================
// Barcode Scanner Module
// =============================================

let _html5QrCode = null;
let _scannerActive = false;

function openScannerModal() {
  document.getElementById('scanner-modal').classList.remove('hidden');
  const statusEl = document.getElementById('scanner-status');
  statusEl.textContent = '';
  statusEl.className = 'scanner-status hidden';

  // Wait for html5-qrcode to load (it's deferred)
  if (typeof Html5Qrcode === 'undefined') {
    statusEl.textContent = 'הספרייה עדיין נטענת, נסה שוב עוד רגע';
    statusEl.className = 'scanner-status scanner-status-error';
    return;
  }

  if (_scannerActive) return;
  _scannerActive = true;

  _html5QrCode = new Html5Qrcode('scanner-reader');
  _html5QrCode.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      qrbox: { width: 260, height: 100 },
      formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128]
    },
    async (decodedText) => {
      if (!_scannerActive) return;
      _scannerActive = false;
      await _onBarcodeScanned(decodedText);
    },
    () => { /* ignore per-frame errors */ }
  ).catch(() => {
    statusEl.textContent = 'לא ניתן לגשת למצלמה. ודא שהענקת הרשאת מצלמה.';
    statusEl.className = 'scanner-status scanner-status-error';
    _scannerActive = false;
  });
}

async function _onBarcodeScanned(podCode) {
  // Stop camera first
  if (_html5QrCode) {
    await _html5QrCode.stop().catch(() => {});
    _html5QrCode = null;
  }

  const statusEl = document.getElementById('scanner-status');
  statusEl.textContent = `מחפש פוד: ${podCode}…`;
  statusEl.className = 'scanner-status scanner-status-info';

  const { data: pod } = await supabaseClient
    .from('pods')
    .select('id')
    .eq('pod_code', podCode)
    .maybeSingle();

  if (!pod) {
    statusEl.textContent = `פוד לא נמצא: ${podCode}`;
    statusEl.className = 'scanner-status scanner-status-error';
    // Allow retry after 2 seconds
    setTimeout(() => {
      if (!document.getElementById('scanner-modal').classList.contains('hidden')) {
        _scannerActive = false;
        openScannerModal();
      }
    }, 2000);
    return;
  }

  closeScannerModal();
  await openPod(pod.id);
}

function closeScannerModal() {
  _scannerActive = false;
  if (_html5QrCode) {
    _html5QrCode.stop().catch(() => {});
    _html5QrCode = null;
  }
  document.getElementById('scanner-modal').classList.add('hidden');
  // Clear the scanner reader element so it can be reused
  const reader = document.getElementById('scanner-reader');
  if (reader) reader.innerHTML = '';
}

document.getElementById('btn-scan-barcode')?.addEventListener('click', openScannerModal);
document.getElementById('scanner-modal-close')?.addEventListener('click', closeScannerModal);
// Close on overlay click
document.getElementById('scanner-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('scanner-modal')) closeScannerModal();
});
