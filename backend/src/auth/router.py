import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from src.auth import schemas
from src.auth.dependencies import get_current_user
from src.auth.models import RefreshToken
from src.auth.services import (
    crear_access_token,
    crear_refresh_token,
    decodificar_token,
    limpiar_intentos,
    registrar_intento_fallido,
    revocar_tokens,
    verificar_intentos_permitidos,
)
from src.database import get_db
from src.personal import schemas as personal_schemas
from src.personal.models import Personal
from src.personal.services import autenticar_persona
from src.roles_service import contar_personas, hay_administradores

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/bootstrap", response_model=schemas.BootstrapStatus)
def bootstrap_status(db: Session = Depends(get_db)):
    """Permite a la pantalla de registro saber si el sistema ya tiene
    administradores (y, por lo tanto, si se puede crear un super admin)."""
    total = contar_personas(db)
    hay_admins = hay_administradores(db)

    return schemas.BootstrapStatus(
        hay_personas=total > 0,
        hay_administradores=hay_admins,
        permite_super_admin=hay_admins is False,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    credentials: personal_schemas.LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Autenticación por DNI y contraseña.

    Devuelve un access token (30 min por defecto) y un refresh token (7 días).
    Tras varios intentos fallidos se bloquea temporalmente la combinación
    IP + DNI para frenar la fuerza bruta.
    """
    from src.auth.services import obtener_ip_cliente
    ip = obtener_ip_cliente(request)

    verificar_intentos_permitidos(db, ip, credentials.dni)

    try:
        user = autenticar_persona(db, credentials.dni, credentials.password)
    except HTTPException as error:
        # Solo cuentan los intentos fallidos por credenciales incorrectas
        if error.status_code == 401:
            registrar_intento_fallido(db, ip, credentials.dni)
        raise

    limpiar_intentos(db, ip, credentials.dni)

    # La sesión queda asociada al usuario autenticado, para que cualquier
    # escritura de este request quede auditada con su actor.
    db.info["usuario_id"] = user.id

    access_token, _, _ = crear_access_token(str(user.id))
    refresh_token, jti_refresh, expira_refresh = crear_refresh_token(str(user.id))

    # Familia del refresh token recién creado (para rotación e invalidación).
    payload_refresh = decodificar_token(refresh_token, token_type="refresh")
    familia_refresh = payload_refresh.get("fam")

    # Registrar el refresh token en BD para la rotación atómica.
    db.add(
        RefreshToken(
            jti=jti_refresh,
            usuario_id=user.id,
            familia=familia_refresh,
            expira=expira_refresh,
        )
    )
    db.commit()

    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh", response_model=schemas.Token)
def refresh(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Renueva el access token a partir de un refresh token válido.

    La rotación es atómica: se marca el refresh token usado con
    `UPDATE ... WHERE jti = :jti AND usado = 0` y solo se procede si
    `rowcount == 1`. Si el token ya fue usado (reutilizado), se invalida toda
    su familia y se rechaza con 401.
    """
    from src.auth.services import (
        decodificar_token,
        token_posterior_a_cambio_password,
        token_revocado,
        revocar_token,
    )
    from datetime import datetime, timezone

    payload = decodificar_token(body.refresh_token, token_type="refresh")

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado.",
        )

    if token_revocado(db, payload.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión fue cerrada. Volvé a iniciar sesión.",
        )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido.")

    user = db.get(Personal, user_id)
    if user is None or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o dado de baja.",
        )

    if not token_posterior_a_cambio_password(payload, user.password_changed_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido por cambio de contraseña.")

    jti_usado = payload.get("jti")
    familia = payload.get("fam")

    # Rotación atómica: marcar el refresh usado solo si aún no lo está.
    resultado = db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == jti_usado, RefreshToken.usado == False)  # noqa: E712
        .values(usado=True)
    )
    if resultado.rowcount != 1:
        # Token reutilizado o inexistente: invalida la familia y rechaza.
        if familia is not None:
            db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.familia == familia,
                    RefreshToken.usado == False,  # noqa: E712
                )
                .values(usado=True)
            )
        db.commit()
        logger.warning(
            "Refresh token reutilizado o inválido: jti=%s familia=%s",
            jti_usado,
            familia,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token ya fue utilizado. Volvé a iniciar sesión.",
        )

    # Revocar el refresh token anterior (ya está marcado como usado).
    try:
        expira_ts = payload.get("exp")
        expira = (
            datetime.fromtimestamp(float(expira_ts), tz=timezone.utc).replace(tzinfo=None)
            if expira_ts
            else datetime.now(timezone.utc).replace(tzinfo=None)
        )
    except Exception:
        expira = datetime.now(timezone.utc).replace(tzinfo=None)
    revocar_token(db, jti=jti_usado, usuario_id=user.id, tipo="refresh", expira=expira)

    # Crear nuevos tokens con una familia nueva.
    access_token, _, _ = crear_access_token(str(user.id))
    refresh_token, jti_nuevo, expira_nueva = crear_refresh_token(str(user.id))
    payload_nuevo = decodificar_token(refresh_token, token_type="refresh")
    familia_nueva = payload_nuevo.get("fam")

    db.add(
        RefreshToken(
            jti=jti_nuevo,
            usuario_id=user.id,
            familia=familia_nueva,
            expira=expira_nueva,
        )
    )
    db.commit()

    return schemas.Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    body: schemas.LogoutRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Cierra la sesión revocando los tokens enviados.

    No exigimos un access token válido: si el access token ya venció, el
    refresh token alcanza para cortar la sesión.
    """
    header = request.headers.get("Authorization", "")
    access_del_header = header[7:].strip() if header.lower().startswith("bearer ") else None

    revocar_tokens(
        db,
        {
            "refresh": body.refresh_token,
            "access": body.access_token or access_del_header,
        },
    )


@router.get("/me", response_model=personal_schemas.Persona)
def me(current_user: Personal = Depends(get_current_user)):
    return current_user