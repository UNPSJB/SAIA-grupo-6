"""Tests unitarios de services del módulo `incidente`."""

from datetime import date, datetime

from src.incidente import exceptions, schemas
from src.incidente.models import Incidente, HistorialIncidente
from src.incidente.services import (
    cambiar_estado_incidente,
    crear_incidente,
    listar_incidentes,
    listar_incidentes_paginado,
    listar_mis_incidentes,
    listar_mis_incidentes_paginado,
    obtener_historial_incidente,
    obtener_incidente,
    resumen_por_tipo,
)
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.Equipo.models import Equipo
from src.Equipo.services import crear_equipo
from src.personal.models import Personal
from src.sector.models import Sector
from src.sector.services import crear_sector
from tests.database import db_session


def _personal_admin(db, dni="12345678", email="a@test.com", activo=True):
    fila = Personal(
        nombre="Admin", apellido="A", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=True, es_super_admin=False,
        activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _personal_operador(db, dni="87654321", email="o@test.com"):
    fila = Personal(
        nombre="Oper", apellido="R", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=False, es_super_admin=False,
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


def _datos_incidente(titulo="Fuga de agua", descripcion="Hay una fuga",
                     tipo=TipoIncidente.PLAGAS, equipo_id=None):
    return schemas.IncidenteCreate(
        titulo=titulo, descripcion=descripcion, tipo=tipo,
        equipo_id=equipo_id,
    )


# ---------------------------------------------------------------------------
# crear_incidente
# ---------------------------------------------------------------------------

def test_crear_incidente_caso_feliz(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    datos = _datos_incidente(equipo_id=equipo.id)

    # Act
    creado = crear_incidente(db_session, datos, usuario.id)

    # Assert
    assert creado.id is not None
    assert creado.titulo == "Fuga de agua"
    assert creado.estado == EstadoIncidente.ABIERTO.value
    assert creado.usuario_id == usuario.id


def test_crear_incidente_equipo_inactivo_lanza_error(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id, activo=False)
    datos = _datos_incidente(equipo_id=equipo.id)

    # Act / Assert
    try:
        crear_incidente(db_session, datos, usuario.id)
    except exceptions.EquipoInactivo:
        pass
    else:
        raise AssertionError("Se esperaba EquipoInactivo")


def test_crear_incidente_usuario_inactivo_lanza_error(db_session):
    # Arrange
    usuario = _personal_admin(db_session, activo=False)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    datos = _datos_incidente(equipo_id=equipo.id)

    # Act / Assert
    try:
        crear_incidente(db_session, datos, usuario.id)
    except exceptions.UsuarioInactivo:
        pass
    else:
        raise AssertionError("Se esperaba UsuarioInactivo")


def test_crear_incidente_titulo_vacio_lanza_error(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)

    # Act / Assert (el validador de Pydantic rechaza antes del service)
    try:
        datos = _datos_incidente(titulo="   ", equipo_id=equipo.id)
        crear_incidente(db_session, datos, usuario.id)
    except exceptions.TituloVacio:
        pass
    else:
        raise AssertionError("Se esperaba TituloVacio")


def test_crear_incidente_descripcion_vacia_lanza_error(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)

    # Act / Assert (el validador de Pydantic rechaza antes del service)
    try:
        datos = _datos_incidente(descripcion="   ", equipo_id=equipo.id)
        crear_incidente(db_session, datos, usuario.id)
    except exceptions.DescripcionVacia:
        pass
    else:
        raise AssertionError("Se esperaba DescripcionVacia")


# ---------------------------------------------------------------------------
# listar_incidentes
# ---------------------------------------------------------------------------

def test_listar_incidentes_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_incidentes(db_session)

    # Assert
    assert resultado == []


def test_listar_incidentes_filtro_por_estado(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)
    cerrado = crear_incidente(db_session, _datos_incidente(titulo="Otro", equipo_id=equipo.id), usuario.id)
    cambiar_estado_incidente(db_session, cerrado.id, EstadoIncidente.CERRADO, usuario)

    # Act
    abiertos = listar_incidentes(db_session, estado=EstadoIncidente.ABIERTO)
    cerrados = listar_incidentes(db_session, estado=EstadoIncidente.CERRADO)

    # Assert
    assert len(abiertos) == 1
    assert len(cerrados) == 1


def test_listar_incidentes_filtro_por_tipo(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_incidente(db_session, _datos_incidente(tipo=TipoIncidente.PLAGAS, equipo_id=equipo.id), usuario.id)
    crear_incidente(db_session, _datos_incidente(tipo=TipoIncidente.FALLA_EQUIPO, equipo_id=equipo.id), usuario.id)

    # Act
    resultado = listar_incidentes(db_session, tipo=TipoIncidente.PLAGAS)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == TipoIncidente.PLAGAS.value


def test_listar_incidentes_rango_fechas_invalido(db_session):
    # Arrange

    # Act / Assert
    try:
        listar_incidentes(db_session, fecha_desde=date(2025, 6, 10), fecha_hasta=date(2025, 6, 1))
    except exceptions.FechaInvalida:
        pass
    else:
        raise AssertionError("Se esperaba FechaInvalida")


# ---------------------------------------------------------------------------
# listar_incidentes_paginado
# ---------------------------------------------------------------------------

def test_listar_incidentes_paginado_page_y_page_size(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    for i in range(5):
        crear_incidente(db_session, _datos_incidente(titulo=f"Inc {i}", equipo_id=equipo.id), usuario.id)

    # Act
    items, total = listar_incidentes_paginado(
        db_session, estado=None, tipo=None, equipo_id=None, buscar=None,
        orden=None, page=1, page_size=2,
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# obtener_incidente
# ---------------------------------------------------------------------------

def test_obtener_incidente_existe(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)

    # Act
    obtenido = obtener_incidente(db_session, creado.id, usuario)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_incidente_no_existe(db_session):
    # Arrange
    usuario = _personal_admin(db_session)

    # Act / Assert
    try:
        obtener_incidente(db_session, 9999, usuario)
    except exceptions.IncidenteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IncidenteNoEncontrado")


def test_obtener_incidente_operador_no_ve_ajeno(db_session):
    # Arrange
    admin = _personal_admin(db_session, dni="11111111", email="admin@test.com")
    operador = _personal_operador(db_session, dni="22222222", email="op@test.com")
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), admin.id)

    # Act / Assert
    try:
        obtener_incidente(db_session, creado.id, operador)
    except exceptions.PermisoDenegado:
        pass
    else:
        raise AssertionError("Se esperaba PermisoDenegado")


# ---------------------------------------------------------------------------
# cambiar_estado_incidente
# ---------------------------------------------------------------------------

def test_cambiar_estado_incidente_cerrar(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)

    # Act
    cerrado = cambiar_estado_incidente(
        db_session, creado.id, EstadoIncidente.CERRADO, usuario,
        observacion_cierre="Se arregló la fuga",
    )

    # Assert
    assert cerrado.estado == EstadoIncidente.CERRADO.value
    assert cerrado.fecha_cierre is not None
    assert cerrado.responsable_cierre_id == usuario.id
    assert cerrado.observacion_cierre == "Se arregló la fuga"


def test_cambiar_estado_incidente_reabrir(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)
    cambiar_estado_incidente(db_session, creado.id, EstadoIncidente.CERRADO, usuario)

    # Act
    reabierto = cambiar_estado_incidente(
        db_session, creado.id, EstadoIncidente.ABIERTO, usuario,
    )

    # Assert
    assert reabierto.estado == EstadoIncidente.ABIERTO.value
    assert reabierto.fecha_cierre is None
    assert reabierto.responsable_cierre_id is None


def test_cambiar_estado_incidente_ya_esta_en_ese_estado(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)

    # Act (cerrar un incidente ya abierto no debería fallar, simplemente devuelve)
    resultado = cambiar_estado_incidente(
        db_session, creado.id, EstadoIncidente.ABIERTO, usuario,
    )

    # Assert
    assert resultado.estado == EstadoIncidente.ABIERTO.value


def test_cambiar_estado_incidente_no_existe(db_session):
    # Arrange
    usuario = _personal_admin(db_session)

    # Act / Assert
    try:
        cambiar_estado_incidente(db_session, 9999, EstadoIncidente.CERRADO, usuario)
    except exceptions.IncidenteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IncidenteNoEncontrado")


# ---------------------------------------------------------------------------
# listar_mis_incidentes
# ---------------------------------------------------------------------------

def test_listar_mis_incidentes_solo_del_usuario(db_session):
    # Arrange
    u1 = _personal_admin(db_session, dni="11111111", email="u1@test.com")
    u2 = _personal_admin(db_session, dni="22222222", email="u2@test.com")
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), u1.id)
    crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), u2.id)

    # Act
    resultado = listar_mis_incidentes(db_session, u1.id)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].usuario_id == u1.id


