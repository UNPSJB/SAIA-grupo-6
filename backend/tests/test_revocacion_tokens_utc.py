"""Regresión de la zona horaria en la revocación de tokens (logout).

Antes del fix, `revocar_tokens` guardaba el `expira` con
`datetime.fromtimestamp(payload["exp"])`, que convierte el timestamp UTC del
JWT a hora LOCAL. La purga (`purgar_revocados_vencidos`, que corre en cada
arranque desde el lifespan) compara contra UTC naive: en un servidor en UTC-3
el `expira` de un access token quedaba ~2.5 h en el pasado al insertarlo y la
revocación se borraba apenas arrancaba el server — un token revocado por
logout volvía a autenticar hasta 30 minutos.

`crear_access_token` devuelve la expiración como UTC naive (ver
`_crear_token`); la revocación guardada tiene que ser ESE mismo instante.

Cómo correrlo (desde `backend/`):

    python -m pytest tests/test_revocacion_tokens_utc.py -v
"""

from src.auth.models import TokenRevocado
from src.auth.services import (
    crear_access_token,
    crear_refresh_token,
    purgar_revocados_vencidos,
    revocar_tokens,
)


def test_el_expira_revocado_se_guarda_en_utc_naive(session_factory, usuarios):
    """El `expira` guardado es exactamente el `exp` del token en UTC naive.

    Con el bug (hora local), en cualquier máquina fuera de UTC esta igualdad
    no se daba ni para el access ni para el refresh token.
    """
    admin_id = str(usuarios["admin_id"])
    access, access_jti, access_expira = crear_access_token(admin_id)
    refresh, refresh_jti, refresh_expira = crear_refresh_token(admin_id)

    # PyJWT trunca el `exp` a segundos enteros al codificar: la comparación
    # es a nivel de segundo, que es la precisión con la que vive el token.
    access_expira = access_expira.replace(microsecond=0)
    refresh_expira = refresh_expira.replace(microsecond=0)

    with session_factory() as db:
        revocar_tokens(db, {"access": access, "refresh": refresh})

        assert db.get(TokenRevocado, access_jti).expira == access_expira
        assert db.get(TokenRevocado, refresh_jti).expira == refresh_expira


def test_la_purga_del_arranque_no_borra_revocaciones_vigentes(
    session_factory, usuarios
):
    """La consecuencia visible del bug: logout + reinicio = token vivo otra vez.

    Una revocación de un access token (válido 30 min más) tiene que sobrevivir
    la purga que corre en el arranque del server.
    """
    admin_id = str(usuarios["admin_id"])
    access, access_jti, _ = crear_access_token(admin_id)
    refresh, refresh_jti, _ = crear_refresh_token(admin_id)

    with session_factory() as db:
        revocar_tokens(db, {"access": access, "refresh": refresh})

        purgar_revocados_vencidos(db)

        assert db.get(TokenRevocado, access_jti) is not None
        assert db.get(TokenRevocado, refresh_jti) is not None
