/**
 * Composable for checking if text content is truncated with ellipsis
 */
export function useTruncation() {
  /**
   * Check if an element's text content is truncated
   * @param elementId - Unique identifier for the element
   * @param dataAttribute - Data attribute name to query (default: 'data-title')
   * @returns boolean - true if element is truncated, false otherwise
   */
  function isTitleTruncated(elementId: string | number, dataAttribute: string = 'data-title'): boolean {
    if (import.meta.server) return false;
    
    const el = document.querySelector(`[${dataAttribute}="${elementId}"]`);
    if (!el) return false;
    
    return el.scrollWidth > el.clientWidth;
  }

  return {
    isTitleTruncated
  };
}
