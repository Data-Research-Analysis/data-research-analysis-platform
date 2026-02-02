#!/usr/bin/env node

/**
 * AI Search Optimization Validation Script
 * Checks if all structured data implementations are present
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_PATH = path.join(__dirname, '..');
const checks = [];

// Helper functions
function checkFileExists(filePath) {
    return fs.existsSync(path.join(FRONTEND_PATH, filePath));
}

function checkFileContains(filePath, searchStrings) {
    const fullPath = path.join(FRONTEND_PATH, filePath);
    if (!fs.existsSync(fullPath)) return { exists: false, found: [] };
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const found = searchStrings.filter(str => content.includes(str));
    return { exists: true, found, missing: searchStrings.filter(str => !found.includes(str)) };
}

// Validation checks
console.log('🔍 AI Search Optimization Validation\n');
console.log('═'.repeat(60));

// 1. Check core files exist
console.log('\n1. Core Infrastructure Files:');
const coreFiles = [
    'composables/useStructuredData.ts',
    'components/breadcrumbs-schema.vue'
];

coreFiles.forEach(file => {
    const exists = checkFileExists(file);
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    checks.push({ name: file, passed: exists });
});

// 2. Check useStructuredData.ts has all schema types
console.log('\n2. Structured Data Composable Functions:');
const schemaFunctions = [
    'getOrganizationSchema',
    'getSoftwareApplicationSchema',
    'getArticleSchema',
    'getFAQSchema',
    'getBreadcrumbSchema',
    'getWebPageSchema',
    'getItemListSchema',
    'getSearchActionSchema',
    'injectSchema',
    'injectMultipleSchemas'
];

const composableCheck = checkFileContains('composables/useStructuredData.ts', schemaFunctions);
schemaFunctions.forEach(func => {
    const found = composableCheck.found.includes(func);
    console.log(`   ${found ? '✅' : '❌'} ${func}()`);
    checks.push({ name: `useStructuredData.${func}`, passed: found });
});

// 3. Check landing page (index.vue)
console.log('\n3. Landing Page (index.vue):');
const indexChecks = [
    'getOrganizationSchema',
    'getSoftwareApplicationSchema',
    'getFAQSchema',
    'getSearchActionSchema',
    'injectMultipleSchemas',
    'faqData',
    'itemscope itemtype="https://schema.org/FAQPage"'
];

const indexCheck = checkFileContains('pages/index.vue', indexChecks);
indexChecks.forEach(check => {
    const found = indexCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `index.vue: ${check}`, passed: found });
});

// 4. Check article detail page
console.log('\n4. Article Detail Page ([articleslug]/index.vue):');
const articleDetailChecks = [
    'getArticleSchema',
    'getBreadcrumbSchema',
    'injectMultipleSchemas',
    'itemscope',
    'itemtype="https://schema.org/Article"',
    'itemprop="headline"',
    'itemprop="author"',
    'itemprop="datePublished"',
    'itemprop="articleBody"',
    'breadcrumbs-schema'
];

const articleCheck = checkFileContains('pages/articles/[articleslug]/index.vue', articleDetailChecks);
articleDetailChecks.forEach(check => {
    const found = articleCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `article detail: ${check}`, passed: found });
});

// 5. Check articles index page
console.log('\n5. Articles Index Page:');
const articlesIndexChecks = [
    'getItemListSchema',
    'getBreadcrumbSchema',
    'injectMultipleSchemas',
    'breadcrumbs-schema'
];

const articlesIndexCheck = checkFileContains('pages/articles/index.vue', articlesIndexChecks);
articlesIndexChecks.forEach(check => {
    const found = articlesIndexCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `articles index: ${check}`, passed: found });
});

// 6. Check privacy policy
console.log('\n6. Privacy Policy Page:');
const privacyChecks = [
    'getWebPageSchema',
    'getBreadcrumbSchema',
    'injectMultipleSchemas',
    'itemscope itemtype="https://schema.org/Article"',
    'breadcrumbs-schema'
];

const privacyCheck = checkFileContains('pages/privacy-policy.vue', privacyChecks);
privacyChecks.forEach(check => {
    const found = privacyCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `privacy: ${check}`, passed: found });
});

// 7. Check terms page
console.log('\n7. Terms & Conditions Page:');
const termsChecks = [
    'getWebPageSchema',
    'getBreadcrumbSchema',
    'injectMultipleSchemas',
    'itemscope itemtype="https://schema.org/Article"',
    'breadcrumbs-schema'
];

const termsCheck = checkFileContains('pages/terms-conditions.vue', termsChecks);
termsChecks.forEach(check => {
    const found = termsCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `terms: ${check}`, passed: found });
});

// 8. Check app.vue
console.log('\n8. Global App Configuration (app.vue):');
const appChecks = [
    'getOrganizationSchema',
    'injectSchema'
];

const appCheck = checkFileContains('app.vue', appChecks);
appChecks.forEach(check => {
    const found = appCheck.found.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check}`);
    checks.push({ name: `app.vue: ${check}`, passed: found });
});

// Summary
console.log('\n' + '═'.repeat(60));
const passedChecks = checks.filter(c => c.passed).length;
const totalChecks = checks.length;
const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);

console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed (${passRate}%)`);

if (passedChecks === totalChecks) {
    console.log('\n✅ All AI search optimizations are properly implemented!');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Test: https://search.google.com/test/rich-results');
    console.log('   3. Validate: https://validator.schema.org/');
    console.log('   4. Deploy and monitor AI search visibility\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some checks failed. Review the output above.');
    console.log('\nFailed checks:');
    checks.filter(c => !c.passed).forEach(c => {
        console.log(`   ❌ ${c.name}`);
    });
    console.log('');
    process.exit(1);
}
