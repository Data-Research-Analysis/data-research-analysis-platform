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
  });
  
  nuxtApp.provide("swal", swalWithDefaults);
});
