import type { User } from "../context/auth-context";

/**
 * Jerarquía de roles (de mayor a menor):
 *   super admin -> de la empresa, sin sede: edita a cualquiera
 *   gerente     -> administra su sede: edita a admins y operadores de ella
 *   admin       -> edita a operadores de su sede y a sí mismo
 *   operador    -> solo se edita a sí mismo
 *
 * Este módulo es la traducción en el frontend de las mismas reglas que
 * valida el backend en src/auth/roles.py. La UI hides acciones, pero la
 * restricción real es la del servidor.
 */

/** Forma mínima que debe tener una persona para evaluar roles. */
export interface ConRoles {
  id: number;
  puede_operar: boolean;
  puede_administrar: boolean;
  es_super_admin?: boolean;
  es_gerente?: boolean;
  establecimiento_id?: number | null;
}

export function esSuperAdmin(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario?.es_super_admin);
}

/**
 * Debe calcar `require_operador` del backend, que solo mira `puede_operar` y
 * `puede_administrar`. Antes sumaba `es_super_admin` acá pero no allá: un super
 * admin con ambos flags en false (combinación legal) pasaba este guard y
 * recibía un 403.
 */
export function esGerente(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario?.es_gerente);
}

export function puedeOperar(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario && (usuario.puede_operar || usuario.puede_administrar || usuario.es_gerente));
}

export function puedeAdministrar(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario && (usuario.puede_administrar || usuario.es_gerente || usuario.es_super_admin));
}

export type Nivel = "super admin" | "gerente" | "admin" | "operador";

export function nivelDe(usuario: ConRoles | User | null | undefined): Nivel {
  if (esSuperAdmin(usuario)) return "super admin";
  if (esGerente(usuario)) return "gerente";
  if (usuario?.puede_administrar) return "admin";
  return "operador";
}

const RANGO: Record<Nivel, number> = { "super admin": 3, gerente: 2, admin: 1, operador: 0 };

function rango(usuario: ConRoles | User | null | undefined): number {
  return RANGO[nivelDe(usuario)];
}

/** Solo el super admin designa gerentes (y otros super admins). */
export function puedeAsignarGerente(actor: ConRoles | User | null | undefined): boolean {
  return esSuperAdmin(actor);
}

/** Dar o quitar "Administrar": el gerente de la sede o el super admin. */
export function puedeAsignarAdministrar(actor: ConRoles | User | null | undefined): boolean {
  return rango(actor) >= RANGO.gerente;
}

export type PersonaObjetivo = ConRoles;

export function puedeEditarA(
  actor: ConRoles | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  if (!actor) return false;
  if (actor.id === objetivo.id) return true;
  if (esSuperAdmin(actor)) return true;

  if (!puedeAdministrar(actor)) return false;
  // Gerente y admin trabajan dentro de su sede, y cada uno toca solo a quien
  // está por debajo: el gerente a admins y operadores, el admin a operadores.
  // (Una sesión guardada antes del multiestablecimiento no trae la sede: ahí
  // se deja decidir al backend, que es quien valida de verdad.)
  if (
    actor.establecimiento_id !== undefined &&
    (actor.establecimiento_id ?? null) !== (objetivo.establecimiento_id ?? null)
  ) {
    return false;
  }
  return rango(objetivo) < rango(actor);
}

/** Quién puede cambiar capacidades/estado de una persona. */
export function puedeModificarRoles(
  actor: ConRoles | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  // Hace falta poder de administración: editar tu propio perfil no te
  // permite darte permisos (ni quitártelos) a vos mismo.
  if (!puedeAdministrar(actor)) return false;
  if (!puedeEditarA(actor, objetivo)) return false;
  // El flag de super admin solo lo mueve otro super admin.
  if (objetivo.es_super_admin && !esSuperAdmin(actor)) return false;
  return true;
}

export function puedeDarDeBajaA(
  actor: ConRoles | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  if (!actor || actor.id === objetivo.id) return false;
  return puedeEditarA(actor, objetivo);
}

export function etiquetaDeRol(usuario: ConRoles | User | null | undefined): string {
  return nivelDe(usuario);
}

/** Nombre del rol para mostrar ("Gerente", "Super administrador", ...). */
export function nombreDeRol(usuario: ConRoles | User | null | undefined): string {
  switch (nivelDe(usuario)) {
    case "super admin":
      return "Super administrador";
    case "gerente":
      return "Gerente";
    case "admin":
      return "Administrador";
    default:
      return usuario?.puede_operar ? "Operador" : "Usuario";
  }
}
