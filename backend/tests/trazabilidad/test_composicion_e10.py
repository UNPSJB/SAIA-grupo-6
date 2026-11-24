"""E10 – Ver composición porcentual: criterios de aceptación.

1. Porcentaje de cada ingrediente y aditivo sobre el peso total, en grupos separados.
2. La suma da 100 % (admitiendo redondeo) y se informa la verificación.
3. Convierte g, kg, ml, l y unidades con las equivalencias del maestro; si falta
   una, avisa en lugar de asumir un valor.
4. Se recalcula al modificar la receta y queda asociada a cada versión.
"""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from src.aditivos.models import ClaseFuncional
from src.ingredientes.models import Ingrediente
from src.productos.models import Producto
from src.recetas import schemas
from src.recetas.composicion_services import calcular_composicion
from src.recetas.constants import MotivoFaltante
from src.recetas.services import crear_receta, crear_version, version_vigente
from src.unidadMedida.models import UnidadMedida


def _version(c, renglones, rendimiento="1"):
    """Versión con una sola tarea que usa todo. `renglones`: [(ingrediente, cantidad)]."""
    return schemas.VersionRecetaIn(
        rendimiento=Decimal(rendimiento),
        unidad_medida_id=c.kg.id,
        ingredientes=[
            {"ingrediente_id": i.id, "cantidad": cantidad, "unidad_medida_id": i.unidad_medida_id}
            for i, cantidad in renglones
        ],
        tareas=[
            {
                "descripcion": "Elaborar",
                "ingredientes": [{"ingrediente_id": i.id, "cantidad": cantidad} for i, cantidad in renglones],
            }
        ],
    )


@pytest.fixture
def catalogo(escenario):
    """Unidades con su tipo y factor reales e ingredientes con sus equivalencias."""
    db = escenario.db
    kg = UnidadMedida(nombre="kilogramo e10", simbolo="KG10", tipo="masa", factor_a_base=1000)
    g = UnidadMedida(nombre="gramo e10", simbolo="G10", tipo="masa", factor_a_base=1)
    litro = UnidadMedida(nombre="litro e10", simbolo="L10", tipo="volumen", factor_a_base=1000)
    unidad = UnidadMedida(nombre="unidad e10", simbolo="U10", tipo="unidad", factor_a_base=1)
    docena = UnidadMedida(nombre="docena e10", simbolo="DOC10", tipo="unidad", factor_a_base=12)
    conservante = ClaseFuncional(nombre="Conservante e10")

    c = SimpleNamespace(db=db, kg=kg, g=g, litro=litro, unidad=unidad, docena=docena)
    c.harina = Ingrediente(nombre="Harina e10", unidad_medida=kg)
    c.azucar = Ingrediente(nombre="Azúcar e10", unidad_medida=g)
    c.leche = Ingrediente(nombre="Leche e10", unidad_medida=litro, densidad_g_ml=1.03)
    c.huevo = Ingrediente(nombre="Huevo e10", unidad_medida=unidad, peso_unitario_g=50)
    c.huevos_docena = Ingrediente(nombre="Huevos por docena e10", unidad_medida=docena, peso_unitario_g=50)
    c.sorbato = Ingrediente(
        nombre="Sorbato e10", es_aditivo=True, clase_funcional=conservante, numero_ins="202",
        unidad_medida=g,
    )
    c.producto = Producto(nombre="Budín e10", unidad_medida=kg)
    db.info["sin_auditoria"] = True
    try:
        db.add_all([
            kg, g, litro, unidad, docena, conservante, c.harina, c.azucar,
            c.leche, c.huevo, c.huevos_docena, c.sorbato, c.producto,
        ])
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)
    c.escenario = escenario
    return c


def _receta(c, renglones):
    receta = crear_receta(
        c.db,
        schemas.RecetaCreate(producto_id=c.producto.id, version=_version(c, renglones)),
        c.escenario.admin,
    )
    return receta, version_vigente(c.db, receta.id)


def _por_nombre(items):
    return {i.ingrediente.nombre: i for i in items}


