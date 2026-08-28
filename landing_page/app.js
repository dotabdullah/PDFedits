const releaseApi = 'https://api.github.com/repos/dotabdullah/PDFedits/releases/latest';
const releaseFallback = 'https://github.com/dotabdullah/PDFedits/releases/latest';

document.getElementById('year').textContent = new Date().getFullYear();

async function downloadLatestExe(button) {
  const label = button.querySelector('span');
  const originalLabel = label.textContent;
  document.querySelectorAll('.download-trigger').forEach((item) => { item.disabled = true; });
  label.textContent = 'Finding latest installer…';

  try {
    const response = await fetch(releaseApi, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error('Release lookup failed');
    const release = await response.json();
    const installer = release.assets.find((asset) => /\.exe$/i.test(asset.name));
    window.location.assign(installer ? installer.browser_download_url : release.html_url || releaseFallback);
  } catch (error) {
    window.location.assign(releaseFallback);
  } finally {
    window.setTimeout(() => {
      document.querySelectorAll('.download-trigger').forEach((item) => { item.disabled = false; });
      label.textContent = originalLabel;
    }, 1500);
  }
}

document.querySelectorAll('.download-trigger').forEach((button) => {
  button.addEventListener('click', () => downloadLatestExe(button));
});

// Keep the first impression polished without making the page feel busy.
// Small screens only fade content in; larger screens receive the lifted reveal.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealTargets = document.querySelectorAll([
  '.hero .eyebrow',
  '.hero h1',
  '.hero-copy',
  '.hero-actions',
  '.download-note',
  '.product-stage',
  '.section-intro',
  '.feature-card',
  '.industry-card',
  '.privacy-panel',
  '.download-panel',
  '.site-footer',
].join(','));

if (!reduceMotion && 'IntersectionObserver' in window) {
  document.body.classList.add('motion-ready');
  revealTargets.forEach((element, index) => {
    element.classList.add('reveal');
    element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 70}ms`);
  });

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -32px' });

  revealTargets.forEach((element) => revealObserver.observe(element));
}
