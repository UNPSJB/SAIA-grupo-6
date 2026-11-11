"""Tests de services del módulo de certificaciones de transportistas."""

from datetime import date

import pytest
from sqlalchemy import select, text

from src.certificaciones_transportista import exceptions, schemas, services
from src.certificaciones_transportista.estado import (
    ESTADO_CERTIFICACION_VENCIDA,
    ESTADO_HABILITADO,
    ESTADO_SIN_CERTIFICACIONES,
    estado_habilitacion,
)
from src.certificaciones_transportista.models import CertificacionTransportista
from src.transportistas import services as transportistas_services
from src.transportistas.models import Transportista
from tests.database import db_session


def _transportista(db, cuit="20123456789"):
    fila = Transportista(
        razon_social="Transportes SA",
        cuit=cuit,
        telefono="11-1234-5678",
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _crear(
    db,
    transportista_id,
    *,
    tipo="SENASA",
    numero="SENASA-2026-001",
    fecha_emision=date(2026, 1, 1),
    fecha_vencimiento=date(2099, 12, 31),
):
    datos = schemas.CertificacionTransportistaCreate(
        tipo=tipo,
        numero=numero,
        fecha_emision=fecha_emision,
        fecha_vencimiento=fecha_vencimiento,
    )
    db.info["sin_auditoria"] = True
    try:
        return services.crear_certificacion(db, transportista_id, datos)
    finally:
        db.info.pop("sin_auditoria", None)


def _activas(db, transportista_id):
    return list(
        db.scalars(
            select(CertificacionTransportista).where(
                CertificacionTransportista.transportista_id == transportista_id,
                CertificacionTransportista.activa.is_(True),
            )
        ).all()
    )


def test_crear_certificacion_normaliza_el_tipo(db_session):
    transportista = _transportista(db_session)

    creada = _crear(db_session, transportista.id, tipo="  Señasa  ")

    assert creada.tipo == "Señasa"
    assert creada.tipo_normalizado == "senasa"


def test_renovacion_desactiva_la_anterior_y_deja_una_sola_activa(db_session):
    transportista = _transportista(db_session)
    anterior = _crear(db_session, transportista.id, tipo="SENASA")
    nueva = _crear(
        db_session,
        transportista.id,
        tipo="senasa ",
        fecha_vencimiento=date(2099, 12, 31),
    )

    activas = _activas(db_session, transportista.id)

    assert len(activas) == 1
    assert activas[0].id == nueva.id
    db_session.refresh(anterior)
    assert anterior.activa is False
    assert anterior.anulada is False
    assert anterior.tipo_normalizado == nueva.tipo_normalizado == "senasa"


def test_renovacion_reconoce_tipos_con_tildes(db_session):
    transportista = _transportista(db_session)
    _crear(db_session, transportista.id, tipo="SENASA")
    _crear(db_session, transportista.id, tipo="Señasa")

    assert len(_activas(db_session, transportista.id)) == 1


def test_anulacion_no_cuenta_y_registra_motivo_usuario_y_fecha(db_session):
    transportista = _transportista(db_session)
    certificacion = _crear(db_session, transportista.id)
    datos = schemas.CertificacionTransportistaAnular(motivo="error de carga")

    anulada = services.anular_certificacion(
        db_session, certificacion.id, datos, usuario_id=7
    )

    assert anulada.activa is False
    assert anulada.anulada is True
    assert anulada.motivo_anulacion == "error de carga"
    assert anulada.anulada_por == 7
    assert anulada.fecha_anulacion is not None

    activas = services.listar_certificaciones(db_session, transportista.id)
    assert activas == []
    assert estado_habilitacion(activas) == ESTADO_SIN_CERTIFICACIONES


def test_anulacion_exige_motivo(db_session):
    transportista = _transportista(db_session)
    certificacion = _crear(db_session, transportista.id)
    # `model_construct` evita la validación del schema para probar la guarda
    # defensiva del service.
    datos = schemas.CertificacionTransportistaAnular.model_construct(motivo="   ")

    with pytest.raises(exceptions.MotivoAnulacionRequerido):
        services.anular_certificacion(db_session, certificacion.id, datos)


def test_no_se_puede_anular_dos_veces(db_session):
    transportista = _transportista(db_session)
    certificacion = _crear(db_session, transportista.id)
    datos = schemas.CertificacionTransportistaAnular(motivo="error")

    services.anular_certificacion(db_session, certificacion.id, datos)

    with pytest.raises(exceptions.CertificacionYaAnulada):
        services.anular_certificacion(db_session, certificacion.id, datos)


def test_actualizar_solo_cambia_observaciones(db_session):
    transportista = _transportista(db_session)
    certificacion = _crear(db_session, transportista.id)
    datos = schemas.CertificacionTransportistaUpdate(observaciones="nueva nota")

    actualizada = services.actualizar_certificacion(
        db_session, certificacion.id, datos
    )

    assert actualizada.observaciones == "nueva nota"
    assert actualizada.tipo == certificacion.tipo
    assert actualizada.numero == certificacion.numero
    assert actualizada.fecha_emision == certificacion.fecha_emision
    assert actualizada.fecha_vencimiento == certificacion.fecha_vencimiento


def test_no_existe_borrado_fisico(db_session):
    assert not hasattr(services, "eliminar_certificacion")

    from src.certificaciones_transportista.router import router

    metodos = [
        getattr(ruta, "methods", set()) or set() for ruta in router.routes
    ]
    assert all("DELETE" not in metodos_ruta for metodos_ruta in metodos)


def test_indice_unico_parcial_por_tipo_activo(db_session):
    nombres = [
        fila[0]
        for fila in db_session.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'index' AND tbl_name = 'certificaciones_transportista'"
            )
        ).all()
    ]

    assert "uq_certificaciones_transportista_tipo_activa" in nombres


def test_estado_global_del_transportista_sin_certificaciones(db_session):
    transportista = _transportista(db_session)

    obtenido = transportistas_services.obtener_transportista(
        db_session, transportista.id
    )

    assert obtenido.estado_habilitacion == ESTADO_SIN_CERTIFICACIONES


def test_estado_global_del_transportista_habilitado(db_session):
    transportista = _transportista(db_session)
    _crear(db_session, transportista.id, fecha_vencimiento=date(2099, 12, 31))

    obtenido = transportistas_services.obtener_transportista(
        db_session, transportista.id
    )

    assert obtenido.estado_habilitacion == ESTADO_HABILITADO


def test_estado_global_del_transportista_con_una_vencida(db_session):
    transportista = _transportista(db_session)
    _crear(
        db_session,
        transportista.id,
        tipo="SENASA",
        fecha_emision=date(1999, 1, 1),
        fecha_vencimiento=date(2000, 1, 1),
    )
    _crear(
        db_session,
        transportista.id,
        tipo="Seguro",
        fecha_vencimiento=date(2099, 12, 31),
    )

    obtenido = transportistas_services.obtener_transportista(
        db_session, transportista.id
    )

    assert obtenido.estado_habilitacion == ESTADO_CERTIFICACION_VENCIDA
