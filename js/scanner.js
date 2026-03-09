// =============================================
// Barcode Scanner Module (Quagga2 / CODE128)
// =============================================

let _quaggaRunning = false;
let _detectedHandler = null;

function openScannerModal() {
  document.getElementById('scanner-modal').classList.remove('hidden');
  const statusEl = document.getElementById('scanner-status');
  statusEl.textContent = '';
  statusEl.className = 'scanner-status hidden';

  if (typeof Quagga === 'undefined') {
    statusEl.textContent = 'הספרייה עדיין נטענת, נסה שוב עוד רגע';
    statusEl.className = 'scanner-status scanner-status-error';
    return;
  }

  if (_quaggaRunning) return;

  const reader = document.getElementById('scanner-reader');
  reader.innerHTML = '';

  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: reader,
      constraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    locator: { patchSize: 'medium', halfSample: true },
    numOfWorkers: 2,
    frequency: 10,
    decoder: { readers: ['code_128_reader'] },
    locate: true
  }, function (err) {
    if (err) {
      statusEl.textContent = 'לא ניתן לגשת למצלמה. ודא שהענקת הרשאת מצלמה.';
      statusEl.className = 'scanner-status scanner-status-error';
      return;
    }
    _quaggaRunning = true;
    Quagga.start();
  });

  // Remove previous handler if any, then register fresh
  if (_detectedHandler) {
    Quagga.offDetected(_detectedHandler);
  }
  _detectedHandler = async (result) => {
    const code = result?.codeResult?.code;
    if (!code || !_quaggaRunning) return;
    // Confidence check: require at least 2 of the decodedCodes to have low error
    const errors = result.codeResult.decodedCodes
      .filter(c => c.error !== undefined)
      .map(c => c.error);
    const avgError = errors.reduce((a, b) => a + b, 0) / (errors.length || 1);
    if (avgError > 0.25) return; // low confidence, skip

    _quaggaRunning = false;
    Quagga.stop();
    Quagga.offDetected(_detectedHandler);
    _detectedHandler = null;
    await _onBarcodeScanned(code);
  };
  Quagga.onDetected(_detectedHandler);
}

async function _onBarcodeScanned(podCode) {
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
    setTimeout(() => {
      if (!document.getElementById('scanner-modal').classList.contains('hidden')) {
        openScannerModal();
      }
    }, 2500);
    return;
  }

  closeScannerModal();
  await openPod(pod.id);
}

function closeScannerModal() {
  if (_quaggaRunning) {
    Quagga.stop();
    _quaggaRunning = false;
  }
  if (_detectedHandler) {
    Quagga.offDetected(_detectedHandler);
    _detectedHandler = null;
  }
  document.getElementById('scanner-modal').classList.add('hidden');
  const reader = document.getElementById('scanner-reader');
  if (reader) reader.innerHTML = '';
}

document.getElementById('btn-scan-barcode')?.addEventListener('click', openScannerModal);
document.getElementById('scanner-modal-close')?.addEventListener('click', closeScannerModal);
document.getElementById('scanner-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('scanner-modal')) closeScannerModal();
});
