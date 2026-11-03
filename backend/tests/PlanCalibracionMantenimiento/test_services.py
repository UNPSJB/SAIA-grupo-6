"""Tests unitarios de services del módulo `PlanCalibracionMantenimiento`."""

from datetime import date

from src.Equipo.models import Equipo
from src.Equipo.services import crear_equipo
from src.Equipo.schemas import EquipoCreate
from src.PlanCalibracionMantenimiento import exceptions, models, schemas
from src.PlanCalibracionMantenimiento.services import (
    crear_plan_calibracion_mantenimiento,
    dar_de_baja_plan_calibracion_mantenimiento,
    listar_planes_calibracion_mantenimiento,
    listar_planes_calibracion_mantenimiento_paginado,
    leer_plan_calibracion_mantenimiento,
    modificar_plan_calibracion_mantenimiento,
)
from src.personal.models import Personal
from src.sector.models import Sector
from src.sector.services import crear_sector
from tests.database import db_session


def _personal_admin(db, dni="12345678", email="a@test.com", puede_administrar=True):
    fila = Personal(
        nombre="Admin", apellido="A", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=puede_administrar, es_super_admin=False,
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


# ---------------------------------------------------------------------------
# crear_plan
# ---------------------------------------------------------------------------

def test_crear_plan_caso_feliz(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    datos = schemas.PlanCalibracionMantenimientoCreate(
        equipo_id=equipo.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
    )

    # Act
    creado = crear_plan_calibracion_mantenimiento(db_session, datos, autor.id)

    # Assert
    assert creado.id is not None
    assert creado.tipo == "calibracion"
    assert creado.activo is True


def test_crear_plan_equipo_inactivo_lanza_error(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id, activo=False)
    datos = schemas.PlanCalibracionMantenimientoCreate(
        equipo_id=equipo.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
    )

    # Act / Assert
    try:
        crear_plan_calibracion_mantenimiento(db_session, datos, autor.id)
    except exceptions.EquipoInactivo:
        pass
    else:
        raise AssertionError("Se esperaba EquipoInactivo")


def test_crear_plan_autor_sin_permiso_lanza_error(db_session):
    # Arrange
    autor = _personal_admin(db_session, puede_administrar=False)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    datos = schemas.PlanCalibracionMantenimientoCreate(
        equipo_id=equipo.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
    )

    # Act / Assert
    try:
        crear_plan_calibracion_mantenimiento(db_session, datos, autor.id)
    except exceptions.AutorSinPermisoDeAdministrar:
        pass
    else:
        raise AssertionError("Se esperaba AutorSinPermisoDeAdministrar")


# ---------------------------------------------------------------------------
# listar_planes
# ---------------------------------------------------------------------------

def test_listar_planes_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_planes_calibracion_mantenimiento(db_session)

    # Assert
    assert resultado == []


def test_listar_planes_solo_activos(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_plan_calibracion_mantenimiento(
        db_session,
        schemas.PlanCalibracionMantenimientoCreate(
            equipo_id=equipo.id, tipo="calibracion",
            fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
        ),
        autor.id,
    )
    equipo2 = _equipo(db_session, sector.id, nombre="EquipoDos")
    crear_plan_calibracion_mantenimiento(
        db_session,
        schemas.PlanCalibracionMantenimientoCreate(
            equipo_id=equipo2.id, tipo="calibracion",
            fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
        ),
        autor.id,
    )
    plan2 = leer_plan_calibracion_mantenimiento(db_session, 2)
    dar_de_baja_plan_calibracion_mantenimiento(db_session, plan2.id)

    # Act
    resultado = listar_planes_calibracion_mantenimiento(db_session)

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_planes_paginado
# ---------------------------------------------------------------------------

def test_listar_planes_paginado_page_y_page_size(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id, nombre="Equipo Plan")
    for i in range(5):
        equipo_i = _equipo(db_session, sector.id, nombre=f"Equipo PCM {i}")
        crear_plan_calibracion_mantenimiento(
            db_session,
            schemas.PlanCalibracionMantenimientoCreate(
                equipo_id=equipo_i.id, tipo="calibracion",
                fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
            ),
            autor.id,
        )

    # Act
    items, total = listar_planes_calibracion_mantenimiento_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# leer_plan
# ---------------------------------------------------------------------------

def test_leer_plan_existe(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_calibracion_mantenimiento(
        db_session,
        schemas.PlanCalibracionMantenimientoCreate(
            equipo_id=equipo.id, tipo="calibracion",
            fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
        ),
        autor.id,
    )

    # Act
    obtenido = leer_plan_calibracion_mantenimiento(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_leer_plan_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_plan_calibracion_mantenimiento(db_session, 9999)
    except exceptions.PlanCalibracionMantenimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanCalibracionMantenimientoNoEncontrado")


# ---------------------------------------------------------------------------
# modificar_plan
# ---------------------------------------------------------------------------

def test_modificar_plan_parcial(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_calibracion_mantenimiento(
        db_session,
        schemas.PlanCalibracionMantenimientoCreate(
            equipo_id=equipo.id, tipo="calibracion",
            fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
        ),
        autor.id,
    )
    datos = schemas.PlanCalibracionMantenimientoUpdate(tipo="mantenimiento")

    # Act
    actualizado = modificar_plan_calibracion_mantenimiento(db_session, creado.id, datos)

    # Assert
    assert actualizado.tipo == "mantenimiento"


def test_modificar_plan_no_existe(db_session):
    # Arrange
    datos = schemas.PlanCalibracionMantenimientoUpdate(tipo="mantenimiento")

    # Act / Assert
    try:
        modificar_plan_calibracion_mantenimiento(db_session, 9999, datos)
    except exceptions.PlanCalibracionMantenimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanCalibracionMantenimientoNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_plan (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_plan_pasa_a_activo_falso(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_calibracion_mantenimiento(
        db_session,
        schemas.PlanCalibracionMantenimientoCreate(
            equipo_id=equipo.id, tipo="calibracion",
            fecha_ultima_intervencion=date(2025, 1, 1), periodicidad_dias=90,
        ),
        autor.id,
    )

    # Act
    eliminado = dar_de_baja_plan_calibracion_mantenimiento(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


def test_eliminar_plan_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        dar_de_baja_plan_calibracion_mantenimiento(db_session, 9999)
    except exceptions.PlanCalibracionMantenimientoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanCalibracionMantenimientoNoEncontrado")
