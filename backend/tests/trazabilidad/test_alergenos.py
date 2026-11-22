"""Alérgenos: catálogo, alérgenos de cada ingrediente y del producto.

El producto los calcula desde su receta: si algún ingrediente *contiene* un
alérgeno, el producto lo contiene aunque otro solo *pueda contenerlo*.
"""

import pytest
from sqlalchemy import func, select

from src.alergenos import exceptions
from src.alergenos import schemas
from src.alergenos import services
from src.alergenos.constants import ALERGENOS_INICIALES
from src.alergenos.models import Alergeno
from src.rotulado import schemas as rotulado_schemas
from src.rotulado import services as rotulado_services

GLUTEN = "Cereales con gluten (trigo, avena, cebada, centeno)"


@pytest.fixture
def catalogo(escenario):
    services.cargar_alergenos_iniciales(escenario.db)
    return {a.nombre: a for a in services.listar_alergenos(escenario.db)}


def _asignar(escenario, ingrediente, *pares):
    return services.guardar_alergenos_de_ingrediente(
        escenario.db,
        ingrediente.id,
        schemas.AlergenosDeIngredienteIn(
            alergenos=[
                schemas.AlergenoDeIngredienteIn(alergeno_id=alergeno.id, nivel=nivel)
                for alergeno, nivel in pares
            ]
        ),
    )


def test_la_carga_inicial_es_la_lista_del_caa_y_no_se_duplica(escenario, catalogo):
    services.cargar_alergenos_iniciales(escenario.db)

    assert set(catalogo) == set(ALERGENOS_INICIALES)
    assert escenario.db.scalar(select(func.count()).select_from(Alergeno)) == len(ALERGENOS_INICIALES)


def test_no_se_repite_un_nombre_del_catalogo(escenario, catalogo):
    with pytest.raises(exceptions.AlergenoYaExiste):
        services.crear_alergeno(escenario.db, schemas.AlergenoCreate(nombre="huevo"))


def test_guardar_los_alergenos_de_un_ingrediente_reemplaza_la_lista(escenario, catalogo):
    _asignar(escenario, escenario.harina, (catalogo[GLUTEN], "contiene"), (catalogo["Soja"], "puede_contener"))

    resultado = _asignar(escenario, escenario.harina, (catalogo[GLUTEN], "contiene"))

    assert [(a.nombre, a.nivel) for a in resultado.alergenos] == [(GLUTEN, "contiene")]


def test_un_alergeno_no_se_repite_en_el_mismo_ingrediente(escenario, catalogo):
    with pytest.raises(exceptions.AlergenoRepetido):
        _asignar(
            escenario,
            escenario.harina,
            (catalogo["Soja"], "contiene"),
            (catalogo["Soja"], "puede_contener"),
        )


def test_uno_dado_de_baja_no_se_asigna_pero_el_ya_asignado_se_conserva(escenario, catalogo):
    _asignar(escenario, escenario.harina, (catalogo["Soja"], "contiene"))
    services.dar_de_baja(escenario.db, catalogo["Soja"].id)

    with pytest.raises(exceptions.AlergenoNoValido):
        _asignar(escenario, escenario.sal, (catalogo["Soja"], "contiene"))
    conservado = _asignar(escenario, escenario.harina, (catalogo["Soja"], "puede_contener"))
    assert [(a.nombre, a.nivel) for a in conservado.alergenos] == [("Soja", "puede_contener")]


def test_el_producto_suma_los_alergenos_y_gana_contiene(escenario, catalogo):
    _asignar(escenario, escenario.harina, (catalogo[GLUTEN], "contiene"))
    _asignar(
        escenario,
        escenario.sal,
        (catalogo[GLUTEN], "puede_contener"),
        (catalogo["Leche"], "puede_contener"),
    )

    producto = services.alergenos_de_producto(escenario.db, escenario.pan.id)

    assert [(a.nombre, a.ingredientes) for a in producto.contiene] == [(GLUTEN, ["Harina 000"])]
    assert [(a.nombre, a.ingredientes) for a in producto.puede_contener] == [("Leche", ["Sal fina"])]
    assert producto.leyenda == (
        "Contiene: cereales con gluten (trigo, avena, cebada, centeno). Puede contener: leche."
    )


def test_la_leyenda_une_varios_alergenos_con_y():
    assert services.leyenda(["Huevo", "Leche", "Soja"], []) == "Contiene: huevo, leche y soja."
    assert services.leyenda([], []) is None


def test_un_producto_sin_alergenos_no_tiene_leyenda(escenario, catalogo):
    producto = services.alergenos_de_producto(escenario.db, escenario.pan.id)

    assert producto.contiene == [] and producto.puede_contener == []
    assert producto.leyenda is None


def _borrador(escenario):
    borrador = rotulado_services.crear_borrador(
        escenario.db,
        escenario.pan.id,
        rotulado_schemas.BorradorRotuladoCreate(producto_id=escenario.pan.id),
        escenario.admin,
    )
    return rotulado_services.autocompletar_borrador(
        escenario.db, borrador.id, escenario.version1.id, None, False, escenario.admin
    )


def _estado(escenario, borrador_id, campo):
    completitud = rotulado_services.calcular_completitud(escenario.db, borrador_id)
    return next(c.estado for c in completitud.campos if c.nombre == campo)


def test_el_borrador_de_rotulado_autocompleta_los_alergenos(escenario, catalogo):
    _asignar(escenario, escenario.harina, (catalogo[GLUTEN], "contiene"))

    borrador = _borrador(escenario)

    assert borrador.alergenos == "Contiene: cereales con gluten (trigo, avena, cebada, centeno)."
    assert _estado(escenario, borrador.id, "alergenos") == "completo"

    rotulado_services.actualizar_borrador(
        escenario.db, borrador.id, rotulado_schemas.BorradorRotuladoUpdate(alergenos=""), escenario.admin
    )
    assert _estado(escenario, borrador.id, "alergenos") == "pendiente"


def test_sin_alergenos_en_la_receta_el_campo_no_aplica(escenario, catalogo):
    borrador = _borrador(escenario)

    assert borrador.alergenos is None
    assert _estado(escenario, borrador.id, "alergenos") == "no_aplicable"


def test_api_alergenos_solo_para_administradores(client, escenario, catalogo):
    assert client.get("/alergenos", headers=escenario.h_operador).status_code == 403

    guardado = client.put(
        f"/alergenos/ingredientes/{escenario.harina.id}",
        json={"alergenos": [{"alergeno_id": catalogo["Huevo"].id, "nivel": "contiene"}]},
        headers=escenario.h_admin,
    )
    producto = client.get(f"/alergenos/productos/{escenario.pan.id}", headers=escenario.h_admin)

    assert guardado.status_code == 200
    assert producto.json()["leyenda"] == "Contiene: huevo."
    nivel_invalido = client.put(
        f"/alergenos/ingredientes/{escenario.harina.id}",
        json={"alergenos": [{"alergeno_id": catalogo["Huevo"].id, "nivel": "trazas"}]},
        headers=escenario.h_admin,
    )
    assert nivel_invalido.status_code == 422
