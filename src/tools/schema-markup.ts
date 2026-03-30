import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchPage } from '../services/fetcher.js';
import { parseHtml } from '../services/html-parser.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';
import type { SchemaType } from '../types.js';

function generateArticleSchema(parsed: ReturnType<typeof parseHtml>, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: parsed.title || parsed.h1[0] || '',
    description: parsed.metaDescription || '',
    url,
    image: parsed.ogImage || '',
    author: {
      '@type': 'Person',
      name: '[Author Name]',
    },
    publisher: {
      '@type': 'Organization',
      name: '[Publisher Name]',
      logo: {
        '@type': 'ImageObject',
        url: '[Logo URL]',
      },
    },
    datePublished: '[YYYY-MM-DD]',
    dateModified: '[YYYY-MM-DD]',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

function generateProductSchema(parsed: ReturnType<typeof parseHtml>, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: parsed.title || parsed.h1[0] || '[Product Name]',
    description: parsed.metaDescription || '',
    url,
    image: parsed.ogImage || '[Product Image URL]',
    brand: {
      '@type': 'Brand',
      name: '[Brand Name]',
    },
    offers: {
      '@type': 'Offer',
      price: '[Price]',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '[4.5]',
      reviewCount: '[100]',
    },
  };
}

function generateFaqSchema(parsed: ReturnType<typeof parseHtml>): object {
  // Try to extract Q&A from headings
  const questions: Array<{ q: string; a: string }> = [];

  for (let i = 0; i < parsed.h2.length; i++) {
    const heading = parsed.h2[i];
    if (heading.includes('?') || heading.toLowerCase().startsWith('how') || heading.toLowerCase().startsWith('what') || heading.toLowerCase().startsWith('why') || heading.toLowerCase().startsWith('when') || heading.toLowerCase().startsWith('can')) {
      questions.push({
        q: heading,
        a: `[Answer for: ${heading}]`,
      });
    }
  }

  // If no questions found in headings, generate placeholder
  if (questions.length === 0) {
    questions.push(
      { q: '[Question 1]', a: '[Answer 1]' },
      { q: '[Question 2]', a: '[Answer 2]' },
      { q: '[Question 3]', a: '[Answer 3]' },
    );
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.a,
      },
    })),
  };
}

function generateHowToSchema(parsed: ReturnType<typeof parseHtml>, url: string): object {
  // Use H2/H3 headings as steps
  const steps = parsed.h2.length > 1 ? parsed.h2 : parsed.h3;

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: parsed.title || parsed.h1[0] || '[How-To Title]',
    description: parsed.metaDescription || '',
    url,
    image: parsed.ogImage || '',
    totalTime: 'PT[X]M',
    step: steps.length > 0
      ? steps.map((heading, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: heading,
          text: `[Description for step: ${heading}]`,
        }))
      : [
          { '@type': 'HowToStep', position: 1, name: '[Step 1]', text: '[Description]' },
          { '@type': 'HowToStep', position: 2, name: '[Step 2]', text: '[Description]' },
          { '@type': 'HowToStep', position: 3, name: '[Step 3]', text: '[Description]' },
        ],
  };
}

function generateRecipeSchema(parsed: ReturnType<typeof parseHtml>, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: parsed.title || parsed.h1[0] || '[Recipe Name]',
    description: parsed.metaDescription || '',
    url,
    image: parsed.ogImage || '[Recipe Image URL]',
    author: {
      '@type': 'Person',
      name: '[Author Name]',
    },
    prepTime: 'PT[X]M',
    cookTime: 'PT[X]M',
    totalTime: 'PT[X]M',
    recipeYield: '[X servings]',
    recipeCategory: '[Category]',
    recipeCuisine: '[Cuisine]',
    recipeIngredient: ['[Ingredient 1]', '[Ingredient 2]', '[Ingredient 3]'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: '[Step 1]' },
      { '@type': 'HowToStep', text: '[Step 2]' },
      { '@type': 'HowToStep', text: '[Step 3]' },
    ],
    nutrition: {
      '@type': 'NutritionInformation',
      calories: '[X] calories',
    },
  };
}

function generateEventSchema(parsed: ReturnType<typeof parseHtml>, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: parsed.title || parsed.h1[0] || '[Event Name]',
    description: parsed.metaDescription || '',
    url,
    image: parsed.ogImage || '',
    startDate: '[YYYY-MM-DDTHH:MM:SS]',
    endDate: '[YYYY-MM-DDTHH:MM:SS]',
    location: {
      '@type': 'Place',
      name: '[Venue Name]',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '[Street]',
        addressLocality: '[City]',
        addressRegion: '[State]',
        postalCode: '[Zip]',
        addressCountry: '[Country]',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: '[Organizer Name]',
      url: '[Organizer URL]',
    },
    offers: {
      '@type': 'Offer',
      price: '[Price]',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
    },
  };
}

export function registerSchemaMarkup(server: McpServer): void {
  server.tool(
    'schema_markup',
    'Generate JSON-LD structured data for a page — supports Article, Product, FAQ, HowTo, Recipe, and Event types. Fetches the page to auto-populate fields. PRO feature ($29/mo).',
    {
      url: z.string().url().describe('URL of the page to generate schema markup for'),
      type: z
        .enum(['article', 'product', 'faq', 'howto', 'recipe', 'event'])
        .describe('Schema type: article, product, faq, howto, recipe, or event'),
    },
    async ({ url, type }) => {
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
        const result = await fetchPage(url);
        const parsed = parseHtml(result.html);

        let jsonLd: object;
        const schemaType = type as SchemaType;

        switch (schemaType) {
          case 'article':
            jsonLd = generateArticleSchema(parsed, url);
            break;
          case 'product':
            jsonLd = generateProductSchema(parsed, url);
            break;
          case 'faq':
            jsonLd = generateFaqSchema(parsed);
            break;
          case 'howto':
            jsonLd = generateHowToSchema(parsed, url);
            break;
          case 'recipe':
            jsonLd = generateRecipeSchema(parsed, url);
            break;
          case 'event':
            jsonLd = generateEventSchema(parsed, url);
            break;
        }

        const jsonLdString = JSON.stringify(jsonLd, null, 2);
        const htmlSnippet = `<script type="application/ld+json">\n${jsonLdString}\n</script>`;

        // Validation notes
        const validationNotes: string[] = [];
        const jsonStr = JSON.stringify(jsonLd);

        if (jsonStr.includes('[')) {
          const placeholders = jsonStr.match(/\[[^\]]*\]/g) || [];
          const realPlaceholders = placeholders.filter((p) => p.startsWith('[') && !p.startsWith('["'));
          if (realPlaceholders.length > 0) {
            validationNotes.push(
              `${realPlaceholders.length} placeholder(s) need to be filled in (marked with [brackets])`,
            );
          }
        }

        if (parsed.schemaMarkup.length > 0) {
          validationNotes.push(
            'Page already has existing JSON-LD markup — check for conflicts before adding this schema',
          );
        }

        validationNotes.push(
          'Validate at https://search.google.com/test/rich-results before deploying',
        );
        validationNotes.push(
          'Test with https://validator.schema.org/ for full schema.org compliance',
        );

        recordToolUsage('schema_markup');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  type: schemaType,
                  json_ld: jsonLd,
                  html_snippet: htmlSnippet,
                  validation_notes: validationNotes,
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
              text: JSON.stringify(
                { error: `Schema markup generation failed: ${message}`, url },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
