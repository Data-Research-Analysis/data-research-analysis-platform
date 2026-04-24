/**
 * XML Sitemap proxy route
 * Fetches sitemap from backend API and serves it from frontend domain
 * 
 * Accessible at: https://www.dataresearchanalysis.com/sitemap.xml
 * Backend source: https://api.dataresearchanalysis.com/sitemap.xml
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.apiBase || 'http://localhost:3002';
  
  try {
    // Fetch sitemap from backend API
    const response = await fetch(`${backendUrl}/sitemap.xml`);
    
    if (!response.ok) {
      throw new Error(`Backend XML sitemap not found: ${response.status}`);
    }
    
    const sitemapContent = await response.text();
    
    // Set appropriate headers for XML sitemap
    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
    setHeader(event, 'Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    return sitemapContent;
  } catch (error) {
    console.error('Error fetching XML sitemap from backend:', error);
    
    // Return error response
    setResponseStatus(event, 503);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<error>Sitemap temporarily unavailable</error>';
  }
});
