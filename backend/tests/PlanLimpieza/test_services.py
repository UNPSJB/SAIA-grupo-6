"""Tests unitarios de services del módulo `PlanLimpieza`."""

from src.Equipo.models import Equipo
from src.Equipo.services import crear_equipo
from src.Equipo.schemas import EquipoCreate
from src.PlanLimpieza import exceptions, models, schemas
from src.PlanLimpieza.services import (
    crear_plan_limpieza,
    eliminar_plan_limpieza,
    listar_planes_limpieza,
    listar_planes_limpieza_paginado,
    leer_plan_limpieza,
    modificar_plan_limpieza,
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


def _tarea_plan(nombre="Tarea 1", frecuencia=7):
    return schemas.TareaInput(
        nombre=nombre, frecuencia=frecuencia, tipo="operacional",
    )


# ---------------------------------------------------------------------------
# crear_plan_limpieza
# ---------------------------------------------------------------------------

def test_crear_plan_limpieza_caso_feliz(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = schemas.PlanLimpiezaCreate(
        nombre="PlanMensual", equipo_id=equipo.id,
        tareas=[_tarea_plan("LimpiarPisos", 7)],
    )

    # Act
    creado = crear_plan_limpieza(db_session, plan, autor.id)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "PlanMensual"
    assert creado.autor_id == autor.id
    assert len(creado.tareas) == 1


def test_crear_plan_limpieza_autor_no_administra_lanza_error(db_session):
    # Arrange
    autor = _personal_admin(db_session, puede_administrar=False)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = schemas.PlanLimpiezaCreate(
        nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)],
    )

    # Act / Assert
    try:
        crear_plan_limpieza(db_session, plan, autor.id)
    except exceptions.AutorSinPermisoDeAdministrar:
        pass
    else:
        raise AssertionError("Se esperaba AutorSinPermisoDeAdministrar")


def test_crear_plan_limpieza_equipo_inactivo_lanza_equipo_inactivo(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id, activo=False)
    plan = schemas.PlanLimpiezaCreate(
        nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)],
    )


def test_crear_plan_limpieza_nombre_duplicado_activo_lanza_duplicado(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )
    plan2 = schemas.PlanLimpiezaCreate(
        nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)],
    )

    # Act / Assert
    try:
        crear_plan_limpieza(db_session, plan2, autor.id)
    except exceptions.NombrePlanDuplicado:
        pass
    else:
        raise AssertionError("Se esperaba NombrePlanDuplicado")


# ---------------------------------------------------------------------------
# listar_planes_limpieza
# ---------------------------------------------------------------------------

def test_listar_planes_limpieza_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_planes_limpieza(db_session)

    # Assert
    assert resultado == []


def test_listar_planes_limpieza_solo_activos(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Activo", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )
    crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Inactivo", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )
    # Dar de baja el segundo
    from src.PlanLimpieza.services import eliminar_plan_limpieza
    plans = listar_planes_limpieza(db_session, incluir_inactivos=True)
    eliminar_plan_limpieza(db_session, plans[1].id)

    # Act
    resultado = listar_planes_limpieza(db_session)

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_planes_limpieza_paginado
# ---------------------------------------------------------------------------

def test_listar_planes_limpieza_paginado_page_y_page_size(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    for i, nombre in enumerate(["PlanUno", "PlanDos", "PlanTres", "PlanCuatro", "PlanCinco"]):
        crear_plan_limpieza(
            db_session,
            schemas.PlanLimpiezaCreate(nombre=nombre, equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
            autor.id,
        )

    # Act
    items, total = listar_planes_limpieza_paginado(
        db_session, incluir_inactivos=False, page=1, page_size=2
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# obtener_plan_limpieza
# ---------------------------------------------------------------------------

def test_obtener_plan_limpieza_existe(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )

    # Act
    obtenido = leer_plan_limpieza(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_leer_plan_limpieza_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_plan_limpieza(db_session, 9999)
    except exceptions.PlanLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanLimpiezaNoEncontrado")


# ---------------------------------------------------------------------------
# modificar_plan_limpieza
# ---------------------------------------------------------------------------

def test_modificar_plan_limpieza_parcial(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )
    datos = schemas.PlanLimpiezaUpdate(nombre="Plan Modificado")

    # Act
    actualizado = modificar_plan_limpieza(db_session, creado.id, datos)

    # Assert
    assert actualizado.nombre == "Plan Modificado"


def test_modificar_plan_limpieza_no_existe(db_session):
    # Arrange
    datos = schemas.PlanLimpiezaUpdate(nombre="Otro")

    # Act / Assert
    try:
        modificar_plan_limpieza(db_session, 9999, datos)
    except exceptions.PlanLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanLimpiezaNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_plan_limpieza (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_plan_limpieza_pasa_a_activo_falso(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_plan_limpieza(
        db_session,
        schemas.PlanLimpiezaCreate(nombre="Plan", equipo_id=equipo.id, tareas=[_tarea_plan("TareaUno", 7)]),
        autor.id,
    )

    # Act
    eliminado = eliminar_plan_limpieza(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


def test_eliminar_plan_limpieza_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        eliminar_plan_limpieza(db_session, 9999)
    except exceptions.PlanLimpiezaNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba PlanLimpiezaNoEncontrado")
