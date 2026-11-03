"""Tests unitarios de validadores de schemas del módulo `documentos`."""

import pytest
from datetime import date, datetime
from decimal import Decimal

from src.documentos.constants import TipoDocumento, EstadoVersion
from src.documentos.schemas import (
    AutorResponse,
    VersionDocumento,
    Documento,
    DocumentoVigente,
    HistorialDocumento,
)


def test_autor_response_valido():
    # Arrange
    datos = {"id": 1, "nombre": "Juan", "apellido": "Perez"}

    # Act
    autor = AutorResponse(**datos)

    # Assert
    assert autor.nombre == "Juan"
    assert autor.apellido == "Perez"


def test_version_documento_valido():
    # Arrange
    datos = {
        "id": 1,
        "numero_version": 1,
        "nombre_archivo": "doc.pdf",
        "archivo_url": "uploads/documentos/doc.pdf",
        "estado": EstadoVersion.VIGENTE,
        "vigente_desde": datetime(2025, 1, 1),
        "fecha_subida": datetime(2025, 1, 1),
        "autor": {"id": 1, "nombre": "Juan", "apellido": "Perez"},
    }

    # Act
    version = VersionDocumento(**datos)

    # Assert
    assert version.numero_version == 1
    assert version.estado == EstadoVersion.VIGENTE


def test_documento_valido():
    # Arrange
    datos = {
        "id": 1,
        "nombre": "Manual",
        "tipo": TipoDocumento.PROCEDIMIENTO,
        "fecha_creacion": datetime(2025, 1, 1),
        "version_vigente": None,
        "cantidad_archivadas": 0,
        "proximo_numero_version": 1,
    }

    # Act
    documento = Documento(**datos)

    # Assert
    assert documento.nombre == "Manual"
    assert documento.tipo == TipoDocumento.PROCEDIMIENTO


def test_documento_vigente_valido():
    # Arrange
    datos = {
        "id": 1,
        "nombre": "Manual",
        "tipo": TipoDocumento.PROCEDIMIENTO,
        "version_vigente": {
            "id": 1,
            "numero_version": 1,
            "nombre_archivo": "doc.pdf",
            "archivo_url": "uploads/documentos/doc.pdf",
            "estado": EstadoVersion.VIGENTE,
            "vigente_desde": datetime(2025, 1, 1),
            "fecha_subida": datetime(2025, 1, 1),
            "autor": {"id": 1, "nombre": "Juan", "apellido": "Perez"},
        },
    }

    # Act
    doc = DocumentoVigente(**datos)

    # Assert
    assert doc.version_vigente.estado == EstadoVersion.VIGENTE


def test_historial_documento_valido():
    # Arrange
    from src.documentos.schemas import HistorialDocumento, VersionDocumento as VD
    datos = {
        "id": 1,
        "nombre": "Manual",
        "tipo": TipoDocumento.PROCEDIMIENTO,
        "versiones": [],
    }

    # Act
    historial = HistorialDocumento(**datos)

    # Assert
    assert historial.versiones == []
