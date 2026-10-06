import type { User } from "../context/auth-context";

/**
 * Jerarquía de roles:
 *   super admin -> edita a cualquiera
 *   admin       -> edita a operadores y a sí mismo
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
export function puedeOperar(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario && (usuario.puede_operar || usuario.puede_administrar));
}

export function puedeAdministrar(usuario: ConRoles | User | null | undefined): boolean {
  return Boolean(usuario && (usuario.puede_administrar || usuario.es_super_admin));
}

export function nivelDe(usuario: ConRoles | User | null | undefined): "super admin" | "admin" | "operador" {
  if (esSuperAdmin(usuario)) return "super admin";
  if (usuario?.puede_administrar) return "admin";
  return "operador";
}

export type PersonaObjetivo = ConRoles;

export function puedeEditarA(
  actor: ConRoles | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  if (!actor) return false;
  if (actor.id === objetivo.id) return true;
  if (esSuperAdmin(actor)) return true;

  // Un admin solo toca a operadores: nada de tocar a otro admin ni a un super admin.
  if (actor.puede_administrar) {
    return !objetivo.puede_administrar && !objetivo.es_super_admin;
  }

  return false;
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
