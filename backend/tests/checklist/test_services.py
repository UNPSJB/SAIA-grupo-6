"""Tests unitarios de services del módulo `checklist`."""

from datetime import date, datetime

from src.Equipo.models import Equipo
from src.PlanLimpieza import models as plan_models
from src.personal.models import Personal
from src.sector.models import Sector
from src.tareas.models import Tarea
from src.checklist import exceptions
from src.checklist.models import EstadoChecklist, Checklist, HistorialRegistroTarea, RegistroTarea
from src.checklist.services.generacion import obtener_o_crear_checklists_del_dia
from src.checklist.services.marcado import (
    marcar_tarea,
    asignar_cobertura_tarea,
)
from src.checklist.services.historial import (
    listar_historial_checklists,
    obtener_detalle_checklist,
)
from src.checklist.services.consumo import listar_consumo_insumos
from src.checklist.services.tareas_del_dia import listar_tareas_del_dia
from tests.database import db_session


def _mock_hoy(monkeypatch, fecha):
    """Hoy se importa directamente en cada módulo de services, así que hay
    que parchear cada referencia."""
    monkeypatch.setattr("src.common.fechas.hoy", lambda: fecha)
    monkeypatch.setattr("src.checklist.services.generacion.hoy", lambda: fecha)
    monkeypatch.setattr("src.checklist.services.marcado.hoy", lambda: fecha)
    monkeypatch.setattr("src.checklist.services.historial.hoy", lambda: fecha)
    monkeypatch.setattr("src.checklist.services.tareas_del_dia.hoy", lambda: fecha)


def _mock_ahora(monkeypatch, dt):
    monkeypatch.setattr("src.common.fechas.ahora", lambda: dt)
    monkeypatch.setattr("src.checklist.services.marcado.ahora", lambda: dt)


def _personal_admin(db, dni="12345678", email="a@test.com"):
    fila = Personal(
        nombre="Admin", apellido="A", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=True, es_super_admin=False,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _sector(db, nombre="Sector", activo=True):
    fila = Sector(nombre=nombre, descripcion="d", activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _equipo(db, sector_id, nombre="Equipo 1", activo=True):
    fila = Equipo(nombre=nombre, tipo="T", sector_id=sector_id, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _plan_con_tarea(db, nombre_plan="Plan Limpieza", nombre_tarea="Tarea Limpieza",
                    frecuencia=7, fecha_creacion=None):
    autor = _personal_admin(db)
    sector = _sector(db)
    equipo = _equipo(db, sector.id)
    plan = plan_models.PlanLimpieza(
        nombre=nombre_plan, equipo_id=equipo.id, autor_id=autor.id,
        activo=True,
    )
    if fecha_creacion is not None:
        plan.fecha_creacion = fecha_creacion
    db.info["sin_auditoria"] = True
    try:
        db.add(plan)
        db.commit()
        db.refresh(plan)
        tarea = Tarea(
            nombre=nombre_tarea, frecuencia=frecuencia, tipo="operacional",
            plan_limpieza_id=plan.id, activo=True,
        )
        db.add(tarea)
        db.commit()
        db.refresh(tarea)
    finally:
        db.info.pop("sin_auditoria", None)
    return plan, equipo, tarea, autor


# ---------------------------------------------------------------------------
# obtener_o_crear_checklists_del_dia
# ---------------------------------------------------------------------------

def test_checklist_del_dia_crea_checklist_y_registros(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # fecha_creacion 2025-06-03, fecha 2025-06-10: 7 dias, multiplo de frecuencia 7
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )

    # Act (listar_tareas_del_dia crea el checklist y registros cuando fecha == hoy)
    resultados = listar_tareas_del_dia(db_session, date(2025, 6, 10))

    # Assert
    tareas_equipo = [t for t in resultados.tareas if t.equipo_id == equipo.id]
    assert len(tareas_equipo) == 1
    assert tareas_equipo[0].registro_id != 0
    assert tareas_equipo[0].nombre == "Tarea Limpieza"
    assert tareas_equipo[0].completado is False


def test_checklist_del_dia_fecha_futura_devuelve_vista_sin_persistir(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # 2025-06-01 a 2025-06-15 son 14 dias, multiplo de 7
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 1),
    )

    # Act
    resultados = obtener_o_crear_checklists_del_dia(
        db_session, equipo.id, fecha=date(2025, 6, 15),
    )

    # Assert
    assert len(resultados) == 1
    assert resultados[0].checklist_id is None
    assert resultados[0].estado is None
    assert resultados[0].tareas[0].registro_id == 0


def test_checklist_del_dia_fecha_pasada_no_crea(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # 2025-06-01 a 2025-06-10: 9 dias, 9%7 != 0 -> no hay tarea para esa fecha
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 1),
    )

    # Act
    resultados = obtener_o_crear_checklists_del_dia(
        db_session, equipo.id, fecha=date(2025, 6, 10),
    )

    # Assert
    assert resultados == []


def test_checklist_del_dia_sin_tareas_para_la_fecha(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # fecha_creacion 2025-06-01, fecha 2025-06-10: 9 dias, 9%7 != 0
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 1),
    )

    # Act
    resultados = obtener_o_crear_checklists_del_dia(
        db_session, equipo.id, fecha=date(2025, 6, 10),
    )

    # Assert
    assert resultados == []


