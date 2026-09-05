document.documentElement.classList.add('js');
const menuButton = document.getElementById('menuButton');
const siteNav = document.getElementById('siteNav');
const siteHeader = document.querySelector('.site-header');
const releaseMeta = document.getElementById('releaseMeta');
const downloadButtons = [...document.querySelectorAll('[data-download]')];

function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
  siteNav?.classList.remove('is-open');
}

menuButton?.addEventListener('click', () => {
  const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(willOpen));
  menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
  siteNav?.classList.toggle('is-open', willOpen);
});

siteNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

window.addEventListener('scroll', () => {
  siteHeader?.classList.toggle('is-scrolled', window.scrollY > 8);
}, { passive: true });

document.getElementById('year').textContent = String(new Date().getFullYear());

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadLatestRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/sayanpramanik2012/NowLayer/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return;

    const release = await response.json();
    const installer = release.assets?.find((asset) => /NowLayer-Setup-.*\.exe$/i.test(asset.name));
    if (!installer?.browser_download_url) return;
    const url = new URL(installer.browser_download_url);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/sayanpramanik2012/NowLayer/releases/download/')) return;

    downloadButtons.forEach((button) => {
      button.href = installer.browser_download_url;
    });

    const size = formatBytes(installer.size);
    releaseMeta.textContent = `${release.tag_name} · ${size ? `${size} · ` : ''}Windows 10 and 11 · x64`;
  } catch {
    // The permanent releases/latest link remains available when the API is offline or rate-limited.
  }
}

const layerTabs = [...document.querySelectorAll('[data-layer]')];
function activateLayer(tab) {
  for (const item of layerTabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  }
}
for (const tab of layerTabs) {
  tab.addEventListener('click', () => activateLayer(tab));
  tab.addEventListener('keydown', (event) => {
    const index = layerTabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % layerTabs.length
      : event.key === 'ArrowLeft' ? (index + layerTabs.length - 1) % layerTabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? layerTabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    activateLayer(layerTabs[next]);
    layerTabs[next].focus();
  });
}
document.addEventListener('click', event => {
  if (!siteNav?.contains(event.target) && !menuButton?.contains(event.target)) closeMenu();
});
loadLatestRelease();
