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
        answer: 'Data Research Analysis (DRA) is an AI paid-media operating system for CMOs, performance marketers, and digital marketing teams. Plan Studio turns your website and brief into a channel-by-channel paid media plan — where to spend, how much, and what to create — then tracks campaigns against that plan with targets, attribution, dashboards, reports, and AI insights.'
    },
    {
        question: 'How does the paid media plan builder work?',
        answer: 'Enter your website, target platforms, markets, budget, and dates. In Basic mode the AI runs the full 18-step pipeline without follow-up questions; Advanced mode adds a detailed brief covering industry, product, competitors, existing channels, team, and autonomy. You review five human checkpoints — funnel/build mode, brief, destination URLs, tracking, and pre-launch QA — and receive a media plan, creative brief, ad and landing-page copy, tracking setup, campaign build guide, QA checklist, and strategy deck. Deliverables are versioned in the plan, and the strategy deck exports as a PPTX on every plan (50 credits per export). You can then publish the plan to create draft campaigns and targets and track actual results against them.'
    },
    {
        question: 'Can I try it before signing up?',
        answer: 'Yes. Start a free guest plan from the homepage with just your website. You can run the first seven steps (0–6), including market and competitor research and keyword planning; later steps and exports are locked. Register to claim the plan into a free account and continue building it; claiming the guest plan uses one of your monthly plan builds. The Free plan includes 500 credits every month for AI-powered actions, and everything else — connecting channels, data syncs, viewing, and manual work — is always free.'
    },
    {
        question: 'What are credits?',
        answer: 'Credits are the meter for AI-powered actions like building a paid media plan, running an AI analysis, or exporting a client deck. Manual work, viewing data, connecting channels, and data syncs are always free.'
    },
    {
        question: 'What happens when I run out of credits?',
        answer: 'AI-powered actions pause until you top up. Buy a credit pack ($9 / $40 / $70) — packs never expire — or increase your monthly Pro credits. You are never billed for a failed action.'
    },
    {
        question: 'Do credits roll over?',
        answer: 'Yes. Monthly Pro credits roll over to the next month, and purchased packs roll over indefinitely. Free plan credits reset at the end of each month.'
    },
    {
        question: 'Which channels does it plan for and track?',
        answer: 'Plan Studio can include Google Search, Google Display, and Meta Ads in a plan. Tracking connectors are live for Google Ads, Google Analytics 4, Google Ad Manager, and Meta Ads. HubSpot and Klaviyo are built but also in gated rollout. You can add offline campaign data, upload Excel/CSV or PDF files, and connect PostgreSQL, MySQL, MariaDB, or MongoDB on Professional and above when you need engineering data.'
    },
    {
        question: 'Do I need technical skills to use Data Research Analysis?',
        answer: 'No. Plan Studio is built for marketers: you provide the website and brief, and the AI handles research, planning, copy, and deliverables. Ad accounts connect through OAuth, and files can be uploaded directly. For analysts, the visual data modeler and SQL/MongoDB connectors are available on Professional and above when you need deeper control.'
    },
    {
        question: 'How is Data Research Analysis different from a BI or analytics tool?',
        answer: 'BI tools visualize data but do not tell you where to spend. DRA builds the plan first — where to spend, how much, and what to create — then writes those targets into campaign and ad-set records, syncs actual results back, and compares planned versus actual performance. The result is a closed loop from strategy to spend to outcome, not just another dashboard.'
    },
    {
        question: 'Is my data secure?',
        answer: 'Yes. Connection credentials, MongoDB connection strings, and OAuth tokens are encrypted at rest with AES-256-GCM. The platform uses JWT authentication, role-based access control, rate limiting, and SQL safety guardrails, and supports SAML 2.0 SSO with JIT provisioning on Enterprise. Data export, deletion, and configurable retention controls support GDPR-aligned workflows.'
    },
    {
        question: 'Can I share plans and results with my team?',
        answer: 'Yes. Organizations, workspaces, and projects support owner/admin/member, workspace admin/editor/viewer, and project analyst/manager/CMO roles. Reports can be shared through public links with 7-, 30-, 90-, or 365-day expiry that you can copy or revoke. Dashboards on Professional and above can also be shared through public links. Professional Plus adds organization branding to public reports and dashboards.'
    },
    {
        question: 'How much does Data Research Analysis cost?',
        answer: 'Pricing is credits-based and every plan includes every feature — features are not gated by tier. Free includes 500 credits every month at $0. Pro starts at 5,000 credits for $49/month billed monthly, or $39/month billed annually (about 20% off), with credits rolling over month to month. Credit packs ($9 / $40 / $70) never expire. Enterprise is custom priced for volume, onboarding, SSO, and SLAs. Credits are only consumed by AI-powered actions — data syncs, viewing, and manual work are always free.'
    },
    {
        question: 'Can I change my plan or cancel?',
        answer: 'Anytime. Pro is billed monthly or annually and can be changed or cancelled from the billing page. Upgrades take effect immediately with proration shown before you confirm; cancellations take effect at the end of the current billing period. See the refund and cancellation policies for details.'
    },
    {
        question: 'Is there a free trial for paid plans?',
        answer: 'There is no separate time-limited trial. You can start with the Free plan — 500 credits every month — or run a guest plan with just your website, then upgrade to Pro when you need more credits, rollover, or more data capacity. For Enterprise evaluations, contact sales to arrange a customized assessment.'
    },
    {
        question: 'Do you offer annual discounts?',
        answer: 'Yes. Annual billing saves about 20% on Pro — 5,000 credits is $49/month billed monthly or $39/month billed annually. Enterprise is custom priced.'
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through Paddle, our secure payment processor and merchant of record. Monthly and annual billing are available, and you can update your payment method, view invoices, and manage your subscription from the billing page. For Enterprise plans or custom billing agreements, contact our sales team.'
    }
];
