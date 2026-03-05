const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'zuzzkins2026';
const SESSION_COOKIE = 'zk_admin_session';
const SESSION_VALUE = 'authenticated_' + Buffer.from(ADMIN_PASSWORD).toString('base64');

export function checkAuth(request: Request): boolean {
  const cookie = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookie.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  return cookies[SESSION_COOKIE] === SESSION_VALUE;
}

export function createAuthCookie(): string {
  // 7-day session
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  return `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`;
}

export function clearAuthCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function verifyPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}
