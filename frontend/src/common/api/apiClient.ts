import { CLAVE_USUARIO } from "../context/auth-context";

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

// Evita que varias requests 401 en paralelo disparen el redirect varias veces.
let expulsandoAlLogin = false;

/**
 * Sesión irrecuperable: el access token dio 401 y el refresh tampoco pudo
 * renovarla. Se limpian los tokens (y la sesión guardada) y se manda al login,
 * en lugar de dejar que cada pantalla muestre su propio error.
 */
function expulsarPorSesionVencida() {
  clearTokens();
  localStorage.removeItem(CLAVE_USUARIO);
  if (expulsandoAlLogin) return;
  expulsandoAlLogin = true;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
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

  // Si después de intentar renovar sigue siendo 401, la sesión quedó vacía o el
  // refresh también venció: no hay nada que reintentar, se cierra sesión.
  if (response.status === 401) {
    expulsarPorSesionVencida();
  }

  return response;
}

/**
 * Descarga una imagen protegida por sesión yy devuelve una URL de objeto
 * lista para usar en un <img src>.
 *
 * No se puede poner la ruta directamente en el tag porque el endpoint
 * /uploads exige el token JWT, y el <img> no tiene forma de mandarlo. Por eso
 * se baja el archivo con apiFetch (que ya adjunta el token y renueva la
 * sesión ante un 401) y se lo pasa al navegador como blob.
 */
export async function apiFetchImagen(rutaRelativa: string): Promise<string> {
  const response = await apiFetch(
    `${API_URL}/${rutaRelativa.replace(/\\/g, "/")}`
  );

  if (!response.ok) {
    throw new Error("No se pudo cargar la imagen");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}