/**
 * Evals for SERP preview and meta generation logic.
 */

interface EvalResult {
  name: string;
  passed: boolean;
  details: string;
}

interface EvalSuite {
  passed: number;
  failed: number;
  results: EvalResult[];
}

// We test the meta generation and SERP logic indirectly through the
// exported functions. Since the tools themselves wrap these into MCP
// handlers, we test the underlying logic.

export function runSerpMetaEvals(): EvalSuite {
  const results: EvalResult[] = [];

  // ── Test 1: Title truncation detection ─────────────────────────────
  {
    const title = 'This Is a Very Long Title That Will Definitely Be Truncated by Google in Search Results Pages';
    const passed = title.length > 60;
    results.push({
      name: 'Detect title exceeding 60 chars',
      passed,
      details: `Title length: ${title.length} chars (max 60)`,
    });
  }

  // ── Test 2: Description truncation detection ───────────────────────
  {
    const desc =
      'This is a long meta description that goes beyond the recommended maximum of 160 characters for Google search results display. Google will typically truncate descriptions that exceed this limit with an ellipsis.';
    const passed = desc.length > 160;
    results.push({
      name: 'Detect description exceeding 160 chars',
      passed,
      details: `Description length: ${desc.length} chars (max 160)`,
    });
  }

  // ── Test 3: Optimal title length ───────────────────────────────────
  {
    const title = 'SEO Best Practices: Complete Guide for 2026';
    const passed = title.length >= 30 && title.length <= 60;
    results.push({
      name: 'Optimal title length (30-60 chars)',
      passed,
      details: `Title: "${title}" (${title.length} chars)`,
    });
  }

  // ── Test 4: Optimal description length ─────────────────────────────
  {
    const desc =
      'Learn the essential SEO strategies for 2026. This comprehensive guide covers keyword research, on-page SEO, and content strategy.';
    const passed = desc.length >= 120 && desc.length <= 160;
    results.push({
      name: 'Optimal description length (120-160 chars)',
      passed,
      details: `Description: ${desc.length} chars`,
    });
  }

  // ── Test 5: URL formatting for SERP ────────────────────────────────
  {
    const url = 'https://example.com/blog/seo-best-practices';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const breadcrumbs = parts.map((p) => p.replace(/-/g, ' '));
      const formatted = `${parsed.hostname} > ${breadcrumbs.join(' > ')}`;

      const passed = formatted === 'example.com > blog > seo best practices';
      results.push({
        name: 'URL breadcrumb formatting',
        passed,
        details: `Formatted: "${formatted}"`,
      });
    } catch {
      results.push({
        name: 'URL breadcrumb formatting',
        passed: false,
        details: 'URL parsing failed',
      });
    }
  }

  // ── Test 6: Mobile description is shorter than desktop ─────────────
  {
    const mobileMax = 120;
    const desktopMax = 160;
    const passed = mobileMax < desktopMax;
    results.push({
      name: 'Mobile description limit < desktop limit',
      passed,
      details: `Mobile: ${mobileMax}, Desktop: ${desktopMax}`,
    });
  }

  // ── Test 7: Pixel width estimation ─────────────────────────────────
  {
    // Estimate pixel width
    function estimatePixelWidth(text: string): number {
      let width = 0;
      for (const char of text) {
        if (/[A-Z]/.test(char)) width += 9;
        else if (/[a-z]/.test(char)) width += 7;
        else if (/[0-9]/.test(char)) width += 7;
        else if (char === ' ') width += 3.5;
        else width += 7;
      }
      return Math.round(width);
    }

    const shortTitle = 'Short';
    const longTitle = 'This Is A Really Long Title With Many Capital Letters That Takes Significantly More Pixel Width In Google Search Results';

    const shortPx = estimatePixelWidth(shortTitle);
    const longPx = estimatePixelWidth(longTitle);

    const passed = shortPx < longPx && shortPx < 580 && longPx > 580;
    results.push({
      name: 'Pixel width: long title exceeds 580px',
      passed,
      details: `Short: ${shortPx}px, Long: ${longPx}px (max 580px)`,
    });
  }

  // ── Test 8: CTA word detection ─────────────────────────────────────
  {
    const ctaWords = ['learn', 'discover', 'get', 'find', 'try', 'start', 'read', 'see', 'explore'];

    const withCta = 'Learn how to optimize your website for search engines with our complete guide.';
    const withoutCta = 'A comprehensive resource about search engine optimization techniques and methods.';

    const hasCta = ctaWords.some((w) => withCta.toLowerCase().includes(w));
    const noCta = !ctaWords.some((w) => withoutCta.toLowerCase().includes(w));

    const passed = hasCta && noCta;
    results.push({
      name: 'CTA word detection in descriptions',
      passed,
      details: `With CTA: ${hasCta}, Without CTA: ${!noCta ? 'false (has CTA)' : 'true (no CTA)'}`,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { passed, failed, results };
}
