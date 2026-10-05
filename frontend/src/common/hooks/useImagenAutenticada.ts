import { useEffect, useState } from "react";
import { apiFetchImagen } from "../api/apiClient";

interface ImagenAutenticada {
  /** URL lista para el `src` de un `<img>`, o null si todavía no cargó / falló. */
  src: string | null;
  loading: boolean;
  error: string | null;
}

const ESTADO_VACIO: ImagenAutenticada = { src: null, loading: false, error: null };

/** Estado interno: incluye la ruta para la que se pidió, así durante el render
 *  podemos descartar un resultado que ya no corresponde a la imagen actual. */
interface EstadoDescarga {
  ruta: string;
  src: string | null;
  error: string | null;
}

/**
 * Carga una imagen que está protegida por sesión (endpoint /uploads) y devuelve
 * una URL lista para usar en un `<img src>`.
 *
 * No se puede poner la ruta del archivo directo en el tag porque el backend
 * exige el token JWT y el tag `<img>` no tiene forma de mandarlo. Por eso se
 * baja el archivo con apiFetch (que adjunta el token y renueva la sesión ante
 * un 401) y se lo pasa al navegador como blob.
 *
 * Libera la URL del blob cuando cambia la imagen o se desmonta el componente,
 * para no dejar archivos huérfanos en memoria.
 *
 * @param rutaRelativa Ruta guardada en el registro (ej: "uploads/incidentes/foto.jpg").
 *                     Si ya viniera una URL absoluta, se usa tal cual.
 */
export function useImagenAutenticada(
  rutaRelativa?: string | null
): ImagenAutenticada {
  const ruta = rutaRelativa ?? null;
  const esAbsoluta = ruta !== null && /^https?:\/\//i.test(ruta);

  const [descarga, setDescarga] = useState<EstadoDescarga | null>(null);

  useEffect(() => {
    // Sin ruta no hay nada que pedir; y una URL absoluta no necesita el cliente
    // autenticado (se resuelve en el render de más abajo).
    if (!ruta || esAbsoluta) return;

    let vigente = true;
    let objectUrl: string | null = null;

    apiFetchImagen(ruta)
      .then((url) => {
        // Si el componente se desmontó mientras descargaba, liberamos el blob
        // al toque para no filtrarlo.
        if (!vigente) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setDescarga({ ruta, src: url, error: null });
      })
      .catch(() => {
        if (!vigente) return;
        setDescarga({
          ruta,
          src: null,
          error: "No se pudo cargar la imagen",
        });
      });

    return () => {
      vigente = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta, esAbsoluta]);

  // El estado se deriva durante el render en vez de setearse dentro del efecto,
  // para no provocar renders en cascada.
  if (!ruta) return ESTADO_VACIO;
  if (esAbsoluta) return { src: ruta, loading: false, error: null };
  // Todavía no hay resultado para esta ruta: la petición está en curso.
  if (!descarga || descarga.ruta !== ruta) {
    return { src: null, loading: true, error: null };
  }

  return {
    src: descarga.src,
    loading: false,
    error: descarga.error,
  };
}