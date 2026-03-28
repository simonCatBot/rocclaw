const { URL } = require("node:url");
const crypto = require("crypto");

const parseCookies = (header) => {
  const raw = typeof header === "string" ? header : "";
  if (!raw.trim()) return {};
  const out = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
};

const buildRedirectUrl = (req, nextPathWithQuery) => {
  const host = req.headers?.host || "localhost";
  const proto =
    String(req.headers?.["x-forwarded-proto"] || "").toLowerCase() === "https"
      ? "https"
      : "http";
  return `${proto}://${host}${nextPathWithQuery}`;
};

/**
 * Generate a CSRF token for state-changing request protection
 * @returns {string} A random CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hash a CSRF token for cookie storage
 * @param {string} token - The raw token
 * @returns {string} SHA-256 hash of the token
 */
const hashCsrfToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Get CSRF cookie settings
 * @param {string} token - The hashed token value
 * @param {boolean} isProduction - Whether in production mode
 * @returns {string} Cookie header value
 */
const getCsrfCookieSettings = (token, isProduction) => {
  const secure = isProduction ? "; Secure" : "";
  return `__Host-csrf_token=${token}${secure}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`;
};

/**
 * Get readable CSRF token cookie settings
 * @param {string} token - The raw token value (not hashed)
 * @param {boolean} isProduction - Whether in production mode
 * @returns {string} Cookie header value
 */
const getReadableCsrfCookieSettings = (token, isProduction) => {
  const secure = isProduction ? "; Secure" : "";
  return `csrf_token_readable=${token}${secure}; Path=/; SameSite=Strict; Max-Age=86400`;
};

function createAccessGate(options) {
  const token = String(options?.token ?? "").trim();
  const cookieName = String(options?.cookieName ?? "studio_access").trim() || "studio_access";
  const queryParam = String(options?.queryParam ?? "access_token").trim() || "access_token";
  const isProduction = process.env.NODE_ENV === "production";

  const enabled = Boolean(token);

  const isAuthorized = (req) => {
    if (!enabled) return true;
    const cookieHeader = req.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    return cookies[cookieName] === token;
  };

  const handleHttp = (req, res) => {
    if (!enabled) return false;
    const host = req.headers?.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const provided = url.searchParams.get(queryParam);

    if (provided !== null) {
      if (provided !== token) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid Studio access token." }));
        return true;
      }

      url.searchParams.delete(queryParam);
      
      // Generate CSRF token for security
      const csrfToken = generateCsrfToken();
      const csrfHashed = hashCsrfToken(csrfToken);
      
      // Set multiple cookies: access token, CSRF token, and readable CSRF
      const cookies = [
        `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Strict${isProduction ? "; Secure" : ""}`,
        getCsrfCookieSettings(csrfHashed, isProduction),
        getReadableCsrfCookieSettings(csrfToken, isProduction),
      ];
      
      res.statusCode = 302;
      res.setHeader("Set-Cookie", cookies);
      res.setHeader("Location", buildRedirectUrl(req, url.pathname + url.search));
      res.end();
      return true;
    }

    if (url.pathname.startsWith("/api/")) {
      if (!isAuthorized(req)) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              "Studio access token required. Open /?access_token=... once to set a cookie.",
          })
        );
        return true;
      }
    }

    return false;
  };

  const allowUpgrade = (req) => {
    if (!enabled) return true;
    return isAuthorized(req);
  };

  return { enabled, handleHttp, allowUpgrade };
}

module.exports = { createAccessGate };

