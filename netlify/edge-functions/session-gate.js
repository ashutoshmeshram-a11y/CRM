export default async (request, context) => {
  const cookie = request.headers.get('cookie') || '';
  const hasSession = /(?:^|;\s*)crm_session=[^;]+/.test(cookie);
  if (!hasSession) {
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/login.html?reason=session`, 302);
  }
  return context.next();
};

export const config = {
  path: ['/index.html', '/pipeline', '/dashboard']
};
