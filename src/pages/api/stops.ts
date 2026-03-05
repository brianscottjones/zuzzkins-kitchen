export const prerender = false;

import type { APIRoute } from 'astro';
import { readContent, writeContent, generateId } from '../../lib/content';
import { checkAuth } from '../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const content = readContent();
  return new Response(JSON.stringify(content.stops), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const content = readContent();
  const newStop = { id: generateId(), ...body };
  content.stops.push(newStop);
  writeContent(content);
  return new Response(JSON.stringify(newStop), {
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
    content.stops = body;
    writeContent(content);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update single stop
  const idx = content.stops.findIndex((s: { id: string }) => s.id === body.id);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  content.stops[idx] = body;
  writeContent(content);
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { id } = await request.json();
  const content = readContent();
  content.stops = content.stops.filter((s: { id: string }) => s.id !== id);
  writeContent(content);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
