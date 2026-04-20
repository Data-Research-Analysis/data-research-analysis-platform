/**
 * Geolocation Testing Utilities
 * 
 * Provides functions to manually override region detection during development
 * and testing. This allows you to test different consent flows without using
 * a VPN or proxy.
 * 
 * Usage (in browser console or component):
 * 
 * ```typescript
 * import { mockRegion, clearRegionMock, getCurrentRegion } from '@/utils/test-geolocation'
 * 
 * // Test EU consent flow
 * mockRegion('eu_eea_uk')
 * 
 * // Test US CCPA flow
 * mockRegion('us')
 * 
 * // Test Rest of World flow
 * mockRegion('rest_of_world')
 * 
 * // Clear mock and use real geolocation
 * clearRegionMock()
 * 
 * // Check current region
 * console.log(getCurrentRegion())
 * ```
 */

export type ConsentRegion = 'eu_eea_uk' | 'us' | 'rest_of_world';

/**
 * Mock a specific region for testing
 * Page will reload to apply the change
 */
export function mockRegion(region: ConsentRegion): void {
  if (!import.meta.client) {
    console.warn('[test-geolocation] mockRegion() only works in browser');
    return;
  }

  // Validate region
  const validRegions: ConsentRegion[] = ['eu_eea_uk', 'us', 'rest_of_world'];
  if (!validRegions.includes(region)) {
    console.error(`[test-geolocation] Invalid region: ${region}. Valid options: ${validRegions.join(', ')}`);
    return;
  }

  console.log(`[test-geolocation] Mocking region as: ${region}`);
  
  // Set mock data in localStorage (same format as composable cache)
  localStorage.setItem('consent_region', region);
  localStorage.setItem('consent_region_timestamp', Date.now().toString());
  
  // Clear existing consent to trigger fresh flow
  localStorage.removeItem('cookie_consent');
  localStorage.removeItem('cookie_consent_timestamp');
  localStorage.removeItem('minimal_notice_dismissed');
  
  // Reload page to apply changes
  console.log('[test-geolocation] Reloading page...');
  window.location.reload();
}

/**
 * Clear region mock and use real geolocation
 * Page will reload to apply the change
 */
export function clearRegionMock(): void {
  if (!import.meta.client) {
    console.warn('[test-geolocation] clearRegionMock() only works in browser');
    return;
  }

  console.log('[test-geolocation] Clearing region mock...');
  
  // Clear cached region
  localStorage.removeItem('consent_region');
  localStorage.removeItem('consent_region_timestamp');
  
  // Clear consent to trigger fresh flow
  localStorage.removeItem('cookie_consent');
  localStorage.removeItem('cookie_consent_timestamp');
  localStorage.removeItem('minimal_notice_dismissed');
  
  // Reload page
  console.log('[test-geolocation] Reloading page...');
  window.location.reload();
}

/**
 * Get currently cached region (mock or real)
 * Does not trigger API call
 */
export function getCurrentRegion(): ConsentRegion | null {
  if (!import.meta.client) {
    return null;
  }

  const cached = localStorage.getItem('consent_region');
  return cached as ConsentRegion | null;
}

/**
 * Check if region is currently mocked
 */
export function isRegionMocked(): boolean {
  if (!import.meta.client) {
    return false;
  }

  return localStorage.getItem('consent_region') !== null;
}

/**
 * Get all current geolocation and consent data for debugging
 */
export function debugGeolocation(): void {
  if (!import.meta.client) {
    console.warn('[test-geolocation] debugGeolocation() only works in browser');
    return;
  }

  const region = localStorage.getItem('consent_region');
  const regionTimestamp = localStorage.getItem('consent_region_timestamp');
  const consent = localStorage.getItem('cookie_consent');
  const consentTimestamp = localStorage.getItem('cookie_consent_timestamp');
  const noticeDismissed = localStorage.getItem('minimal_notice_dismissed');

  console.group('🌍 Geolocation Debug Info');
  console.log('Current Region:', region || 'Not cached');
  
  if (regionTimestamp) {
    const age = Math.floor((Date.now() - parseInt(regionTimestamp)) / 1000 / 60);
    console.log('Region Cache Age:', `${age} minutes`);
  }
  
  console.log('Region Mocked:', isRegionMocked() ? '✅ Yes' : '❌ No (using real geolocation)');
  
  console.group('Cookie Consent Data');
  if (consent) {
    console.log('Saved Consent:', JSON.parse(consent));
    if (consentTimestamp) {
      const days = Math.floor((Date.now() - parseInt(consentTimestamp)) / 1000 / 60 / 60 / 24);
      console.log('Consent Age:', `${days} days`);
    }
  } else {
    console.log('Saved Consent:', 'None (first-time visitor)');
  }
  console.groupEnd();
  
  console.log('Minimal Notice Dismissed:', noticeDismissed === 'true' ? 'Yes' : 'No');
  console.groupEnd();
}