# ---------------------------------------------------------------------------
# marcar_tarea
# ---------------------------------------------------------------------------

def test_marcar_tarea_completar(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    _mock_ahora(monkeypatch, datetime(2025, 6, 10, 10, 0))
    # 2025-06-03 a 2025-06-10 son 7 dias, multiplo de 7
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    resultados = obtener_o_crear_checklists_del_dia(
        db_session, equipo.id, fecha=date(2025, 6, 10),
    )
    assert len(resultados) == 1
    registro_id = resultados[0].tareas[0].registro_id

    # Act
    registro = marcar_tarea(
        db_session, tarea.id, True, autor.id, "Admin A", None,
        fecha=date(2025, 6, 10),
    )

    # Assert
    assert registro.completado is True
    assert registro.fecha_completado is not None
    assert registro.usuario_id == autor.id


def test_marcar_tarea_desmarcar(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    _mock_ahora(monkeypatch, datetime(2025, 6, 10, 10, 0))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    obtener_o_crear_checklists_del_dia(db_session, equipo.id, fecha=date(2025, 6, 10))
    marcar_tarea(db_session, tarea.id, True, autor.id, "Admin A", None, fecha=date(2025, 6, 10))

    # Act
    registro = marcar_tarea(db_session, tarea.id, False, autor.id, "Admin A", None, fecha=date(2025, 6, 10))

    # Assert
    assert registro.completado is False
    assert registro.fecha_completado is None


def test_marcar_tarea_checklist_pasado_es_inmutable(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    checklist = Checklist(
        equipo_id=equipo.id, plan_id=plan.id, fecha=date(2025, 6, 5),
        estado=EstadoChecklist.ABIERTO,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(checklist)
        db_session.commit()
        db_session.refresh(checklist)
        registro = RegistroTarea(
            checklist_id=checklist.id, tarea_id=tarea.id,
            nombre_tarea_historico="Tarea", completado=False,
        )
        db_session.add(registro)
        db_session.commit()
        db_session.refresh(registro)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        marcar_tarea(db_session, tarea.id, True, autor.id, "Admin A", None, fecha=date(2025, 6, 5))
    except exceptions.ChecklistInmutable:
        pass
    else:
        raise AssertionError("Se esperaba ChecklistInmutable")


def test_tareas_del_dia_pasado_abierto_se_informa_cerrado(db_session, monkeypatch):
    """Un día pasado guardado como ABIERTO (nadie lo volvió a tocar) se informa
    CERRADO: si no, el frontend habilitaba la casilla y el backend rechazaba
    el cambio. La lectura no escribe: el estado guardado no cambia."""
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    checklist = Checklist(
        equipo_id=equipo.id, plan_id=plan.id, fecha=date(2025, 6, 5),
        estado=EstadoChecklist.ABIERTO,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(checklist)
        db_session.commit()
        db_session.refresh(checklist)
        db_session.add(RegistroTarea(
            checklist_id=checklist.id, tarea_id=tarea.id,
            nombre_tarea_historico="Tarea", completado=False,
        ))
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = listar_tareas_del_dia(db_session, date(2025, 6, 5))

    # Assert
    tareas_equipo = [t for t in resultado.tareas if t.equipo_id == equipo.id]
    assert len(tareas_equipo) == 1
    assert tareas_equipo[0].checklist_estado == EstadoChecklist.CERRADO
    db_session.refresh(checklist)
    assert checklist.estado == EstadoChecklist.ABIERTO


def test_marcar_tarea_checklist_futuro(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # 2025-06-01 a 2025-06-15 son 14 dias, multiplo de 7 -> corresponde
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 1),
    )

    # Act / Assert
    try:
        marcar_tarea(db_session, tarea.id, True, autor.id, "Admin A", None, fecha=date(2025, 6, 15))
    except exceptions.ChecklistFuturo:
        pass
    else:
        raise AssertionError("Se esperaba ChecklistFuturo")


# ---------------------------------------------------------------------------
# asignar_cobertura_tarea
# ---------------------------------------------------------------------------

def test_asignar_cobertura_tarea_asigna_operador(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    operador = Personal(
        nombre="Oper", apellido="Ar", dni="87654321", email="op@test.com",
        password="h", puede_operar=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(operador)
        db_session.commit()
        db_session.refresh(operador)
    finally:
        db_session.info.pop("sin_auditoria", None)
    # listar_tareas_del_dia crea el checklist y registros cuando fecha == hoy
    listar_tareas_del_dia(db_session, date(2025, 6, 10))
    registro_id = db_session.scalar(
        __import__("sqlalchemy").select(RegistroTarea.id).where(
            RegistroTarea.tarea_id == tarea.id
        )
    )

    # Act
    actualizado = asignar_cobertura_tarea(
        db_session, registro_id, operador.id, autor.id,
    )

    # Assert: la tarea no tenía responsable, así que el elegido pasa a serlo.
    assert actualizado.operador_id == operador.id
    assert actualizado.reemplazado_por_id is None


def test_asignar_cobertura_tarea_checklist_pasado_es_inmutable(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    checklist = Checklist(
        equipo_id=equipo.id, plan_id=plan.id, fecha=date(2025, 6, 5),
        estado=EstadoChecklist.ABIERTO,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(checklist)
        db_session.commit()
        db_session.refresh(checklist)
        registro = RegistroTarea(
            checklist_id=checklist.id, tarea_id=tarea.id,
            nombre_tarea_historico="Tarea", completado=False,
        )
        db_session.add(registro)
        db_session.commit()
        db_session.refresh(registro)
        registro_id = registro.id
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act / Assert
    try:
        asignar_cobertura_tarea(db_session, registro_id, None, autor.id)
    except exceptions.ChecklistInmutable:
        pass
    else:
        raise AssertionError("Se esperaba ChecklistInmutable")


# ---------------------------------------------------------------------------
# listar_historial_checklists
# ---------------------------------------------------------------------------

def test_listar_historial_checklists_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = listar_historial_checklists(
        db_session, date(2025, 6, 1), date(2025, 6, 10),
    )

    # Assert
    assert resultado.checklists == []
    assert resultado.porcentaje_cumplimiento_general == 0.0


def test_listar_historial_checklists_rango_invalido(db_session):
    # Arrange

    # Act / Assert
    try:
        listar_historial_checklists(db_session, date(2025, 6, 10), date(2025, 6, 1))
    except exceptions.FechaInvalida:
        pass
    else:
        raise AssertionError("Se esperaba FechaInvalida")


# ---------------------------------------------------------------------------
# obtener_detalle_checklist
# ---------------------------------------------------------------------------

def test_obtener_detalle_checklist_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_detalle_checklist(db_session, 9999)
    except exceptions.ChecklistNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba ChecklistNoEncontrado")


# ---------------------------------------------------------------------------
# listar_consumo_insumos
# ---------------------------------------------------------------------------

def test_listar_consumo_insumos_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_consumo_insumos(db_session, date(2025, 6, 1), date(2025, 6, 10))

    # Assert
    assert resultado.insumos == []


def test_listar_consumo_insumos_rango_invalido(db_session):
    # Arrange

    # Act / Assert
    try:
        listar_consumo_insumos(db_session, date(2025, 6, 10), date(2025, 6, 1))
    except exceptions.FechaInvalida:
        pass
    else:
        raise AssertionError("Se esperaba FechaInvalida")


# ---------------------------------------------------------------------------
# listar_tareas_del_dia
# ---------------------------------------------------------------------------

def test_listar_tareas_del_dia_sin_equipos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = listar_tareas_del_dia(db_session, date(2025, 6, 10))

    # Assert
    assert resultado.tareas == []


def _desactivar(db, fila):
    fila.activo = False
    db.info["sin_auditoria"] = True
    try:
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def test_tareas_del_dia_conserva_checklist_de_plan_desactivado_hoy(db_session, monkeypatch):
    # Arrange: el checklist de hoy ya estaba armado cuando se desactivó el plan.
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    _mock_ahora(monkeypatch, datetime(2025, 6, 10, 10, 0))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    listar_tareas_del_dia(db_session, date(2025, 6, 10))
    _desactivar(db_session, plan)

    # Act
    hoy_ = listar_tareas_del_dia(db_session, date(2025, 6, 10))
    registro = marcar_tarea(
        db_session, tarea.id, True, autor.id, "Admin A", None, fecha=date(2025, 6, 10),
    )

    # Assert: sigue siendo tarea de hoy y se puede marcar.
    assert [t.nombre for t in hoy_.tareas] == ["Tarea Limpieza"]
    assert hoy_.tareas[0].plan_nombre == "Plan Limpieza"
    assert registro.completado is True


def test_tareas_del_dia_conserva_checklist_de_equipo_desactivado_hoy(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    listar_tareas_del_dia(db_session, date(2025, 6, 10))
    _desactivar(db_session, equipo)

    # Act
    hoy_ = listar_tareas_del_dia(db_session, date(2025, 6, 10))

    # Assert
    assert [(t.nombre, t.equipo_nombre) for t in hoy_.tareas] == [("Tarea Limpieza", "Equipo 1")]


def test_plan_desactivado_no_genera_checklist_al_dia_siguiente(db_session, monkeypatch):
    # Arrange: frecuencia diaria; el plan se desactiva con el checklist de hoy armado.
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=1, fecha_creacion=date(2025, 6, 3),
    )
    listar_tareas_del_dia(db_session, date(2025, 6, 10))
    _desactivar(db_session, plan)
    _mock_hoy(monkeypatch, date(2025, 6, 11))

    # Act
    manana = listar_tareas_del_dia(db_session, date(2025, 6, 11))

    # Assert
    assert manana.tareas == []
    try:
        marcar_tarea(db_session, tarea.id, True, autor.id, "Admin A", None, fecha=date(2025, 6, 11))
        assert False, "una tarea de un plan desactivado no debería generar checklist nuevo"
    except Exception as error:
        assert type(error).__name__ == "TareaNoEncontrada"


def test_tareas_del_dia_fecha_pasada_sin_checklist_no_se_reconstruye(db_session, monkeypatch):
    # Arrange: el 2025-06-10 tocaba la tarea, pero nadie abrió el checklist.
    _mock_hoy(monkeypatch, date(2025, 6, 12))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )

    # Act
    del_dia = listar_tareas_del_dia(db_session, date(2025, 6, 10), current_user=autor)
    del_equipo = obtener_o_crear_checklists_del_dia(db_session, equipo.id, fecha=date(2025, 6, 10))

    # Assert
    assert del_dia.tareas == []
    assert del_equipo == []


def test_tareas_del_dia_fecha_futura_muestra_vista_calculada(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 12))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )

    # Act
    resultado = listar_tareas_del_dia(db_session, date(2025, 6, 17), current_user=autor)

    # Assert: se ve lo que va a tocar, sin persistir nada.
    assert [(t.nombre, t.registro_id) for t in resultado.tareas] == [("Tarea Limpieza", 0)]
    assert db_session.query(Checklist).count() == 0


def _operador(db, dni, email, nombre="Oper"):
    fila = Personal(
        nombre=nombre, apellido="Ar", dni=dni, email=email,
        password="h", puede_operar=True, puede_administrar=False, es_super_admin=False,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def test_asignar_cobertura_el_elegido_queda_como_suplente(db_session, monkeypatch):
    # Arrange: la tarea tiene responsable; el admin elige a otro operador.
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    plan, equipo, tarea, autor = _plan_con_tarea(
        db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3),
    )
    responsable = _operador(db_session, "11111111", "r@test.com", "Responsable")
    suplente = _operador(db_session, "22222222", "s@test.com", "Suplente")
    tarea.operador_id = responsable.id
    db_session.commit()
    registro_id = listar_tareas_del_dia(db_session, date(2025, 6, 10)).tareas[0].registro_id

    # Act
    cubierta = asignar_cobertura_tarea(db_session, registro_id, suplente.id, autor.id)

    # Assert: responsable intacto, suplente el elegido, el admin en el historial.
    assert (cubierta.operador_id, cubierta.reemplazado_por_id) == (responsable.id, suplente.id)
    historial = db_session.query(HistorialRegistroTarea).filter_by(registro_tarea_id=registro_id).all()
    assert [h.usuario_id for h in historial] == [autor.id]
    # El suplente la ve en su checklist.
    del_suplente = listar_tareas_del_dia(db_session, date(2025, 6, 10), current_user=suplente)
    assert [t.registro_id for t in del_suplente.tareas] == [registro_id]

    # Act: sin suplente, vuelve a su responsable.
    sin_cobertura = asignar_cobertura_tarea(db_session, registro_id, None, autor.id)

    # Assert
    assert (sin_cobertura.operador_id, sin_cobertura.reemplazado_por_id) == (responsable.id, None)
