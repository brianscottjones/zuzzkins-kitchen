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
