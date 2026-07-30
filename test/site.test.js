const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('landing page includes product content, metadata, and accessible navigation', () => {
  const html = read('site/index.html');

  assert.match(html, /<title>NowLayer — Game-safe media overlay for Windows<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-controls="siteNav"/);
  assert.match(html, /id="downloadButton"/);
  assert.match(html, /assets\/control-center\.png/);
  assert.match(html, /assets\/compact-overlay\.png/);
  assert.doesNotMatch(html, /target="_blank"(?![^>]*rel="noopener")/);
});

test('every local landing-page asset exists', () => {
  const html = read('site/index.html');
  const references = [...html.matchAll(/(?:src|href)="(assets\/[^"#?]+|(?:styles|script)\.\w+)"/g)]
    .map((match) => match[1]);

  assert.ok(references.length >= 8);
  for (const reference of references) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'site', reference)), true, `${reference} is missing`);
  }
});

test('landing page ids, anchors, and icon metadata are internally consistent', () => {
  const html = read('site/index.html');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingAnchors = anchors.filter((id) => !ids.includes(id));
  const icon = fs.readFileSync(path.join(projectRoot, 'site/assets/app-icon.png'));

  assert.deepEqual(duplicateIds, []);
  assert.deepEqual(missingAnchors, []);
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
  for (const file of ['404.html', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', '.nojekyll']) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'site', file)), true, `${file} is missing`);
  }
});

test('GitHub Pages workflow deploys only the static site from main', () => {
  const workflow = read('.github/workflows/pages.yml');

  assert.match(workflow, /push:\s*[\s\S]*branches: \[main\]/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /path: site/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});
