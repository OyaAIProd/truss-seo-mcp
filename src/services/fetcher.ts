/**
 * HTTP fetcher with timing, redirects, and error handling.
 */

export interface FetchResult {
  html: string;
  status: number;
  redirected: boolean;
  finalUrl: string;
  loadTimeMs: number;
  headers: Record<string, string>;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; TrussSEOBot/1.0; +https://truss.dev/seo-bot)';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB

export async function fetchPage(url: string): Promise<FetchResult> {
  const start = Date.now();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    // Still try to read it, but warn
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_SIZE) {
    throw new Error(`Page too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB (max 5 MB)`);
  }

  const html = new TextDecoder('utf-8').decode(buffer);
  const loadTimeMs = Date.now() - start;

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    html,
    status: response.status,
    redirected: response.redirected,
    finalUrl: response.url,
    loadTimeMs,
    headers,
  };
}

/**
 * Fetch with error wrapping — returns null on failure instead of throwing.
 */
export async function fetchPageSafe(
  url: string,
): Promise<FetchResult | { error: string; status: number }> {
  try {
    return await fetchPage(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, status: 0 };
  }
}

/**
 * Check if a URL returns a valid response (for broken link detection).
 */
export async function checkUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
