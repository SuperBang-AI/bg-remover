/**
 * Home page: server-rendered so the headline, the copy and the FAQ are in the
 * HTML source that crawlers actually read. The interactive part is a thin
 * client script on top of this markup.
 */

const TITLE = 'Image Background Remover: Transparent PNG in Seconds';
const DESCRIPTION =
  'Remove the background from any image in seconds. A free AI background remover that returns a clean, full resolution transparent PNG. JPG, PNG or WEBP.';

export const FAQ = [
  {
    q: 'Is this image background remover free?',
    a: 'Yes. This release is free to use as much as you need, and every download is a full resolution PNG with no watermark. Accounts, credit packs and API access are the next release.',
  },
  {
    q: 'Do I need an account to use it?',
    a: 'No. There is no sign up, no email and nothing to install. Drop an image, wait a few seconds and the transparent PNG is yours to download.',
  },
  {
    q: 'What file formats and sizes can I upload?',
    a: 'JPG, PNG and WEBP up to 10 MB per image. The file is checked in the browser before upload and again on the server, so a renamed file will not waste your time.',
  },
  {
    q: 'Will the downloaded image have a watermark?',
    a: 'No. The result is the full resolution image with a real alpha channel. Nothing is stamped on it, and there is no lower resolution preview hiding behind a paywall.',
  },
  {
    q: 'How long does the removal take?',
    a: 'Most photos come back in three to six seconds. Large or busy images with fine detail like hair and foliage take a little longer.',
  },
  {
    q: 'Do you store my images?',
    a: 'No. The image is streamed to the removal engine to produce the cutout and then discarded. We do not keep a copy, and we do not use your images to train models.',
  },
  {
    q: 'What resolution is the result?',
    a: 'The result keeps the resolution of the source image, up to the provider limit. The result pane shows the exact pixel dimensions as soon as it loads, so you can verify before downloading.',
  },
  {
    q: 'What happens if the removal fails?',
    a: 'You get a plain message explaining why, and the image stays on your machine. Nothing is charged in this release, and you can retry with the same file or a different one.',
  },
  {
    q: 'Can I use the cutouts commercially?',
    a: 'Yes. You keep the rights to the images you upload and to the results. Product photos, client work and ads are all fine.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Current versions of Chrome, Safari, Firefox and Edge on desktop and mobile. Drag and drop works on desktop; on a phone the button opens your photo library or camera.',
  },
];

