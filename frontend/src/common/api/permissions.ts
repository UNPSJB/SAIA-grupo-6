import type { User } from "../context/AuthContext";

/**
 * Permisos del usuario, en el frontend.
 *
 * Jerarquía:
 *   admin    -> edita a operadores y a sí mismo
 *   operador -> solo se edita a sí mismo
 *
 * Este módulo es la traducción en el frontend de las mismas reglas que valida
 * el backend en src/auth/roles.py. La UI oculta acciones, pero la restricción
 * real es la del servidor.
 */

/** Forma mínima que debe tener una persona para evaluar permisos. */
export interface ConPermisos {
  id: number;
  puede_operar: boolean;
  puede_administrar: boolean;
}

export function puedeOperar(usuario: ConPermisos | User | null | undefined): boolean {
  return Boolean(usuario && (usuario.puede_operar || usuario.puede_administrar));
}

export function puedeAdministrar(usuario: ConPermisos | User | null | undefined): boolean {
  return Boolean(usuario?.puede_administrar);
}

export function nivelDe(usuario: ConPermisos | User | null | undefined): "admin" | "operador" {
  return usuario?.puede_administrar ? "admin" : "operador";
}

export type PersonaObjetivo = ConPermisos;

export function puedeEditarA(
  actor: ConPermisos | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  if (!actor) return false;
  if (actor.id === objetivo.id) return true;
  // Un admin solo toca a operadores: nada de tocar a otro admin.
  if (actor.puede_administrar) return !objetivo.puede_administrar;
  return false;
}

/** Quién puede cambiar capacidades/estado de una persona. */
export function puedeModificarRoles(
  actor: ConPermisos | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  // Hace falta poder de administración: editar tu propio perfil no te
  // permite darte permisos (ni quitártelos) a vos mismo.
  if (!puedeAdministrar(actor)) return false;
  return puedeEditarA(actor, objetivo);
}

export function puedeDarDeBajaA(
  actor: ConPermisos | User | null | undefined,
  objetivo: PersonaObjetivo
): boolean {
  if (!actor || actor.id === objetivo.id) return false;
  return puedeEditarA(actor, objetivo);
}