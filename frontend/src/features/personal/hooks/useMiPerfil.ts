import { useLista } from "../../../common/hooks/useLista";
import { obtenerMiPerfil } from "../services/personalService";
import type { Persona } from "../types/personal";

/**
 * Ficha de la persona logueada, para la página "Mi perfil".
 *
 * Usa `useLista` y no `useRegistro` porque no hay id que pasarle al
 * backend: `/auth/me` deduce la persona del token de la sesión.
 *
 * `recargar` se expone para volver a pedir el perfil después de guardar
 * cambios desde la propia página.
 */
export function useMiPerfil() {
  const { items, loading, error, recargar } = useLista<Persona | null>({
    cargar: obtenerMiPerfil,
    dependencias: [],
    valorInicial: null,
    mensajeError: "No se pudo cargar tu perfil",
    // El mensaje del backend explica mejor el fallo ("Usuario no encontrado
    // o dado de baja") que el texto genérico.
    preferirMensajeDelBackend: true,
  });

  return { persona: items, loading, error, recargar };
}