# ---------------------------------------------------------------------------
# listar_mis_incidentes_paginado
# ---------------------------------------------------------------------------

def test_listar_mis_incidentes_paginado(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    for i in range(3):
        crear_incidente(db_session, _datos_incidente(titulo=f"Inc {i}", equipo_id=equipo.id), usuario.id)

    # Act
    items, total = listar_mis_incidentes_paginado(
        db_session, usuario.id, page=1, page_size=2,
    )

    # Assert
    assert total == 3
    assert len(items) == 2


# ---------------------------------------------------------------------------
# resumen_por_tipo
# ---------------------------------------------------------------------------

def test_resumen_por_tipo(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    crear_incidente(db_session, _datos_incidente(tipo=TipoIncidente.PLAGAS, equipo_id=equipo.id), usuario.id)
    crear_incidente(db_session, _datos_incidente(tipo=TipoIncidente.PLAGAS, equipo_id=equipo.id), usuario.id)
    crear_incidente(db_session, _datos_incidente(tipo=TipoIncidente.FALLA_EQUIPO, equipo_id=equipo.id), usuario.id)

    # Act
    resumen = resumen_por_tipo(db_session, estado=EstadoIncidente.ABIERTO)

    # Assert
    assert resumen.total == 3
    por_tipo = {item.tipo: item.cantidad for item in resumen.por_tipo}
    assert por_tipo[TipoIncidente.PLAGAS.value] == 2
    assert por_tipo[TipoIncidente.FALLA_EQUIPO.value] == 1


# ---------------------------------------------------------------------------
# obtener_historial_incidente
# ---------------------------------------------------------------------------

def test_obtener_historial_incidente(db_session):
    # Arrange
    usuario = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    creado = crear_incidente(db_session, _datos_incidente(equipo_id=equipo.id), usuario.id)
    cambiar_estado_incidente(db_session, creado.id, EstadoIncidente.CERRADO, usuario, "Cierre")
    cambiar_estado_incidente(db_session, creado.id, EstadoIncidente.ABIERTO, usuario)

    # Act
    historial = obtener_historial_incidente(db_session, creado.id, usuario)

    # Assert
    assert len(historial.eventos) == 2
    assert historial.eventos[0].estado_anterior == EstadoIncidente.ABIERTO.value
    assert historial.eventos[0].estado_nuevo == EstadoIncidente.CERRADO.value
    assert historial.eventos[1].estado_anterior == EstadoIncidente.CERRADO.value
    assert historial.eventos[1].estado_nuevo == EstadoIncidente.ABIERTO.value


def test_obtener_historial_incidente_no_existe(db_session):
    # Arrange
    usuario = _personal_admin(db_session)

    # Act / Assert
    try:
        obtener_historial_incidente(db_session, 9999, usuario)
    except exceptions.IncidenteNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba IncidenteNoEncontrado")

