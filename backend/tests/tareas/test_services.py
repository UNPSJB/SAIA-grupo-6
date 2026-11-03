"""Tests unitarios de services del módulo `tareas`."""

from src.Equipo.models import Equipo
from src.Equipo.services import crear_equipo
from src.Equipo.schemas import EquipoCreate
from src.PlanLimpieza import models as plan_models
from src.PlanLimpieza.schemas import PlanLimpiezaCreate, TareaInput
from src.PlanLimpieza.services import crear_plan_limpieza
from src.personal.models import Personal
from src.sector.models import Sector
from src.sector.services import crear_sector
from src.tareas import exceptions, models, schemas
from src.tareas.services import (
    crear_tarea, eliminar_tarea, listar_tareas, leer_tarea, modificar_tarea,
)
from tests.database import db_session


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


def _plan_con_tarea(db):
    autor = _personal_admin(db)
    sector = Sector(nombre="Sector", descripcion="d", activo=True)
    db.info["sin_auditoria"] = True
    db.add(sector)
    db.commit()
    db.refresh(sector)
    equipo = Equipo(nombre="Equipo", tipo="T", sector_id=sector.id, activo=True)
    db.info["sin_auditoria"] = True
    db.add(equipo)
    db.commit()
    db.refresh(equipo)
    plan = crear_plan_limpieza(
        db,
        PlanLimpiezaCreate(
            nombre="PlanLimpieza", equipo_id=equipo.id,
            tareas=[TareaInput(nombre="TareaExistente", frecuencia=7, tipo="operacional")],
        ),
        autor.id,
    )
    return plan, equipo, autor


# ---------------------------------------------------------------------------
# crear_tarea
# ---------------------------------------------------------------------------

def test_crear_tarea_caso_feliz(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)
    datos = schemas.TareaCreate(
        nombre="NuevaTarea", frecuencia=14, tipo="operacional",
        plan_limpieza_id=plan.id,
    )

    # Act
    creada = crear_tarea(db_session, datos)

    # Assert
    assert creada.id is not None
    assert creada.nombre == "NuevaTarea"
    assert creada.plan_limpieza_id == plan.id


def test_crear_tarea_nombre_duplicado_en_mismo_plan(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)
    datos = schemas.TareaCreate(
        nombre="TareaExistente", frecuencia=7, tipo="operacional",
        plan_limpieza_id=plan.id,
    )

    # Act / Assert
    try:
        crear_tarea(db_session, datos)
    except exceptions.NombreDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba NombreDuplicado")


def test_crear_tarea_plan_inexistente_lanza_error(db_session):
    # Arrange
    datos = schemas.TareaCreate(
        nombre="Nueva", frecuencia=7, tipo="operacional", plan_limpieza_id=9999,
    )

    # Act / Assert
    try:
        crear_tarea(db_session, datos)
    except exceptions.PlanLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanLimpiezaNoEncontrado")


def test_crear_tarea_tipo_invalido(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)

    # Act / Assert
    try:
        datos = schemas.TareaCreate(
            nombre="Nueva", frecuencia=7, tipo="invalido", plan_limpieza_id=plan.id,
        )
        crear_tarea(db_session, datos)
    except exceptions.TipoInvalido:
        pass
    else:
        raise AssertionError("Se esperaba TipoInvalido")


# ---------------------------------------------------------------------------
# listar_tareas
# ---------------------------------------------------------------------------

def test_listar_tareas_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_tareas(db_session)

    # Assert
    assert resultado == []


def test_listar_tareas_filtro_por_plan(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)

    # Act
    resultado = listar_tareas(db_session, plan_limpieza_id=plan.id)

    # Assert
    assert len(resultado) >= 1


# ---------------------------------------------------------------------------
# leer_tarea
# ---------------------------------------------------------------------------

def test_leer_tarea_existe(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)
    tarea = db_session.scalar(
        __import__("sqlalchemy").select(models.Tarea).where(
            models.Tarea.plan_limpieza_id == plan.id
        )
    )

    # Act
    leída = leer_tarea(db_session, tarea.id)

    # Assert
    assert leída.id == tarea.id


def test_leer_tarea_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_tarea(db_session, 9999)
    except exceptions.TareaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba TareaNoEncontrada")


# ---------------------------------------------------------------------------
# modificar_tarea
# ---------------------------------------------------------------------------

def test_modificar_tarea_parcial(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)
    tarea = db_session.scalar(
        __import__("sqlalchemy").select(models.Tarea).where(
            models.Tarea.plan_limpieza_id == plan.id
        )
    )
    datos = schemas.TareaUpdate(frecuencia=10)

    # Act
    modificada = modificar_tarea(db_session, tarea.id, datos)

    # Assert
    assert modificada.frecuencia == 10


def test_modificar_tarea_no_existe(db_session):
    # Arrange
    datos = schemas.TareaUpdate(nombre="Otra")

    # Act / Assert
    try:
        modificar_tarea(db_session, 9999, datos)
    except exceptions.TareaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba TareaNoEncontrada")


# ---------------------------------------------------------------------------
# eliminar_tarea (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_tarea_pasa_a_activo_falso(db_session):
    # Arrange
    plan, _, _ = _plan_con_tarea(db_session)
    tarea = db_session.scalar(
        __import__("sqlalchemy").select(models.Tarea).where(
            models.Tarea.plan_limpieza_id == plan.id
        )
    )

    # Act
    eliminada = eliminar_tarea(db_session, tarea.id)

    # Assert
    assert eliminada.activo is False


def test_eliminar_tarea_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_tarea(db_session, 9999)
    except exceptions.TareaNoEncontrada:
        pass
    else:
        raise AssertionError("Se esperaba TareaNoEncontrada")
