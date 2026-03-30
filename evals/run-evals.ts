import { runHtmlParserEvals } from './eval-html-parser.js';
import { runSeoScorerEvals } from './eval-seo-scorer.js';
import { runSerpMetaEvals } from './eval-serp-meta.js';

console.log('========================================');
console.log('  SEO MCP Server — Evaluation Suite');
console.log('========================================\n');

// ── HTML Parser Evals ───────────────────────────────────────────────

console.log('--- HTML Parser Evals ---\n');

const parserResults = runHtmlParserEvals();

for (const r of parserResults.results) {
  const icon = r.passed ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${r.name}`);
  console.log(`         ${r.details}`);
}

console.log(
  `\n  HTML Parser: ${parserResults.passed}/${parserResults.passed + parserResults.failed} passed\n`,
);

// ── SEO Scorer Evals ────────────────────────────────────────────────

console.log('--- SEO Scorer Evals ---\n');

const scorerResults = runSeoScorerEvals();

for (const r of scorerResults.results) {
  const icon = r.passed ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${r.name}`);
  console.log(`         ${r.details}`);
}

console.log(
  `\n  SEO Scorer: ${scorerResults.passed}/${scorerResults.passed + scorerResults.failed} passed\n`,
);

// ── SERP & Meta Evals ───────────────────────────────────────────────

console.log('--- SERP & Meta Evals ---\n');

const serpResults = runSerpMetaEvals();

for (const r of serpResults.results) {
  const icon = r.passed ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${r.name}`);
  console.log(`         ${r.details}`);
}

console.log(
  `\n  SERP & Meta: ${serpResults.passed}/${serpResults.passed + serpResults.failed} passed\n`,
);

// ── Summary ─────────────────────────────────────────────────────────

const totalPassed = parserResults.passed + scorerResults.passed + serpResults.passed;
const totalFailed = parserResults.failed + scorerResults.failed + serpResults.failed;
const total = totalPassed + totalFailed;

console.log('========================================');
console.log(`  TOTAL: ${totalPassed}/${total} passed`);

if (totalFailed > 0) {
  console.log(`  ${totalFailed} failure(s)`);
}

console.log('========================================');

process.exit(totalFailed > 0 ? 1 : 0);
