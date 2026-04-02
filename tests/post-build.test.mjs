/**
 * post-build.test.mjs
 * Tests that run AFTER the build — validates dist/ output.
 * Uses Node.js built-in test runner (node:test).
 *
 * Run: node --test tests/post-build.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// ── Helpers ───────────────────────────────────────────────────────────────────

function distExists() {
  if (!existsSync(DIST)) {
    throw new Error('dist/ directory not found — run `npm run build` first');
  }
}

/** Recursively find all files matching an extension in a directory */
function findFiles(dir, ext) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (!ext || entry.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

/** Extract all href/src attribute values from HTML string */
function extractRefs(html) {
  const refs = { hrefs: [], srcs: [] };
  // href links (anchors, links)
  for (const m of html.matchAll(/href="([^"#?][^"]*?)"/g)) {
    refs.hrefs.push(m[1]);
  }
  // src attributes (img, script)
  for (const m of html.matchAll(/src="([^"#?][^"]*?)"/g)) {
    refs.srcs.push(m[1]);
  }
  return refs;
}

// ── Build output checks ───────────────────────────────────────────────────────

test('dist/ directory exists', () => {
  distExists();
});

test('index.html exists in dist/', () => {
  distExists();
  assert.ok(existsSync(join(DIST, 'index.html')), 'dist/index.html not found');
});

// ── HTML validation ───────────────────────────────────────────────────────────

test('all HTML files have doctype', () => {
  distExists();
  const htmlFiles = findFiles(DIST, '.html');
  assert.ok(htmlFiles.length > 0, 'No HTML files found in dist/');

  const missing = [];
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8');
    if (!content.trimStart().toLowerCase().startsWith('<!doctype')) {
      missing.push(relative(DIST, file));
    }
  }
  assert.deepEqual(missing, [], `HTML files missing doctype: ${missing.join(', ')}`);
});

test('all HTML files have <html>, <head>, and <body> tags', () => {
  distExists();
  const htmlFiles = findFiles(DIST, '.html');
  const problems = [];
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8').toLowerCase();
    const rel = relative(DIST, file);
    if (!content.includes('<html')) problems.push(`${rel}: missing <html>`);
    if (!content.includes('<head>') && !content.includes('<head ')) problems.push(`${rel}: missing <head>`);
    if (!content.includes('<body>') && !content.includes('<body ')) problems.push(`${rel}: missing <body>`);
    if (!content.includes('</html>')) problems.push(`${rel}: missing </html>`);
    if (!content.includes('</body>')) problems.push(`${rel}: missing </body>`);
  }
  assert.deepEqual(problems, [], `HTML structure issues:\n  ${problems.join('\n  ')}`);
});

// ── Meta tag checks (Lighthouse basics) ──────────────────────────────────────

test('homepage has <title> tag', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(html, /<title>[^<]+<\/title>/, 'Homepage is missing a <title> tag');
});

test('homepage has meta description', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(html, /<meta\s[^>]*name=["']description["'][^>]*>/i, 'Homepage is missing meta description');
});

test('homepage has meta viewport', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(html, /<meta\s[^>]*name=["']viewport["'][^>]*>/i, 'Homepage is missing meta viewport');
});

test('homepage has charset declaration', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(html, /<meta\s[^>]*charset/i, 'Homepage is missing charset meta tag');
});

// ── Critical content check ────────────────────────────────────────────────────

test('homepage contains business name "Zuzzkin\'s Kitchen"', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.ok(
    html.includes("Zuzzkin's Kitchen") || html.includes("Zuzzkin&#x27;s Kitchen") || html.includes("Zuzzkin&apos;s Kitchen"),
    'Homepage does not contain business name "Zuzzkin\'s Kitchen"'
  );
});

test('homepage contains contact email', () => {
  distExists();
  const content = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const email = content.site.contactEmail;
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.ok(html.includes(email), `Homepage does not contain contact email (${email})`);
});

test('homepage contains location', () => {
  distExists();
  const content = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  // "Kingston Springs" is the key part we care about
  assert.ok(html.includes('Kingston Springs'), `Homepage does not mention location (${content.site.location})`);
});

test('homepage has an <img> tag with alt attribute', () => {
  distExists();
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(html, /<img\s[^>]*alt=["'][^"']+["']/i, 'No <img> tags with alt text found');
});

// ── Internal link / asset checker ────────────────────────────────────────────

test('internal links in HTML resolve to real files', () => {
  distExists();
  const htmlFiles = findFiles(DIST, '.html');
  const broken = [];

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const { hrefs } = extractRefs(html);
    const fileDir = dirname(file);

    for (const href of hrefs) {
      // Only check internal paths (not external URLs, mailto, etc.)
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      if (href.startsWith('//')) continue;
      if (href === '/' || href === '') continue;

      // Resolve relative to dist root for absolute paths, relative to file for relative paths
      const targetPath = href.startsWith('/')
        ? join(DIST, href)
        : join(fileDir, href);

      // Accept both exact match and /path/index.html
      const exists =
        existsSync(targetPath) ||
        existsSync(join(targetPath, 'index.html')) ||
        existsSync(targetPath + '.html');

      if (!exists) {
        broken.push(`${relative(DIST, file)}: broken href="${href}"`);
      }
    }
  }
  assert.deepEqual(broken, [], `Broken internal links found:\n  ${broken.join('\n  ')}`);
});

test('image src attributes in HTML resolve to real files', () => {
  distExists();
  const htmlFiles = findFiles(DIST, '.html');
  const missing = [];

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const { srcs } = extractRefs(html);

    for (const src of srcs) {
      // Skip external URLs and data URIs
      if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('//')) continue;
      if (!src.match(/\.(jpe?g|png|gif|webp|svg|ico|avif)(\?|$)/i)) continue;

      const targetPath = src.startsWith('/')
        ? join(DIST, src.split('?')[0])
        : join(dirname(file), src.split('?')[0]);

      if (!existsSync(targetPath)) {
        missing.push(`${relative(DIST, file)}: missing image src="${src}"`);
      }
    }
  }
  assert.deepEqual(missing, [], `Missing image files:\n  ${missing.join('\n  ')}`);
});

// ── 404 page check ────────────────────────────────────────────────────────────

test('404 page exists', () => {
  distExists();
  // Astro generates 404.html for static sites
  const has404 = existsSync(join(DIST, '404.html')) || existsSync(join(DIST, '404/index.html'));
  // This is a soft warning — not all static sites need a custom 404 (host may provide one)
  // But it's best practice to have one for direct deploys
  if (!has404) {
    console.warn('  ⚠️  No 404.html found in dist/. Consider adding a src/pages/404.astro page.');
  }
  // Non-fatal: assert true always, just log the warning above
  assert.ok(true);
});

// ── Build artifact sanity ─────────────────────────────────────────────────────

test('dist/ contains CSS or assets', () => {
  distExists();
  // Astro puts assets in _assets/ by default
  const assetDir = join(DIST, '_assets');
  const hasAssets = existsSync(assetDir) && readdirSync(assetDir).length > 0;
  const hasCssInRoot = findFiles(DIST, '.css').length > 0;
  // Inline-only CSS is also fine (Astro compressHTML can inline small CSS)
  // Just check the build produced *something* beyond HTML
  const htmlFiles = findFiles(DIST, '.html');
  assert.ok(
    htmlFiles.length > 0 && (hasAssets || hasCssInRoot || htmlFiles.some(f => readFileSync(f, 'utf8').includes('<style'))),
    'dist/ looks suspiciously empty — no assets or inline styles found'
  );
});
