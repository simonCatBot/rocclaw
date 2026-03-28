const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Extract CSRF token from cookies (readable cookie set by middleware)
 */
const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;

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
 * Check if HTTP method requires CSRF token
 */
const requiresCsrf = (method: string | undefined): boolean => {
  if (!method) return false;
  return ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
};

/**
 * Make a fetch request with automatic CSRF token inclusion for mutation methods
 */
export const fetchWithCsrf = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const method = init?.method || "GET";

  // Only add CSRF token for mutation methods
  if (requiresCsrf(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      init = {
        ...init,
        headers: {
          ...init?.headers,
          [CSRF_HEADER_NAME]: csrfToken,
        },
      };
    }
  }

  return fetch(input, init);
};

export const fetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const res = await fetchWithCsrf(input, init);
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
      : `Request failed with status ${res.status}.`;
    throw new Error(errorMessage);
  }
  return data as T;
};
