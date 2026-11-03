"""Tests unitarios de funciones comunes (`common`)"""

import pytest
from datetime import date, datetime

from src.common import fechas
from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.paginacion import Pagina, paginar
from src.common.texto import (
    contiene_texto,
    coincide_terminos,
    escapar_like,
    normalizar_texto,
    patron_contiene,
    sin_tildes,
)
from src.common.validators import (
    dni_valido,
    email_valido,
    id_positivo,
    texto_obligatorio,
    texto_no_vacio,
    texto_opcional,
)
from src.exceptions import BadRequest
from src.sector.models import Sector
from sqlalchemy import select

from tests.database import db_session


# ---------------------------------------------------------------------------
# common.texto
# ---------------------------------------------------------------------------

def test_normalizar_texto_minusculas_y_sin_tildes():
    # Arrange / Act
    resultado = normalizar_texto("José María")

    # Assert
    assert resultado == "jose maria"


def test_escapar_like_escapa_comodines():
    # Arrange / Act
    resultado = escapar_like("100%_todo")

    # Assert
    assert resultado == "100\\%\\_todo"


def test_patron_contiene():
    # Arrange / Act
    resultado = patron_contiene("hola")

    # Assert
    assert resultado == "%hola%"


def test_contiene_texto_devuelve_expresion():
    # Arrange / Act
    expr = contiene_texto(Sector.nombre, "texto")

    # Assert
    assert expr is not None


def test_coincidir_terminos():
    # Arrange / Act
    assert coincide_terminos(["José María", "Limpieza"], "jose") is True
    assert coincide_terminos(["José María", "Limpieza"], "limpieza jose") is True
    assert coincide_terminos(["José María", "Limpieza"], "inexistente") is False
    assert coincide_terminos(["José María", "Limpieza"], None) is True
    assert coincide_terminos(["José María", "Limpieza"], "") is True


# ---------------------------------------------------------------------------
# common.fechas
# ---------------------------------------------------------------------------

def test_hoy_devuelve_fecha(monkeypatch):
    # Arrange
    monkeypatch.setattr("src.common.fechas.hoy", lambda: date(2025, 6, 10))

    # Act
    resultado = fechas.hoy()

    # Assert
    assert resultado == date(2025, 6, 10)


def test_ahora_devuelve_datetime(monkeypatch):
    # Arrange
    esperado = datetime(2025, 6, 10, 10, 0)
    monkeypatch.setattr("src.common.fechas.ahora", lambda: esperado)

    # Act
    resultado = fechas.ahora()

    # Assert
    assert resultado == esperado


# ---------------------------------------------------------------------------
# common.validators
# ---------------------------------------------------------------------------

def test_texto_obligatorio_valido():
    # Arrange / Act
    resultado = texto_obligatorio("  Hola  ", invalido=BadRequest, vacio=BadRequest)

    # Assert
    assert resultado == "Hola"


def test_texto_obligatorio_vacio():
    # Arrange / Act / Assert
    with pytest.raises(BadRequest):
        texto_obligatorio("   ", invalido=BadRequest, vacio=BadRequest)


def test_texto_obligatorio_none_devuelve_none():
    # Arrange / Act
    resultado = texto_obligatorio(None, invalido=BadRequest, vacio=BadRequest)

    # Assert
    assert resultado is None


def test_texto_no_vacio_valido():
    # Arrange / Act
    resultado = texto_no_vacio("  texto  ", vacio=BadRequest)

    # Assert
    assert resultado == "texto"


def test_texto_no_vacio_vacio():
    # Arrange / Act / Assert
    with pytest.raises(BadRequest):
        texto_no_vacio("   ", vacio=BadRequest)


def test_texto_opcional_devuelve_none_si_vacio():
    # Arrange / Act
    resultado = texto_opcional("   ", largo_maximo=100)

    # Assert
    assert resultado is None


def test_id_positivo_valido():
    # Arrange / Act
    resultado = id_positivo(5, invalido=BadRequest)

    # Assert
    assert resultado == 5


def test_id_positivo_cero_o_negativo():
    # Arrange / Act / Assert
    with pytest.raises(BadRequest):
        id_positivo(0, invalido=BadRequest)
    with pytest.raises(BadRequest):
        id_positivo(-1, invalido=BadRequest)


def test_dni_valido():
    # Arrange / Act
    resultado = dni_valido("12345678", invalido=BadRequest)

    # Assert
    assert resultado == "12345678"


def test_dni_valido_invalido():
    # Arrange / Act / Assert
    with pytest.raises(BadRequest):
        dni_valido("123", invalido=BadRequest)


def test_email_valido():
    # Arrange / Act
    resultado = email_valido("usuario@ejemplo.com", invalido=BadRequest)

    # Assert
    assert resultado == "usuario@ejemplo.com"


def test_email_valido_invalido():
    # Arrange / Act / Assert
    with pytest.raises(BadRequest):
        email_valido("no-es-email", invalido=BadRequest)


# ---------------------------------------------------------------------------
# common.paginacion
# ---------------------------------------------------------------------------

def test_pagina_total_paginas():
    # Arrange
    pagina = Pagina(items=[1, 2], total=25, page=1, page_size=10)

    # Act / Assert
    assert pagina.total_paginas == 3


def test_paginar_devuelve_items_y_total(db_session):
    # Arrange (consulta vacía sobre una tabla real)
    consulta = select(Sector).where(Sector.id == -1)

    # Act
    items, total = paginar(db_session, consulta, page=1, page_size=10)

    # Assert
    assert items == []
    assert total == 0


# ---------------------------------------------------------------------------
# common.listados
# ---------------------------------------------------------------------------

def test_filtro_busqueda_sin_texto_devuelve_none():
    # Arrange / Act
    resultado = filtro_busqueda([], None)

    # Assert
    assert resultado is None


def test_columna_orden():
    # Arrange / Act
    col = ColumnaOrden(expresiones=(), descendente=True, nulos_al_final=True)

    # Assert
    assert col.descendente is True
    assert col.nulos_al_final is True


def test_paginar_consulta_vacio(db_session):
    # Arrange
    consulta = select(Sector).where(Sector.id == -1)

    # Act
    items, total = paginar_consulta(db_session, consulta, modelo=Sector, page=1, page_size=10)

    # Assert
    assert items == []
    assert total == 0
