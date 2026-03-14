/**
 * Loader Messages Composable
 * 
 * Provides context-aware, conversational loading messages for API operations.
 * Maps route paths and API endpoints to personalized messages that inform users
 * about what's happening in a friendly, conversational tone.
 * 
 * @example
 * const { getMessageForContext } = useLoaderMessages()
 * const message = getMessageForContext('/connect/excel', '/upload-excel-preview')
 * // Returns: "Hang tight! We're reading your Excel file and detecting data types..."
 */

export const useLoaderMessages = () => {
  /**
   * Get personalized loading message based on route and API endpoint
   * @param routePath Current route path (e.g., '/connect/excel')
   * @param apiUrl API endpoint URL (e.g., '/upload-excel-preview')
   * @returns Personalized loading message
   */
  const getMessageForContext = (routePath: string, apiUrl: string): string => {
    const route = routePath.toLowerCase()
    const url = apiUrl.toLowerCase()

    // ========== Excel/CSV Data Source ==========
    if (url.includes('/upload-excel-preview')) {
      return "Hang tight! We're reading your Excel file and detecting data types..."
    }
    if (url.includes('/add-excel-data-source')) {
      return "Almost there! Creating your Excel data source..."
    }
    if (route.includes('/connect/excel') && !url) {
      return "Loading Excel upload interface..."
    }

    // ========== PDF Data Source ==========
    if (url.includes('/upload/pdf')) {
      return "Working on it! Scanning your PDF for data tables..."
    }
    if (url.includes('/extract-text-from-image')) {
      return "Analyzing PDF page structure..."
    }
    if (url.includes('/add-pdf-data-source')) {
      return "Creating your PDF data source..."
    }
    if (route.includes('/connect/pdf') && !url) {
      return "Loading PDF upload interface..."
    }

    // ========== Google Analytics ==========
    if (url.includes('/google-analytics/connect')) {
      return "Setting up Google Analytics connection..."
    }
    if (url.includes('/google-analytics/callback')) {
      return "Authenticating with Google Analytics..."
    }
    if (url.includes('/google-analytics/add')) {
      return "Connecting your Google Analytics account..."
    }
    if (url.includes('/google-analytics/sync')) {
      return "Fetching your latest analytics data..."
    }
    if (route.includes('/connect/google-analytics')) {
      return "Loading Google Analytics connector..."
    }

    // ========== Google Ads ==========
    if (url.includes('/google-ads/connect')) {
      return "Getting ready to connect Google Ads..."
    }
    if (url.includes('/google-ads/callback')) {
      return "Authenticating with Google Ads..."
    }
    if (url.includes('/google-ads/add')) {
      return "Connecting your Google Ads account..."
    }
    if (url.includes('/google-ads/sync')) {
      return "Syncing your ad campaign data..."
    }
    if (route.includes('/connect/google-ads')) {
      return "Loading Google Ads connector..."
    }

    // ========== Google Ad Manager ==========
    if (url.includes('/google-ad-manager/connect')) {
      return "Setting up Google Ad Manager connection..."
    }
    if (url.includes('/google-ad-manager/callback')) {
      return "Authenticating with Google Ad Manager..."
    }
    if (url.includes('/google-ad-manager/add')) {
      return "Connecting your Google Ad Manager account..."
    }
    if (url.includes('/google-ad-manager/sync')) {
      return "Fetching your ad inventory data..."
    }
    if (route.includes('/connect/google-ad-manager')) {
      return "Loading Google Ad Manager connector..."
    }

    // ========== Meta Ads ==========
    if (url.includes('/meta-ads/connect')) {
      return "Preparing Meta Ads connection..."
    }
    if (url.includes('/meta-ads/callback')) {
      return "Authenticating with Meta Business..."
    }
    if (url.includes('/meta-ads/add')) {
      return "Connecting your Meta Ads account..."
    }
    if (url.includes('/meta-ads/sync')) {
      return "Pulling your Facebook ad performance data..."
    }
    if (route.includes('/connect/meta-ads')) {
      return "Loading Meta Ads connector..."
    }

    // ========== LinkedIn Ads ==========
    if (url.includes('/linkedin-ads/connect')) {
      return "Setting up LinkedIn Ads connection..."
    }
    if (url.includes('/linkedin-ads/callback')) {
      return "Authenticating with LinkedIn..."
    }
    if (url.includes('/linkedin-ads/add')) {
      return "Connecting your LinkedIn Ads account..."
    }
    if (url.includes('/linkedin-ads/sync')) {
      return "Syncing your LinkedIn campaign data..."
    }
    if (route.includes('/connect/linkedin-ads')) {
      return "Loading LinkedIn Ads connector..."
    }

    // ========== HubSpot ==========
    if (url.includes('/hubspot/connect')) {
      return "Getting ready to connect HubSpot..."
    }
    if (url.includes('/hubspot/add')) {
      return "Connecting your HubSpot portal..."
    }
    if (url.includes('/hubspot/sync')) {
      return "Syncing your HubSpot contacts and deals..."
    }
    if (route.includes('/connect/hubspot')) {
      return "Loading HubSpot connector..."
    }

    // ========== Klaviyo ==========
    if (url.includes('/klaviyo/add')) {
      return "Connecting your Klaviyo account..."
    }
    if (url.includes('/klaviyo/sync')) {
      return "Fetching your email marketing data..."
    }
    if (route.includes('/connect/klaviyo')) {
      return "Loading Klaviyo connector..."
    }

    // ========== MongoDB ==========
    if (url.includes('/mongodb/test-connection')) {
      return "Testing MongoDB connection..."
    }
    if (url.includes('/mongodb/add')) {
      return "Connecting to your MongoDB database..."
    }
    if (route.includes('/connect/mongodb')) {
      return "Loading MongoDB connector..."
    }

    // ========== PostgreSQL/MySQL/MariaDB ==========
    if (url.includes('/test-connection')) {
      if (route.includes('postgresql')) {
        return "Testing PostgreSQL connection..."
      }
      if (route.includes('mysql')) {
        return "Testing MySQL connection..."
      }
      if (route.includes('mariadb')) {
        return "Testing MariaDB connection..."
      }
      return "Testing database connection..."
    }
    if (url.includes('/add-data-source') || url.includes('/data-source/add')) {
      return "Connecting to your database..."
    }
    if (route.includes('/connect/postgresql')) {
      return "Loading PostgreSQL connector..."
    }
    if (route.includes('/connect/mysql')) {
      return "Loading MySQL connector..."
    }
    if (route.includes('/connect/mariadb')) {
      return "Loading MariaDB connector..."
    }

    // ========== Data Source Operations ==========
    if (url.includes('/sync/') || url.match(/\/sync\/\d+/)) {
      return "Refreshing your data... This might take a moment!"
    }
    if (url.includes('/delete-data-source')) {
      return "Removing data source..."
    }
    if (route.includes('/data-sources/') && route.match(/\/\d+$/)) {
      return "Loading data source details..."
    }
    if (route.includes('/data-sources')) {
      return "Loading your data sources..."
    }

    // ========== AI Data Modeler ==========
    if (url.includes('/ai-data-modeler/session/initialize')) {
      return "Starting AI analysis of your data structure..."
    }
    if (url.includes('/ai-data-modeler/session/message')) {
      return "AI is crafting your data model recommendations..."
    }
    if (url.includes('/ai-data-modeler/apply-model')) {
      return "Creating your data model... Almost done!"
    }
    if (route.includes('/data-model-builder')) {
      return "Loading AI Data Modeler..."
    }

    // ========== AI Insights ==========
    if (url.includes('/insights/session/initialize')) {
      return "AI is analyzing your data patterns... Hang tight!"
    }
    if (url.includes('/insights/session/generate')) {
      return "Generating intelligent insights from your data..."
    }
    if (url.includes('/insights/session/chat')) {
      return "AI is thinking about your question..."
    }
    if (route.includes('insights')) {
      return "Loading AI Insights..."
    }

    // ========== Data Models ==========
    if (url.includes('/data-models')) {
      if (url.includes('delete') || apiUrl.match(/DELETE/i)) {
        return "Removing data model..."
      }
      if (url.includes('/data') || url.includes('/preview')) {
        return "Loading model data..."
      }
      // POST/PUT detection from context
      return "Building your data model..."
    }
    if (route.includes('/data-models/') && route.includes('/edit')) {
      return "Loading data model editor..."
    }
    if (route.includes('/data-models')) {
      return "Loading your data models..."
    }

    // ========== Dashboards ==========
    if (url.includes('/dashboards')) {
      if (url.includes('/export')) {
        return "Preparing your dashboard export..."
      }
      if (url.includes('delete')) {
        return "Removing dashboard..."
      }
      return "Saving dashboard changes..."
    }
    if (route.includes('/dashboards/') && route.match(/\/\d+$/)) {
      return "Loading dashboard..."
    }
    if (route.includes('/dashboards')) {
      return "Loading your dashboards..."
    }

    // ========== Projects ==========
    if (url.includes('/projects') && !url.includes('/data-sources')) {
      if (url.includes('delete')) {
        return "Removing project..."
      }
      return "Updating project settings..."
    }
    if (route === '/projects' || route === '/marketing-projects') {
      return "Loading your projects..."
    }

    // ========== Admin Operations ==========
    if (url.includes('/admin/platform-settings')) {
      return "Loading platform settings..."
    }
    if (url.includes('/admin/database/backup')) {
      return "Creating database backup..."
    }
    if (url.includes('/admin/database/restore')) {
      return "Restoring database..."
    }
    if (url.includes('/admin/stats')) {
      return "Loading platform statistics..."
    }
    if (route.includes('/admin')) {
      return "Loading admin panel..."
    }

    // ========== Authentication ==========
    if (route.includes('/login') || url.includes('/login')) {
      return "Signing you in..."
    }
    if (route.includes('/register') || url.includes('/register')) {
      return "Creating your account..."
    }
    if (url.includes('/logout')) {
      return "Signing you out..."
    }

    // ========== Settings ==========
    if (route.includes('/settings')) {
      return "Loading settings..."
    }

    // ========== User Management ==========
    if (url.includes('/invitations') || route.includes('/invitations')) {
      return "Loading team invitations..."
    }
    if (url.includes('/users') || route.includes('/users')) {
      return "Loading team members..."
    }

    // ========== Generic Operation Detection ==========
    // Try to infer operation from HTTP method patterns or URL structure
    if (url.includes('/delete') || url.includes('/remove')) {
      return "Removing item..."
    }
    if (url.includes('/update') || url.includes('/edit')) {
      return "Saving changes..."
    }
    if (url.includes('/create') || url.includes('/add')) {
      return "Creating new item..."
    }
    if (url.includes('/export')) {
      return "Preparing export..."
    }
    if (url.includes('/import')) {
      return "Importing data..."
    }

    // ========== Default Fallback ==========
    return "Loading..."
  }

  return {
    getMessageForContext
  }
}
