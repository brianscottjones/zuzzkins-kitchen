export const prerender = false;

import type { APIRoute } from 'astro';
import { verifyPassword, createAuthCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password || !verifyPassword(password)) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createAuthCookie(),
    },
  });
};
