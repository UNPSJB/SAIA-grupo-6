import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from src.config import settings
from src.auth.models import RefreshToken, IntentoLogin, TokenRevocado

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
    """Devuelve (token, jti, expira). El payload lleva `fam` (familia) para
    poder rotar e invalidar familias de tokens."""
    ahora = datetime.now(timezone.utc)
    expira = ahora + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = uuid.uuid4().hex
    familia = uuid.uuid4().hex

    payload = {
        "sub": subject,
        "type": "refresh",
        "jti": jti,
        "fam": familia,
        "iat": ahora,
        "exp": expira,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return token, jti, expira.replace(tzinfo=None)


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

# Los intentos fallidos se guardan en la base (tabla `intentos_login`), así el
# límite se comparte entre workers y réplicas, y se aplica por DNI y por IP.


def _clave_intentos(ip: str, dni: str) -> tuple[str, str]:
    return (ip, dni.strip().lower())


def _purgar_intentos_vencidos(db: Session, ventana: timedelta) -> None:
    """Elimina los registros de intentos fuera de la ventana."""
    limite = datetime.now(timezone.utc).replace(tzinfo=None) - ventana
    db.execute(delete(IntentoLogin).where(IntentoLogin.ultimo_intento < limite))


def verificar_intentos_permitidos(db: Session, ip: str, dni: str) -> None:
    """Bloquea el login si hubo demasiados intentos fallidos recientes.

    Aplica backoff: tras alcanzar el máximo, se bloquea por un múltiplo de la
    ventana que crece con cada nuevo intento fallido mientras siga bloqueado.
    """
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    _purgar_intentos_vencidos(db, ventana)

    ip_limpia, dni_limpio = _clave_intentos(ip, dni)
    intento = db.scalar(
        select(IntentoLogin).where(
            IntentoLogin.ip == ip_limpia,
            IntentoLogin.dni == dni_limpio,
        )
    )

    if intento is not None:
        if (
            intento.bloqueado_hasta is not None
            and ahora < intento.bloqueado_hasta
        ):
            espera = max(int((intento.bloqueado_hasta - ahora).total_seconds()), 1)
            logger.warning(
                "Login bloqueado por exceso de intentos: %s desde %s (hasta %s)",
                dni, ip, intento.bloqueado_hasta,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Demasiados intentos fallidos. Volvé a intentar en "
                    f"{espera} segundos."
                ),
                headers={"Retry-After": str(espera)},
            )
        if intento.contador >= settings.LOGIN_MAX_INTENTOS:
            # Ya se alcanzó el máximo y el bloqueo venció: se aplica un nuevo
            # bloqueo con backoff (ventana * 2^n) y se reinicia el contador.
            exponente = max(intento.contador // settings.LOGIN_MAX_INTENTOS, 1)
            intento.bloqueado_hasta = ahora + ventana * (2**exponente)
            intento.contador = 0
            db.add(intento)
            db.commit()
            espera = max(int((intento.bloqueado_hasta - ahora).total_seconds()), 1)
            logger.warning(
                "Login bloqueado por exceso de intentos (backoff): %s desde %s",
                dni, ip,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Demasiados intentos fallidos. Volvé a intentar en "
                    f"{espera} segundos."
                ),
                headers={"Retry-After": str(espera)},
            )


def registrar_intento_fallido(db: Session, ip: str, dni: str) -> None:
    ventana = timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    _purgar_intentos_vencidos(db, ventana)

    ip_limpia, dni_limpio = _clave_intentos(ip, dni)
    intento = db.scalar(
        select(IntentoLogin).where(
            IntentoLogin.ip == ip_limpia,
            IntentoLogin.dni == dni_limpio,
        )
    )

    if intento is None:
        intento = IntentoLogin(
            ip=ip_limpia,
            dni=dni_limpio,
            ultimo_intento=ahora,
            contador=1,
            bloqueado_hasta=None,
        )
        db.add(intento)
    else:
        intento.contador += 1
        intento.ultimo_intento = ahora
        if intento.contador >= settings.LOGIN_MAX_INTENTOS:
            exponente = max(intento.contador // settings.LOGIN_MAX_INTENTOS, 1)
            intento.bloqueado_hasta = ahora + ventana * (2**exponente)
        db.add(intento)

    db.commit()

    logger.warning(
        "Login fallido para DNI %s desde %s (%s intentos en la ventana)",
        dni, ip, intento.contador,
    )


def limpiar_intentos(db: Session, ip: str, dni: str) -> None:
    """Elimina el registro de intentos tras un login exitoso."""
    ip_limpia, dni_limpio = _clave_intentos(ip, dni)
    db.execute(
        delete(IntentoLogin).where(
            IntentoLogin.ip == ip_limpia,
            IntentoLogin.dni == dni_limpio,
        )
    )
    db.commit()


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

    try:
        return db.get(TokenRevocado, jti) is not None
    except OperationalError:
        # La tabla puede no existir si el lifespan no corrió (p. ej. tests
        # con TestClient que no ejecutan el lifespan de la app).
        return False


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
