import { fetchJson } from "@/lib/http";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf";

/**
 * Extract CSRF token from cookies
 */
const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;
  
  // Try to get from readable cookie first
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token_readable" && value) {
      return decodeURIComponent(value);
    }
  }
  return null;
};

/**
 * Post a studio intent with CSRF protection
 */
export const postStudioIntent = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const csrfToken = getCsrfToken();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }
  
  return await fetchJson<T>(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};
