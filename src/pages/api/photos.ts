export const prerender = false;

import type { APIRoute } from 'astro';
import { readContent, writeContent, generateId } from '../../lib/content';
import { checkAuth } from '../../lib/auth';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, '../../../public');

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const content = readContent();
  return new Response(JSON.stringify(content.photos), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const alt = (formData.get('alt') as string) || '';

  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  const ext = extname(file.name).toLowerCase() || '.jpg';
  const filename = generateId() + ext;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  writeFileSync(join(PUBLIC_DIR, filename), buffer);

  const content = readContent();
  const newPhoto = { id: generateId(), src: '/' + filename, alt };
  content.photos.push(newPhoto);
  writeContent(content);

  return new Response(JSON.stringify(newPhoto), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const content = readContent();

  // Reorder: body is full array
  if (Array.isArray(body)) {
    content.photos = body;
    writeContent(content);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update single photo alt text
  const idx = content.photos.findIndex((p: { id: string }) => p.id === body.id);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  content.photos[idx] = { ...content.photos[idx], ...body };
  writeContent(content);
  return new Response(JSON.stringify(content.photos[idx]), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { id } = await request.json();
  const content = readContent();
  content.photos = content.photos.filter((p: { id: string }) => p.id !== id);
  writeContent(content);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
