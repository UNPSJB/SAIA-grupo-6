"""Tests unitarios de services del módulo `documentos`."""

import io
from datetime import datetime
import io
from unittest.mock import MagicMock

from fastapi import UploadFile

from src.config import CARPETA_UPLOADS
from src.documentos import exceptions
from src.documentos.models import Documento, VersionDocumento
from src.documentos.services import (
    crear_documento,
    leer_documento,
    listar_documentos,
    listar_documentos_paginado,
    listar_documentos_vigentes,
    subir_nueva_version,
)
from src.documentos.constants import TipoDocumento
from src.personal.models import Personal
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


def _archivo_mock(nombre="documento.pdf", tamaño=100, contenido=b"contenido de prueba"):
    archivo = MagicMock(spec=UploadFile)
    archivo.filename = nombre
    archivo.size = tamaño
    archivo.file = io.BytesIO(contenido)
    return archivo


# ---------------------------------------------------------------------------
# leer_documento
# ---------------------------------------------------------------------------

def test_leer_documento_existe(db_session):
    # Arrange
    documento = Documento(nombre="Doc A", tipo=TipoDocumento.PROCEDIMIENTO.value)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(documento)
        db_session.commit()
        db_session.refresh(documento)
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    obtenido = leer_documento(db_session, documento.id)

    # Assert
    assert obtenido.id == documento.id


def test_leer_documento_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        leer_documento(db_session, 9999)
    except exceptions.DocumentoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba DocumentoNoEncontrado")


# ---------------------------------------------------------------------------
# listar_documentos
# ---------------------------------------------------------------------------

def test_listar_documentos_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_documentos(db_session)

    # Assert
    assert resultado == []


def test_listar_documentos_filtro_por_tipo(db_session):
    # Arrange
    d1 = Documento(nombre="Doc A", tipo=TipoDocumento.PROCEDIMIENTO.value)
    d2 = Documento(nombre="Doc B", tipo=TipoDocumento.RECETA.value)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([d1, d2])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = listar_documentos(db_session, tipo=TipoDocumento.PROCEDIMIENTO)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].tipo == TipoDocumento.PROCEDIMIENTO.value


def test_listar_documentos_buscar_ignora_tildes(db_session):
    # Arrange
    d1 = Documento(nombre="Procedimiento Limpieza", tipo=TipoDocumento.PROCEDIMIENTO.value)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(d1)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = listar_documentos(db_session, buscar="procedimiento")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_documentos_paginado
# ---------------------------------------------------------------------------

