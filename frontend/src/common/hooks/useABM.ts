import { useState } from "react";

import { ConflictoInactivoError } from "../api/errors";
import type { ConflictoInactivo } from "../api/errors";

/**
 * Alta / modificación / baja lógica de una entidad, genérica.
 *
 * Reemplaza los ~85 líneas que cada feature tenía repetidos en su
 * `useXxxABM`: el `loading`, el `error`, el `conflicto` de baja lógica y el
 * `re-throw` del error (las páginas hacen `try/catch` alrededor, así que el
 * error tiene que seguir saliendo).
 *
 * Todas las operaciones pasan por el mismo `mensajeDeError`, que SIEMPRE
 * prefiere el mensaje del backend (`err.message`) y solo cae al texto de
 * respaldo cuando lo que se tiró no es un `Error`. Antes cada feature elegía
 * distinto: `useEquipoABM` y `useInsumoABM` descartaban `err.message` al
 * modificar y terminaban mostrando "No se pudo modificar el equipo",
 * escondiendo cosas como "El correo ya está en uso".
 */
export interface OpcionesABM<TIn, TOut> {
  /** POST / o similar. Lanza `ConflictoInactivoError` si choca con un registro dado de baja. */
  crear(v: TIn): Promise<TOut>;
  /** PUT / PATCH. Acepta cuerpos parciales porque algunos services los mandan así. */
  modificar(id: number, v: Partial<TIn>): Promise<TOut>;
  /** DELETE / baja lógica. No se usa el valor devuelto: el id ya lo tiene la página. */
  eliminar(id: number): Promise<unknown>;
  /** Vuelve a dar de alta un registro. El cuerpo es parcial a propósito: hay
   *  features (elementos de limpieza) que reactivan solo con `{ activo: true }`. */
  reactivar(id: number, v?: Partial<TIn>): Promise<TOut>;
  /** Cómo se llama la entidad en los mensajes, con artículo: "el equipo", "la aptitud". */
  etiqueta: string;
}

/** Lo que devuelve el hook: las cuatro operaciones más el estado que las acompaña. */
export interface ABM<TIn, TOut> {
  alta: (v: TIn) => Promise<TOut>;
  modificar: (id: number, v: Partial<TIn>) => Promise<TOut>;
  borrar: (id: number) => Promise<void>;
  reactivar: (id: number, v?: Partial<TIn>) => Promise<TOut>;
  /** Datos del choque con un registro dado de baja, o null si no hubo choque. */
  conflicto: ConflictoInactivo | null;
  cancelarConflicto: () => void;
  loading: boolean;
  error: string | null;
}

/** El mensaje del backend explica mejor el fallo que un texto genérico, así que
 *  va primero siempre; el texto con `etiqueta` es solo la red de seguridad. */
function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof Error ? err.message : porDefecto;
}

export function useABM<TIn, TOut>(opciones: OpcionesABM<TIn, TOut>): ABM<TIn, TOut> {
  const { crear, modificar, eliminar, reactivar, etiqueta } = opciones;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuando el alta choca con el dni/email/nombre de alguien dado de baja
  // guardamos acá los datos del conflicto para que la página muestre el
  // diálogo de "¿querés reactivarlo?" en vez de un simple cartel de error.
  const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

  /** Base de las tres operaciones "simples": limpiar el estado, correr el
   *  service, y dejar el error listo para que la página lo muestre. */
  const ejecutar = async <TResultado>(operacion: () => Promise<TResultado>, porDefecto: string) => {
    try {
      setLoading(true);
      setError(null);

      return await operacion();
    } catch (err) {
      setError(mensajeDeError(err, porDefecto));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const alta = async (valores: TIn) => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);

      return await crear(valores);
    } catch (err) {
      if (err instanceof ConflictoInactivoError) {
        setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
      } else {
        setError(mensajeDeError(err, `No se pudo crear ${etiqueta}`));
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cambiar = (id: number, valores: Partial<TIn>) =>
    ejecutar(() => modificar(id, valores), `No se pudo modificar ${etiqueta}`);

  const borrar = (id: number) =>
    ejecutar(async () => {
      await eliminar(id);
    }, `No se pudo eliminar ${etiqueta}`);

  const volverActivo = async (id: number, valores?: Partial<TIn>) => {
    const resultado = await ejecutar(
      () => reactivar(id, valores),
      `Error al reactivar ${etiqueta}`,
    );
    // Recién con la reactivación confirmada se cierra el conflicto pendiente.
    setConflicto(null);
    return resultado;
  };

  const cancelarConflicto = () => setConflicto(null);

  return {
    alta,
    modificar: cambiar,
    borrar,
    reactivar: volverActivo,
    conflicto,
    cancelarConflicto,
    loading,
    error,
  };
}