"""Tests unitarios de services del módulo `vistaPublica`."""

from datetime import date, datetime
from unittest.mock import MagicMock

from src.aptitud.models import Aptitud
from src.config import settings
from src.documentos.constants import TipoDocumento
from src.documentos.models import Documento, VersionDocumento
from src.elementoLimpieza.models import ElementoLimpieza
from src.Equipo.models import Equipo
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.personal.models import Personal
from src.sector.models import Sector
from src.unidadMedida.models import UnidadMedida
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vistaPublica import services as vservices
from src.vistaPublica.models import ConfiguracionVistaPublica, IndicadorVistaPublica
from src.vistaPublica.services import (
    actualizar_configuracion,
    construir_url_publica,
    codigo_publico_valido,
    indicadores_publicos,
    obtener_configuracion,
    obtener_indicadores,
    actualizar_indicadores,
)
from tests.database import db_session


# ---------------------------------------------------------------------------
# Helpers locales
# ---------------------------------------------------------------------------

def _mock_hoy(monkeypatch, fecha):
    monkeypatch.setattr("src.common.fechas.hoy", lambda: fecha)
    monkeypatch.setattr("src.vistaPublica.services.hoy", lambda: fecha)


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


def _personal(db, dni="12345678", email="p@test.com", activo=True):
    fila = Personal(
        nombre="Persona", apellido="Test", dni=dni, email=email,
        password="h", puede_operar=True, puede_administrar=False, activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _aptitud(db, nombre="Altura", activo=True):
    fila = Aptitud(nombre=nombre, descripcion="d", activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _um(db, nombre="Unidad", simbolo="UN", activo=True):
    fila = UnidadMedida(nombre=nombre, simbolo=simbolo, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# obtener_configuracion / actualizar_configuracion / construir_url_publica
# ---------------------------------------------------------------------------

def test_obtener_configuracion_sin_fila_devuelve_none(db_session):
    # Arrange

    # Act
    resultado = obtener_configuracion(db_session)

    # Assert
    assert resultado is None


def test_actualizar_configuracion_crea_y_habilita(db_session):
    # Arrange

    # Act
    configuracion = actualizar_configuracion(db_session, habilitada=True)

    # Assert
    assert configuracion.id == 1
    assert configuracion.habilitada is True
    assert configuracion.codigo_publico is not None
    assert len(configuracion.codigo_publico) >= 32


def test_actualizar_configuracion_deshabilita(db_session):
    # Arrange
    actualizar_configuracion(db_session, habilitada=True)

    # Act
    configuracion = actualizar_configuracion(db_session, habilitada=False)

    # Assert
    assert configuracion.habilitada is False
    assert configuracion.codigo_publico is None


def test_actualizar_configuracion_actualiza_existente(db_session):
    # Arrange
    actualizar_configuracion(db_session, habilitada=True)
    codigo_previo = obtener_configuracion(db_session).codigo_publico

    # Act (rehabilitar conserva el código)
    configuracion = actualizar_configuracion(db_session, habilitada=True)

    # Assert
    assert configuracion.habilitada is True
    assert configuracion.codigo_publico == codigo_previo


def test_construir_url_publica_sin_public_app_url_lanza_error(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", None)

    # Act / Assert
    try:
        construir_url_publica("abc123")
    except Exception as e:
        assert e.status_code == 400
    else:
        raise AssertionError("Se esperaba BadRequest")


def test_construir_url_publica_arma_url(db_session, monkeypatch):
    # Arrange
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://ejemplo.com/saia")

    # Act
    url = construir_url_publica("codigo-secreto")

    # Assert
    assert url == "https://ejemplo.com/saia/publico/codigo-secreto"


def test_codigo_publico_valido(db_session):
    # Arrange
    actualizar_configuracion(db_session, habilitada=True)
    config = obtener_configuracion(db_session)
    codigo = config.codigo_publico

    # Act / Assert
    assert codigo_publico_valido(db_session, codigo) is True


def test_codigo_publico_valido_codigo_incorrecto(db_session):
    # Arrange
    actualizar_configuracion(db_session, habilitada=True)

    # Act / Assert
    assert codigo_publico_valido(db_session, "codigo-falso") is False


def test_codigo_publico_valido_configuracion_deshabilitada(db_session):
    # Arrange
    actualizar_configuracion(db_session, habilitada=True)
    codigo = obtener_configuracion(db_session).codigo_publico
    actualizar_configuracion(db_session, habilitada=False)

    # Act / Assert
    assert codigo_publico_valido(db_session, codigo) is False


# ---------------------------------------------------------------------------
# obtener_indicadores / actualizar_indicadores
# ---------------------------------------------------------------------------

def test_obtener_indicadores_catálogo_completo(db_session):
    # Arrange

    # Act
    resultado = obtener_indicadores(db_session)

    # Assert
    claves = [i["clave"] for i in resultado]
    assert "cumplimiento_poes" in claves
    assert "equipos_al_dia" in claves
    assert "personal_apto" in claves
    assert "documentos_vigentes" in claves
    assert "elementos_al_dia" in claves
    for i in resultado:
        assert "clave" in i
        assert "etiqueta" in i
        assert "descripcion" in i
        assert "formato" in i
        assert "disponible" in i
        assert "habilitado" in i


def test_obtener_indicadores_incluir_datos(db_session):
    # Arrange

    # Act
    resultado = obtener_indicadores(db_session, incluir_datos=True)

    # Assert
    for i in resultado:
        assert "con_datos" in i


def test_actualizar_indicadores_cambia_habilitado(db_session):
    # Arrange

    # Act
    resultado = actualizar_indicadores(db_session, [("cumplimiento_poes", False)])

    # Assert
    indicador = [i for i in resultado if i["clave"] == "cumplimiento_poes"][0]
    assert indicador["habilitado"] is False


def test_actualizar_indicadores_clave_desconocida_lanza_error(db_session):
    # Arrange

    # Act / Assert
    try:
        actualizar_indicadores(db_session, [("clave_inexistente", True)])
    except Exception as e:
        assert e.status_code == 422
    else:
        raise AssertionError("Se esperaba UnprocessableContent")


# ---------------------------------------------------------------------------
# _cumplimiento_poes (usa hoy() -> monkeypatch)
# ---------------------------------------------------------------------------

def test_cumplimiento_poes_sin_datos_devuelve_none(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = vservices._cumplimiento_poes(db_session)

    # Assert
    assert resultado is None


# ---------------------------------------------------------------------------
# _equipos_al_dia
# ---------------------------------------------------------------------------

def test_equipos_al_dia_sin_equipos_devuelve_none(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = vservices._equipos_al_dia(db_session)

    # Assert
    assert resultado is None


def test_equipos_al_dia_con_plan_vigente(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id, autor_id=autor.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 6, 1), periodicidad_dias=30,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(plan)
        db_session.commit()
        db_session.refresh(plan)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._equipos_al_dia(db_session)

    # Assert
    assert resultado == 100.0


def test_equipos_al_dia_con_plan_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id, autor_id=autor.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 4, 1), periodicidad_dias=30,
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(plan)
        db_session.commit()
        db_session.refresh(plan)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._equipos_al_dia(db_session)

    # Assert
    assert resultado == 0.0


# ---------------------------------------------------------------------------
# _personal_apto
# ---------------------------------------------------------------------------

def test_personal_apto_menos_de_5_devuelve_none(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    persona = _personal(db_session)
    aptitud = _aptitud(db_session)
    vp = VencimientoPersonal(
        persona_id=persona.id, aptitud_id=aptitud.id,
        fecha_vencimiento=date(2025, 12, 31), activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(vp)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._personal_apto(db_session)

    # Assert
    assert resultado is None


def test_personal_apto_con_datos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    for i in range(5):
        persona = _personal(db_session, dni=f"{i:08d}", email=f"p{i}@test.com")
        aptitud = _aptitud(db_session, nombre=f"Aptitud {i}")
        vp = VencimientoPersonal(
            persona_id=persona.id, aptitud_id=aptitud.id,
            fecha_vencimiento=date(2025, 12, 31), activo=True,
        )
        db_session.info["sin_auditoria"] = True
        try:
            db_session.add(vp)
            db_session.commit()
        finally:
            db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._personal_apto(db_session)

    # Assert
    assert resultado == 100.0


# ---------------------------------------------------------------------------
# _documentos_vigentes
# ---------------------------------------------------------------------------

def test_documentos_vigentes_sin_documentos_devuelve_none(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = vservices._documentos_vigentes(db_session)

    # Assert
    assert resultado is None


def test_documentos_vigentes_con_documento_vigente(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    doc = Documento(
        nombre="Manual", tipo=TipoDocumento.PROCEDIMIENTO.value,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(doc)
        db_session.commit()
        db_session.refresh(doc)
        version = VersionDocumento(
            documento_id=doc.id, numero_version=1,
            nombre_archivo="manual.pdf", archivo_url="uploads/documentos/manual.pdf",
            vigente=True, vigente_desde=datetime(2025, 1, 1),
            fecha_subida=datetime(2025, 1, 1), autor_id=autor.id,
            fecha_vencimiento=date(2026, 1, 1),
        )
        db_session.add(version)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._documentos_vigentes(db_session)

    # Assert
    assert resultado == 100.0


# ---------------------------------------------------------------------------
# _elementos_al_dia
# ---------------------------------------------------------------------------

def test_elementos_al_dia_sin_elementos_devuelve_none(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))

    # Act
    resultado = vservices._elementos_al_dia(db_session)

    # Assert
    assert resultado is None


def test_elementos_al_dia_con_elemento_vigente(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elemento = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=30,
        fecha_ultimo_recambio=date(2025, 6, 1),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elemento)
        db_session.commit()
        db_session.refresh(elemento)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._elementos_al_dia(db_session)

    # Assert
    assert resultado == 100.0


def test_elementos_al_dia_con_elemento_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    elemento = ElementoLimpieza(
        nombre="Detergente",
        frecuencia_recambio_dias=1,
        fecha_ultimo_recambio=date(2025, 5, 1),
        activo=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(elemento)
        db_session.commit()
        db_session.refresh(elemento)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._elementos_al_dia(db_session)

    # Assert
    assert resultado == 0.0


def test_documentos_vigentes_con_documento_vencido(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    doc = Documento(
        nombre="Manual Vencido", tipo=TipoDocumento.PROCEDIMIENTO.value,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(doc)
        db_session.commit()
        db_session.refresh(doc)
        version = VersionDocumento(
            documento_id=doc.id, numero_version=1,
            nombre_archivo="manual.pdf", archivo_url="uploads/documentos/manual.pdf",
            vigente=True, vigente_desde=datetime(2025, 1, 1),
            fecha_subida=datetime(2025, 1, 1), autor_id=autor.id,
            fecha_vencimiento=date(2025, 5, 1),
        )
        db_session.add(version)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = vservices._documentos_vigentes(db_session)

    # Assert
    assert resultado == 0.0


def test_indicadores_publicos_con_datos(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    autor = _personal_admin(db_session)
    sector = _sector(db_session)
    equipo = _equipo(db_session, sector.id)
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id, autor_id=autor.id, tipo="calibracion",
        fecha_ultima_intervencion=date(2025, 6, 1), periodicidad_dias=30,
        activo=True,
    )
    # Habilitar el indicador de equipos al día
    indicador = IndicadorVistaPublica(
        clave="equipos_al_dia", habilitado=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(plan)
        db_session.add(indicador)
        db_session.commit()
        db_session.refresh(plan)
        db_session.refresh(indicador)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = indicadores_publicos(db_session)

    # Assert
    assert len(resultado) >= 1
    equipos_al_dia = [i for i in resultado if i["clave"] == "equipos_al_dia"]
    assert len(equipos_al_dia) == 1
    assert equipos_al_dia[0]["valor"] == 100.0


def test_indicadores_publicos_sin_datos_devuelve_vacio(db_session, monkeypatch):
    # Arrange
    _mock_hoy(monkeypatch, date(2025, 6, 10))
    # Habilitar un indicador pero sin datos
    indicador = IndicadorVistaPublica(
        clave="equipos_al_dia", habilitado=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(indicador)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = indicadores_publicos(db_session)

    # Assert
    assert resultado == []
