/**
 * pre-build.test.mjs
 * Tests that run BEFORE the build — validates source files are sane.
 * Uses Node.js built-in test runner (node:test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Content JSON ──────────────────────────────────────────────────────────────

test('content.json exists', () => {
  const path = join(ROOT, 'src/data/content.json');
  assert.ok(existsSync(path), 'src/data/content.json not found');
});

test('content.json is valid JSON', () => {
  const path = join(ROOT, 'src/data/content.json');
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    assert.fail(`content.json is not valid JSON: ${e.message}`);
  }
  assert.ok(data, 'content.json is empty');
});

test('content.json has required site fields', () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const site = data.site;
  assert.ok(site, 'content.json missing "site" key');
  assert.ok(site.tagline, 'site.tagline is missing or empty');
  assert.ok(site.location, 'site.location is missing or empty');
  assert.ok(site.contactEmail, 'site.contactEmail is missing or empty');
});

test('content.json photos have required fields', () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const photos = data.photos ?? [];
  for (const photo of photos) {
    assert.ok(photo.src, `Photo id=${photo.id} missing "src"`);
    assert.ok(photo.alt, `Photo src=${photo.src} missing "alt" (accessibility)`);
  }
});

test('content.json photo files exist in public/', () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const photos = data.photos ?? [];
  const missing = [];
  for (const photo of photos) {
    // src values like "/flower-cake.jpg" → public/flower-cake.jpg
    const file = join(ROOT, 'public', photo.src.replace(/^\//, ''));
    if (!existsSync(file)) missing.push(photo.src);
  }
  assert.deepEqual(missing, [], `Photo files missing from public/: ${missing.join(', ')}`);
});

test('content.json stops have required fields', () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'src/data/content.json'), 'utf8'));
  const stops = data.stops ?? [];
  for (const stop of stops) {
    assert.ok(stop.id,       `Stop missing "id" (YYYY-MM-DD)`);
    assert.ok(stop.venue,    `Stop id=${stop.id} missing "venue"`);
    assert.ok(stop.location, `Stop id=${stop.id} missing "location"`);
    assert.ok(stop.time,     `Stop id=${stop.id} missing "time"`);
    // Validate id format
    assert.match(stop.id, /^\d{4}-\d{2}-\d{2}$/, `Stop "id" must be YYYY-MM-DD, got: ${stop.id}`);
  }
});

// ── Key source files ───────────────────────────────────────────────────────────

test('astro.config.mjs exists', () => {
  assert.ok(existsSync(join(ROOT, 'astro.config.mjs')));
});

test('Layout.astro exists', () => {
  assert.ok(existsSync(join(ROOT, 'src/layouts/Layout.astro')));
});

test('index.astro exists', () => {
  assert.ok(existsSync(join(ROOT, 'src/pages/index.astro')));
});

test('package.json is valid', () => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  } catch (e) {
    assert.fail(`package.json is invalid: ${e.message}`);
  }
  assert.ok(pkg.scripts?.build, 'package.json missing scripts.build');
});

// ── Jess wishlist follow-ups ──────────────────────────────────────────────────

test('body font is Lora', () => {
  const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8');
  assert.match(css, /family=Lora:/, 'Google Fonts import should include Lora');
  assert.match(css, /--font-body:\s*'Lora'/, 'Body font variable should use Lora first');
});

test('YAMAS-styled text is forced lowercase visually', () => {
  const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8');
  assert.match(css, /\.yamas-lowercase[\s\S]*text-transform:\s*lowercase/, 'Need reusable lowercase helper for YAMAS text');

  const sourceFiles = [
    'src/styles/global.css',
    'src/components/Hero.astro',
    'src/components/WhereToShop.astro',
    'src/components/Contact.astro',
    'src/components/Footer.astro',
    'src/pages/index.astro',
  ].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

  const yamasSelectors = [
    'h1, h2, h3',
    '.eyebrow',
    '.btn',
    'label',
    '.hero__tagline',
    '.hero__nav-link',
    '.dates__title',
    '.dates__month-day',
    '.dates__venue',
    '.dates__signup-heading',
    '.contact__title',
    '.footer__name',
    '.footer__nav a',
    '.slider__label-text',
  ];

  for (const selector of yamasSelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(sourceFiles, new RegExp(`${escaped}[\\s\\S]*?text-transform:\\s*lowercase`), `${selector} should force lowercase when using YAMAS`);
  }
});

test('About section source and public assets exist', () => {
  const index = readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf8');
  assert.match(index, /id="about"/, 'Homepage should include final About section');
  assert.match(index, /Zuzzkin’s is a cottage foods kitchen in Kingston Springs, Tennessee, offering small-batch canned goods made with local and often homegrown ingredients\./, 'About copy should use Jess-approved sentence');
  assert.match(index, /rotating cakes and bakes, made from scratch to reflect the best flavors of the season\./i, 'About copy should mention rotating cakes and bakes');
  assert.ok(existsSync(join(ROOT, 'public/about/strawberry-pot.jpg')), 'strawberry-pot about image missing');
  assert.ok(existsSync(join(ROOT, 'public/about/garden-flowers.jpg')), 'garden-flowers about image missing');
});

test('latest Jess nav and Next Stops tweaks are present', () => {
  const hero = readFileSync(join(ROOT, 'src/components/Hero.astro'), 'utf8');
  assert.match(hero, /href="#about"/, 'Hero nav should link to the About section');

  const whereToShop = readFileSync(join(ROOT, 'src/components/WhereToShop.astro'), 'utf8');
  assert.match(whereToShop, /\.dates__venue[\s\S]*font-size:\s*1\.15rem/, 'Market venue names should be slightly larger');
});

test('label iteration PDFs are not exposed as public website downloads', () => {
  const index = readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf8');
  assert.doesNotMatch(index, /\/labels\/strawberry-preserves\.pdf/, 'strawberry label PDF should not be linked from the site');
  assert.doesNotMatch(index, /\/labels\/green-tomato-chutney\.pdf/, 'green tomato chutney label PDF should not be linked from the site');
  assert.ok(!existsSync(join(ROOT, 'public/labels/strawberry-preserves.pdf')), 'public strawberry label PDF should not be present');
  assert.ok(!existsSync(join(ROOT, 'public/labels/green-tomato-chutney.pdf')), 'public green tomato chutney label PDF should not be present');
});
