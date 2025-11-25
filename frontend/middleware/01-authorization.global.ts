import { useLoggedInUserStore } from "@/stores/logged_in_user";

// Cache token validation for 30 seconds to avoid repeated API calls
const tokenValidationCache = new Map<string, { isValid: boolean; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

function isTokenValidationCached(token: string): boolean | null {
  const cached = tokenValidationCache.get(token);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    tokenValidationCache.delete(token);
    return null;
  }
  
  return cached.isValid;
}

function cacheTokenValidation(token: string, isValid: boolean) {
  tokenValidationCache.set(token, {
    isValid,
    timestamp: Date.now()
  });
}

// Define public routes that don't require authentication
function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/privacy-policy',
    '/terms-conditions',
    '/articles',
  ];
  
  const publicPatterns = [
    /^\/articles\/.+$/,           // /articles/[slug]
    /^\/public-dashboard\/.+$/,   // /public-dashboard/[key]
    /^\/verify-email\/.+$/,       // /verify-email/[code]
    /^\/forgot-password/,         // /forgot-password and /forgot-password/[code]
    /^\/unsubscribe\/.+$/,        // /unsubscribe/[code]
  ];
  
  // Check exact matches
  if (publicRoutes.includes(path)) {
    return true;
  }
  
  // Check pattern matches
  return publicPatterns.some(pattern => pattern.test(path));
}

// Define routes that require authentication
function requiresAuthentication(path: string): boolean {
  return path.startsWith('/projects') || path.startsWith('/admin');
}

export default defineNuxtRouteMiddleware(async (to, from) => {
  // INSTRUMENTATION: Track authorization middleware timing
  const authStartTime = import.meta.client ? performance.now() : 0
  if (import.meta.client) {
    console.log(`[01-authorization] Started at ${authStartTime.toFixed(2)}ms`)
  }
  
  // Set batch context if batch ID exists (set by 00-route-loader)
  const batchId = to.meta.loaderBatchId as string | undefined
  if (batchId && import.meta.client) {
    const { setBatchContext } = useGlobalLoader()
    setBatchContext(batchId)
  }
  
  try {
    // Check if running on server side
    const isServer = typeof window === 'undefined'
    const token = getAuthToken();
  const loggedInUserStore = useLoggedInUserStore();
  
  // OPTIMIZATION: Skip token validation for public routes
  if (isPublicRoute(to.path)) {
    if (import.meta.client) {
      console.log(`[01-authorization] Public route detected, skipping token validation`)
    }
    
    // If user has token and tries to access login/register/home, redirect to projects
    if (token && (to.path === '/login' || to.path === '/register' || to.path === '/')) {
      return navigateTo('/projects');
    }
    
    return; // Allow access to public routes without validation
  }
  
  if (token) {
    if (to.path === "/logout") {
      //logout the user
      deleteAuthToken();
      if (isPlatformEnabled()) {
        return navigateTo("/login");
      } else {
        return navigateTo("/");
      }
    } else {
      let isAuthorized = false;
      
      // During SSR, skip token validation (will be validated on client)
      // This prevents ECONNREFUSED errors when backend is not accessible during SSR
      if (isServer) {
        // Assume authorized during SSR, client will validate
        isAuthorized = true;
      } else {
        // Client-side: validate token with backend (only for protected routes)
        
        // OPTIMIZATION: Check cache first to avoid repeated API calls
        const cachedValidation = isTokenValidationCached(token);
        if (cachedValidation !== null) {
          if (import.meta.client) {
            console.log(`[01-authorization] Using cached validation (valid: ${cachedValidation})`)
          }
          isAuthorized = cachedValidation;
          
          if (!isAuthorized) {
            deleteAuthToken();
            tokenValidationCache.delete(token);
            return navigateTo("/login");
          }
        } else {
          // Cache miss - validate with backend
          try {
            const requestOptions = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "non-auth",

              },
            };
            const response = await fetch(
              `${baseUrl()}/auth/validate-token`,
              requestOptions,
            );
            
            if (!response.ok) {
              // Token is invalid - clear it and redirect to login
              cacheTokenValidation(token, false);
              deleteAuthToken();
              return navigateTo("/login");
            }
            
            const data = await response.json();
            if (data?.message === "validated token") {
              isAuthorized = true;
              cacheTokenValidation(token, true);
              if (import.meta.client) {
                console.log(`[01-authorization] Token validated and cached`)
              }
            } else {
              // Token is invalid - clear it and redirect to login
              cacheTokenValidation(token, false);
              deleteAuthToken();
              return navigateTo("/login");
            }
          } catch (error) {
            // If fetch fails (backend not available), allow navigation to continue
            // The page will show an error or the backend will be checked again later
            console.error('Token validation failed (backend may be unavailable):', error);
            // Allow the route to proceed - don't block the user
            return;
          }
        }
      }
      
      if (isAuthorized) {
        // Check if user is trying to access admin pages
        if (to.path.startsWith("/admin")) {
          const currentUser = loggedInUserStore.getLoggedInUser();
          // If user data isn't loaded yet, allow access temporarily
          // The page will handle authorization once user data loads
          if (!currentUser) {
            return; // Allow access, user data will be validated by the page
          }
          
          if (currentUser.user_type === "admin") {
            return; // Allow admin access
          } else {
            return navigateTo("/projects"); // Non-admin can't access admin pages
          }
        }
        
        // If authenticated user tries to access login/register, redirect to projects
        if (to.path === "/login" || to.path === "/register") {
          return navigateTo("/projects");
        }
        
        // If authenticated user tries to access home page, redirect to projects
        if (to.path === "/" && isPlatformEnabled()) {
          return navigateTo("/projects");
        }
        
        // Allow access to all other pages when authenticated
        return;
      }
    }
  } else {
      // No token - check if route requires authentication
      if (requiresAuthentication(to.path)) {
        if (import.meta.client) {
          console.log(`[01-authorization] Protected route requires authentication`)
        }
        return navigateTo("/login");
      }
      
      // Public routes - allow access with platform checks
      if (isPlatformEnabled()) {
        if (to.path === '/login') {
          if (isPlatformLoginEnabled()) {
            return;
          } else {
            return navigateTo("/");
          }
        } else if (to.path === '/register') {
          if (isPlatformRegistrationEnabled()) {
            return;
          } else {
            return navigateTo("/");
          }
        }
      } else {
        if (to.path === "/privacy-policy" || to.path === "/terms-conditions") {
          return;
        }
      }
    }
  
  } finally {
    // Clear batch context after authorization completes (always runs)
    if (batchId && import.meta.client) {
      const { clearBatchContext } = useGlobalLoader()
      clearBatchContext()
    }
    
    // INSTRUMENTATION: Track authorization middleware completion
    if (import.meta.client) {
      const authEndTime = performance.now()
      const duration = authEndTime - authStartTime
      console.log(`[01-authorization] Completed at ${authEndTime.toFixed(2)}ms (duration: ${duration.toFixed(2)}ms)`)
    }
  }
});