# --------------------------------------------------------------------------
# 1 y 3 – Porcentajes por grupo, con conversión de unidades
# --------------------------------------------------------------------------

def test_convierte_todas_las_unidades_y_separa_ingredientes_de_aditivos(catalogo):
    c = catalogo
    # 0,5 kg = 500 g · 250 g · 0,2 L x 1,03 = 206 g · 4 u x 50 = 200 g · 44 g
    _, version = _receta(c, [
        (c.harina, "0.5"), (c.azucar, "250"), (c.leche, "0.2"), (c.huevo, "4"), (c.sorbato, "44"),
    ])

    comp = calcular_composicion(c.db, version.id)

    assert comp.completa
    assert comp.total_gramos == Decimal("1200.000")
    ingredientes = _por_nombre(comp.ingredientes)
    assert {n: i.gramos for n, i in ingredientes.items()} == {
        "Harina e10": Decimal("500.000"),
        "Azúcar e10": Decimal("250.000"),
        "Leche e10": Decimal("206.000"),
        "Huevo e10": Decimal("200.000"),
    }
    assert ingredientes["Harina e10"].porcentaje == Decimal("41.67")
    assert ingredientes["Leche e10"].porcentaje == Decimal("17.17")
    assert [a.ingrediente.nombre for a in comp.aditivos] == ["Sorbato e10"]
    assert comp.aditivos[0].porcentaje == Decimal("3.67")


def test_una_docena_son_doce_unidades(catalogo):
    c = catalogo
    _, version = _receta(c, [(c.harina, "0.4"), (c.huevos_docena, "1")])  # 400 g + 12 x 50 g

    comp = calcular_composicion(c.db, version.id)

    assert _por_nombre(comp.ingredientes)["Huevos por docena e10"].gramos == Decimal("600.000")
    assert comp.total_gramos == Decimal("1000.000")


# --------------------------------------------------------------------------
# 2 – Verificación de la suma
# --------------------------------------------------------------------------

def test_la_suma_es_100_y_se_informa(catalogo):
    c = catalogo
    _, version = _receta(c, [(c.harina, "0.5"), (c.azucar, "250"), (c.sorbato, "250")])

    comp = calcular_composicion(c.db, version.id)

    assert comp.suma_porcentajes == Decimal("100.00")
    assert comp.suma_correcta is True


def test_admite_la_diferencia_de_redondeo(catalogo):
    c = catalogo
    # Tres tercios: 33,33 + 33,33 + 33,33 = 99,99.
    _, version = _receta(c, [(c.harina, "0.1"), (c.azucar, "100"), (c.sorbato, "100")])

    comp = calcular_composicion(c.db, version.id)

    assert comp.suma_porcentajes == Decimal("99.99")
    assert comp.suma_correcta is True


# --------------------------------------------------------------------------
# 3 – Si falta una equivalencia, avisa y no asume
# --------------------------------------------------------------------------

def test_sin_densidad_avisa_y_no_calcula(catalogo):
    c = catalogo
    c.leche.densidad_g_ml = None
    c.db.commit()
    _, version = _receta(c, [(c.harina, "1"), (c.leche, "1")])

    comp = calcular_composicion(c.db, version.id)

    assert comp.completa is False
    assert comp.ingredientes == [] and comp.aditivos == []
    assert comp.total_gramos is None
    assert [(f.ingrediente.nombre, f.motivo) for f in comp.faltantes] == [
        ("Leche e10", MotivoFaltante.SIN_DENSIDAD)
    ]


def test_sin_peso_unitario_avisa_y_no_calcula(catalogo):
    c = catalogo
    c.huevo.peso_unitario_g = None
    c.db.commit()
    _, version = _receta(c, [(c.harina, "1"), (c.huevo, "2")])

    comp = calcular_composicion(c.db, version.id)

    assert comp.completa is False
    assert [f.motivo for f in comp.faltantes] == [MotivoFaltante.SIN_PESO_UNITARIO]


