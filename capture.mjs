// Capture the game's screenshots: serve game/ over a local static server, open each ?shot= scene
// in headless Chromium at 1280x720, wait for window.__shotReady, and write a JPEG. These are real
// renders of the game's own code, never edited or composited.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from '/app/node_modules/playwright/index.mjs';

const ROOT = new URL('./game/', import.meta.url).pathname;
const OUT = new URL('./screenshots/', import.meta.url).pathname;
const PORT = 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

const shots = [
  { name: '1-title.jpg', query: '?shot=title&seed=7' },
  { name: '2-play.jpg', query: '?shot=play&seed=7' },
  { name: '3-combo.jpg', query: '?shot=combo&seed=7' },
  { name: '4-over.jpg', query: '?shot=over&seed=7' },
];

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(`http://localhost:${PORT}`) && !u.startsWith('data:')) errors.push(`NETWORK: ${u}`);
});

for (const shot of shots) {
  await page.goto(`http://localhost:${PORT}/index.html${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', { timeout: 30000 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(OUT, shot.name), type: 'jpeg', quality: 88 });
  console.log('wrote', shot.name);
}

await browser.close();
server.close();

if (errors.length) {
  console.log('--- PAGE ERRORS ---');
  for (const e of errors) console.log(e);
  process.exitCode = 1;
} else {
  console.log('no page errors, no outside requests');
}
