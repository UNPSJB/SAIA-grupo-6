// URL base de la API. Se puede overridear con VITE_API_URL para poder
// levantar la app desde un celular/tablet (donde "localhost" es el propio
// dispositivo y no la PC del servidor).
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const ACCESS_KEY = "saia_access_token";
const REFRESH_KEY = "saia_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrapper de fetch que adjunta el access token y, ante un 401,
 * intenta renovar la sesión con el refresh token y reintenta la request.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  let response = await fetch(input, mergedInit);

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      const retryInit: RequestInit = {
        ...init,
        headers: {
          ...(init.headers || {}),
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
      };
      response = await fetch(input, retryInit);
    }
  }

  return response;
}
