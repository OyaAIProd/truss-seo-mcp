import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { researchKeyword } from '../services/keyword-suggest.js';
import { generateAiContent, hasAiCapability } from '../services/ai-service.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';
import type { ContentSection } from '../types.js';

/**
 * Generate questions people ask about a keyword (rule-based).
 */
function generateQuestions(keyword: string): string[] {
  const patterns = [
    `What is ${keyword}?`,
    `How does ${keyword} work?`,
    `Why is ${keyword} important?`,
    `What are the benefits of ${keyword}?`,
    `How to get started with ${keyword}?`,
    `What are common mistakes with ${keyword}?`,
    `How much does ${keyword} cost?`,
    `What are the best ${keyword} tools?`,
    `${keyword} vs alternatives: which is better?`,
    `How to improve ${keyword} results?`,
  ];
  return patterns;
}

/**
 * Generate a rule-based content outline.
 */
function generateRuleBasedOutline(
  keyword: string,
  contentType: string,
  relatedKeywords: string[],
): ContentSection[] {
  const sections: ContentSection[] = [];

  switch (contentType) {
    case 'blog':
      sections.push(
        { heading: `What is ${keyword}?`, level: 2, talking_points: ['Definition', 'Context and background', 'Why it matters'] },
        { heading: `Why ${keyword} Matters`, level: 2, talking_points: ['Key benefits', 'Industry impact', 'Statistics and data'] },
        { heading: `How to ${keyword}: Step-by-Step Guide`, level: 2, talking_points: ['Prerequisites', 'Step 1: Getting started', 'Step 2: Implementation', 'Step 3: Optimization'] },
        { heading: 'Best Practices', level: 2, talking_points: ['Do\'s and don\'ts', 'Expert tips', 'Common pitfalls to avoid'] },
        { heading: 'Tools and Resources', level: 2, talking_points: ['Recommended tools', 'Free vs paid options', 'Resource links'] },
      );
      if (relatedKeywords.length > 0) {
        sections.push({
          heading: 'Frequently Asked Questions',
          level: 2,
          talking_points: relatedKeywords.slice(0, 5).map((kw) => `Q: ${kw}`),
        });
      }
      sections.push({
        heading: 'Conclusion',
        level: 2,
        talking_points: ['Key takeaways', 'Next steps', 'Call to action'],
      });
      break;

    case 'landing':
      sections.push(
        { heading: `Hero: ${keyword}`, level: 2, talking_points: ['Value proposition', 'Primary benefit', 'CTA'] },
        { heading: 'Problem', level: 2, talking_points: ['Pain point identification', 'Empathy', 'Cost of inaction'] },
        { heading: 'Solution', level: 2, talking_points: ['How it works', 'Key features', 'Differentiators'] },
        { heading: 'Social Proof', level: 2, talking_points: ['Testimonials', 'Case studies', 'Trust signals'] },
        { heading: 'Pricing / CTA', level: 2, talking_points: ['Clear pricing', 'Guarantees', 'Final CTA'] },
      );
      break;

    case 'product':
      sections.push(
        { heading: `${keyword} Overview`, level: 2, talking_points: ['Product description', 'Key features', 'Use cases'] },
        { heading: 'Features', level: 2, talking_points: ['Feature 1 with benefit', 'Feature 2 with benefit', 'Feature 3 with benefit'] },
        { heading: 'Specifications', level: 2, talking_points: ['Technical specs', 'Dimensions/requirements', 'Compatibility'] },
        { heading: 'How It Works', level: 2, talking_points: ['Setup process', 'Usage guide', 'Tips'] },
        { heading: 'Reviews', level: 2, talking_points: ['Customer testimonials', 'Ratings', 'Common feedback'] },
        { heading: 'FAQ', level: 2, talking_points: ['Shipping info', 'Returns policy', 'Support'] },
      );
      break;
  }

  return sections;
}

function getTargetWordCount(contentType: string): number {
  switch (contentType) {
    case 'blog':
      return 1500;
    case 'landing':
      return 800;
    case 'product':
      return 1000;
    default:
      return 1200;
  }
}

export function registerContentBrief(server: McpServer): void {
  server.tool(
    'content_brief',
    'Generate an SEO content brief for a target keyword — outline, word count target, related keywords, and questions to answer. Enhanced with AI when API key is provided. PRO feature ($29/mo).',
    {
      keyword: z.string().min(1).describe('Target keyword to create a content brief for'),
      content_type: z
        .enum(['blog', 'landing', 'product'])
        .describe('Type of content: blog post, landing page, or product page'),
    },
    async ({ keyword, content_type }) => {
      try {
        await requirePro();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message, upgrade_url: 'https://truss.dev/seo' }, null, 2),
            },
          ],
        };
      }

      try {
        // Get related keywords (limited to avoid rate limits)
        let relatedKeywords: string[] = [];
        try {
          const kwResults = await researchKeyword(keyword, 10);
          relatedKeywords = kwResults.map((r) => r.keyword);
        } catch {
          // Non-fatal — continue without related keywords
        }

        const questions = generateQuestions(keyword);
        const targetWordCount = getTargetWordCount(content_type);

        let outline: ContentSection[];
        let competitorGaps: string[] = [];
        let aiEnhanced = false;

        if (hasAiCapability()) {
          const aiResult = await generateAiContent(
            `Create a detailed SEO content brief for the keyword "${keyword}" as a ${content_type} page.\n\nRelated keywords: ${relatedKeywords.join(', ')}\nTarget word count: ${targetWordCount}\n\nReturn a JSON object with:\n- outline: array of { heading: string, level: number (2 or 3), talking_points: string[] }\n- competitor_gaps: string[] (opportunities most competitors miss)\n- additional_keywords: string[] (LSI keywords to include)\n\nReturn ONLY valid JSON, no markdown.`,
            'You are an expert SEO content strategist. Generate comprehensive, actionable content briefs optimized for search rankings. Return only valid JSON.',
          );

          if (aiResult.ai_used) {
            try {
              const parsed = JSON.parse(aiResult.text);
              if (Array.isArray(parsed.outline)) {
                outline = parsed.outline;
                competitorGaps = parsed.competitor_gaps || [];
                if (parsed.additional_keywords) {
                  relatedKeywords = [...new Set([...relatedKeywords, ...parsed.additional_keywords])];
                }
                aiEnhanced = true;
              } else {
                outline = generateRuleBasedOutline(keyword, content_type, relatedKeywords);
              }
            } catch {
              outline = generateRuleBasedOutline(keyword, content_type, relatedKeywords);
            }
          } else {
            outline = generateRuleBasedOutline(keyword, content_type, relatedKeywords);
          }
        } else {
          outline = generateRuleBasedOutline(keyword, content_type, relatedKeywords);
          competitorGaps = [
            'Include original data or research',
            'Add expert quotes or interviews',
            'Create custom visuals or infographics',
            'Cover advanced use cases most articles skip',
            'Include a downloadable resource (checklist, template)',
          ];
        }

        recordToolUsage('content_brief');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  keyword,
                  content_type,
                  outline,
                  target_word_count: targetWordCount,
                  related_keywords: relatedKeywords,
                  questions_to_answer: questions,
                  competitor_gaps: competitorGaps,
                  ai_enhanced: aiEnhanced,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Content brief generation failed: ${message}` }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
