"""Tests de la clasificación única de estado de documento (problema 3).

Casos límite: vence hoy, vence mañana, vence en el margen, venció ayer.
Además verifica que criticidad y la campana de notificaciones usen el mismo
criterio y que un documento que vence hoy sea vigente (no vencido).
"""

from datetime import datetime, timedelta

from src.common.estado_documento import (
    estado_documento,
    VENCIDO,
    PROXIMO,
    VIGENTE,
)
from src.common.fechas import hoy
from src.notificaciones.criticidad import obtener_criticidad_dashboard
from src.notificaciones import services as notificacion_services
from src.documentos.models import Documento, VersionDocumento
from src.personal.models import Personal

MARGEN_DEFECTO = 15


def _crear_documento_con_version(db, nombre, fecha_vencimiento, autor):
    documento = Documento(nombre=nombre, tipo="manual_bpm")
    db.add(documento)
    db.flush()
    db.add(
        VersionDocumento(
            documento_id=documento.id,
            numero_version=1,
            nombre_archivo=f"{nombre}.pdf",
            archivo_url=f"uploads/documentos/{nombre}.pdf",
            vigente=True,
            vigente_desde=datetime.now(),
            fecha_subida=datetime.now(),
            autor_id=autor.id,
            fecha_vencimiento=fecha_vencimiento,
        )
    )
    db.flush()
    return documento


def test_estado_documento_vence_hoy_es_vigente():
    hoy_val = hoy()
    assert estado_documento(hoy_val, hoy_val, MARGEN_DEFECTO) == VIGENTE


def test_estado_documento_vence_manana_es_proximo():
    hoy_val = hoy()
    assert estado_documento(hoy_val + timedelta(days=1), hoy_val, MARGEN_DEFECTO) == PROXIMO


def test_estado_documento_vence_en_el_margen_es_proximo():
    hoy_val = hoy()
    assert estado_documento(hoy_val + timedelta(days=MARGEN_DEFECTO), hoy_val, MARGEN_DEFECTO) == PROXIMO


def test_estado_documento_vencio_ayer_es_vencido():
    hoy_val = hoy()
    assert estado_documento(hoy_val - timedelta(days=1), hoy_val, MARGEN_DEFECTO) == VENCIDO


def test_estado_documento_sin_fecha_es_vigente():
    hoy_val = hoy()
    assert estado_documento(None, hoy_val, MARGEN_DEFECTO) == VIGENTE


def test_estado_documento_fuera_del_margen_es_vigente():
    hoy_val = hoy()
    assert estado_documento(hoy_val + timedelta(days=MARGEN_DEFECTO + 1), hoy_val, MARGEN_DEFECTO) == VIGENTE


def test_criticidad_no_marca_vencido_al_documento_que_vence_hoy(db_session):
    """Un documento que vence hoy no genera alerta DOCUMENTO_VENCIDO en
    criticidad (es vigente). Uno que venció ayer sí."""
    db = db_session
    hoy_val = hoy()
    autor = Personal(
        nombre="Autor Doc",
        apellido="Prueba",
        dni=f"920000{_contador()}",
        email=f"doc.{_contador()}@test.local",
        password="x",
        puede_administrar=True,
        puede_operar=True,
        activo=True,
    )
    db.add(autor)
    db.commit()

    # Vence hoy -> no debe alertar en criticidad.
    _crear_documento_con_version(db, "Doc vence hoy", hoy_val, autor)
    # Venció ayer -> debe alertar DOCUMENTO_VENCIDO.
    _crear_documento_con_version(
        db, "Doc venció ayer", hoy_val - timedelta(days=1), autor
    )
    # Vence dentro del margen -> DOCUMENTO_PROXIMO.
    _crear_documento_con_version(
        db, "Doc vence en margen", hoy_val + timedelta(days=5), autor
    )
    db.commit()

    resultado = obtener_criticidad_dashboard(db)

    alertas = [a for a in resultado.alertas if a.origen == "DOCUMENTO"]
    claves = {a.clave for a in alertas}

    # El que vence hoy no está.
    assert not any("vence hoy" in c for c in claves), claves
    # El que venció ayer está como DOCUMENTO_VENCIDO (criticidad media).
    vencidos = [a for a in alertas if a.titulo == "Documento vencido"]
    assert len(vencidos) == 1, [a.clave for a in alertas]
    assert vencidos[0].criticidad == "media"
    # El que vence en margen está como DOCUMENTO_PROXIMO (criticidad baja).
    proximos = [a for a in alertas if a.titulo == "Documento próximo a vencer"]
    assert len(proximos) == 1, [a.clave for a in alertas]
    assert proximos[0].criticidad == "baja"


def test_campana_incluye_documentos_vencidos_y_proximos_pero_no_hoy(db_session):
    """La campana de notificaciones incluye documentos vencidos y próximos,
    pero no el que vence hoy."""
    db = db_session
    hoy_val = hoy()
    autor = Personal(
        nombre="Autor Campana",
        apellido="Prueba",
        dni=f"930000{_contador()}",
        email=f"campana.{_contador()}@test.local",
        password="x",
        puede_administrar=True,
        puede_operar=True,
        activo=True,
    )
    db.add(autor)
    db.commit()

    _crear_documento_con_version(db, "Campana venció ayer", hoy_val - timedelta(days=1), autor)
    _crear_documento_con_version(
        db, "Campana vence hoy", hoy_val, autor
    )
    _crear_documento_con_version(
        db, "Campana vence en margen", hoy_val + timedelta(days=3), autor
    )
    db.commit()

    notificaciones = notificacion_services.obtener_todas_notificaciones(db)
    documentos = [n for n in notificaciones if n.tipo == "DOCUMENTO"]

    titulos = {n.titulo for n in documentos}
    assert "Documento vencido" in titulos, titulos
    assert "Documento próximo a vencer" in titulos, titulos
    # El que vence hoy es vigente: no aparece en la campana.
    assert not any("Campana vence hoy" in n.mensaje for n in documentos), titulos


def _contador():
    if not hasattr(_contador, "i"):
        _contador.i = 0
    _contador.i += 1
    return _contador.i
