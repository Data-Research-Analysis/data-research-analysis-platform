import Swal from "sweetalert2";

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
      confirmButton: 'bg-primary-blue-300 hover:bg-primary-blue-400 text-white font-bold py-2 px-4 rounded cursor-pointer',
      cancelButton: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded ml-2 cursor-pointer',
    },
    buttonsStyling: false,
  });
  
  nuxtApp.provide("swal", swalWithDefaults);
});