export function renderHome({ origin, providerReady }) {
  const canonical = `${origin}/`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#F5F2EA">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Cutout">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESCRIPTION}">

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/styles.css">
${structuredData(origin)}
</head>
<body data-provider="${providerReady ? 'ready' : 'offline'}">

<a class="skip" href="#tool">Skip to the tool</a>

<header class="site-head">
  <div class="wrap site-head__inner">
    <a class="brand" href="/" aria-label="Cutout, back to the top">
      <span class="brand__mark" aria-hidden="true"></span>
      <span class="brand__word">cutout</span>
      <span class="brand__stage">stage 1</span>
    </a>
    <nav class="site-nav" aria-label="Page sections">
      <a href="#how">How it works</a>
      <a href="#faq">FAQ</a>
      <a class="site-nav__cta" href="#tool">Open the tool</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero__grid">
      <div class="hero__lead">
        <p class="eyebrow reveal" style="--i:0">
          <span class="eyebrow__dot" aria-hidden="true"></span>Free AI cutout&nbsp;· no sign up
        </p>
        <h1 class="hero__title reveal" style="--i:1" id="hero-title">
          Image background<br>
          <em>remover</em><span class="hero__dot" aria-hidden="true">.</span>
        </h1>
        <p class="hero__sub reveal" style="--i:2">
          One upload, one clean cut. You get a transparent PNG back at full
          resolution in about five seconds, edge detail and all.
        </p>
        <div class="hero__actions reveal" style="--i:3">
          <label class="btn btn--primary" for="file-input">
            Choose an image
            <span class="btn__arrow" aria-hidden="true">&#8594;</span>
          </label>
          <a class="btn btn--quiet" href="#how">How it works</a>
        </div>
      </div>

      <aside class="hero__specs reveal" style="--i:2" aria-label="Specifications">
        <span class="swatch" aria-hidden="true"></span>
        <dl class="specs">
          <div class="specs__row">
            <dt>Formats</dt>
            <dd>JPG · PNG · WEBP</dd>
          </div>
          <div class="specs__row">
            <dt>Max size</dt>
            <dd>10 MB</dd>
          </div>
          <div class="specs__row">
            <dt>Output</dt>
            <dd>Transparent PNG</dd>
          </div>
          <div class="specs__row">
            <dt>Storage</dt>
            <dd>None kept</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>

  <section class="tool-section" id="tool" aria-labelledby="tool-heading">
    <div class="wrap">
      <h2 class="sr-only" id="tool-heading">Remove the background from your image</h2>

      <div class="tool" id="tool-panel" data-state="empty">
        <div class="tool__bar">
          <p class="tool__id"><span class="tool__num">01</span> Background removal</p>
          <p class="tool__status" id="status" role="status" aria-live="polite">Ready</p>
        </div>

        ${providerReady ? '' : noticeMarkup()}

        <div class="tool__error" id="error-bar" role="alert" hidden>
          <span class="tool__error-k">Failed</span>
          <span class="tool__error-v" id="error-text"></span>
        </div>

        <div class="stage" data-stage="empty">
          <input class="sr-only" type="file" id="file-input" accept="image/jpeg,image/png,image/webp" />
          <label class="drop" id="drop" for="file-input">
            <span class="drop__badge" aria-hidden="true">Drop</span>
            <span class="drop__title">Drag your image here</span>
            <span class="drop__hint">or click to browse&nbsp;· JPG, PNG, WEBP&nbsp;· up to 10 MB</span>
            <span class="btn btn--outline drop__btn">Select a file</span>
          </label>
        </div>

        <div class="stage" data-stage="loading" hidden>
          <div class="loading">
            <span class="loading__spin" aria-hidden="true"></span>
            <p class="loading__title">Removing the background</p>
            <p class="loading__hint" id="loading-hint">Sending the image to the removal engine</p>
            <div class="loading__bar" aria-hidden="true"><span></span></div>
            <p class="loading__file" id="loading-file"></p>
          </div>
        </div>

        <div class="stage" data-stage="compare" hidden>
          <div class="compare">
            <figure class="pane pane--original">
              <figcaption class="pane__head">
                <span class="pane__label">Original</span>
                <span class="pane__meta" id="meta-original">&nbsp;</span>
              </figcaption>
              <div class="pane__body">
                <img id="img-original" alt="The photo you uploaded" decoding="async" />
              </div>
            </figure>

            <div class="pane-divider" aria-hidden="true"><span>vs</span></div>

            <figure class="pane pane--result">
              <figcaption class="pane__head">
                <span class="pane__label">Result <span class="pane__tag">transparent</span></span>
                <span class="pane__meta" id="meta-result">&nbsp;</span>
              </figcaption>
              <div class="pane__body">
                <img id="img-result" alt="The same photo with the background removed" decoding="async" />
              </div>
            </figure>
          </div>

          <div class="tool__actions">
            <a class="btn btn--accent" id="download" download="result-no-bg.png" href="#">
              Download PNG
              <span class="btn__arrow" aria-hidden="true">&#8595;</span>
            </a>
            <button class="btn btn--quiet" type="button" id="reset">Try another image</button>
            <p class="tool__note" id="result-note"></p>
          </div>
        </div>
      </div>

      <p class="tool__caption">
        Nothing is stored. The image is streamed to the removal engine, cut on the fly, and discarded.
      </p>
    </div>
  </section>

  <section class="how" id="how" aria-labelledby="how-title">
    <div class="wrap">
      <div class="section-head rise">
        <p class="eyebrow"><span class="eyebrow__dot" aria-hidden="true"></span>02 / Process</p>
        <h2 class="h2" id="how-title">Three steps. Only the first one is yours.</h2>
      </div>

      <ol class="steps">
        <li class="step rise">
          <span class="step__num">01</span>
          <div class="step__body">
            <h3>Drop the image</h3>
            <p>Drag a file onto the panel or pick one from your library. The browser checks the format and the size before anything is uploaded.</p>
          </div>
          <span class="step__meta">JPG · PNG · WEBP</span>
        </li>
        <li class="step rise">
          <span class="step__num">02</span>
          <div class="step__body">
            <h3>Let the model cut it</h3>
            <p>The image goes to the removal engine, which separates the subject from the background. Fine detail like hair, fur and glass edges is kept.</p>
          </div>
          <span class="step__meta">3 to 6 seconds</span>
        </li>
        <li class="step rise">
          <span class="step__num">03</span>
          <div class="step__body">
            <h3>Check it, then download</h3>
            <p>Original and result sit side by side, the result over a checkerboard so the transparent areas are obvious. One click saves the PNG.</p>
          </div>
          <span class="step__meta">Full resolution</span>
        </li>
      </ol>
    </div>
  </section>

  <section class="strip" aria-label="Privacy">
    <div class="wrap strip__inner rise">
      <p class="strip__k">Privacy</p>
      <p class="strip__v">
        Images are never written to disk. There is no account to tie them to, and no copy left
        behind for anything else to use.
      </p>
    </div>
  </section>

  <section class="faq" id="faq" aria-labelledby="faq-title">
    <div class="wrap faq__grid">
      <div class="faq__head rise">
        <p class="eyebrow"><span class="eyebrow__dot" aria-hidden="true"></span>03 / FAQ</p>
        <h2 class="h2" id="faq-title">Questions, answered plainly.</h2>
        <p class="faq__hint">
          Still stuck? Write to
          <a href="mailto:hello@example.com">hello@example.com</a>
        </p>
      </div>

      <div class="faq__list">
        ${FAQ.map(
          (item, index) => `<details class="qa rise"${index === 0 ? ' open' : ''}>
          <summary>
            <span class="qa__num">${String(index + 1).padStart(2, '0')}</span>
            <span class="qa__q">${item.q}</span>
            <span class="qa__sign" aria-hidden="true"></span>
          </summary>
          <p class="qa__a">${item.a}</p>
        </details>`,
        ).join('\n        ')}
      </div>
    </div>
  </section>

</main>

<footer class="site-foot">
  <div class="wrap site-foot__inner">
    <p class="site-foot__brand"><span class="brand__mark" aria-hidden="true"></span>cutout</p>
    <p class="site-foot__note">Background removal by remove.bg. Served from the edge by Cloudflare Workers.</p>
    <p class="site-foot__legal">&copy; 2026 &nbsp;·&nbsp; Stage 1 preview</p>
  </div>
</footer>

<script src="/app.js" defer></script>
</body>
</html>`;
}

function noticeMarkup() {
  return `<div class="tool__notice" role="note">
          <span class="tool__notice-k">Provider offline</span>
          <span class="tool__notice-v">REMOVE_BG_API_KEY is not set in this build. The interface works end to end; the removal step will report a configuration error.</span>
        </div>`;
}

function structuredData(origin) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Cutout',
        url: `${origin}/`,
        description: DESCRIPTION,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any modern web browser',
        browserRequirements: 'Requires JavaScript',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Remove image background',
          'Transparent PNG download',
          'Full resolution output',
          'No watermark',
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}
