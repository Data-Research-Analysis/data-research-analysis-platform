import { useLoggedInUserStore } from "@/stores/logged_in_user";
export default defineNuxtRouteMiddleware(async (to, from) => {
  const token = getAuthToken();
  const loggedInUserStore = useLoggedInUserStore();
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
        if (to.path.startsWith("/admin")) {
          if (loggedInUserStore.getLoggedInUser()?.user_type === "admin") {
            return;
          } else {
            return navigateTo("/projects");
          }
        } else {
          if (to.path === "/login" || to.path === "/register"
              || to.path === "/" || to.path === "/privacy-policy"
              || to.path === "/terms-conditions") {
            return navigateTo("/projects");
          }
          return;
        }
      } else {
        if (to.path === "/login"// || to.path === "/register"
            || to.path === "/privacy-policy" || to.path === "/terms-conditions") {
          return;
        }
        if (isPlatformEnabled()) {
          return navigateTo("/login");
        } else {
          return navigateTo("/");
        }
      }
    }
  } else {
    console.log('to', to);
    if (to.path === "/login" //|| to.path === "/register"
        || to.path === "/" || to.path === "/privacy-policy"
        || to.path === "/terms-conditions" || to.name === "verify-email-code"
        || to.name === "unsubscribe-code" || to.name === "articles" || to.name === "articles-articleslug"
        || to.name === "public-dashboard-dashboardkey" || to.name === "forgot-password" || to.name === "register" || to.name === "forgot-password-code") {
      return;
    }
    if (isPlatformEnabled()) {
      return navigateTo("/login");
    } else {
      return navigateTo("/");
    }
  }
  
});
