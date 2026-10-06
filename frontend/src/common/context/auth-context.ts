import { createContext } from "react";

/**
 * Tipos del contexto de autenticacion.
 *
 * Antes vivian en `auth-context.ts` mientras el provider vivia en
 * `AuthContext.tsx` y el hook en `useAuth.ts`: tres archivos para un contexto,
 * con dos grafias distintas del mismo modulo (`auth-context` vs
 * `AuthContext`). En un sistema de archivos que no distingue mayusculas, un
 * rename futuro a `authContext.ts` los colapsaria en un modulo duplicado y
 * `createContext` correria dos veces.
 *
 * Ahora son tres archivos con una responsabilidad cada uno, y el nombre del
 * modulo de tipos ya no se confunde con el del provider.
 */

export interface User {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  puede_operar: boolean;
  puede_administrar: boolean;
  es_super_admin: boolean;
}

export interface AuthContextType {
  user: User | null;
  loginUser: (userData: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const CLAVE_USUARIO = "saia_user";