def test_al_completar_la_equivalencia_se_puede_calcular(catalogo):
    c = catalogo
    c.leche.densidad_g_ml = None
    c.db.commit()
    _, version = _receta(c, [(c.harina, "1"), (c.leche, "1")])
    assert calcular_composicion(c.db, version.id).completa is False

    c.leche.densidad_g_ml = 1.03
    c.db.commit()

    assert calcular_composicion(c.db, version.id).completa is True


# --------------------------------------------------------------------------
# 4 – Asociada a la versión, se recalcula al modificar la receta
# --------------------------------------------------------------------------

def test_cada_version_tiene_su_composicion(catalogo):
    c = catalogo
    receta, v1 = _receta(c, [(c.harina, "0.5"), (c.azucar, "500")])
    v2 = crear_version(
        c.db, receta.id, _version(c, [(c.harina, "0.75"), (c.azucar, "250")]), c.escenario.admin
    )

    comp1 = calcular_composicion(c.db, v1.id)
    comp2 = calcular_composicion(c.db, v2.id)

    assert (comp1.version_numero, comp2.version_numero) == (1, 2)
    assert _por_nombre(comp1.ingredientes)["Harina e10"].porcentaje == Decimal("50.00")
    assert _por_nombre(comp2.ingredientes)["Harina e10"].porcentaje == Decimal("75.00")


# --------------------------------------------------------------------------
# API: solo administración
# --------------------------------------------------------------------------

def test_la_api_devuelve_la_composicion_a_quien_administra(client, catalogo):
    c = catalogo
    _, version = _receta(c, [(c.harina, "0.5"), (c.sorbato, "500")])

    respuesta = client.get(
        f"/recetas/versiones/{version.id}/composicion", headers=c.escenario.h_admin
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["completa"] is True
    assert cuerpo["producto_nombre"] == "Budín e10"
    assert [i["ingrediente"]["nombre"] for i in cuerpo["ingredientes"]] == ["Harina e10"]
    assert [i["ingrediente"]["nombre"] for i in cuerpo["aditivos"]] == ["Sorbato e10"]


def test_quien_solo_opera_no_ve_la_composicion(client, catalogo):
    c = catalogo
    _, version = _receta(c, [(c.harina, "1")])

    respuesta = client.get(
        f"/recetas/versiones/{version.id}/composicion", headers=c.escenario.h_operador
    )

    assert respuesta.status_code == 403


def test_version_inexistente_da_404(client, catalogo):
    respuesta = client.get("/recetas/versiones/99999/composicion", headers=catalogo.escenario.h_admin)

    assert respuesta.status_code == 404


# --------------------------------------------------------------------------
# Orden de la lista: a igual masa decide una persona, sin tocar la versión
# --------------------------------------------------------------------------

def test_a_igual_masa_el_orden_lo_decide_una_persona(catalogo):
    from src.recetas import exceptions
    from src.recetas.composicion_services import decidir_orden_empate

    c = catalogo
    # 0,25 kg de harina y 250 g de azúcar: la misma masa, empatados.
    _, version = _receta(c, [(c.harina, "0.25"), (c.azucar, "250"), (c.sorbato, "10")])

    comp = calcular_composicion(c.db, version.id)
    empatados = [i for i in comp.ingredientes if i.grupo_empate is not None]
    assert {i.ingrediente.nombre for i in empatados} == {"Harina e10", "Azúcar e10"}
    assert comp.aditivos[0].aditivo.clase_funcional == "Conservante e10"

    comp = decidir_orden_empate(c.db, version.id, [c.azucar.id, c.harina.id], c.escenario.admin)
    assert [i.ingrediente.nombre for i in comp.ingredientes] == ["Azúcar e10", "Harina e10"]
    assert comp.ingredientes[0].orden_decidido_por is not None

    # Solo un grupo empatado completo: el aditivo no está empatado con ellos.
    with pytest.raises(exceptions.OrdenEmpateInvalido):
        decidir_orden_empate(c.db, version.id, [c.azucar.id, c.sorbato.id], c.escenario.admin)
