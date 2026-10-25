/**
 * Sign-in state and the two gate dialogs.
 *
 * The header itself is rendered on the server from the session cookie, so this
 * file never paints a "signed in" header from scratch. It only does three
 * things the server cannot: intercept the upload when there is nothing left to
 * spend, swap the credit number after a removal, and run the dialog.
 */
(() => {
  const body = document.body;
  const gate = document.getElementById('gate');
  if (!gate) return;

  const ui = {
    kicker: document.getElementById('gate-kicker'),
    title: document.getElementById('gate-title'),
    bodyText: document.getElementById('gate-body'),
    actions: document.getElementById('gate-actions'),
    fine: document.getElementById('gate-fine'),
  };

  const state = {
    signedIn: body.dataset.signedIn === '1',
    credits: Number(body.dataset.credits || 0),
    lastFocus: null,
  };

  const SIGN_IN_HREF = '/auth/google?next=' + encodeURIComponent('/#tool');

  /* --------------------------------------------------------------- copy */

  const COPY = {
    login: () => ({
      kicker: '3 free removals',
      title: 'Sign in to remove a background',
      body:
        'Google is the whole account: no password to invent, no form to fill. ' +
        'New accounts start with 3 background removals on the house.',
      actions: [
        { label: 'Sign in with Google', href: SIGN_IN_HREF, primary: true },
        { label: 'Not now', close: true },
      ],
      fine: 'You come straight back to this page after signing in.',
    }),

    credits: () => ({
      kicker: 'Out of credits',
      title: 'Your free removals are used up',
      body:
        'Every account starts with 3 removals and yours are spent. Credit packs are the next ' +
        'release; if you need more right now, ask and we will sort it out.',
      actions: [
        {
          label: 'Ask about credit packs',
          href: 'mailto:hello@example.com?subject=Credit%20packs',
          primary: true,
        },
        { label: 'Close', close: true },
      ],
      fine: 'A removal that fails never costs you a credit.',
    }),

    unconfigured: () => ({
      kicker: 'Not switched on',
      title: "Sign-in isn't available on this build",
      body:
        'This deployment has no Google client yet. Set GOOGLE_CLIENT_ID and ' +
        'GOOGLE_CLIENT_SECRET in the environment, redeploy, and the button will work.',
      actions: [{ label: 'Close', close: true }],
      fine: '',
    }),

    denied: () => ({
      kicker: 'Cancelled',
      title: 'Sign-in was cancelled',
      body: 'Google did not hand back a code, so nothing changed on your account.',
      actions: [
        { label: 'Try again', href: SIGN_IN_HREF, primary: true },
        { label: 'Close', close: true },
      ],
      fine: '',
    }),

    failed: () => ({
      kicker: 'Sign-in failed',
      title: "We couldn't finish the sign-in",
      body:
        'Google accepted the request but the exchange failed on our side. Usually a second ' +
        'attempt works; if it keeps happening, the client secret is probably stale.',
      actions: [
        { label: 'Try again', href: SIGN_IN_HREF, primary: true },
        { label: 'Close', close: true },
      ],
      fine: '',
    }),

    state: () => ({
      kicker: 'Expired',
      title: 'That sign-in link had expired',
      body: 'Sign-in links are only good for ten minutes. Start again and it will go through.',
      actions: [
        { label: 'Start again', href: SIGN_IN_HREF, primary: true },
        { label: 'Close', close: true },
      ],
      fine: '',
    }),
  };

  /* -------------------------------------------------------------- render */

  function openGate(kind) {
    const copy = (COPY[kind] || COPY.login)();

    ui.kicker.textContent = copy.kicker;
    ui.title.textContent = copy.title;
    ui.bodyText.textContent = copy.body;
    ui.fine.textContent = copy.fine;

    ui.actions.replaceChildren();
    for (const action of copy.actions) {
      const node = document.createElement(action.href ? 'a' : 'button');
      node.className = 'btn ' + (action.primary ? 'btn--primary' : 'btn--quiet');
      node.textContent = action.label;
      if (action.href) {
        node.href = action.href;
      } else {
        node.type = 'button';
        node.addEventListener('click', closeGate);
      }
      ui.actions.appendChild(node);
    }

    state.lastFocus = document.activeElement;
    gate.hidden = false;
    body.classList.add('is-gated');
    const first = ui.actions.querySelector('.btn--primary') || ui.actions.firstElementChild;
    if (first) first.focus();
  }

  function closeGate() {
    gate.hidden = true;
    body.classList.remove('is-gated');
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
      state.lastFocus.focus();
      state.lastFocus = null;
    }
  }

  function paintCredits(value) {
    state.credits = Math.max(0, Number(value) || 0);
    const node = document.querySelector('[data-credits]');
    const unit = document.querySelector('[data-credits-unit]');
    if (node) node.textContent = String(state.credits);
    if (unit) unit.textContent = state.credits === 1 ? 'credit' : 'credits';
    const chip = node && node.closest('.auth-live__credits');
    if (chip) chip.classList.toggle('is-empty', state.credits === 0);
    body.dataset.credits = String(state.credits);
  }

  /* ---------------------------------------------------------------- api */

  const CutoutAuth = {
    get signedIn() {
      return state.signedIn;
    },
    get credits() {
      return state.credits;
    },
    setCredits: paintCredits,
    openGate,

    /** Nothing to spend, or nobody to spend it: false means "do not upload". */
    canRemove() {
      return state.signedIn && state.credits > 0;
    },

    ensureCanRemove() {
      if (this.canRemove()) return true;
      openGate(state.signedIn ? 'credits' : 'login');
      return false;
    },

    async refresh() {
      try {
        const response = await fetch('/api/me', { headers: { accept: 'application/json' } });
        if (!response.ok) return null;
        const data = await response.json();
        state.signedIn = Boolean(data.user);
        paintCredits(data.credits || 0);
        return data;
      } catch {
        return null;
      }
    },

    async signOut() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } finally {
        // A full reload is the simplest way to get the server-rendered header
        // back in step with the cleared cookie.
        window.location.assign('/');
      }
    },
  };

  window.CutoutAuth = CutoutAuth;

  /* ------------------------------------------------------------- events */

  document.addEventListener('click', (event) => {
    const out = event.target.closest('[data-auth-out]');
    if (out) {
      event.preventDefault();
      out.disabled = true;
      CutoutAuth.signOut();
      return;
    }
    if (event.target.closest('[data-gate-close]')) closeGate();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !gate.hidden) closeGate();
  });

  const flag = new URLSearchParams(window.location.search).get('auth');
  if (flag) {
    openGate(COPY[flag] ? flag : 'failed');
    // Drop the flag so a refresh does not reopen the dialog.
    const clean = new URL(window.location.href);
    clean.searchParams.delete('auth');
    window.history.replaceState({}, '', clean.pathname + clean.search + clean.hash);
  }
})();
