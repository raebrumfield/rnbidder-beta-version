/* ═══════════════════════════════════════════
   RnB Bidding Tool — Authentication Module
   ═══════════════════════════════════════════ */

/**
 * Check whether the user has a valid auth token in sessionStorage.
 */
function isAuthenticated() {
  const token = sessionStorage.getItem("rnb_auth");
  return token && token.startsWith("rnb-auth-");
}

/**
 * Guard function — redirect to login if not authenticated.
 * Call this at the top of every protected page.
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = "index.html";
  }
}

/**
 * Log out — clear token and redirect to login.
 */
function handleLogout() {
  sessionStorage.removeItem("rnb_auth");
  window.location.href = "index.html";
}
