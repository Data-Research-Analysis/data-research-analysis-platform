<script setup>
import { onMounted } from "vue";

// SEO Meta Tags for Cancellation Policy
useHead({
    title: 'Cancellation Policy - Data Research Analysis',
    meta: [
        { name: 'description', content: 'Read the Cancellation Policy for Data Research Analysis. Learn how to cancel your subscription, data retention periods, and account reactivation procedures.' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: 'Cancellation Policy - Data Research Analysis' },
        { property: 'og:description', content: 'Our subscription cancellation policy and data retention information.' },
        { property: 'og:url', content: 'https://dataresearchanalysis.com/cancellation-policy' },
    ],
    link: [
        { rel: 'canonical', href: 'https://dataresearchanalysis.com/cancellation-policy' }
    ]
});

onMounted(() => {

})
</script>
<template>
    <div class="w-3/4 h-full m-auto mt-10 p-5">
        <h1>Cancellation Policy</h1>
        
        <p>
            Last updated: January 25, 2026
        </p>

        <h2>Introduction</h2>
        
        <p>
            This Cancellation Policy explains how to cancel your Data Research Analysis subscription, what happens to your account and data after cancellation, and your options for reactivation. We respect your decision to cancel and aim to make the process as straightforward as possible.
        </p>
        
        <p>
            Please read this policy carefully before cancelling your subscription. We also encourage you to consider downgrading to our FREE tier as an alternative to complete cancellation.
        </p>

        <h2>How to Cancel Your Subscription</h2>

        <h3>Self-Service Cancellation</h3>
        
        <p>
            You can cancel your subscription at any time through your account settings:
        </p>
        <ol>
            <li>
                <p>Log in to your Data Research Analysis account</p>
            </li>
            <li>
                <p>Navigate to <strong>Account Settings</strong> → <strong>Subscription</strong></p>
            </li>
            <li>
                <p>Click <strong>"Cancel Subscription"</strong></p>
            </li>
            <li>
                <p>Follow the cancellation wizard (includes data export reminders)</p>
            </li>
            <li>
                <p>Confirm your cancellation decision</p>
            </li>
            <li>
                <p>Receive confirmation email with cancellation details</p>
            </li>
        </ol>

        <h3>Email Support Cancellation</h3>
        
        <p>
            Alternatively, you may cancel by contacting our support team:
        </p>
        <ul>
            <li>
                <p>Email: <a href="mailto:hello@dataresearchanalysis.com" class="text-primary-blue-300 hover:underline">hello@dataresearchanalysis.com</a></p>
            </li>
            <li>
                <p>Subject line: "Subscription Cancellation Request"</p>
            </li>
            <li>
                <p>Include: Your registered email address and account details</p>
            </li>
        </ul>
        <p>
            Email cancellation requests are processed within 1-2 business days. You will receive confirmation once processed.
        </p>

        <h3>Required Information</h3>
        
        <p>
            To process your cancellation, we require:
        </p>
        <ul>
            <li>
                <p>Account email address (for verification)</p>
            </li>
            <li>
                <p>Reason for cancellation (optional but helps us improve)</p>
            </li>
            <li>
                <p>Confirmation that you understand data retention policies</p>
            </li>
        </ul>

        <h2>Cancellation Effective Date</h2>

        <h3>End of Billing Cycle</h3>
        
        <p>
            Your subscription cancellation becomes effective at the <strong>end of your current paid billing period</strong>. This means:
        </p>
        <ul>
            <li>
                <p>You retain full access to all paid features until the billing period ends</p>
            </li>
            <li>
                <p>No prorated refund is issued for unused time in the current period</p>
            </li>
            <li>
                <p>Automatic renewal is disabled and you will not be charged again</p>
            </li>
            <li>
                <p>Your account continues with all current tier limits until expiration</p>
            </li>
        </ul>

        <h3>Immediate Effect</h3>
        
        <p>
            Upon confirming cancellation:
        </p>
        <ul>
            <li>
                <p>Future billing is immediately stopped</p>
            </li>
            <li>
                <p>Auto-renewal is disabled</p>
            </li>
            <li>
                <p>A cancellation confirmation email is sent</p>
            </li>
            <li>
                <p>Your account is marked for review after the billing period expires</p>
            </li>
        </ul>

        <h2>Access After Cancellation</h2>

        <h3>During Current Billing Period</h3>
        
        <p>
            Until your paid period expires, you continue to have:
        </p>
        <ul>
            <li>
                <p>Full access to all features of your current subscription tier</p>
            </li>
            <li>
                <p>Ability to create, edit, and delete projects, data sources, and dashboards</p>
            </li>
            <li>
                <p>Access to AI data modeling (within your tier's monthly limit)</p>
            </li>
            <li>
                <p>Export capabilities for all your data and visualizations</p>
            </li>
            <li>
                <p>Third-party integrations (Google Analytics, Google Ads, etc.)</p>
            </li>
        </ul>

        <h3>After Billing Period Expires</h3>
        
        <p>
            When your paid period ends:
        </p>
        <ul>
            <li>
                <p>Your account automatically transitions to a <strong>cancelled status</strong></p>
            </li>
            <li>
                <p>Access to the platform is <strong>restricted</strong> (read-only mode for data export)</p>
            </li>
            <li>
                <p>You cannot create new projects, data sources, or dashboards</p>
            </li>
            <li>
                <p>Data remains accessible for the retention period (see below)</p>
            </li>
            <li>
                <p>You receive email notifications about data export and retention</p>
            </li>
        </ul>

        <h2>Data Retention and Deletion</h2>

        <h3>Retention Period</h3>
        
        <p>
            After your subscription ends, we retain your account data for a <strong>configurable grace period</strong> to allow you time to:
        </p>
        <ul>
            <li>
                <p>Export your data, dashboards, and visualizations</p>
            </li>
            <li>
                <p>Reconsider your cancellation</p>
            </li>
            <li>
                <p>Reactivate your account without data loss</p>
            </li>
        </ul>
        <p>
            <strong>Current Retention Period:</strong> The platform administrator configures this period (default is 30 days from cancellation effective date).
        </p>
        <p>
            You will be notified via email:
        </p>
        <ul>
            <li>
                <p>7 days before retention period expires</p>
            </li>
            <li>
                <p>1 day before retention period expires</p>
            </li>
            <li>
                <p>When data deletion has been completed</p>
            </li>
        </ul>

        <h3>What Happens to Your Data</h3>
        
        <p>
            <strong>During Retention Period:</strong>
        </p>
        <ul>
            <li>
                <p>All your data remains intact and accessible (read-only)</p>
            </li>
            <li>
                <p>Projects, data sources, data models, and dashboards are preserved</p>
            </li>
            <li>
                <p>Database connection credentials remain encrypted in storage</p>
            </li>
            <li>
                <p>OAuth tokens for third-party services (Google Analytics, etc.) remain valid</p>
            </li>
            <li>
                <p>You can log in to export data or reactivate</p>
            </li>
        </ul>
        
        <p>
            <strong>After Retention Period Expires:</strong>
        </p>
        <ul>
            <li>
                <p><strong>Permanent deletion</strong> of all data associated with your account</p>
            </li>
            <li>
                <p>Projects, data sources, data models, and dashboards are deleted</p>
            </li>
            <li>
                <p>All uploaded files (CSV, Excel, PDF) are removed</p>
            </li>
            <li>
                <p>Dashboard visualizations and exports are deleted</p>
            </li>
            <li>
                <p>Database connection credentials are permanently deleted</p>
            </li>
            <li>
                <p>OAuth tokens are revoked and deleted</p>
            </li>
            <li>
                <p>Your user account is marked as deleted (email reserved to prevent reuse)</p>
            </li>
            <li>
                <p>This deletion is <strong>irreversible</strong> and cannot be undone</p>
            </li>
        </ul>

        <h3>Data We Retain</h3>
        
        <p>
            Even after account deletion, we may retain certain information as required by law or for legitimate business purposes:
        </p>
        <ul>
            <li>
                <p>Transaction records (for tax and accounting purposes, typically 7 years)</p>
            </li>
            <li>
                <p>Billing history and invoices</p>
            </li>
            <li>
                <p>Support correspondence and communications</p>
            </li>
            <li>
                <p>Anonymized usage statistics (no personally identifiable information)</p>
            </li>
        </ul>
        <p>
            This retained data cannot be accessed by you and is used solely for compliance and business operations.
        </p>

        <h2>How to Export Your Data</h2>

        <h3>Before Cancellation (Recommended)</h3>
        
        <p>
            We <strong>strongly recommend</strong> exporting your data before initiating cancellation:
        </p>
        <ol>
            <li>
                <p>
                    <strong>Dashboard Exports:</strong> Navigate to each dashboard → Click "Export" → Choose format (PNG, PDF)
                </p>
            </li>
            <li>
                <p>
                    <strong>Data Model Results:</strong> Open each data model → Click "Export Data" → Choose format (CSV, Excel, JSON)
                </p>
            </li>
            <li>
                <p>
                    <strong>Project Configurations:</strong> Export project settings and data source connection details (credentials excluded for security)
                </p>
            </li>
            <li>
                <p>
                    <strong>Account Data:</strong> Navigate to Account Settings → "Download Account Data" → Receive ZIP file with all exportable data
                </p>
            </li>
        </ol>

        <h3>During Retention Period</h3>
        
        <p>
            After cancellation but within the retention period:
        </p>
        <ul>
            <li>
                <p>Log in to your account (read-only mode)</p>
            </li>
            <li>
                <p>Access all export functions</p>
            </li>
            <li>
                <p>Download your complete account data archive</p>
            </li>
            <li>
                <p>Export capabilities remain fully functional</p>
            </li>
        </ul>

        <h3>Export Formats</h3>
        
        <p>
            We provide multiple export formats:
        </p>
        <ul>
            <li>
                <p><strong>Dashboards:</strong> PNG images, PDF documents</p>
            </li>
            <li>
                <p><strong>Data:</strong> CSV, Excel (XLSX), JSON</p>
            </li>
            <li>
                <p><strong>Account Archive:</strong> ZIP file containing all projects, configurations, and metadata</p>
            </li>
        </ul>

        <h2>Reactivation Process</h2>

        <h3>Within Retention Period</h3>
        
        <p>
            If you change your mind during the retention period:
        </p>
        <ol>
            <li>
                <p>Log in to your account</p>
            </li>
            <li>
                <p>Navigate to Account Settings → Subscription</p>
            </li>
            <li>
                <p>Click "Reactivate Subscription"</p>
            </li>
            <li>
                <p>Choose your subscription tier</p>
            </li>
            <li>
                <p>Complete payment to reactivate</p>
            </li>
            <li>
                <p>Immediate restoration of full access</p>
            </li>
        </ol>
        <p>
            <strong>No data loss</strong> – All your projects, data sources, data models, and dashboards are restored exactly as they were.
        </p>

        <h3>After Retention Period</h3>
        
        <p>
            If the retention period has expired and your data has been deleted:
        </p>
        <ul>
            <li>
                <p>You may create a new account with the same email address</p>
            </li>
            <li>
                <p>You will start fresh with no previous data</p>
            </li>
            <li>
                <p>Previous subscription history is not restored</p>
            </li>
            <li>
                <p>You qualify for first-time subscriber benefits (if applicable)</p>
            </li>
        </ul>

        <h2>Downgrade as an Alternative</h2>

        <h3>Keep Your Data with FREE Tier</h3>
        
        <p>
            Instead of cancelling completely, consider downgrading to our <strong>FREE tier</strong>:
        </p>
        <ul>
            <li>
                <p><strong>No cost forever</strong> – Completely free, no credit card required</p>
            </li>
            <li>
                <p><strong>Keep your data</strong> – All projects and dashboards are preserved</p>
            </li>
            <li>
                <p><strong>No retention period</strong> – Your account remains active indefinitely</p>
            </li>
            <li>
                <p><strong>Core features included</strong> – 3 projects, 5 data sources, 5 dashboards, AI data modeling</p>
            </li>
            <li>
                <p><strong>Easy upgrades</strong> – Upgrade back to paid tier anytime you need more resources</p>
            </li>
        </ul>

        <h3>How to Downgrade</h3>
        
        <p>
            To downgrade instead of cancelling:
        </p>
        <ol>
            <li>
                <p>Navigate to Account Settings → Subscription</p>
            </li>
            <li>
                <p>Click "Change Subscription Tier"</p>
            </li>
            <li>
                <p>Select "FREE" tier</p>
            </li>
            <li>
                <p>Confirm downgrade (takes effect at end of billing period)</p>
            </li>
        </ol>
        <p>
            <strong>Note:</strong> If your current usage exceeds FREE tier limits (e.g., more than 3 projects), you'll need to reduce your resources before downgrading. The platform will guide you through this process.
        </p>

        <h2>Outstanding Balances</h2>
        
        <p>
            Before your cancellation can be fully processed:
        </p>
        <ul>
            <li>
                <p>All outstanding invoices must be paid</p>
            </li>
            <li>
                <p>Any failed payment attempts must be resolved</p>
            </li>
            <li>
                <p>Disputed charges must be settled</p>
            </li>
        </ul>
        <p>
            Accounts with unpaid balances cannot be cancelled and may be subject to collection procedures.
        </p>

        <h2>Third-Party Service Disconnection</h2>

        <h3>OAuth Integrations</h3>
        
        <p>
            When your account is deleted after the retention period:
        </p>
        <ul>
            <li>
                <p>OAuth connections to Google Analytics are automatically revoked</p>
            </li>
            <li>
                <p>Google Ads API access tokens are deleted</p>
            </li>
            <li>
                <p>Google Ad Manager refresh tokens are removed</p>
            </li>
            <li>
                <p>All third-party service permissions are withdrawn</p>
            </li>
        </ul>
        <p>
            <strong>Recommendation:</strong> Manually revoke access through your Google Account settings at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener" class="text-primary-blue-300 hover:underline">Google Account Permissions</a> for added security.
        </p>

        <h3>Database Connections</h3>
        
        <p>
            Encrypted database connection credentials (PostgreSQL, MySQL, MariaDB, MongoDB) stored in our system are:
        </p>
        <ul>
            <li>
                <p>Securely deleted from our database</p>
            </li>
            <li>
                <p>Encryption keys are rotated to prevent future decryption</p>
            </li>
            <li>
                <p>No ongoing access to your external databases</p>
            </li>
        </ul>

        <h2>No Cancellation Fees</h2>
        
        <p>
            Data Research Analysis <strong>does not charge any fees</strong> for cancelling your subscription. You are free to cancel at any time without penalty.
        </p>
        <p>
            However, please note that cancelling does not entitle you to a refund for the current billing period. See our <NuxtLink to="/return-refund-policy" class="text-primary-blue-300 hover:underline">Return &amp; Refund Policy</NuxtLink> for details.
        </p>

        <h2>Effect on Shared Projects</h2>
        
        <p>
            If you have shared projects with other users:
        </p>
        <ul>
            <li>
                <p>Projects you own will be marked for deletion after the retention period</p>
            </li>
            <li>
                <p>Team members will lose access when the retention period expires</p>
            </li>
            <li>
                <p>Consider transferring project ownership before cancelling</p>
            </li>
            <li>
                <p>Other members should export any data they need before your retention period ends</p>
            </li>
        </ul>

        <h2>Notification of Data Deletion</h2>
        
        <p>
            We will notify you via email:
        </p>
        <ul>
            <li>
                <p><strong>At cancellation:</strong> Confirmation email with retention period end date</p>
            </li>
            <li>
                <p><strong>7 days before deletion:</strong> Reminder to export data and option to reactivate</p>
            </li>
            <li>
                <p><strong>1 day before deletion:</strong> Final warning with export instructions</p>
            </li>
            <li>
                <p><strong>After deletion:</strong> Confirmation that data has been permanently deleted</p>
            </li>
        </ul>
        <p>
            These notifications are sent to your registered email address. Please ensure your email is current and accessible.
        </p>

        <h2>Admin-Managed Cancellations</h2>
        
        <p>
            In certain circumstances, platform administrators may cancel accounts:
        </p>
        <ul>
            <li>
                <p>Violation of Terms of Service</p>
            </li>
            <li>
                <p>Fraudulent activity or payment disputes</p>
            </li>
            <li>
                <p>Prolonged inactivity (typically 12+ months with unpaid balance)</p>
            </li>
            <li>
                <p>Legal or regulatory requirements</p>
            </li>
        </ul>
        <p>
            In such cases, you will be notified and given an opportunity to export your data before deletion.
        </p>

        <h2>Changes to This Policy</h2>
        
        <p>
            We may update this Cancellation Policy from time to time. Changes will be effective immediately upon posting. We will notify active subscribers of material changes via email.
        </p>
        <p>
            Your continued use of the service after changes constitutes acceptance of the updated policy.
        </p>

        <h2>Jurisdiction</h2>
        
        <p>
            This policy is governed by the laws of Pakistan. Any disputes arising from subscription cancellations shall be subject to the exclusive jurisdiction of the courts in Lahore, Pakistan.
        </p>

        <h2>Contact Us</h2>
        
        <p>
            If you have questions about this Cancellation Policy or need assistance with cancellation:
        </p>
        <ul>
            <li>
                <p><strong>Email:</strong> <a href="mailto:hello@dataresearchanalysis.com" class="text-primary-blue-300 hover:underline">hello@dataresearchanalysis.com</a></p>
            </li>
            <li>
                <p><strong>Phone:</strong> <a href="tel:+923224138957" class="text-primary-blue-300 hover:underline">+92 322 4138957</a> (Available from 10am to 6pm Pakistan Standard time)</p>
            </li>
            <li>
                <p>
                    <strong>Company:</strong> Data Research Analysis (SMC-Private) Limited<br />
                    1327 D Street 26 Phase 6<br />
                    Defence Housing Authority<br />
                    Lahore, Punjab<br />
                    Pakistan
                </p>
            </li>
        </ul>

        <h2>Related Policies</h2>
        
        <p>
            Please also review our related policies:
        </p>
        <ul>
            <li>
                <p><NuxtLink to="/return-refund-policy" class="text-primary-blue-300 hover:underline">Return &amp; Refund Policy</NuxtLink></p>
            </li>
            <li>
                <p><NuxtLink to="/privacy-policy" class="text-primary-blue-300 hover:underline">Privacy Policy</NuxtLink></p>
            </li>
        </ul>
    </div>
</template>
