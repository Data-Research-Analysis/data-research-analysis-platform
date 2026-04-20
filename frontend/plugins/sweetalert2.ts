import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

/**
 * SweetAlert2 Plugin
 * 
 * Provides global SweetAlert2 instance for dialogs, alerts, and loading indicators.
 * Includes custom configuration for branded loading spinner.
 * 
 * Usage:
 * const { $swal } = useNuxtApp()
 * $swal.fire({ title: 'Success!', icon: 'success' })
 */

export default defineNuxtPlugin((nuxtApp) => {
  // Configure default SweetAlert2 options
  const swalWithDefaults = Swal.mixin({
    // Default options for all SweetAlert2 dialogs
    customClass: {
      popup: 'rounded-lg shadow-xl',
      confirmButton: 'swal2-styled',
      cancelButton: 'swal2-styled',
    },
    buttonsStyling: true, // Use SweetAlert's default button styling
    // Ensure SweetAlert appears above overlay-dialog (z-index 1200) and all other modals
    heightAuto: false, // Prevent body height changes
  });

  // Override Swal's show method to dynamically set z-index
  const originalFire = swalWithDefaults.fire.bind(swalWithDefaults);
  swalWithDefaults.fire = function(...args: any[]) {
    const result = originalFire(...args);
    
    // Set z-index after dialog is shown
    if (import.meta.client) {
      setTimeout(() => {
        const swalContainer = document.querySelector('.swal2-container');
        if (swalContainer) {
          (swalContainer as HTMLElement).style.zIndex = '9999';
        }
      }, 0);
    }
    
    return result;
  };
  
  return {
    provide: {
      swal: swalWithDefaults as typeof Swal,
    },
  };
});
