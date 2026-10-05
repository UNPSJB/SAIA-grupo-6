import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.config import settings

logger = logging.getLogger(__name__)


# ==========================================
# HASH DE CONTRASEÑAS
# ==========================================

def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, hash_almacenado: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hash_almacenado.encode("utf-8"))
    except ValueError:
        return False


def es_hash_bcrypt(valor: str) -> bool:
    return valor.startswith(("$2a$", "$2b$", "$2y$"))


# ==========================================
# TOKENS JWT
# ==========================================

def _crear_token(subject: str, expires_delta: timedelta, token_type: str) -> tuple[str, str, datetime]:
    """Devuelve (token, jti, instante de expiración sin timezone)."""
    ahora = datetime.now(timezone.utc)
    expira = ahora + expires_delta
    jti = uuid.uuid4().hex

    payload = {
        "sub": subject,
        "type": token_type,
        "jti": jti,
        "iat": ahora,
        "exp": expira,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return token, jti, expira.replace(tzinfo=None)


def crear_access_token(subject: str) -> tuple[str, str, datetime]:
    return _crear_token(
        subject,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def crear_refresh_token(subject: str) -> tuple[str, str, datetime]:
    return _crear_token(
        subject,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decodificar_token(token: str, token_type: Optional[str] = None) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None

    if token_type is not None and payload.get("type") != token_type:
        return None

    return payload


# ==========================================
# LÍMITE DE INTENTOS DE LOGIN (anti fuerza bruta)
# ==========================================

# Intentos fallidos por clave "ip|dni". Es un contador en memoria: con varios
# procesos o réplicas el límite aplicaría por proceso.
_intentos: dict[str, list[datetime]] = defaultdict(list)


def _clave_intentos(ip: str, dni: str) -> str:
    return f"{ip}|{dni.strip().lower()}"


def _purgar_ventana(clave: str, ventana: timedelta) -> None:
    limite = datetime.now(timezone.utc) - ventana
    _intentos[clave] = [m for m in _intentos[clave] if m > limite]


def verificar_intentos_permitidos(ip: str, dni: str) -> None:
    """Bloquea el login si hubo demasiados intentos fallidos recientes."""
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
    clave = _clave_intentos(ip, dni)
    _purgar_ventana(clave, ventana)

    if len(_intentos[clave]) >= settings.LOGIN_MAX_INTENTOS:
        espera = max(
            int((ventana - (datetime.now(timezone.utc) - _intentos[clave][0])).total_seconds()),
            1,
        )
        logger.warning("Login bloqueado por exceso de intentos: %s desde %s", dni, ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos fallidos. Volvé a intentar en {espera} segundos.",
            headers={"Retry-After": str(espera)},
        )


def registrar_intento_fallido(ip: str, dni: str) -> None:
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
    clave = _clave_intentos(ip, dni)
    _purgar_ventana(clave, ventana)
    _intentos[clave].append(datetime.now(timezone.utc))

    logger.warning(
        "Login fallido para DNI %s desde %s (%s intentos en la ventana)",
        dni, ip, len(_intentos[clave]),
    )


def limpiar_intentos(ip: str, dni: str) -> None:
    _intentos.pop(_clave_intentos(ip, dni), None)


# ==========================================
# REVOCACIÓN DE TOKENS (logout)
# ==========================================

def revocar_token(db: Session, jti: str, usuario_id: Optional[int], tipo: str, expira: datetime) -> None:
    from src.auth.models import TokenRevocado

    if not jti or db.get(TokenRevocado, jti) is not None:
        return

    db.add(
        TokenRevocado(jti=jti, usuario_id=usuario_id, tipo=tipo, expira=expira)
    )


def revocar_tokens(db: Session, tokens: dict[str, Optional[str]]) -> int:
    """Invalida los tokens indicados (refresh y, si viene, access).

    Gracias a esto el cierre de sesión es real: el access token deja de
    aceptarse en el siguiente request, sin esperar a que expire.
    """
    revocados = 0

    for tipo, token in tokens.items():
        if not token:
            continue

        payload = decodificar_token(token, token_type=tipo)
        if not payload or not payload.get("jti"):
            continue

        try:
            usuario_id = int(payload.get("sub", 0)) or None
        except (TypeError, ValueError):
            usuario_id = None

        revocar_token(
            db=db,
            jti=payload["jti"],
            usuario_id=usuario_id,
            tipo=tipo,
            expira=datetime.fromtimestamp(payload["exp"]),
        )
        revocados += 1

    if revocados:
        db.commit()
        logger.info("Se revocaron %s token(s) al cerrar sesión", revocados)

    return revocados


def token_revocado(db: Session, jti: Optional[str]) -> bool:
    from src.auth.models import TokenRevocado

    if not jti:
        return False

    return db.get(TokenRevocado, jti) is not None


def purgar_revocados_vencidos(db: Session) -> None:
    """Elimina los registros de revocación cuyo token ya expiró."""
    from src.auth.models import TokenRevocado

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    borrados = db.execute(
        delete(TokenRevocado).where(TokenRevocado.expira < ahora)
    ).rowcount

    if borrados:
        db.commit()