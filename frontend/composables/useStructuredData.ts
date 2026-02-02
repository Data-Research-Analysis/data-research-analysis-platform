/**
 * Composable for generating Schema.org structured data (JSON-LD)
 * Used for AI search optimization (ChatGPT, Perplexity, Claude, Gemini)
 * and traditional SEO (Google Rich Snippets)
 */

export interface ArticleSchemaData {
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  author?: {
    name: string;
    jobTitle?: string;
  };
  categories?: string[];
  slug: string;
  content?: string;
  image?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export const useStructuredData = () => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
  
  /**
   * Generate Organization schema (site-wide)
   */
  const getOrganizationSchema = () => {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Data Research Analysis',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
      description: 'AI-powered marketing data analytics platform for CMOs and marketing executives. Unify data from Google Ads, Analytics, and SQL databases.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '1327 D Street 26 Phase 6 Defence Housing Authority',
        addressLocality: 'Lahore',
        addressRegion: 'Punjab',
        addressCountry: 'Pakistan'
      },
      foundingDate: '2024',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        email: 'support@dataresearchanalysis.com'
      }
    };
  };

  /**
   * Generate SoftwareApplication schema (for landing page)
   */
  const getSoftwareApplicationSchema = () => {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Data Research Analysis',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free trial available'
      },
      description: 'AI-powered marketing data analytics platform that unifies data from Google Ads, Google Analytics, SQL databases, CSV, Excel, and PDF files. Build custom dashboards and get actionable insights for marketing ROI.',
      featureList: [
        'Multi-source data integration (Google Ads, Analytics, SQL, CSV, Excel, PDF)',
        'AI-powered data model builder',
        'Custom interactive dashboards',
        'Cross-source data joining',
        'Real-time marketing analytics',
        'ROI tracking and reporting',
        'Automated data visualization',
        'CMO-focused insights'
      ],
      screenshot: `${baseUrl}/images/dashboard-screenshot.png`,
      softwareVersion: '2.0',
      datePublished: '2024-07-01',
      author: {
        '@type': 'Organization',
        name: 'Data Research Analysis'
      }
    };
  };

  /**
   * Generate Article schema (for blog posts)
   */
  const getArticleSchema = (article: ArticleSchemaData) => {
    // Extract plain text from HTML content for better AI parsing
    let plainTextContent = '';
    if (article.content) {
      plainTextContent = article.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit for performance
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.headline,
      description: article.description,
      image: article.image || `${baseUrl}/logo-words.svg`,
      author: {
        '@type': 'Person',
        name: article.author?.name || 'Data Research Analysis Team',
        jobTitle: article.author?.jobTitle || 'Data Analytics Expert',
        url: `${baseUrl}/about`
      },
      publisher: {
        '@type': 'Organization',
        name: 'Data Research Analysis',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo.png`,
          width: 600,
          height: 60
        }
      },
      datePublished: article.datePublished,
      dateModified: article.dateModified,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/articles/${article.slug}`
      },
      articleBody: plainTextContent,
      keywords: article.categories?.join(', ') || 'data analytics, marketing analytics',
      articleSection: 'Marketing Analytics',
      inLanguage: 'en-US'
    };
  };

  /**
   * Generate FAQ schema (for landing page and content pages)
   */
  const getFAQSchema = (faqs: FAQItem[]) => {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };
  };

  /**
   * Generate BreadcrumbList schema (for all pages)
   */
  const getBreadcrumbSchema = (items: BreadcrumbItem[]) => {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url
      }))
    };
  };

  /**
   * Generate WebPage schema (for legal and content pages)
   */
  const getWebPageSchema = (title: string, description: string, url: string, lastReviewed?: string) => {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      url: url,
      lastReviewed: lastReviewed || new Date().toISOString().split('T')[0],
      inLanguage: 'en-US',
      publisher: {
        '@type': 'Organization',
        name: 'Data Research Analysis'
      }
    };
  };

  /**
   * Generate ItemList schema (for article listings)
   */
  const getItemListSchema = (articles: Array<{ title: string; slug: string; description: string; date: string }>) => {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${baseUrl}/articles/${article.slug}`,
        name: article.title,
        description: article.description,
        datePublished: article.date
      }))
    };
  };

  /**
   * Generate SearchAction schema (site-wide search)
   */
  const getSearchActionSchema = () => {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${baseUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    };
  };

  /**
   * Inject JSON-LD script into page head
   */
  const injectSchema = (schema: any) => {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(schema)
        }
      ]
    });
  };

  /**
   * Inject multiple schemas at once
   */
  const injectMultipleSchemas = (schemas: any[]) => {
    useHead({
      script: schemas.map(schema => ({
        type: 'application/ld+json',
        innerHTML: JSON.stringify(schema)
      }))
    });
  };

  return {
    getOrganizationSchema,
    getSoftwareApplicationSchema,
    getArticleSchema,
    getFAQSchema,
    getBreadcrumbSchema,
    getWebPageSchema,
    getItemListSchema,
    getSearchActionSchema,
    injectSchema,
    injectMultipleSchemas
  };
};
