export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public authentication endpoint/pages and static assets required by login.
  if (
    path === '/login.html' ||
    path === '/login' ||
    path.startsWith('/.netlify/functions/') ||
    path.startsWith('/.netlify/edge-functions/') ||
    path.startsWith('/assets/') ||
    path === '/favicon.ico' ||
    path === '/robots.txt'
  ) {
    return context.next();
  }

  // Treat the CRM dashboard as private. A valid session is verified by the
  // browser/API as well; this gate prevents direct URL access without a cookie.
  const cookie = request.headers.get('cookie') || '';
  const hasSession = /(?:^|;\s*)crm_session=[^;]+/.test(cookie);

  if (!hasSession) {
    return Response.redirect(new URL('/login.html?reason=session', request.url), 302);
  }

  return context.next();
};

export const config = { path: '/*' };
