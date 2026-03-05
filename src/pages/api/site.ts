export const prerender = false;

import type { APIRoute } from 'astro';
import { readContent, writeContent } from '../../lib/content';
import { checkAuth } from '../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const content = readContent();
  return new Response(JSON.stringify(content.site), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await request.json();
  const content = readContent();
  content.site = { ...content.site, ...body };
  writeContent(content);
  return new Response(JSON.stringify(content.site), {
    headers: { 'Content-Type': 'application/json' },
  });
};
