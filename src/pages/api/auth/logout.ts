export const prerender = false;

import type { APIRoute } from 'astro';
import { clearAuthCookie } from '../../../lib/auth';

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearAuthCookie(),
    },
  });
};
