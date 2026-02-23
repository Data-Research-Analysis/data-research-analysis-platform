<script setup>
import { onMounted } from "vue";

// Get site URL from config
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

// Structured data
const { getWebPageSchema, getBreadcrumbSchema, injectMultipleSchemas } = useStructuredData();

// Inject structured data
onMounted(() => {
    if (import.meta.client) {
        const webPageSchema = getWebPageSchema(
            'Terms and Conditions',
            'Terms and conditions for using Data Research Analysis platform. Understand your rights, responsibilities, and service agreements.',
            `${siteUrl}/terms-conditions`,
            '2026-02-23'
        );
        
        const breadcrumbSchema = getBreadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Terms and Conditions', url: `${siteUrl}/terms-conditions` }
        ]);
        
        injectMultipleSchemas([webPageSchema, breadcrumbSchema]);
    }
});

// SEO Meta Tags for Terms & Conditions
useHead({
    title: 'Terms and Conditions - Service Agreement | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Terms and conditions for Data Research Analysis platform. Review service agreements, user responsibilities, data ownership, intellectual property rights, and limitation of liability.' },
        { name: 'keywords', content: 'terms and conditions, service agreement, user agreement, terms of service, legal terms' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: 'Terms and Conditions - Data Research Analysis' },
        { property: 'og:description', content: 'Terms and conditions for using our marketing analytics platform.' },
        { property: 'og:url', content: `${siteUrl}/terms-conditions` },
    ],
    link: [
        { rel: 'canonical', href: `${siteUrl}/terms-conditions` }
    ]
});
</script>
<template>
    <article class="w-3/4 h-full m-auto mt-10 p-5" itemscope itemtype="https://schema.org/Article">
        <!-- Breadcrumbs -->
        <breadcrumbs-schema :items="[
            { name: 'Home', path: '/' },
            { name: 'Terms and Conditions' }
        ]" />
        
        <header>
            <h1 itemprop="headline">Terms and Conditions</h1>
        
            <meta itemprop="dateModified" content="2026-02-23" />
            <p class="text-sm text-gray-600 mt-2">
                <strong>Last updated:</strong> <time datetime="2026-02-23">February 23, 2026</time>
            </p>
        </header>
        
        <div itemprop="articleBody">
        
        <p>
            Please read these terms and conditions carefully before using Our Service.
        </p>
        
        <h2>Interpretation and Definitions</h2>
        
        <h3>Interpretation</h3>
        
        <p>
            The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
        </p>
        
        <h3>Definitions</h3>
        
        <p>
            For the purposes of these Terms and Conditions:
        </p>
        <ul>
            <li>
                <p>
                    <strong>Affiliate</strong> means an entity that controls, is controlled by or is under common control with a party, where &quot;control&quot; means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.
                </p>
            </li>
            <li>
                <p>
                    <strong>Country</strong> refers to:  Pakistan
                </p>
            </li>
            <li>
                <p>
                    <strong>Company</strong> (referred to as either &quot;the Company&quot;, &quot;We&quot;, &quot;Us&quot; or &quot;Our&quot; in this Agreement) refers to Data Research Analysis (SMC-Private) Limited, 1327 D Street 26 Phase 6 Defence Housing Authority Lahore Punjab Pakistan.
                </p>
            </li>
            <li>
                <p>
                    <strong>Device</strong> means any device that can access the Service such as a computer, a cellphone or a digital tablet.
                </p>
            </li>
            <li>
                <p>
                    <strong>Service</strong> refers to the Website.
                </p>
            </li>
            <li>
                <p>
                    <strong>Connected Services</strong> refers to third-party services and data sources that You authorize to integrate with Our Service, including but not limited to Google Analytics, Google Ad Manager, Google Ads, Meta Ads, LinkedIn Ads, database systems, and API-based data sources.
                </p>
            </li>
            <li>
                <p>
                    <strong>User Data</strong> refers to data You provide, upload, import, or authorize Us to access from Connected Services for the purpose of using Our data analysis features.
                </p>
            </li>
            <li>
                <p>
                    <strong>Terms and Conditions</strong> (also referred as &quot;Terms&quot;) mean these Terms and Conditions that form the entire agreement between You and the Company regarding the use of the Service. This Terms and Conditions agreement has been created with the help of the <a href="https://www.termsfeed.com/terms-conditions-generator/" target="_blank">Terms and Conditions Generator</a>.
                </p>
            </li>
            <li>
                <p>
                    <strong>Third-party Social Media Service</strong> means any services or content (including data, information, products or services) provided by a third-party that may be displayed, included or made available by the Service.
                </p>
            </li>
            <li> 
                <p>
                    <strong>Website</strong> refers to Data Research Analysis (SMC-Private) Limited, accessible from <a href="http://www.dataresearchanalysis.com" rel="external nofollow noopener" target="_blank">http://www.dataresearchanalysis.com</a>
                </p>
            </li>
            <li>        
                <p>
                    <strong>You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.
                </p>
            </li>
        </ul>
        
        <h2>Acknowledgment</h2>
        
        <p>
            These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.
        </p>
        
        <p>
            Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.
        </p>
        
        <p>
            By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service.
        </p>
        
        <p>
            You represent that you are over the age of 18. The Company does not permit those under 18 to use the Service.
        </p>
        
        <p>
            Your access to and use of the Service is also conditioned on Your acceptance of and compliance with the Privacy Policy of the Company. Our Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your personal information when You use the Application or the Website and tells You about Your privacy rights and how the law protects You. Please read Our Privacy Policy carefully before using Our Service.
        </p>

        <h2>Third-Party Integrations and Connected Services</h2>

        <h3>Authorization and Access</h3>

        <p>
            Our Service allows You to connect third-party services, including Google Analytics, Google Ad Manager, Google Ads, Meta Ads, and LinkedIn Ads, to import and analyze Your data. By connecting these services:
        </p>

        <ul>
            <li>You authorize Us to access data from Your connected accounts on Your behalf</li>
            <li>You represent that You have the legal right to grant such authorization</li>
            <li>You understand that We will access only the data and permissions You explicitly authorize</li>
            <li>You acknowledge that Our access is governed by the third-party service's terms and policies</li>
        </ul>

        <h3>Google Analytics Integration</h3>

        <p>
            When You connect Your Google Analytics account:
        </p>

        <ul>
            <li>You grant Us read-only access to Your Google Analytics data</li>
            <li>You acknowledge that We store encrypted OAuth tokens to maintain the integration</li>
            <li>You can disconnect the integration at any time through Your account settings</li>
            <li>You remain responsible for Your Google Analytics account and its compliance with Google's Terms of Service</li>
            <li>We are not responsible for any changes, interruptions, or termination of Google Analytics services</li>
        </ul>

        <h3>Google Ad Manager Integration</h3>

        <p>
            When You connect Your Google Ad Manager account:
        </p>

        <ul>
            <li>You grant Us read-only access to Your Google Ad Manager data</li>
            <li>You acknowledge that We store encrypted OAuth tokens to maintain the integration</li>
            <li>You can disconnect the integration at any time through Your account settings</li>
            <li>You remain responsible for Your Google Ad Manager account and its compliance with Google's Terms of Service</li>
            <li>We are not responsible for any changes, interruptions, or termination of Google Ad Manager services</li>
            <li>You understand that We access advertising performance data, revenue metrics, and inventory information from Your selected Ad Manager network</li>
        </ul>

        <h3>Google Ads Integration</h3>

        <p>
            When You connect Your Google Ads account:
        </p>

        <ul>
            <li>You grant Us read-only access to Your Google Ads data</li>
            <li>You acknowledge that We store encrypted OAuth tokens to maintain the integration</li>
            <li>You can disconnect the integration at any time through Your account settings</li>
            <li>You remain responsible for Your Google Ads account and its compliance with Google's Terms of Service</li>
            <li>We are not responsible for any changes, interruptions, or termination of Google Ads services</li>
            <li>You understand that We access campaign performance data, ad metrics, and cost information from Your selected customer accounts</li>
        </ul>

        <h3>Meta Ads Integration</h3>

        <p>
            When You connect Your Meta Ads account (Facebook Ads Manager):
        </p>

        <ul>
            <li>You grant Us read-only access to Your Meta Ads data via Meta OAuth 2.0</li>
            <li>You acknowledge that We store encrypted OAuth access tokens to maintain the integration</li>
            <li>You can disconnect the integration at any time through Your account settings or via <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener">Meta Business Integrations settings</a></li>
            <li>You remain responsible for Your Meta Ads account and its compliance with Meta's Terms of Service and Advertising Policies</li>
            <li>We are not responsible for any changes, interruptions, suspension, or termination of Meta Ads services or API access</li>
            <li>You understand that We access campaign performance data, ad spend, creative metrics, and audience insights from Your authorized ad accounts</li>
            <li>You represent that You are an authorized user of the Meta Ads accounts You connect</li>
        </ul>

        <h3>LinkedIn Ads Integration</h3>

        <p>
            When You connect Your LinkedIn Ads account:
        </p>

        <ul>
            <li>You grant Us read-only access to Your LinkedIn Ads data via LinkedIn OAuth 2.0 using the <code>r_ads</code> and <code>r_ads_reporting</code> scopes</li>
            <li>You acknowledge that We store encrypted OAuth access and refresh tokens (valid for 60 days and 1 year respectively) to maintain the integration</li>
            <li>You can disconnect the integration at any time through Your account settings or via <a href="https://www.linkedin.com/psettings/permitted-services" target="_blank" rel="noopener">LinkedIn Permitted Services settings</a></li>
            <li>You remain responsible for Your LinkedIn Ads account and its compliance with LinkedIn's User Agreement and Marketing API Terms</li>
            <li>We are not responsible for any changes, interruptions, suspension, or termination of LinkedIn Ads API services</li>
            <li>You understand that We access campaign groups, campaigns, creatives, performance analytics, and aggregated demographic data from Your authorized ad accounts</li>
            <li>You represent that You are an authorized user of the LinkedIn Ads accounts You connect</li>
            <li>You acknowledge that LinkedIn demographic analytics are always aggregated; no individual member data is ever accessed or stored</li>
        </ul>

        <h3>Data Sync and Storage</h3>

        <p>
            For connected services:
        </p>

        <ul>
            <li>We sync data according to the frequency You configure (manual, hourly, daily, or weekly)</li>
            <li>Imported data is stored in Your projects and remains under Your control</li>
            <li>You are responsible for managing data retention and deletion within Our Service</li>
            <li>Disconnecting a service does not automatically delete previously imported data</li>
        </ul>

        <h3>Database Connections and File Uploads</h3>

        <p>
            Our Service allows You to connect Your own databases and upload files for analysis:
        </p>

        <ul>
            <li>You may connect external databases (PostgreSQL, MySQL, MariaDB, MongoDB) by providing connection credentials</li>
            <li>You may upload files (Excel, CSV, PDF) for data extraction and analysis</li>
            <li>You represent that You have authorization to connect the databases and upload the files You specify</li>
            <li>You are responsible for the security, validity, and compliance of the data You provide or connect</li>
            <li>We encrypt and securely store database credentials using industry-standard encryption (AES-256)</li>
            <li>You can disconnect databases or delete uploaded files at any time through Your account settings</li>
            <li>You acknowledge that database connectivity may be affected by network conditions, firewall settings, or database availability beyond Our control</li>
        </ul>

        <h3>Your Responsibilities</h3>

        <p>
            When using Connected Services, You agree to:
        </p>

        <ul>
            <li>Comply with all terms, policies, and usage limits of the third-party services</li>
            <li>Maintain the security of Your third-party service credentials</li>
            <li>Only connect accounts and data You have authorization to access</li>
            <li>Not use Connected Services to access data belonging to others without permission</li>
            <li>Promptly notify Us if You believe Your connected account has been compromised</li>
        </ul>

        <h3>Service Limitations</h3>

        <p>
            We do not guarantee:
        </p>

        <ul>
            <li>Continuous availability of third-party integrations</li>
            <li>That integrated services will meet Your requirements</li>
            <li>That data imports will be complete, accurate, or timely</li>
            <li>That third-party services will not change their APIs or terms in ways that affect integrations</li>
        </ul>

        <p>
            We reserve the right to suspend or terminate third-party integrations if required by the service provider or if We determine misuse has occurred.
        </p>
        
        <h2>Links to Other Websites</h2>
        
        <p>
            Our Service may contain links to third-party web sites or services that are not owned or controlled by the Company.
        </p>
        
        <p>
            The Company has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third party web sites or services. You further acknowledge and agree that the Company shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods or services available on or through any such web sites or services.
        </p>
        
        <p>
            We strongly advise You to read the terms and conditions and privacy policies of any third-party web sites or services that You visit.
        </p>
        
        <h2>Termination</h2>
        
        <p>
            We may terminate or suspend Your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.
        </p>
        
        <p>
            Upon termination, Your right to use the Service will cease immediately.
        </p>
        
        <h2>Limitation of Liability</h2>
        
        <p>
            Notwithstanding any damages that You might incur, the entire liability of the Company and any of its suppliers under any provision of this Terms and Your exclusive remedy for all of the foregoing shall be limited to the amount actually paid by You through the Service or 100 USD if You haven't purchased anything through the Service.
        </p>
        
        <p>
            To the maximum extent permitted by applicable law, in no event shall the Company or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, loss of data or other information, for business interruption, for personal injury, loss of privacy arising out of or in any way related to the use of or inability to use the Service, third-party software and/or third-party hardware used with the Service, or otherwise in connection with any provision of this Terms), even if the Company or any supplier has been advised of the possibility of such damages and even if the remedy fails of its essential purpose.
        </p>
        
        <p>
            Some states do not allow the exclusion of implied warranties or limitation of liability for incidental or consequential damages, which means that some of the above limitations may not apply. In these states, each party's liability will be limited to the greatest extent permitted by law.
        </p>
        
        <h2>&quot;AS IS&quot; and &quot;AS AVAILABLE&quot; Disclaimer</h2>
        
        <p>
            The Company shall not be liable for any loss, corruption, or unauthorized access to data imported from Connected Services, including Google Analytics, Google Ad Manager, and Google Ads, or for any interruption or termination of third-party integrations beyond Our control.
        </p>
        
        <p>
            The Service is provided to You &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, the Company, on its own behalf and on behalf of its Affiliates and its and their respective licensors and service providers, expressly disclaims all warranties, whether express, implied, statutory or otherwise, with respect to the Service, including all implied warranties of merchantability, fitness for a particular purpose, title and non-infringement, and warranties that may arise out of course of dealing, course of performance, usage or trade practice. Without limitation to the foregoing, the Company provides no warranty or undertaking, and makes no representation of any kind that the Service will meet Your requirements, achieve any intended results, be compatible or work with any other software, applications, systems or services, operate without interruption, meet any performance or reliability standards or be error free or that any errors or defects can or will be corrected.
        </p>
        
        <p>
            Without limiting the foregoing, neither the Company nor any of the company's provider makes any representation or warranty of any kind, express or implied: (i) as to the operation or availability of the Service, or the information, content, and materials or products included thereon; (ii) that the Service will be uninterrupted or error-free; (iii) as to the accuracy, reliability, or currency of any information or content provided through the Service; or (iv) that the Service, its servers, the content, or e-mails sent from or on behalf of the Company are free of viruses, scripts, trojan horses, worms, malware, timebombs or other harmful components.
        </p>
        
        <p>
            Some jurisdictions do not allow the exclusion of certain types of warranties or limitations on applicable statutory rights of a consumer, so some or all of the above exclusions and limitations may not apply to You. But in such a case the exclusions and limitations set forth in this section shall be applied to the greatest extent enforceable under applicable law.
        </p>
        
        <h2>Governing Law</h2>
        
        <p>
            The laws of the Country, excluding its conflicts of law rules, shall govern this Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.
        </p>
        
        <h2>Disputes Resolution</h2>
        
        <p>
            If You have any concern or dispute about the Service, You agree to first try to resolve the dispute informally by contacting the Company.
        </p>
        
        <h2>For European Union (EU) Users</h2>
        
        <p>
            If You are a European Union consumer, you will benefit from any mandatory provisions of the law of the country in which You are resident.
        </p>
        
        <h2>United States Legal Compliance</h2>
        
        <p>
            You represent and warrant that (i) You are not located in a country that is subject to the United States government embargo, or that has been designated by the United States government as a &quot;terrorist supporting&quot; country, and (ii) You are not listed on any United States government list of prohibited or restricted parties.
        </p>
        
        <h2>Severability and Waiver</h2>
        
        <h3>Severability</h3>
        
        <p>
            If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law and the remaining provisions will continue in full force and effect.
        </p>
        
        <h3>Waiver</h3>
        
        <p>
            Except as provided herein, the failure to exercise a right or to require performance of an obligation under these Terms shall not affect a party's ability to exercise such right or require such performance at any time thereafter nor shall the waiver of a breach constitute a waiver of any subsequent breach.
        </p>
        
        <h2>Translation Interpretation</h2>
        
        <p>
            These Terms and Conditions may have been translated if We have made them available to You on our Service. You agree that the original English text shall prevail in the case of a dispute.
        </p>
        
        <h2>Changes to These Terms and Conditions</h2>
        
        <p>
            We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. If a revision is material We will make reasonable efforts to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at Our sole discretion.
        </p>
        
        <p>
            By continuing to access or use Our Service after those revisions become effective, You agree to be bound by the revised terms. If You do not agree to the new terms, in whole or in part, please stop using the website and the Service.
        </p>
        
        <h2>Contact Us</h2>
        
        <p>
            If you have any questions about these Terms and Conditions, You can contact us:
        </p>
        <ul>
            <li>By email: <a href="mailto:hello@dataresearchanalysis.com" class="hover:text-gray-500">hello@dataresearchanalysis.com</a>  </li>
        </ul>
        </div>
    </article>
</template>