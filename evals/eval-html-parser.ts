import { parseHtml, classifyLink } from '../src/services/html-parser.js';

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

export function runHtmlParserEvals(): EvalSuite {
  const results: EvalResult[] = [];

  // ── Test 1: Parse title ────────────────────────────────────────────
  {
    const html = '<html><head><title>Test Page Title</title></head><body></body></html>';
    const parsed = parseHtml(html);
    const passed = parsed.title === 'Test Page Title';
    results.push({
      name: 'Parse title tag',
      passed,
      details: passed ? `Got: "${parsed.title}"` : `Expected "Test Page Title", got "${parsed.title}"`,
    });
  }

  // ── Test 2: Parse meta description ─────────────────────────────────
  {
    const html = '<html><head><meta name="description" content="A test description here"></head><body></body></html>';
    const parsed = parseHtml(html);
    const passed = parsed.metaDescription === 'A test description here';
    results.push({
      name: 'Parse meta description',
      passed,
      details: passed ? `Got: "${parsed.metaDescription}"` : `Expected "A test description here", got "${parsed.metaDescription}"`,
    });
  }

  // ── Test 3: Parse headings ─────────────────────────────────────────
  {
    const html = `
      <html><body>
        <h1>Main Heading</h1>
        <h2>Sub Heading 1</h2>
        <h2>Sub Heading 2</h2>
        <h3>Detail Heading</h3>
      </body></html>
    `;
    const parsed = parseHtml(html);
    const passed =
      parsed.h1.length === 1 &&
      parsed.h1[0] === 'Main Heading' &&
      parsed.h2.length === 2 &&
      parsed.h3.length === 1;
    results.push({
      name: 'Parse heading hierarchy',
      passed,
      details: passed
        ? `H1: ${parsed.h1.length}, H2: ${parsed.h2.length}, H3: ${parsed.h3.length}`
        : `H1: ${parsed.h1.join(',')}, H2: ${parsed.h2.join(',')}, H3: ${parsed.h3.join(',')}`,
    });
  }

  // ── Test 4: Parse images with/without alt ──────────────────────────
  {
    const html = `
      <html><body>
        <img src="photo1.jpg" alt="A photo">
        <img src="photo2.jpg">
        <img src="photo3.jpg" alt="">
      </body></html>
    `;
    const parsed = parseHtml(html);
    const passed = parsed.images.length === 3;
    const withAlt = parsed.images.filter((i) => i.alt && i.alt.length > 0).length;
    results.push({
      name: 'Parse images and alt text',
      passed: passed && withAlt === 1,
      details: `Total: ${parsed.images.length}, with alt: ${withAlt}`,
    });
  }

  // ── Test 5: Parse links ────────────────────────────────────────────
  {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="https://external.com">External</a>
        <a href="/contact" rel="nofollow">Contact</a>
      </body></html>
    `;
    const parsed = parseHtml(html);
    const passed = parsed.links.length === 3;
    const nofollow = parsed.links.filter((l) => l.rel === 'nofollow').length;
    results.push({
      name: 'Parse links and rel attributes',
      passed: passed && nofollow === 1,
      details: `Links: ${parsed.links.length}, nofollow: ${nofollow}`,
    });
  }

  // ── Test 6: Parse Open Graph tags ──────────────────────────────────
  {
    const html = `
      <html><head>
        <meta property="og:title" content="OG Title">
        <meta property="og:description" content="OG Description">
        <meta property="og:image" content="https://example.com/image.jpg">
      </head><body></body></html>
    `;
    const parsed = parseHtml(html);
    const passed =
      parsed.ogTitle === 'OG Title' &&
      parsed.ogDescription === 'OG Description' &&
      parsed.ogImage === 'https://example.com/image.jpg';
    results.push({
      name: 'Parse Open Graph tags',
      passed,
      details: `og:title="${parsed.ogTitle}", og:desc="${parsed.ogDescription}", og:image="${parsed.ogImage}"`,
    });
  }

  // ── Test 7: Parse schema markup ────────────────────────────────────
  {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@type": "Article", "name": "Test"}</script>
      </head><body></body></html>
    `;
    const parsed = parseHtml(html);
    const passed = parsed.schemaMarkup.length === 1 && parsed.schemaMarkup[0].includes('"Article"');
    results.push({
      name: 'Parse JSON-LD schema markup',
      passed,
      details: `Found ${parsed.schemaMarkup.length} schema(s)`,
    });
  }

  // ── Test 8: Word count ─────────────────────────────────────────────
  {
    const html = '<html><body><p>One two three four five six seven eight nine ten.</p><script>var x = "this should not be counted";</script></body></html>';
    const parsed = parseHtml(html);
    const passed = parsed.wordCount === 10;
    results.push({
      name: 'Word count (excluding script tags)',
      passed,
      details: `Word count: ${parsed.wordCount} (expected 10)`,
    });
  }

  // ── Test 9: Canonical URL ──────────────────────────────────────────
  {
    const html = '<html><head><link rel="canonical" href="https://example.com/page"></head><body></body></html>';
    const parsed = parseHtml(html);
    const passed = parsed.canonical === 'https://example.com/page';
    results.push({
      name: 'Parse canonical URL',
      passed,
      details: `Canonical: "${parsed.canonical}"`,
    });
  }

  // ── Test 10: Classify links ────────────────────────────────────────
  {
    const base = 'https://example.com/page';
    const internal = classifyLink('/about', base);
    const external = classifyLink('https://other.com', base);
    const mailto = classifyLink('mailto:test@test.com', base);
    const hash = classifyLink('#section', base);

    const passed =
      internal === 'internal' &&
      external === 'external' &&
      mailto === 'other' &&
      hash === 'other';
    results.push({
      name: 'Classify link types',
      passed,
      details: `internal="${internal}", external="${external}", mailto="${mailto}", hash="${hash}"`,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { passed, failed, results };
}
