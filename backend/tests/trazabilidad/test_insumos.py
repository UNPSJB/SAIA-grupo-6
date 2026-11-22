"""Insumos: la marca concreta que se compra de un ingrediente.

La receta y la tabla nutricional usan el ingrediente; el lote recibido apunta
al insumo (marca) y copia su ingrediente, así el consumo en producción acepta
cualquier marca del ingrediente que pide la tarea.
"""

from decimal import Decimal

import pytest

from src.insumos import exceptions as insumos_exceptions
from src.insumos import homologacion
from src.insumos import schemas as insumos_schemas
from src.insumos import services as insumos_services
from src.lotes import schemas as lotes_schemas
from src.lotes import services as lotes_services
from src.lotesInsumo import exceptions as lotes_insumo_exceptions
from src.lotesInsumo import schemas as lotes_insumo_schemas
from src.lotesInsumo import services as lotes_insumo_services
from src.proveedores import services as proveedores_services


def _nuevo_insumo(escenario, marca, proveedores=(), descripcion=None, ingrediente=None, aprobar=True):
    insumo = insumos_services.crear_insumo(
        escenario.db,
        insumos_schemas.InsumoCreate(
            ingrediente_id=(ingrediente or escenario.harina).id,
            marca=marca,
            descripcion=descripcion,
            proveedor_ids=[p.id for p in proveedores],
        ),
    )
    if aprobar:
        # El ingrediente del escenario no tiene valores de referencia: la
        # comparación da "apta" y se aprueba sin justificación.
        homologacion.decidir(
            escenario.db, insumo.id, insumos_schemas.DecisionHomologacionIn(decision="aprobar"), escenario.admin
        )
    return insumo


def _recibir(escenario, insumo, proveedor, numero, cantidad="10"):
    return lotes_insumo_services.crear_lote_insumo(
        escenario.db,
        lotes_insumo_schemas.LoteInsumoCreate(
            insumo_id=insumo.id,
            proveedor_id=proveedor.id,
            numero_lote=numero,
            cantidad_recibida=Decimal(cantidad),
        ),
        escenario.admin,
    )


def test_crear_un_insumo_con_sus_proveedores(escenario):
    insumo = _nuevo_insumo(escenario, "Cañuelas", [escenario.molino], descripcion="Bolsa 25 kg")

    respuesta = insumos_services.a_respuesta(insumo)
    assert respuesta.nombre == "Cañuelas · Bolsa 25 kg"
    assert respuesta.ingrediente_nombre == "Harina 000"
    assert [p.nombre for p in respuesta.proveedores] == ["Molino Sur"]


def test_misma_marca_y_descripcion_del_mismo_ingrediente_se_rechaza(escenario):
    _nuevo_insumo(escenario, "Cañuelas")

    with pytest.raises(insumos_exceptions.InsumoYaExiste):
        _nuevo_insumo(escenario, "cañuelas")
    # Con otra descripción es otro producto de la misma marca.
    assert _nuevo_insumo(escenario, "Cañuelas", descripcion="Integral").id
    # La misma marca de otro ingrediente no choca.
    assert _nuevo_insumo(escenario, "Cañuelas", ingrediente=escenario.sal).id


def test_no_se_crea_un_insumo_de_un_ingrediente_dado_de_baja(escenario):
    escenario.harina.activo = False
    escenario.db.commit()

    with pytest.raises(insumos_exceptions.IngredienteNoValido):
        _nuevo_insumo(escenario, "Cañuelas")


def test_no_se_asocia_un_proveedor_dado_de_baja(escenario):
    proveedores_services.eliminar_proveedor(escenario.db, escenario.molino.id)

    with pytest.raises(insumos_exceptions.ProveedoresNoValidos):
        _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])


def test_no_se_recibe_un_lote_de_un_proveedor_que_no_vende_ese_insumo(escenario):
    insumo = _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])

    with pytest.raises(lotes_insumo_exceptions.ProveedorNoVendeInsumo):
        _recibir(escenario, insumo, escenario.salinas, "C-1")


def test_el_lote_copia_el_ingrediente_del_insumo(escenario):
    insumo = _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])

    lote = _recibir(escenario, insumo, escenario.molino, "C-1")

    assert lote.insumo_id == insumo.id
    assert lote.ingrediente_id == escenario.harina.id
    assert lotes_insumo_services.lote_a_respuesta(lote).insumo.nombre == "Cañuelas"


