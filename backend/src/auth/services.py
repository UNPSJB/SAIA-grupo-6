import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy import delete
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
_ultima_purga_global: datetime = datetime.fromtimestamp(0, tz=timezone.utc)


def _clave_intentos(ip: str, dni: str) -> str:
    return f"{ip}|{dni.strip().lower()}"


def _purgar_global(ventana: timedelta) -> None:
    global _ultima_purga_global
    ahora = datetime.now(timezone.utc)
    if (ahora - _ultima_purga_global).total_seconds() < 60:
        return
    _ultima_purga_global = ahora
    limite = ahora - ventana
    claves_a_borrar = []
    for clave, marcas in list(_intentos.items()):
        filtrados = [m for m in marcas if m > limite]
        if filtrados:
            _intentos[clave] = filtrados
        else:
            claves_a_borrar.append(clave)
    for clave in claves_a_borrar:
        _intentos.pop(clave, None)


def _purgar_ventana(clave: str, ventana: timedelta) -> None:
    limite = datetime.now(timezone.utc) - ventana
    filtrados = [m for m in _intentos.get(clave, []) if m > limite]
    if filtrados:
        _intentos[clave] = filtrados
    else:
        _intentos.pop(clave, None)


def verificar_intentos_permitidos(ip: str, dni: str) -> None:
    """Bloquea el login si hubo demasiados intentos fallidos recientes."""
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
    _purgar_global(ventana)
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
    _purgar_global(ventana)
    clave = _clave_intentos(ip, dni)
    _purgar_ventana(clave, ventana)
    _intentos[clave].append(datetime.now(timezone.utc))

    logger.warning(
        "Login fallido para DNI %s desde %s (%s intentos en la ventana)",
        dni, ip, len(_intentos[clave]),
    )


def obtener_ip_cliente(request) -> str:
    from src.config import settings
    if settings.TRUSTED_PROXY:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            partes = [p.strip() for p in forwarded.split(",") if p.strip()]
            hops = max(1, settings.TRUSTED_PROXY_HOPS)
            if len(partes) >= hops:
                return partes[-hops]
    return request.client.host if request.client else "desconocida"


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
            # `exp` es un timestamp UTC: sin `tz=timezone.utc`,
            # `fromtimestamp` lo convierte a hora LOCAL y la purga de
            # `purgar_revocados_vencidos` (que compara contra UTC) borraba la
            # revocación apenas arrancaba el server: un token con logout volvía
            # a autenticar hasta 30 minutos.
            expira=datetime.fromtimestamp(payload["exp"], tz=timezone.utc).replace(
                tzinfo=None
            ),
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


def token_posterior_a_cambio_password(payload: dict, user_password_changed_at) -> bool:
    """Devuelve True si el token es válido respecto al cambio de contraseña.

    Compara iat con password_changed_at truncado a segundos para evitar
    falsos rechazos por microsegundos. Un token emitido en el mismo segundo
    que el cambio es válido; uno emitido al menos 1 segundo antes no lo es.
    """
    iat = payload.get("iat")
    if iat is None or user_password_changed_at is None:
        return True

    if isinstance(iat, datetime):
        iat_naive = iat.replace(tzinfo=None) if iat.tzinfo else iat
    else:
        # JWT serializa iat como timestamp entero (segundos UTC).
        iat_naive = datetime.fromtimestamp(float(iat), tz=timezone.utc).replace(tzinfo=None)

    # Ambas fechas como naive UTC para poder compararlas sin TypeError.
    changed_naive = user_password_changed_at
    if isinstance(changed_naive, datetime) and changed_naive.tzinfo is not None:
        changed_naive = changed_naive.replace(tzinfo=None)

    # Truncar a segundos
    iat_sec = iat_naive.replace(microsecond=0)
    changed_sec = changed_naive.replace(microsecond=0)

    return iat_sec >= changed_sec


def purgar_revocados_vencidos(db: Session) -> int:
    """Elimina los registros de revocacion cuyo token ya expiro.

    Se invoca desde el lifespan de `src.main` (por eso recibe la `Session` y
    no el engine). Devuelve cuantas filas borro, para poder loguearlo.
    """
    from src.auth.models import TokenRevocado

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    borrados = db.execute(
        delete(TokenRevocado).where(TokenRevocado.expira < ahora)
    ).rowcount

    if borrados:
        db.commit()
    return borrados
