from typing import Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.auth.services import (
    decodificar_token,
    token_posterior_a_cambio_password,
    token_revocado,
)
from src.exceptions import NotAuthenticated, PermissionDenied
from src.database import get_db
from src.establecimientos.contexto import fijar_establecimiento
from src.establecimientos.models import ESTABLECIMIENTO_PRINCIPAL_ID, Establecimiento
from src.personal.models import Personal

# Cabecera con la que el super admin (de la empresa, sin sede propia) elige en
# qué establecimiento trabaja. Sin ella, trabaja en el principal.
CABECERA_ESTABLECIMIENTO = "X-Establecimiento-Id"


def _sede_del_request(db: Session, user: Personal, request: Optional[Request]) -> int:
    """Sede en la que actúa el usuario en este request.

    Gerentes, admins y operadores: siempre la suya, sin importar lo que pida
    el cliente. El super admin: la que elija por cabecera.
    """
    if not user.es_super_admin:
        if user.establecimiento_id is None:
            raise PermissionDenied("Tu usuario no tiene un establecimiento asignado.")
        sede = db.get(Establecimiento, user.establecimiento_id)
        if sede is None or not sede.activo:
            raise PermissionDenied("Tu establecimiento está dado de baja.")
        return user.establecimiento_id

    pedido = request.headers.get(CABECERA_ESTABLECIMIENTO) if request else None
    if not pedido:
        return ESTABLECIMIENTO_PRINCIPAL_ID
    try:
        sede_id = int(pedido)
    except ValueError:
        raise PermissionDenied("Establecimiento inválido.")
    sede = db.get(Establecimiento, sede_id)
    if sede is None or not sede.activo:
        raise PermissionDenied("El establecimiento no existe o está dado de baja.")
    return sede_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Personal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise NotAuthenticated("No se proporcionó un token de autenticación.")

    payload = decodificar_token(credentials.credentials, token_type="access")
    if not payload or not payload.get("sub"):
        raise NotAuthenticated("Token inválido o expirado.")

    # Token revocado (por ejemplo al cerrar sesión): se invalida de inmediato,
    # sin esperar a que venza.
    if token_revocado(db, payload.get("jti")):
        raise NotAuthenticated("La sesión fue cerrada. Volvé a iniciar sesión.")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise NotAuthenticated("Token inválido.")

    user = db.get(Personal, user_id)
    if user is None or not user.activo:
        raise NotAuthenticated("Usuario no encontrado o dado de baja.")

    # Invalidar también los access tokens emitidos antes del último cambio
    # de contraseña, igual que ya se hace con los refresh tokens.
    if not token_posterior_a_cambio_password(payload, user.password_changed_at):
        raise NotAuthenticated("Token inválido por cambio de contraseña.")

    # La sesión queda asociada al usuario: los listeners de auditoría la
    # leen para registrar quién hizo cada cambio de este request.
    db.info["usuario_id"] = user.id

    # Desde acá, toda consulta del request ve solo los datos de su sede
    # (ver src.establecimientos.contexto).
    fijar_establecimiento(db, _sede_del_request(db, user, request))

    return user


def get_current_user_activo_completo(
    current_user: Personal = Depends(get_current_user),
) -> Personal:
    # Ya no se bloquea el acceso cuando debe_cambiar_password es True:
    # el usuario puede seguir operando. El frontend es el encargado de
    # mostrar una notificación/banner recordándole que debe cambiarla.
    return current_user


def get_current_user_opcional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[Personal]:
    """Igual que get_current_user pero devuelve None en lugar de 401 si no hay
    token. Se usa en el alta de personal, donde la ausencia de sesión solo es
    tolerable durante el bootstrap (primer usuario del sistema)."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None

    payload = decodificar_token(credentials.credentials, token_type="access")
    if not payload or not payload.get("sub"):
        return None

    # Mantener la misma política de sesión que la dependencia obligatoria.
    if token_revocado(db, payload.get("jti")):
        return None

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None

    user = db.get(Personal, user_id)

    if user is None or not user.activo:
        return None

    if not token_posterior_a_cambio_password(payload, user.password_changed_at):
        return None

    # Igual que get_current_user: deja el actor disponible para la
    # auditoría de lo que se escriba en este request.
    db.info["usuario_id"] = user.id

    # Desde acá, toda consulta del request ve solo los datos de su sede
    # (ver src.establecimientos.contexto).
    fijar_establecimiento(db, _sede_del_request(db, user, request))

    return user


def require_operador(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    """Permite operar a quien tenga puede_operar.

    Quien solo tiene puede_administrar también pasa por acá: administra
    implica poder hacer también todo lo operativo (las historias del
    administrador dicen "todo lo anterior + los maestros").
    """
    if not (current_user.puede_operar or current_user.puede_administrar or current_user.es_gerente):
        raise PermissionDenied("Se requiere permiso de operar.")
    return current_user


def require_admin(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    """Permite administrar a quien tenga puede_administrar.

    El super admin también pasa: administra todo el sistema.
    """
    if not (current_user.puede_administrar or current_user.es_gerente or current_user.es_super_admin):
        raise PermissionDenied("Se requiere permiso de administrar.")
    return current_user


def require_gerente(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    """Gerente de una sede o super admin: el tablero comparativo entre sedes."""
    if not (current_user.es_gerente or current_user.es_super_admin):
        raise PermissionDenied("Se requiere permiso de gerente.")
    return current_user


def require_super_admin(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    if not current_user.es_super_admin:
        raise PermissionDenied("Se requiere permiso de super administrador.")
    return current_user
