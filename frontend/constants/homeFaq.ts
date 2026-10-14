/**
 * Homepage FAQ content.
 *
 * Shared between the visible FAQ section (components/faq-section.vue) and the
 * FAQPage JSON-LD injected in pages/index.vue. Keeping it in one place lets the
 * structured data be emitted during SSR (setup) instead of after mount.
 */
export interface HomeFaqItem {
    question: string;
    answer: string;
}

export const HOME_FAQ_DATA: HomeFaqItem[] = [
    {
        question: 'What is Data Research Analysis?',
        answer: 'Data Research Analysis is an AI-powered marketing analytics platform that unifies data from Google Ads, Google Analytics, SQL databases, CSV, Excel, and PDF files. It helps CMOs and marketing executives build custom dashboards and get actionable insights for marketing ROI without requiring technical expertise.'
    },
    {
        question: 'How does Data Research Analysis integrate with Google Ads and Analytics?',
        answer: 'Our platform connects directly to your Google Ads and Google Analytics accounts via secure OAuth authentication. Once connected, it automatically imports campaign data, performance metrics, conversion tracking, and audience insights for comprehensive cross-channel analysis.'
    },
    {
        question: 'Can I connect multiple data sources?',
        answer: 'Yes! You can connect unlimited data sources including PostgreSQL, MySQL, MariaDB databases, CSV files, Excel spreadsheets, and PDF documents. Our AI-powered data model builder helps you join data across sources for unified reporting.'
    },
    {
        question: 'Do I need technical skills to use Data Research Analysis?',
        answer: 'No technical skills required. Our AI Data Modeler uses natural language to help you build data models and dashboards. Simply describe what insights you need, and our AI will generate the appropriate data structures and visualizations.'
    },
    {
        question: 'How is Data Research Analysis different from a general BI tool?',
        answer: 'General BI tools visualize data but do not solve the data integration problem. Data Research Analysis is built for marketing executives: it unifies Google Ads, Analytics, SQL, CSV, and PDF sources first, then builds CMO-focused dashboards on top. No complex setup or data engineering required.'
    },
    {
        question: 'Is my data secure?',
        answer: 'Yes. All sensitive data including connection credentials and OAuth tokens are encrypted at rest using AES-256 encryption. We follow industry best practices for data security and are compliant with GDPR and international data protection standards.'
    },
    {
        question: 'Can I share dashboards with my team?',
        answer: 'Absolutely. You can create projects and invite team members with different permission levels (Owner, Editor, Viewer). Dashboards can also be shared via public links for stakeholder reporting.'
    },
    {
        question: 'How much does Data Research Analysis cost?',
        answer: 'We offer 5 plans. FREE is always free (50K rows, 3 projects, 5 data sources, 10 AI generations/month). STARTER is $29/month. PROFESSIONAL is $129/month with unlimited projects, data sources, and dashboards, plus 2-5 team members. PROFESSIONAL PLUS is $399/month for unlimited everything and 6-100 team members. ENTERPRISE is custom pricing tailored to your needs.'
    },
    {
        question: 'Can I upgrade or downgrade my plan?',
        answer: 'Yes! Contact our sales team to discuss plan changes. We\'ll ensure a smooth transition with no data loss. You can also start with the FREE plan to test the platform before committing to a paid tier.'
    },
    {
        question: 'Is there a free trial for paid plans?',
        answer: 'We recommend starting with our FREE plan to test the platform with 50K rows, 3 projects, and 10 AI generations per month. For enterprise needs or specific feature testing, contact sales for a customized evaluation.'
    },
    {
        question: 'Do you offer annual discounts?',
        answer: 'Yes. Annual billing saves you money on paid tiers. STARTER drops from $29/month to the equivalent of $23/month ($276/year). PROFESSIONAL drops from $129/month to the equivalent of $103/month ($1,236/year), saving $312 annually. PROFESSIONAL PLUS drops from $399/month to the equivalent of $319/month ($3,828/year), saving $960 annually. ENTERPRISE is custom pricing.'
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We\'re currently in private beta. Contact our sales team to discuss payment options and custom enterprise agreements for your organization.'
    }
];
