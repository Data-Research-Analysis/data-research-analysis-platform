/**
 * Sitemap proxy route
 * Fetches sitemap from backend API and serves it from frontend domain
 * 
 * Accessible at: https://www.dataresearchanalysis.com/sitemap.txt
 * Backend source: https://api.dataresearchanalysis.com/sitemap.txt
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.apiBase || 'http://localhost:3002';
  
  try {
    // Fetch sitemap from backend API
    const response = await fetch(`${backendUrl}/sitemap.txt`);
    
    if (!response.ok) {
      throw new Error(`Backend sitemap not found: ${response.status}`);
    }
    
    const sitemapContent = await response.text();
    
    // Set appropriate headers for sitemap
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
    setHeader(event, 'Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    return sitemapContent;
  } catch (error) {
    console.error('Error fetching sitemap from backend:', error);
    
    // Return error response
    setResponseStatus(event, 503);
    return 'Sitemap temporarily unavailable. Please try again later.';
  }
});
