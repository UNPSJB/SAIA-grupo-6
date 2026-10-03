from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.auth import schemas
from src.auth.dependencies import get_current_user
from src.auth.services import (
    crear_access_token,
    crear_refresh_token,
    limpiar_intentos,
    registrar_intento_fallido,
    revocar_tokens,
    verificar_intentos_permitidos,
)
from src.database import get_db
from src.personal import schemas as personal_schemas
from src.personal.models import Personal
from src.personal.services import autenticar_persona

router = APIRouter(prefix="/auth", tags=["auth"])


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
    ip = request.client.host if request.client else "desconocida"

    verificar_intentos_permitidos(ip, credentials.dni)

    try:
        user = autenticar_persona(db, credentials.dni, credentials.password)
    except HTTPException as error:
        # Solo cuentan los intentos fallidos por credenciales incorrectas: un
        # usuario dado de baja o un DNI inexistente también cuentan, pero un
        # error de validación de la base no debería "castigar" al cliente.
        if error.status_code in (401, 404):
            registrar_intento_fallido(ip, credentials.dni)
        raise

    limpiar_intentos(ip, credentials.dni)

    access_token, _, _ = crear_access_token(str(user.id))
    refresh_token, _, _ = crear_refresh_token(str(user.id))

    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh", response_model=schemas.Token)
def refresh(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Renueva el access token a partir de un refresh token válido."""
    from src.auth.services import decodificar_token, token_revocado

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

    access_token, _, _ = crear_access_token(str(user.id))
    refresh_token, _, _ = crear_refresh_token(str(user.id))

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