// Client-side guard: never allow the Kanban to remain visible without a valid server session.
(async function () {
  try {
    const r = await fetch('/.netlify/functions/auth', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) {
      window.location.replace('/login.html?reason=session');
      return;
    }
    const data = await r.json();
    if (!data.authenticated) window.location.replace('/login.html?reason=session');
  } catch (_) {
    window.location.replace('/login.html?reason=session');
  }
})();
