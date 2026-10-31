from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.auth.services import (
    decodificar_token,
    token_posterior_a_cambio_password,
    token_revocado,
)
from src.exceptions import NotAuthenticated, PermissionDenied
from src.database import get_db
from src.personal.models import Personal

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
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

    return user


def get_current_user_activo_completo(
    current_user: Personal = Depends(get_current_user),
) -> Personal:
    if current_user.debe_cambiar_password:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Debés cambiar tu contraseña antes de continuar.")
    return current_user


def get_current_user_opcional(
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

    return user


def require_operador(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    """Permite operar a quien tenga puede_operar.

    Quien solo tiene puede_administrar también pasa por acá: administra
    implica poder hacer también todo lo operativo (las historias del
    administrador dicen "todo lo anterior + los maestros").
    """
    if not (current_user.puede_operar or current_user.puede_administrar):
        raise PermissionDenied("Se requiere permiso de operar.")
    return current_user


def require_admin(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    """Permite administrar a quien tenga puede_administrar.

    El super admin también pasa: administra todo el sistema.
    """
    if not (current_user.puede_administrar or current_user.es_super_admin):
        raise PermissionDenied("Se requiere permiso de administrar.")
    return current_user


def require_super_admin(current_user: Personal = Depends(get_current_user_activo_completo)) -> Personal:
    if not current_user.es_super_admin:
        raise PermissionDenied("Se requiere permiso de super administrador.")
    return current_user