def test_un_insumo_dado_de_baja_no_recibe_lotes(escenario):
    insumo = _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])
    insumos_services.dar_de_baja(escenario.db, insumo.id)

    with pytest.raises(lotes_insumo_exceptions.InsumoNoEncontrado):
        _recibir(escenario, insumo, escenario.molino, "C-1")


def test_los_proveedores_del_ingrediente_salen_de_sus_insumos_sin_repetir(escenario):
    # Molino Sur vende dos marcas de harina: aparece una sola vez.
    _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])
    escenario.db.refresh(escenario.harina)

    nombres = [p.nombre for p in escenario.harina.proveedores]
    assert sorted(nombres) == ["Molino Sur", "Salinas del Norte"]


def test_la_receta_consume_cualquier_marca_del_ingrediente(escenario):
    otra_marca = _nuevo_insumo(escenario, "Cañuelas", [escenario.molino])
    lote_otra_marca = _recibir(escenario, otra_marca, escenario.molino, "C-1", "50")
    lote = lotes_services.crear_lote(
        escenario.db,
        lotes_schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal("10")),
        escenario.admin,
    )
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]

    for lote_insumo in (escenario.lote_harina, lote_otra_marca):
        consumo, _ = lotes_services.registrar_consumo(
            escenario.db,
            lote.id,
            amasar.id,
            lotes_schemas.ConsumoCreate(lote_insumo_id=lote_insumo.id, cantidad=Decimal("1")),
            escenario.operador,
        )
        assert lotes_services.consumo_a_respuesta(consumo).insumo_nombre in {"Molinera", "Cañuelas"}


def test_api_insumos_solo_para_administradores(client, escenario):
    filtrado = client.get(f"/insumos?ingrediente_id={escenario.harina.id}", headers=escenario.h_admin)

    assert filtrado.status_code == 200
    assert [i["marca"] for i in filtrado.json()] == ["Molinera"]
    assert client.get("/insumos", headers=escenario.h_operador).status_code == 403


def test_api_alta_y_asociacion_desde_el_proveedor(client, escenario):
    creado = client.post(
        "/insumos",
        json={"ingrediente_id": escenario.harina.id, "marca": "Cañuelas"},
        headers=escenario.h_admin,
    )
    assert creado.status_code == 201
    insumo_id = creado.json()["id"]

    asociado = client.put(
        f"/proveedores/{escenario.molino.id}/insumos",
        json={"insumo_ids": [insumo_id, escenario.insumo_harina.id]},
        headers=escenario.h_admin,
    )
    assert asociado.status_code == 200
    assert sorted(i["nombre"] for i in asociado.json()["insumos"]) == ["Cañuelas", "Molinera"]
    assert {i["ingrediente_nombre"] for i in asociado.json()["insumos"]} == {"Harina 000"}


def test_no_se_cambia_la_unidad_de_un_ingrediente_con_lotes_o_recetas(escenario):
    from src.ingredientes import exceptions as ingredientes_exceptions
    from src.ingredientes import schemas as ingredientes_schemas
    from src.ingredientes import services as ingredientes_services
    from src.ingredientes.models import Ingrediente
    from src.unidadMedida.models import UnidadMedida
    from src.unidadMedida.constants import TIPO_MASA

    gramo = UnidadMedida(nombre="Gramo", simbolo="g", tipo=TIPO_MASA, factor_a_base=1)
    escenario.kg.tipo = TIPO_MASA  # el escenario no le fija tipo
    nuevo = Ingrediente(nombre="Harina integral", unidad_medida=escenario.kg)
    escenario.db.add_all([gramo, nuevo])
    escenario.db.commit()
    cambio = ingredientes_schemas.IngredienteUpdate(unidad_medida_id=gramo.id)

    # La harina tiene lotes y está en la receta: sus cantidades están en kg.
    with pytest.raises(ingredientes_exceptions.UnidadEnUso):
        ingredientes_services.modificar_ingrediente(escenario.db, escenario.harina.id, cambio)
    # Sin lotes ni recetas, se puede corregir.
    assert ingredientes_services.modificar_ingrediente(escenario.db, nuevo.id, cambio).unidad_medida_id == gramo.id
    # Guardar la misma unidad no es un cambio.
    misma = ingredientes_schemas.IngredienteUpdate(unidad_medida_id=escenario.kg.id)
    assert ingredientes_services.modificar_ingrediente(escenario.db, escenario.harina.id, misma).id
