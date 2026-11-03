"""Tests unitarios de services del módulo `auditoria` (solo lectura)."""

from datetime import date, datetime

from src.auditoria.models import AuditLog
from src.auditoria.services import listar_auditoria
from tests.database import db_session


def _audit_log(
    db,
    entidad="sectores",
    entidad_id="1",
    accion="CREAR",
    fecha=None,
    usuario_id=None,
    cambios=None,
):
    fila = AuditLog(
        entidad=entidad,
        entidad_id=entidad_id,
        accion=accion,
        fecha=fecha or datetime(2025, 6, 10, 10, 0),
        usuario_id=usuario_id,
        cambios=cambios or {"nombre": ["Nuevo", None]},
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# listar_auditoria
# ---------------------------------------------------------------------------

def test_listar_auditoria_vacio(db_session):
    # Arrange

    # Act
    items, total = listar_auditoria(db_session)

    # Assert
    assert items == []
    assert total == 0


def test_listar_auditoria_con_datos(db_session):
    # Arrange
    _audit_log(db_session, entidad="sectores", entidad_id="1", accion="CREAR")
    _audit_log(db_session, entidad="sectores", entidad_id="2", accion="BAJA")
    _audit_log(db_session, entidad="personal", entidad_id="5", accion="MODIFICAR")

    # Act
    items, total = listar_auditoria(db_session)

    # Assert
    assert total == 3
    assert len(items) == 3


def test_listar_auditoria_filtro_por_entidad(db_session):
    # Arrange
    _audit_log(db_session, entidad="sectores", entidad_id="1", accion="CREAR")
    _audit_log(db_session, entidad="personal", entidad_id="5", accion="CREAR")

    # Act
    items, total = listar_auditoria(db_session, entidad="sectores")

    # Assert
    assert total == 1
    assert items[0].entidad == "sectores"


def test_listar_auditoria_filtro_por_accion(db_session):
    # Arrange
    _audit_log(db_session, entidad="sectores", entidad_id="1", accion="CREAR")
    _audit_log(db_session, entidad="sectores", entidad_id="2", accion="BAJA")

    # Act
    items, total = listar_auditoria(db_session, accion="BAJA")

    # Assert
    assert total == 1
    assert items[0].accion == "BAJA"


def test_listar_auditoria_filtro_por_rango_fechas(db_session):
    # Arrange
    _audit_log(db_session, entidad="sectores", entidad_id="1", accion="CREAR",
               fecha=datetime(2025, 6, 1, 10, 0))
    _audit_log(db_session, entidad="sectores", entidad_id="2", accion="CREAR",
               fecha=datetime(2025, 6, 10, 10, 0))

    # Act
    items, total = listar_auditoria(db_session, desde=date(2025, 6, 10),
                                    hasta=date(2025, 6, 10))

    # Assert
    assert total == 1


def test_listar_auditoria_paginado(db_session):
    # Arrange
    for i in range(5):
        _audit_log(db_session, entidad="sectores", entidad_id=str(i), accion="CREAR")

    # Act
    items, total = listar_auditoria(db_session, page=1, page_size=2)

    # Assert
    assert total == 5
    assert len(items) == 2
