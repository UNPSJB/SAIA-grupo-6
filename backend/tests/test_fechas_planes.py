"""Tests de zona horaria para fecha_creacion de planes (problema 2).

Verifica que `PlanLimpieza.fecha_creacion` use `ahora()` (zona horaria del
proyecto, Buenos Aires) y no la hora del servidor. Se simula un servidor en
UTC mockeando el reloj: un plan "creado a las 22:00 UTC" debe quedar con la
fecha/hora local de Buenos Aires correcta (19:00 del mismo día), no con la
fecha de mañana.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from src.common.fechas import ahora
from src.PlanLimpieza.models import PlanLimpieza
from src.Equipo.models import Equipo
from src.personal.models import Personal
from src.sector.models import Sector

ZONA_BA = ZoneInfo("America/Argentina/Buenos_Aires")
ZONA_UTC = timezone.utc

# Simulamos que el servidor (UTC) marca las 22:00 del 30/10/2026.
# En Buenos Aires (UTC-3) son las 19:00 del 30/10/2026.
SERVIDOR_UTC = datetime(2026, 10, 30, 22, 0, 0, tzinfo=ZONA_UTC)
HORA_LOCAL_BA = SERVIDOR_UTC.astimezone(ZONA_BA).replace(tzinfo=None)


class _FechaFalsa:
    """Sustituto de datetime que devuelve la hora UTC del servidor cuando se
    consulta con tz=UTC, y la hora local de BA cuando se consulta con
    tz=America/Argentina/Buenos_Aires (como hace `ahora()`)."""

    @classmethod
    def now(cls, tz=None):
        if tz is not None:
            return SERVIDOR_UTC.astimezone(tz)
        return SERVIDOR_UTC

    @classmethod
    def utcnow(cls):
        return SERVIDOR_UTC.replace(tzinfo=None)


def _crear_plan(db, **campos_extra):
    sector = Sector(nombre=f"Sector tz {_crear_plan.contador}", activo=True)
    _crear_plan.contador += 1
    db.add(sector)
    db.flush()

    autor = Personal(
        nombre="Autor TZ",
        apellido="Plan",
        dni=f"910000{_crear_plan.contador}",
        email=f"autor.tz.{_crear_plan.contador}@test.local",
        password="x",
        puede_administrar=True,
        puede_operar=True,
        activo=True,
    )
    db.add(autor)
    db.flush()

    equipo = Equipo(
        nombre=f"Equipo TZ {_crear_plan.contador}",
        tipo="Medición",
        sector_id=sector.id,
        activo=True,
    )
    db.add(equipo)
    db.flush()

    plan = PlanLimpieza(
        nombre=f"Plan TZ {_crear_plan.contador}",
        equipo_id=equipo.id,
        autor_id=autor.id,
        activo=True,
        **campos_extra,
    )
    db.add(plan)
    db.flush()
    return plan


_crear_plan.contador = 0


def test_ahora_devuelve_hora_local_buenos_aires(db_session):
    """`ahora()` convierte la hora del servidor (UTC) a la local de BA."""
    db = db_session
    with patch("src.common.fechas.datetime", _FechaFalsa):
        resultado = ahora()
    # 22:00 UTC -> 19:00 BA, naive (sin tzinfo).
    assert resultado == HORA_LOCAL_BA
    assert resultado.tzinfo is None


def test_plan_creado_a_las_22_utc_tiene_fecha_local_correcta(db_session):
    """Plan creado cuando el servidor marca 22:00 UTC queda con fecha 30/10
    19:00 en BA (fecha correcta), no 31/10 01:00 (fecha de mañana)."""
    db = db_session
    with patch("src.common.fechas.datetime", _FechaFalsa):
        plan = _crear_plan(db)
        db.commit()

    assert plan.fecha_creacion == HORA_LOCAL_BA
    assert plan.fecha_creacion.day == 30
    assert plan.fecha_creacion.hour == 19
    # Nunca debe ser el día siguiente (mañana) por el desfase UTC->BA.
    assert plan.fecha_creacion.date() != SERVIDOR_UTC.date() + timedelta(days=1)
