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
        return navigateTo("/projects");
      }
    }
  } else {
      if (to.path.startsWith("/admin")) {
        return navigateTo("/login");
      } else if (to.path.startsWith("/projects")) {
        return navigateTo("/login");
      } else {
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
          } else {
          return navigateTo("/");
          }
        }
      }
    }
});
