const NOT_FOUND_TITLE = 'Page not found · Cutout';

export function renderNotFound({ origin }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${NOT_FOUND_TITLE}</title>
<meta name="robots" content="noindex, follow">
<meta name="theme-color" content="#F5F2EA">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="site-head">
  <div class="wrap site-head__inner">
    <a class="brand" href="/" aria-label="Cutout, back to the top">
      <span class="brand__mark" aria-hidden="true"></span>
      <span class="brand__word">cutout</span>
      <span class="brand__stage">stage 1</span>
    </a>
    <nav class="site-nav" aria-label="Page sections">
      <a href="/#how">How it works</a>
      <a href="/#faq">FAQ</a>
      <a class="site-nav__cta" href="/#tool">Open the tool</a>
    </nav>
  </div>
</header>

<main class="missing">
  <div class="wrap missing__inner">
    <p class="eyebrow"><span class="eyebrow__dot" aria-hidden="true"></span>404</p>
    <h1 class="hero__title">Nothing cut out here<span class="hero__dot" aria-hidden="true">.</span></h1>
    <p class="hero__sub">
      The page you asked for does not exist. The tool still does.
    </p>
    <p class="missing__actions">
      <a class="btn btn--primary" href="/">Back to the tool <span class="btn__arrow" aria-hidden="true">&#8594;</span></a>
    </p>
  </div>
</main>

<footer class="site-foot">
  <div class="wrap site-foot__inner">
    <p class="site-foot__brand"><span class="brand__mark" aria-hidden="true"></span>cutout</p>
    <p class="site-foot__note">Background removal by remove.bg. Served from the edge by Cloudflare Workers.</p>
    <p class="site-foot__legal">&copy; 2026 &nbsp;·&nbsp; ${new URL(origin).host}</p>
  </div>
</footer>
</body>
</html>`;
}
