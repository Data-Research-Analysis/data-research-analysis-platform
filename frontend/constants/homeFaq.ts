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
        answer: 'Data Research Analysis is an AI-powered paid media plan builder for CMOs and digital marketing teams. Point it at your website and it builds a channel-by-channel plan — where to spend, how much, and what to create — then track how those campaigns perform and improve your ad and marketing spend.'
    },
    {
        question: 'How does the paid media plan builder work?',
        answer: 'Enter your website and the AI analyzes it, then builds a channel-by-channel paid media plan with recommended budgets, targets, and a creative playbook for each channel. You get a defensible plan in minutes — no spreadsheets and no guesswork.'
    },
    {
        question: 'Can I try it before signing up?',
        answer: 'Yes. The free preview gives you a working plan without an account. When you register, you keep the plan and can continue building and tracking your campaigns.'
    },
    {
        question: 'Which channels does it plan for and track?',
        answer: 'The plan covers the channels that drive paid media — Google Ads, Meta, Google Analytics, and Google Ad Manager — connected securely via OAuth. You can also add Excel, CSV, and PDF files, and SQL databases such as PostgreSQL and MySQL when you need them.'
    },
    {
        question: 'Do I need technical skills to use Data Research Analysis?',
        answer: 'No. The product is built for CMOs, performance marketers, and digital marketing teams. The AI does the planning and the tracking — there are no spreadsheets to maintain and no engineering tickets to open.'
    },
    {
        question: 'How is Data Research Analysis different from a BI or analytics tool?',
        answer: 'BI tools visualize data but do not tell you where to spend. Data Research Analysis builds the plan first — where to spend, how much, and what to create — then tracks how those campaigns perform so you can cut waste and put budget behind what works.'
    },
    {
        question: 'Is my data secure?',
        answer: 'Yes. All sensitive data including connection credentials and OAuth tokens are encrypted at rest using AES-256 encryption. We follow industry best practices for data security and are compliant with GDPR and international data protection standards.'
    },
    {
        question: 'Can I share plans and results with my team?',
        answer: 'Absolutely. You can create projects and invite team members with different permission levels (Owner, Editor, Viewer). Dashboards and reports can also be shared via public links for stakeholder reporting.'
    },
    {
        question: 'How much does Data Research Analysis cost?',
        answer: 'We offer 5 plans. FREE is always free (1 project, 4 channels, 1 paid media plan build/month, 10 AI generations/month). STARTER is $29/month with 5 paid media plan builds, unlimited channels, and deck/PPT export. PROFESSIONAL is $129/month with unlimited projects, unlimited paid media plan builds, unlimited AI (fair-use), 5M rows per manual data model, and 2-5 team members. PROFESSIONAL PLUS is $399/month for 100M rows per manual data model and 6-100 team members. ENTERPRISE is custom pricing tailored to your needs.'
    },
    {
        question: 'Can I upgrade or downgrade my plan?',
        answer: 'Yes! Contact our sales team to discuss plan changes. We\'ll ensure a smooth transition with no data loss. You can also start with the FREE plan to test the platform before committing to a paid tier.'
    },
    {
        question: 'Is there a free trial for paid plans?',
        answer: 'We recommend starting with our FREE plan to test the platform with 1 project, 4 channels, and 1 paid media plan build per month. For enterprise needs or specific feature testing, contact sales for a customized evaluation.'
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
