import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { puedeAdministrar, puedeOperar } from "../api/permissions";

/**
 * Protege las rutas hijas: si no hay usuario logueado, redirige al login.
 */
export function RequireAuth() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Además de exigir sesión, verifica que el usuario tenga el permiso indicado.
 * "puede_operar" también lo cumple quien administra o es super admin.
 */
export function RequireRole({
  permiso,
}: {
  permiso: "puede_operar" | "puede_administrar";
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const tienePermiso =
    permiso === "puede_operar" ? puedeOperar(user) : puedeAdministrar(user);

  if (!tienePermiso) {
    return <Navigate to="/sin-permisos" replace />;
  }

  return <Outlet />;
}
