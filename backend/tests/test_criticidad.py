"""Tests del motor de criticidad (problema 1).

Verifica que varias tareas pendientes de hoy generen una sola situación por
equipo (no inflan el nivel) y que los días anteriores incumplidos sí cuenten
para la recurrencia.
"""

from datetime import timedelta

import pytest

from src.common.fechas import hoy
from src.notificaciones.criticidad import obtener_criticidad_dashboard
from src.checklist.models import EstadoChecklist
from src.Equipo.models import Equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.checklist.models import Checklist, RegistroTarea
from src.personal.models import Personal
from src.sector.models import Sector

_counter = 0


def _siguiente_email() -> str:
    global _counter
    _counter += 1
    return f"autor.plan.{_counter}@test.local"


def _crear_escenario_base(db):
    """Equipo, personal autor, plan de limpieza y 2 tareas del día de hoy."""
    hoy_val = hoy()

    personal = Personal(
        nombre="Autor",
        apellido="Plan",
        dni=f"900000{_counter}",
        email=_siguiente_email(),
        password="x",
        puede_administrar=True,
        puede_operar=True,
        activo=True,
    )
    db.add(personal)
    db.flush()

    sector = Sector(nombre=f"Sector crítica {_counter}", activo=True)
    db.add(sector)
    db.flush()

    equipo = Equipo(
        nombre=f"Equipo crítica {_counter}",
        tipo="Medición",
        sector_id=sector.id,
        activo=True,
    )
    db.add(equipo)
    db.flush()

    plan = PlanLimpieza(
        nombre=f"Plan crítica test {_counter}",
        equipo_id=equipo.id,
        autor_id=personal.id,
        activo=True,
    )
    db.add(plan)
    db.flush()

    tareas = []
    for i, nombre in enumerate(["Tarea A", "Tarea B"]):
        tarea = Tarea(
            nombre=f"{nombre} {_counter}",
            frecuencia=1,
            tipo="operacional",
            descripcion="d",
            plan_limpieza_id=plan.id,
        )
        db.add(tarea)
        tareas.append(tarea)
    db.flush()

    return hoy_val, personal, equipo, plan, tareas


def _crear_checklist(db, plan, equipo, fecha, tareas, completados):
    """Crea un checklist para `fecha` con un registro por tarea."""
    checklist = Checklist(
        equipo_id=equipo.id,
        plan_id=plan.id,
        fecha=fecha,
        estado=EstadoChecklist.ABIERTO,
    )
    db.add(checklist)
    db.flush()

    for tarea, completado in zip(tareas, completados):
        db.add(
            RegistroTarea(
                checklist_id=checklist.id,
                tarea_id=tarea.id,
                nombre_tarea_historico=tarea.nombre,
                completado=completado,
            )
        )
    db.flush()
    return checklist


def _alertas_checklist(resultado):
    return [a for a in resultado.alertas if a.origen == "CHECKLIST"]


def test_mañana_con_dos_tareas_pendientes_no_sube_nivel(db_session):
    """2+ tareas pendientes hoy -> una sola situación, criticidad base (baja)."""
    db = db_session
    hoy_val, _personal, equipo, plan, tareas = _crear_escenario_base(db)

    # Checklist de hoy con las 2 tareas pendientes.
    _crear_checklist(db, plan, equipo, hoy_val, tareas, [False, False])
    db.commit()

    resultado = obtener_criticidad_dashboard(db)

    alertas = _alertas_checklist(resultado)

    # Una sola situación por equipo, no una por tarea.
    assert len(alertas) == 1, [a.clave for a in alertas]
    assert alertas[0].criticidad == "baja"
    assert "varias situaciones" not in alertas[0].motivo
    assert alertas[0].grupo_clave == f"equipo:{equipo.id}"


def test_dias_anteriores_incumplidos_sube_por_recurrencia(db_session):
    """Checklist de hoy pendiente + 3 días anteriores incumplidos -> se eleva."""
    db = db_session
    hoy_val, _personal, equipo, plan, tareas = _crear_escenario_base(db)

    # Hoy: una tarea pendiente (genera la alerta base que la recurrencia elevará).
    _crear_checklist(db, plan, equipo, hoy_val, [tareas[0]], [False])

    # 3 días anteriores dentro de la ventana de 30 días, mismos equipo.
    for delta in (1, 5, 12):
        _crear_checklist(
            db,
            plan,
            equipo,
            hoy_val - timedelta(days=delta),
            [tareas[0]],
            [False],
        )
    db.commit()

    resultado = obtener_criticidad_dashboard(db)

    alertas = _alertas_checklist(resultado)

    assert len(alertas) == 1, [a.clave for a in alertas]
    alerta = alertas[0]
    # La recurrencia (3 ocurrencias >= UMBRAL_RECURRENCIA) sube de baja a media.
    assert alerta.criticidad == "media"
    assert "recurrencia" in alerta.motivo
