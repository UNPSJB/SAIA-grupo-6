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
from src.rotulado import declaraciones_services
from src.rotulado import schemas as rotulado_schemas
from src.rotulado import services as rotulado_services

GLUTEN = "Trigo"


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

    assert set(catalogo) == {nombre for _, nombre, _ in ALERGENOS_INICIALES}
    assert catalogo["Dióxido de azufre y sulfitos"].condicionada is True
    assert catalogo["Leche"].codigo == "leche"
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
        "Contiene: trigo. Puede contener: leche."
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


def test_la_declaracion_del_rotulo_sale_de_los_alergenos_del_ingrediente(escenario, catalogo):
    _asignar(escenario, escenario.harina, (catalogo[GLUTEN], "contiene"))

    borrador = _borrador(escenario)
    salida = declaraciones_services.consultar(escenario.db, borrador.id)

    assert [d["codigo"] for d in salida["contenido"]["detectados"]] == ["trigo"]
    assert salida["declaracion"] == "CONTIENE TRIGO"
    # Sin evaluar, la declaración queda pendiente: no se asume "sin alérgenos".
    assert any("Harina 000: evaluación de alérgenos sin evaluar" in p for p in salida["pendientes"])
    assert _estado(escenario, borrador.id, "declaraciones") == "pendiente"


def test_guardar_la_evaluacion_y_un_derivado(escenario, catalogo):
    resultado = services.guardar_alergenos_de_ingrediente(
        escenario.db,
        escenario.harina.id,
        schemas.AlergenosDeIngredienteIn(
            alergenos=[schemas.AlergenoDeIngredienteIn(
                alergeno_id=catalogo["Soja"].id, nivel="contiene", forma="derivado",
            )],
            evaluacion="evaluada",
            gluten="presente",
            respaldo="Ficha técnica del proveedor",
        ),
        escenario.admin.id,
    )

    assert [(a.codigo, a.forma) for a in resultado.alergenos] == [("soja", "derivado")]
    assert (resultado.evaluacion, resultado.gluten) == ("evaluada", "presente")
    assert resultado.respaldo == "Ficha técnica del proveedor"
    assert resultado.actualizado_en is not None


def test_un_alergeno_nuevo_toma_un_codigo_estable(escenario, catalogo):
    nuevo = services.crear_alergeno(escenario.db, schemas.AlergenoCreate(nombre="Sésamo tostado"))
    renombrado = services.actualizar_alergeno(
        escenario.db, nuevo.id, schemas.AlergenoUpdate(nombre="Sésamo")
    )

    assert renombrado.codigo == "sesamo_tostado"


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
