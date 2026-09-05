const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function assertJavaScriptIdsExist(htmlPath, scriptPath) {
  const html = read(htmlPath);
  const script = read(scriptPath);
  const references = [...script.matchAll(/getElementById\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(references.length > 0, `${scriptPath} should reference UI elements`);
  for (const id of references) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} is missing from ${htmlPath}`);
  }
}

test('overlay script only references elements that exist', () => {
  assertJavaScriptIdsExist('src/renderer/index.html', 'src/renderer/app.js');
});

test('control center script only references elements that exist', () => {
  assertJavaScriptIdsExist('src/control/index.html', 'src/control/app.js');
  assertJavaScriptIdsExist('src/control/index.html', 'src/control/home.js');
});

test('renderer pages enforce a restrictive content security policy', () => {
  for (const file of ['src/renderer/index.html', 'src/control/index.html']) {
    const html = read(file);
    assert.match(html, /Content-Security-Policy/);
    assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
  }
});

test('video PiP controls and bundled Material icon sprite are present', () => {
  const controlHtml = read('src/control/index.html');
  const overlayHtml = read('src/renderer/index.html');
  const overlayStyles = read('src/renderer/styles.css');
  const utilityStyles = read('src/utility/styles.css');
  const preload = read('src/preload/index.js');
  const icons = read('src/assets/material-icons.svg');
  assert.match(controlHtml, /data-view-panel="video"/);
  assert.match(controlHtml, /id="pipControlsToggle"/);
  assert.match(controlHtml, /id="pipControlPositionSelect"/);
  assert.match(controlHtml, /id="pipSizeSelect"/);
  assert.match(overlayHtml, /id="pipPlayButton"/);
  assert.match(overlayStyles, /\.overlay\.is-video \.content\s*{\s*display: none;/);
  assert.match(preload, /listCaptureSources/);
  assert.match(preload, /setCaptureSource/);
  assert.match(icons, /<symbol id="pip"/);
  assert.match(icons, /<symbol id="lock-open"/);
});

test('timer, alarm, clock, and startup controls are available through the safe bridge', () => {
  const control = read('src/control/index.html');
  const overlay = read('src/renderer/index.html');
  const utility = read('src/utility/index.html');
  const overlayStyles = read('src/renderer/styles.css');
  const utilityStyles = read('src/utility/styles.css');
  const preload = read('src/preload/index.js');
  const main = read('src/main/index.js');
  assert.match(control, /data-view-panel="timers"/);
  assert.match(control, /id="startupToggle"/);
  assert.match(control, /id="alarmTime"/);
  assert.match(control, /id="utilityDisplayMode"/);
  assert.match(control, /id="showTimerToggle"/);
  assert.match(control, /id="visibilityHotkeyInput"/);
  assert.match(overlay, /id="alertOverlay"/);
  assert.match(overlay, /dismissAlertButton/);
  assert.match(overlayStyles, /\.alert-overlay\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(utilityStyles, /\.alert\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(utilityStyles, /--clock-opacity/);
  assert.match(utilityStyles, /--timer-opacity/);
  assert.match(utility, /id="timer"/);
  assert.match(utility, /id="analogClock"/);
  assert.match(utility, /class="brand-mark"/);
  assert.match(read('src\/utility\/app.js'), /setProperty\('--clock-opacity'/);
  assert.match(control, /class="hotkey-recorder"/);
  assert.match(control, /id="mediaOpacitySlider"/);
  assert.match(control, /id="videoOpacitySlider"/);
  assert.match(control, /id="clockStyleSelect"/);
  assert.match(preload, /startTimer/);
  assert.match(preload, /setStartup/);
  assert.match(preload, /setHotkeyCapture/);
  assert.match(main, /setLoginItemSettings/);
  assert.match(main, /dismissAlert/);
  assert.match(main, /registerDesktopHotkeys\(requested\)/);
});

test('standalone package and UI contain no Overwolf runtime dependency', () => {
  const packageJson = JSON.parse(read('package.json'));
  const main = read('src/main/index.js');
  const manager = read('src/main/overlay-manager.js');
  const control = read('src/control/index.html');

  assert.equal(packageJson.devDependencies.electron, '43.2.0');
  assert.equal(packageJson.devDependencies['@overwolf/ow-electron'], undefined);
  assert.equal(packageJson.overwolf, undefined);
  assert.doesNotMatch(`${main}\n${manager}\n${control}`, /overwolf/i);
  assert.match(manager, /setAlwaysOnTop\(true, 'screen-saver'\)/);
  assert.match(manager, /setIgnoreMouseEvents\(this\.settings\.locked/);
  assert.match(manager, /setAspectRatio\(this\.videoMode \? 16 \/ 9 : 0\)/);
  assert.match(main, /--smoke-test/);
});

test('main pushes build a release and retain only the newest three versions', () => {
  const workflow = read('.github/workflows/release.yml');
  const verificationWorkflow = read('.github/workflows/ci.yml');
  const icon = fs.readFileSync(path.join(projectRoot, 'src/assets/app-icon.png'));

  assert.match(workflow, /push:\s*[\s\S]*branches:\s*\[main\]/);
  assert.doesNotMatch(workflow, /tags:\s*[\s\S]*v\*/);
  assert.doesNotMatch(verificationWorkflow, /push:/);
  assert.match(workflow, /npm run dist/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /Select-Object -Skip 3/);
  assert.match(workflow, /gh release delete .*--cleanup-tag --yes/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact/);
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
