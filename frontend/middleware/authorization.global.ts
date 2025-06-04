export default defineNuxtRouteMiddleware(async (to, from) => {
  const token = getAuthToken();
  if (token) {
    if (to.path === "/logout") {
      //logout the user
      deleteAuthToken();
      return navigateTo("/login");
    } else {
      let isAuthorized = false;
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
      const data = await response.json();
      if (data?.message === "validated token") {
        isAuthorized = true;
      } else {
        isAuthorized = false;
      }
      if (isAuthorized) {
        if (to.path === "/login" || to.path === "/register"
            || to.path === "/" || to.path === "/privacy-policy"
            || to.path === "/terms-conditions") {
          return navigateTo("/projects");
        } else {
          return;
        }
      } else {
        if (to.path === "/login" || to.path === "/register"
            || to.path === "/privacy-policy" || to.path === "/terms-conditions") {
          return;
        }
        return navigateTo("/login");
      }
    }
  } else {
    if (to.path === "/login" || to.path === "/register"
        || to.path === "/" || to.path === "/privacy-policy"
        || to.path === "/terms-conditions" || to.name === "verify-email-code"
        || to.name === "unsubscribe-code") {
      return;
    }
    return navigateTo("/login");
  }
  
});
