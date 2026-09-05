// Fetch at build/development setup time; installed NowLayer works offline.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const VERSION = '2.3.1';
const SHA256 = '364e5d98d4d134bd54dd25c22ed2ca2f4883f8bc3ed6502bee0c151e3436d30c';
const URL = `https://github.com/GameTechDev/PresentMon/releases/download/v${VERSION}/PresentMon-${VERSION}-x64.exe`;
const destination = path.join(__dirname, '..', 'vendor', 'presentmon', 'PresentMon.exe');
const digest = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
async function prepare() {
  try { if (digest(await fs.readFile(destination)) === SHA256) return destination; } catch { /* First build. */ }
  const response = await fetch(URL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`PresentMon download failed (${response.status}).`);
  const data = Buffer.from(await response.arrayBuffer());
  if (digest(data) !== SHA256) throw new Error('PresentMon integrity check failed; refusing to package it.');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.download`;
  try { await fs.writeFile(temporary, data); await fs.rename(temporary, destination); }
  finally { await fs.rm(temporary, { force: true }); }
  return destination;
}
if (require.main === module && (process.platform === 'win32' || process.argv.includes('--force'))) {
  prepare().then(() => console.info(`PresentMon ${VERSION} verified and ready to bundle.`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { prepare, VERSION, SHA256, destination, digest };
