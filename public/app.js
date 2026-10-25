/**
 * Client for the background remover.
 *
 * Deliberately small: one state machine over three stages (empty / loading /
 * compare), one fetch, no framework. Every value shown to the user comes from
 * the server response or from the file itself; nothing is invented.
 */
(() => {
  const MAX_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;
  const TIMEOUT_MS = 45000;

  const el = {
    panel: document.getElementById('tool-panel'),
    status: document.getElementById('status'),
    errorBar: document.getElementById('error-bar'),
    errorText: document.getElementById('error-text'),
    fileInput: document.getElementById('file-input'),
    drop: document.getElementById('drop'),
    loadingHint: document.getElementById('loading-hint'),
    loadingFile: document.getElementById('loading-file'),
    imgOriginal: document.getElementById('img-original'),
    imgResult: document.getElementById('img-result'),
    metaOriginal: document.getElementById('meta-original'),
    metaResult: document.getElementById('meta-result'),
    download: document.getElementById('download'),
    reset: document.getElementById('reset'),
    resultNote: document.getElementById('result-note'),
  };

  const stages = Array.from(document.querySelectorAll('.stage'));
  const state = {
    stage: 'empty',
    originalUrl: null,
    resultUrl: null,
    filename: 'image',
    busy: false,
  };

  let hintTimers = [];
  let dragDepth = 0;

  /** The sign-in / credits module, when the page shipped one. */
  function auth() {
    return window.CutoutAuth || null;
  }

  /* ---------------------------------------------------------------- helpers */

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function baseName(name) {
    return String(name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'image';
  }

  function setStage(next) {
    state.stage = next;
    for (const node of stages) {
      node.hidden = node.dataset.stage !== next;
    }
    el.panel.dataset.state = next;
    if (next === 'loading') setStatus('Working');
    if (next === 'compare') setStatus('Done');
    if (next === 'empty') setStatus('Ready');
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  function showError(message) {
    el.errorText.textContent = message;
    el.errorBar.hidden = false;
  }

  function clearError() {
    el.errorBar.hidden = true;
    el.errorText.textContent = '';
  }

  function releaseUrls() {
    if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.originalUrl = null;
    state.resultUrl = null;
  }

  function stopHints() {
    hintTimers.forEach(clearTimeout);
    hintTimers = [];
  }

  function startHints(file) {
    el.loadingFile.textContent = file.name + ' · ' + formatSize(file.size);
    el.loadingHint.textContent = 'Sending the image to the removal engine';
    hintTimers = [
      setTimeout(() => {
        el.loadingHint.textContent = 'Separating the subject from the background';
      }, 2400),
      setTimeout(() => {
        el.loadingHint.textContent = 'Still working. Detailed photos take a little longer';
      }, 8000),
    ];
  }

  /* --------------------------------------------------------------- upload */

  function validate(file) {
    if (!file) return 'No file was selected.';
    const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name || '');
    if (!typeOk) return 'That file type is not supported. Use a JPG, PNG or WEBP image.';
    if (file.size === 0) return 'That file is empty. Try another one.';
    if (file.size > MAX_BYTES) {
      return 'That image is ' + formatSize(file.size) + '. The limit is 10 MB, so please resize it first.';
    }
    return null;
  }

  async function handleFile(file) {
    if (state.busy) return;

    // Checked before the file is read: a signed-out visitor or an empty balance
    // gets the dialog, not a request the server would only refuse.
    const guard = auth();
    if (guard && !guard.ensureCanRemove()) return;

    clearError();
    const problem = validate(file);
    if (problem) {
      showError(problem);
      setStage(state.stage === 'compare' ? 'compare' : 'empty');
      return;
    }

    state.busy = true;
    releaseUrls();
    state.filename = baseName(file.name);

    // Show the source immediately: the wait feels shorter when you can see
    // what is being worked on.
    state.originalUrl = URL.createObjectURL(file);
    el.imgOriginal.src = state.originalUrl;
    setStage('loading');
    startHints(file);
    el.download.setAttribute('aria-disabled', 'true');

    const form = new FormData();
    form.append('image', file, file.name || 'upload');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('/api/remove', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await failure(response);
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error('The result came back empty. Please try again.');
      }

      // The server is the only authority on the balance; mirror what it says.
      const remaining = response.headers.get('x-credits-remaining');
      if (remaining !== null && guard) guard.setCredits(Number(remaining));

      state.resultUrl = URL.createObjectURL(blob);
      el.imgResult.src = state.resultUrl;
      el.download.href = state.resultUrl;
      el.download.download = state.filename + '-no-bg.png';
      el.download.removeAttribute('aria-disabled');

      const durationMs = Number(response.headers.get('x-bg-duration-ms') || 0);
      const timing = durationMs ? ' · ' + (durationMs / 1000).toFixed(1) + 's' : '';
      const balance =
        remaining === null
          ? ''
          : ' · 1 credit used · ' + remaining + (Number(remaining) === 1 ? ' credit left' : ' credits left');
      el.resultNote.textContent = 'PNG · ' + formatSize(blob.size) + timing + balance;

      setStage('compare');
      describeImage(el.imgOriginal, el.metaOriginal, file.size);
      describeImage(el.imgResult, el.metaResult, blob.size);
      setStatus(durationMs ? 'Done in ' + (durationMs / 1000).toFixed(1) + 's' : 'Done');
    } catch (error) {
      if (error && error.gated) {
        // The dialog is already open and says the useful thing; the error bar
        // would only repeat it.
        setStage('empty');
      } else if (error.name === 'AbortError') {
        showError('The removal took longer than 45 seconds and was stopped. Please try a smaller image.');
        setStage('empty');
      } else {
        showError(error.message || 'Something went wrong. Please try again.');
        setStage('empty');
      }
    } finally {
      clearTimeout(timeout);
      stopHints();
      state.busy = false;
      el.fileInput.value = '';
    }
  }

  /**
   * Turn a failed response into either a dialog (identity / balance problems,
   * where the page has a better answer than a red bar) or a sentence for the
   * error bar. Codes come from the API, so the mapping stays honest.
   */
  async function failure(response) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      /* not JSON: fall through to the status based copy */
    }

    const error = payload && payload.error ? payload.error : null;
    const guard = auth();

    if (response.status === 401 || (error && error.code === 'auth_required')) {
      if (guard) guard.openGate('login');
      return gated();
    }

    if (response.status === 402 || (error && error.code === 'out_of_credits')) {
      if (guard) {
        guard.setCredits(0);
        guard.openGate('credits');
      }
      return gated();
    }

    if (error && error.code === 'provider_not_configured') {
      return new Error(
        'Background removal is not switched on for this build yet. The interface is ready; the removal key still has to be set.',
      );
    }

    if (error && error.message) return new Error(error.message);

    if (response.status === 413) return new Error('That image is too large. The limit is 10 MB.');
    if (response.status === 415) return new Error('That file type is not supported. Use a JPG, PNG or WEBP image.');
    return new Error('The removal failed with status ' + response.status + '. Please try again.');
  }

  function gated() {
    const error = new Error('gated');
    error.gated = true;
    return error;
  }

  function describeImage(img, target, bytes) {
    const paint = () => {
      const dims = img.naturalWidth && img.naturalHeight ? img.naturalWidth + ' × ' + img.naturalHeight : '';
      target.textContent = [dims, formatSize(bytes)].filter(Boolean).join(' · ') || ' ';
    };
    if (img.complete && img.naturalWidth) paint();
    else img.addEventListener('load', paint, { once: true });
  }

  function resetTool() {
    if (state.busy) return;
    releaseUrls();
    el.imgOriginal.removeAttribute('src');
    el.imgResult.removeAttribute('src');
    el.download.removeAttribute('href');
    el.download.setAttribute('aria-disabled', 'true');
    el.metaOriginal.textContent = ' ';
    el.metaResult.textContent = ' ';
    el.resultNote.textContent = '';
    el.fileInput.value = '';
    clearError();
    setStage('empty');
  }

  /* --------------------------------------------------------------- events */

  // The picker is gated too: no point choosing a file the server will refuse.
  // This fires for the label click as well, so one guard covers both entry points.
  el.fileInput.addEventListener('click', (event) => {
    const guard = auth();
    if (guard && !guard.canRemove()) {
      event.preventDefault();
      guard.ensureCanRemove();
    }
  });

  el.fileInput.addEventListener('change', () => {
    const file = el.fileInput.files && el.fileInput.files[0];
    if (file) handleFile(file);
  });

  el.reset.addEventListener('click', resetTool);

  el.download.addEventListener('click', (event) => {
    if (el.download.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
    }
  });

  // Clicking the drop surface is what the label does natively; keep the pointer
  // cursor honest by not intercepting anything here.
  el.drop.addEventListener('dragenter', () => {
    dragDepth += 1;
    document.body.classList.add('is-dragging');
  });

  el.drop.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove('is-dragging');
  });

  el.drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  el.drop.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('is-dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  // Dropping outside the panel should not navigate away from the page.
  ['dragover', 'drop'].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (!el.drop.contains(event.target)) event.preventDefault();
    });
  });

  window.addEventListener('dragend', () => {
    dragDepth = 0;
    document.body.classList.remove('is-dragging');
  });

  /* ------------------------------------------------------ scroll reveal */

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !prefersReduced) {
    document.body.dataset.anim = 'on';
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    document.querySelectorAll('.rise').forEach((node) => observer.observe(node));
  }

  /* ------------------------------------------------------------- boot */

  el.download.setAttribute('aria-disabled', 'true');
  setStage('empty');
})();
