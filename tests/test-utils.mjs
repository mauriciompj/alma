export function isHtmlResponse(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('text/html');
}

export async function safeJson(res) {
  if (isHtmlResponse(res)) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function optionalEnv(name, fallback = '') {
  const value = (process.env[name] || '').trim();
  return value || fallback;
}
