import { parseHtml } from '../src/services/html-parser.js';
import { scorePage, calculateReadability, analyzeKeywordDensity } from '../src/services/seo-scorer.js';

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

export function runSeoScorerEvals(): EvalSuite {
  const results: EvalResult[] = [];

  // ── Test 1: Perfect page scores high ───────────────────────────────
  {
    const html = `
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Complete SEO Guide: Everything You Need to Know</title>
        <meta name="description" content="Learn the essential strategies for search engine optimization. This comprehensive guide covers keyword research, on-page SEO, and technical optimization.">
        <link rel="canonical" href="https://example.com/seo-guide">
        <meta property="og:title" content="Complete SEO Guide">
        <meta property="og:description" content="Learn essential SEO strategies">
        <meta property="og:image" content="https://example.com/image.jpg">
        <script type="application/ld+json">{"@type": "Article"}</script>
      </head>
      <body>
        <h1>Complete SEO Guide</h1>
        <h2>Chapter 1: Introduction</h2>
        <p>${'Lorem ipsum dolor sit amet. '.repeat(50)}</p>
        <img src="photo.jpg" alt="SEO illustration">
        <a href="/about">About us</a>
        <a href="https://external.com">External resource</a>
        <h2>Chapter 2: Keyword Research</h2>
        <p>${'Keyword research strategies content here. '.repeat(30)}</p>
      </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com/seo-guide', 800);

    const passed = result.score >= 85;
    results.push({
      name: 'Well-optimized page scores 85+',
      passed,
      details: `Score: ${result.score}, Issues: ${result.issues.length}, Suggestions: ${result.suggestions.length}`,
    });
  }

  // ── Test 2: Missing title gets critical issue ──────────────────────
  {
    const html = '<html><head></head><body><p>Some content here.</p></body></html>';
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 500);

    const hasTitleIssue = result.issues.some(
      (i) => i.category === 'title' && i.severity === 'critical',
    );
    results.push({
      name: 'Missing title produces critical issue',
      passed: hasTitleIssue,
      details: `Score: ${result.score}, Title issue found: ${hasTitleIssue}`,
    });
  }

  // ── Test 3: Thin content warning ───────────────────────────────────
  {
    const html = '<html><head><title>Short Page</title></head><body><h1>Title</h1><p>Very short content.</p></body></html>';
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 500);

    const hasContentIssue = result.issues.some((i) => i.category === 'content');
    results.push({
      name: 'Thin content produces warning',
      passed: hasContentIssue,
      details: `Word count: ${result.metadata.wordCount}, Content issue: ${hasContentIssue}`,
    });
  }

  // ── Test 4: Missing meta description ───────────────────────────────
  {
    const html = '<html><head><title>No Meta Page</title></head><body><h1>Title</h1></body></html>';
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 500);

    const hasMetaIssue = result.issues.some(
      (i) => i.category === 'meta_description' && i.severity === 'critical',
    );
    results.push({
      name: 'Missing meta description produces critical issue',
      passed: hasMetaIssue,
      details: `Meta issue found: ${hasMetaIssue}`,
    });
  }

  // ── Test 5: Multiple H1 tags ───────────────────────────────────────
  {
    const html = `
      <html><head><title>Test</title></head><body>
        <h1>First H1</h1>
        <h1>Second H1</h1>
      </body></html>
    `;
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 500);

    const hasMultipleH1 = result.issues.some(
      (i) => i.category === 'headings' && i.message.includes('Multiple'),
    );
    results.push({
      name: 'Multiple H1 tags produces warning',
      passed: hasMultipleH1,
      details: `H1 count: ${result.metadata.h1.length}, Warning: ${hasMultipleH1}`,
    });
  }

  // ── Test 6: Readability calculation ────────────────────────────────
  {
    const easyText = 'The cat sat on the mat. The dog ran fast. It was a sunny day. They played in the park.';
    const easy = calculateReadability(easyText);

    const hardText =
      'Notwithstanding the aforementioned complexities inherent in the epistemological framework, the ontological ramifications of such phenomenological constructs necessitate a comprehensive reevaluation of existing paradigmatic assumptions underlying contemporary theoretical discourse.';
    const hard = calculateReadability(hardText);

    const passed = easy.score > hard.score;
    results.push({
      name: 'Readability: simple text scores higher than complex',
      passed,
      details: `Easy: ${easy.score} (${easy.gradeLevel}), Hard: ${hard.score} (${hard.gradeLevel})`,
    });
  }

  // ── Test 7: Keyword density calculation ────────────────────────────
  {
    const text = 'SEO is important for marketing. SEO helps websites rank higher. Good SEO practices improve visibility.';
    const density = analyzeKeywordDensity(text, ['SEO', 'marketing'], 'SEO Guide', ['SEO Best Practices'], 'Learn SEO marketing');

    const seoDensity = density['SEO'];
    const marketingDensity = density['marketing'];

    const passed =
      seoDensity.count === 3 &&
      seoDensity.inTitle === true &&
      seoDensity.inH1 === true &&
      seoDensity.inMetaDescription === true &&
      marketingDensity.count === 1;

    results.push({
      name: 'Keyword density analysis',
      passed,
      details: `SEO: count=${seoDensity.count}, density=${seoDensity.density}%, inTitle=${seoDensity.inTitle}, inH1=${seoDensity.inH1} | marketing: count=${marketingDensity.count}`,
    });
  }

  // ── Test 8: Score stays in 0-100 range ─────────────────────────────
  {
    // Worst possible page
    const html = '<html><body></body></html>';
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 10000);

    const passed = result.score >= 0 && result.score <= 100;
    results.push({
      name: 'Score stays in 0-100 range (worst page)',
      passed,
      details: `Score: ${result.score}`,
    });
  }

  // ── Test 9: Images without alt text ────────────────────────────────
  {
    const html = `
      <html><head><title>Image Test</title></head><body>
        <h1>Images</h1>
        <img src="a.jpg">
        <img src="b.jpg">
        <img src="c.jpg" alt="Has alt">
      </body></html>
    `;
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 500);

    const hasImageIssue = result.issues.some((i) => i.category === 'images');
    const passed = hasImageIssue && result.metadata.imagesWithAlt === 1 && result.metadata.imageCount === 3;
    results.push({
      name: 'Images without alt text detected',
      passed,
      details: `Total: ${result.metadata.imageCount}, With alt: ${result.metadata.imagesWithAlt}, Issue: ${hasImageIssue}`,
    });
  }

  // ── Test 10: Load time warning ─────────────────────────────────────
  {
    const html = '<html><head><title>Slow Page</title><meta name="description" content="Test"></head><body><h1>Title</h1></body></html>';
    const parsed = parseHtml(html);
    const result = scorePage(parsed, 'https://example.com', 4000);

    const hasPerfIssue = result.issues.some((i) => i.category === 'performance');
    results.push({
      name: 'Slow load time produces warning',
      passed: hasPerfIssue,
      details: `Load time: 4000ms, Performance issue: ${hasPerfIssue}`,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { passed, failed, results };
}
