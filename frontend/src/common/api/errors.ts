// Error específico para cuando el backend devuelve 409 porque el dato único
// (dni, email, nombre, número de serie, etc.) ya pertenece a un registro dado
// de baja lógicamente. No es un error de negocio común: el frontend puede
// usar `entidadId` para ofrecerle al usuario reactivar ese registro en vez
// de simplemente mostrar un cartel de error.
//
// Reutilizable por cualquier feature con baja lógica (Personal, Equipo,
// Insumos): solo se necesita que el service de esa entidad detecte el 409
// y lance esta misma clase.
export class ConflictoInactivoError extends Error {
  entidadId: number;
  campo: string;
 
  constructor(message: string, entidadId: number, campo: string) {
    super(message);
    this.name = "ConflictoInactivoError";
    this.entidadId = entidadId;
    this.campo = campo;
  }
}

/** Lo que los hooks de ABM (`useABM`) guardan en su estado `conflicto`: la forma
 *  plana de la clase de arriba, con los nombres que usan las páginas. Antes cada
 *  feature con baja lógica declaraba su propia copia de esta interface. */
export interface ConflictoInactivo {
  /** Id del registro que está dado de baja y que se podría reactivar. */
  id: number;
  /** Texto para el diálogo "¿querés reactivarlo?". */
  mensaje: string;
  /** Campo que chocó (dni, email, nombre, ...), para señalar el input. */
  campo: string;
}

/** Un item del `detail` cuando FastAPI responde con errores de validación (422). */
type DetalleValidacion = { msg?: unknown };

/**
 * Lee el cuerpo de una respuesta **sin haberlo leído antes**.
 *
 * El cuerpo de una `Response` es un stream de un solo uso: la segunda llamada a
 * `response.json()` falla con "body used already". Por eso esta función se
 * invoca exactamente una vez por camino de ejecución (ver `pedir`), nunca de
 * forma incondicional antes de decidir.
 *
 * El `.catch` es obligatorio: una respuesta de error no siempre es JSON
 * (puede ser la página HTML de error de uvicorn o del proxy que corta la
 * conexión) y sin esto el `SyntaxError` taparía el error real que estamos por
 * reportar.
 */
async function leerCuerpo(response: Response): Promise<{ detail?: unknown } | null> {
  return (await response.json().catch(() => null)) as {
    detail?: unknown;
  } | null;
}

/** ¿El `detail` es el de `ConflictoRegistroInactivo`? */
function esDetalleInactivo(
  detail: unknown
): detail is { tipo: "inactivo"; mensaje: string; id: number; campo: string } {
  if (typeof detail !== "object" || detail === null) return false;

  const d = detail as Record<string, unknown>;
  return (
    d.tipo === "inactivo" &&
    typeof d.mensaje === "string" &&
    typeof d.id === "number" &&
    typeof d.campo === "string"
  );
}

/**
 * Saca un mensaje legible del `detail` de FastAPI, o devuelve el mensaje por
 * defecto si no hay nada usable.
 *
 * FastAPI tiene tres formas distintas de `detail`:
 *  - string  -> ya es el mensaje ("Ya existe una persona con ese dni").
 *  - objeto -> errores de negocio estructurados (el 409 de baja lógica).
 *  - lista   -> errores de validación (422), cada item con `loc` y `msg`.
 *               Sin este caso, un 422 terminaba mostrando "[object Object]".
 */
function mensajeDesdeDetalle(detail: unknown, porDefecto: string): string {
  if (typeof detail === "string" && detail.trim() !== "") return detail;

  if (Array.isArray(detail)) {
    const primero = detail[0] as DetalleValidacion | undefined;
    if (primero && typeof primero.msg === "string" && primero.msg.trim() !== "") {
      return primero.msg;
    }
  }

  return porDefecto;
}

/**
 * Única puerta de entrada para convertir una `Response` del backend en datos
 * o en una excepción. Reemplaza el `if (!response.ok) { ... }` que estaba
 * copiado en cada función de cada service.
 *
 * @param response           respuesta de `apiFetch`
 * @param mensajePorDefecto  qué mostrar si el backend no mandó un `detail`
 *                           utilizable
 *
 * @throws {ConflictoInactivoError} si llega un 409 de registro dado de baja
 *         lógicamente, para que el frontend pueda ofrecer la reactivación.
 */
export async function pedir<T>(
  response: Response,
  mensajePorDefecto: string
): Promise<T> {
  // El cuerpo se lee UNA sola vez, y solo en el camino que lo necesita.
  //
  // Leerlo siempre al principio rompía TODA respuesta exitosa: la segunda
  // llamada a `response.json()` falla con "body used already", el `.catch` lo
  // convertía en `null`, y así todos los servicios entregaban `null` en vez de
  // sus datos. El síntoma aparecía lejos de la causa, como un "Cannot read
  // properties of null" dentro de un componente.
  if (response.status === 409) {
    const cuerpo = await leerCuerpo(response);
    const detail = cuerpo?.detail;
    if (esDetalleInactivo(detail)) {
      throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo);
    }
    throw new Error(mensajeDesdeDetalle(detail, mensajePorDefecto));
  }

  if (!response.ok) {
    const cuerpo = await leerCuerpo(response);
    throw new Error(mensajeDesdeDetalle(cuerpo?.detail, mensajePorDefecto));
  }

  // Un DELETE sin cuerpo viene con 204 y `response.json()` prometería un JSON
  // que no existe: cortamos acá.
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  // Camino feliz: única lectura del body. Si el backend respondió 2xx con algo
  // que no es JSON, el error se propaga en vez de volver `null` en silencio.
  return (await response.json()) as T;
}