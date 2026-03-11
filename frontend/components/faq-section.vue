<script setup>
// FAQ data for structured data
const faqData = [
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
        question: 'How is Data Research Analysis different from Tableau or Power BI?',
        answer: 'Unlike Tableau or Power BI, Data Research Analysis is purpose-built for marketing executives. It offers native Google Ads and Analytics integrations, AI-powered data modeling, and CMO-focused dashboards out of the box. No complex setup or data engineering required.'
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
        answer: 'We offer 3 plans. FREE is always free (50K rows, 3 projects, 5 data sources, 10 AI generations/month). PROFESSIONAL is $399/month (or $3,829/year) with 100M rows, unlimited projects, data sources, dashboards, and up to 100 team members. ENTERPRISE is $2,499/month (or $23,990/year) for unlimited everything, 100+ users, multi-tenancy, and on-premise deployment.'
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
        answer: 'Yes! Annual billing saves you money on paid tiers. PROFESSIONAL drops from $399/month to the equivalent of ~$319/month ($3,829/year), saving $959 annually. ENTERPRISE drops from $2,499/month to the equivalent of ~$1,999/month ($23,990/year), saving $5,998 annually.'
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We\'re currently in private beta. Contact our sales team to discuss payment options and custom enterprise agreements for your organization.'
    }
];

// Expose faqData for parent to use in Schema.org injection
defineExpose({
    faqData
});
</script>

<template>
    <section id="faq" class="py-10">
        <div class="container mx-auto px-4 max-w-4xl">
            <h2 class="text-3xl font-bold text-primary-blue-100 text-center mb-12">Frequently Asked Questions</h2>
            <div class="space-y-6">
                <div v-for="(faq, index) in faqData" 
                     :key="index" 
                     class="bg-white p-6 rounded-lg shadow-md">
                    <h3 class="text-xl font-semibold mb-3 text-primary-blue-100">
                        {{ faq.question }}
                    </h3>
                    <p class="text-gray-700">{{ faq.answer }}</p>
                </div>
            </div>
        </div>
    </section>
</template>