def test_listar_documentos_paginado_page_y_page_size(db_session):
    # Arrange
    for i in range(5):
        d = Documento(nombre=f"Doc {i}", tipo=TipoDocumento.PROCEDIMIENTO.value)
        db_session.info["sin_auditoria"] = True
        try:
            db_session.add(d)
            db_session.commit()
        finally:
            db_session.info.pop("sin_auditoria", None)

    # Act
    items, total = listar_documentos_paginado(
        db_session, page=1, page_size=2,
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# listar_documentos_vigentes
# ---------------------------------------------------------------------------

def test_listar_documentos_vigentes(db_session):
    # Arrange
    autor = _personal_admin(db_session)
    documento = Documento(nombre="Doc Vigente", tipo=TipoDocumento.PROCEDIMIENTO.value)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(documento)
        db_session.commit()
        db_session.refresh(documento)
        version = VersionDocumento(
            documento_id=documento.id, numero_version=1,
            nombre_archivo="a.pdf", archivo_url="uploads/documentos/a.pdf",
            vigente=True, vigente_desde=datetime.now(),
            fecha_subida=datetime.now(), autor_id=autor.id,
        )
        db_session.add(version)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    # Act
    resultado = listar_documentos_vigentes(db_session)

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# crear_documento (toca disco -> tmp_path + monkeypatch)
# ---------------------------------------------------------------------------

def test_crear_documento_caso_feliz(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    archivo = _archivo_mock("documento.pdf")

    # Act
    creado = crear_documento(
        db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
        autor.id, archivo, fecha_vencimiento=datetime(2026, 1, 1).date(),
    )

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Manual Limpieza"
    assert len(creado.versiones) == 1
    assert creado.versiones[0].vigente is True
    assert creado.versiones[0].numero_version == 1


def test_crear_documento_nombre_vacio(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    archivo = _archivo_mock("documento.pdf")

    # Act / Assert
    try:
        crear_documento(db_session, "   ", TipoDocumento.PROCEDIMIENTO, autor.id, archivo)
    except exceptions.NombreVacio:
        pass
    else:
        raise AssertionError("Se esperaba NombreVacio")


def test_crear_documento_ya_existe(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    crear_documento(
        db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
        autor.id, _archivo_mock("documento.pdf"),
    )
    # Act / Assert
    try:
        crear_documento(
            db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
            autor.id, _archivo_mock("documento2.pdf"),
        )
    except exceptions.DocumentoYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba DocumentoYaExiste")


# ---------------------------------------------------------------------------
# subir_nueva_version (toca disco -> tmp_path + monkeypatch)
# ---------------------------------------------------------------------------

def test_subir_nueva_version(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    creado = crear_documento(
        db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
        autor.id, _archivo_mock("v1.pdf"),
    )

    # Act
    resultado = subir_nueva_version(
        db_session, creado.id, autor.id, _archivo_mock("v2.pdf"),
    )

    # Assert
    assert len(resultado.versiones) == 2
    vigentes = [v for v in resultado.versiones if v.vigente]
    assert len(vigentes) == 1
    assert vigentes[0].numero_version == 2
    assert vigentes[0].nombre_archivo == "v2.pdf"


def test_subir_nueva_version_documento_no_existe(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)

    # Act / Assert
    try:
        subir_nueva_version(
            db_session, 9999, autor.id, _archivo_mock("v1.pdf"),
        )
    except exceptions.DocumentoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba DocumentoNoEncontrado")


def test_crear_documento_extension_invalida(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    archivo = _archivo_mock("documento.exe")

    # Act / Assert
    try:
        crear_documento(
            db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
            autor.id, archivo,
        )
    except exceptions.ArchivoExtensionInvalida:
        pass
    else:
        raise AssertionError("Se esperaba ArchivoExtensionInvalida")


def test_crear_documento_archivo_vacio(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    archivo = _archivo_mock("documento.pdf", tamaño=0, contenido=b"")

    # Act / Assert
    try:
        crear_documento(
            db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
            autor.id, archivo,
        )
    except exceptions.ArchivoVacio:
        pass
    else:
        raise AssertionError("Se esperaba ArchivoVacio")


def test_subir_nueva_version_extension_invalida(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    creado = crear_documento(
        db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
        autor.id, _archivo_mock("v1.pdf"),
    )

    # Act / Assert
    try:
        subir_nueva_version(
            db_session, creado.id, autor.id, _archivo_mock("v2.exe"),
        )
    except exceptions.ArchivoExtensionInvalida:
        pass
    else:
        raise AssertionError("Se esperaba ArchivoExtensionInvalida")


def test_crear_documento_archivo_grande(db_session, tmp_path, monkeypatch):
    # Arrange
    import src.documentos.services as doc_svc
    monkeypatch.setattr(doc_svc, "CARPETA_UPLOADS", tmp_path)

    autor = _personal_admin(db_session)
    archivo = MagicMock()
    archivo.filename = "documento.pdf"
    archivo.size = 999999999  # Más grande que el máximo permitido
    archivo.file = io.BytesIO(b"contenido")

    # Act / Assert
    try:
        crear_documento(
            db_session, "Manual Limpieza", TipoDocumento.PROCEDIMIENTO,
            autor.id, archivo,
        )
    except exceptions.ArchivoMuyGrande:
        pass
    else:
        raise AssertionError("Se esperaba ArchivoMuyGrande")
