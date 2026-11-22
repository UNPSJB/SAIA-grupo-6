"""E11: tabla de información nutricional.

El producto de referencia de estos tests está calculado a mano. Cuando la
cátedra entregue el producto validado por un/a profesional, se agrega acá con
sus valores y la tolerancia acordada.
"""

from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.aditivos.models import ClaseFuncional
from src.auth.services import crear_access_token
from src.database import get_db
from src.ingredientes.models import Ingrediente
from src.nutricion import calculo, exceptions, schemas, services
from src.nutricion.models import AlimentoReferencia, ParametroNutriente
from src.nutricion.router import router as nutricion_router
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaIngrediente, VersionReceta
from src.unidadMedida.constants import equivalencia_conocida
from src.unidadMedida.models import UnidadMedida

TOLERANCIA = Decimal("0.01")  # 1 % relativo

HARINA = dict(energia=341, carbohidratos=72, azucares_totales=0.3, azucares_anadidos=0,
              proteinas=10.5, grasas_totales=1.2, grasas_saturadas=0.2, grasas_trans=0,
              fibra=2.7, sodio=2)
AZUCAR = dict(energia=400, carbohidratos=100, azucares_totales=100, azucares_anadidos=0,
              proteinas=0, grasas_totales=0, grasas_saturadas=0, grasas_trans=0,
              fibra=0, sodio=0)
HUEVO = dict(energia=143, carbohidratos=0.7, azucares_totales=0.4, azucares_anadidos=0,
             proteinas=12.6, grasas_totales=9.5, grasas_saturadas=3.1, grasas_trans=0,
             fibra=0, sodio=142)


def _sin_auditoria(db, *objetos):
    db.info["sin_auditoria"] = True
    try:
        db.add_all(objetos)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def _valores(datos: dict, fuente="rotulo_proveedor", referencia="Rótulo"):
    return [
        schemas.ValorIn(nutriente=k, valor=Decimal(str(v)), fuente=fuente, referencia=referencia)
        for k, v in datos.items()
    ]


@pytest.fixture
def usuario(db_session):
    persona = Personal(
        nombre="Nora", apellido="Nutri", dni="44556677", email="nora@test.local",
        password="x", puede_operar=True, puede_administrar=True,
    )
    _sin_auditoria(db_session, persona)
    return persona


def _unidad(nombre: str, simbolo: str) -> UnidadMedida:
    """Unidad con su tipo y factor reales: el cálculo los toma de la unidad."""
    return UnidadMedida(nombre=nombre, simbolo=simbolo, **equivalencia_conocida(nombre, simbolo))


@pytest.fixture
def receta(db_session, usuario):
    """Bizcochuelo: 250 g harina, 250 g azúcar, 300 g huevo, 5 g bicarbonato
    (aditivo que aporta sodio) y 2 g de sorbato sin datos. Rinde 0,7 kg."""
    g = _unidad("gramo", "g")
    kg = _unidad("kilogramo", "Kg")
    clase = ClaseFuncional(nombre="Leudante")
    harina = Ingrediente(nombre="Harina", unidad_medida=g)
    azucar = Ingrediente(nombre="Azúcar", unidad_medida=g)
    huevo = Ingrediente(nombre="Huevo", unidad_medida=g)
    bicarbonato = Ingrediente(nombre="Bicarbonato", es_aditivo=True, clase_funcional=clase,
                              numero_ins="500(ii)", unidad_medida=g)
    sorbato = Ingrediente(nombre="Sorbato", es_aditivo=True, clase_funcional=clase,
                          numero_ins="202", unidad_medida=g)
    producto = Producto(nombre="Bizcochuelo", unidad_medida=kg)
    rec = Receta(producto=producto)
    version = VersionReceta(receta=rec, numero=1, rendimiento=Decimal("0.7"), unidad_medida=kg)
    renglones = [
        RecetaIngrediente(version=version, ingrediente=i, cantidad=Decimal(q), unidad_medida=g,
                     es_aditivo=i.es_aditivo)
        for i, q in ((harina, "250"), (azucar, "250"), (huevo, "300"),
                     (bicarbonato, "5"), (sorbato, "2"))
    ]
    _sin_auditoria(db_session, g, kg, clase, harina, azucar, huevo,
                   bicarbonato, sorbato, producto, rec, version, *renglones)
    return dict(producto=producto, harina=harina, azucar=azucar, huevo=huevo,
                bicarbonato=bicarbonato, sorbato=sorbato, version=version, g=g)


def _cargar_todo(db, r, usuario):
    for ingrediente, datos in ((r["harina"], HARINA), (r["azucar"], AZUCAR), (r["huevo"], HUEVO)):
        services.guardar_datos_ingrediente(
            db, ingrediente.id, schemas.DatosNutricionalesIn(valores=_valores(datos)), usuario
        )
    services.guardar_datos_ingrediente(
        db, r["bicarbonato"].id,
        schemas.DatosNutricionalesIn(
            aporta_energia_sodio=True,
            valores=_valores({"energia": 0, "sodio": 27400}),
        ),
        usuario,
    )
    services.guardar_configuracion(
        db, r["producto"].id,
        schemas.ConfiguracionProductoIn(porcion=Decimal("50"), medida_casera="1 porción"),
    )


def _fila(info, clave):
    return next(f for f in info.filas if f.clave == clave)


def _cerca(valor, esperado):
    esperado = Decimal(str(esperado))
    assert abs(valor - esperado) <= abs(esperado) * TOLERANCIA, (valor, esperado)


# ── Cálculo (historia 2) ───────────────────────────────────────────────────


def test_producto_de_referencia_coincide_dentro_de_la_tolerancia(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)

    assert info.estado == "completa", (info.problemas, info.incompletos)
    assert info.cantidad_base == Decimal("700.0000")
    # Energía: (2,5·341 + 2,5·400 + 3·143) / 700 g · 100
    _cerca(_fila(info, "energia").por_100, "325.928")
    _cerca(_fila(info, "energia").por_porcion, "162.964")
    assert _fila(info, "energia").por_porcion_texto == "163 kcal = 684 kJ"
    # Sodio incluye el bicarbonato (aditivo con aporte): 5 + 426 + 1370 mg
    _cerca(_fila(info, "sodio").por_100, "257.286")
    assert _fila(info, "sodio").por_porcion_texto == "129"
    assert _fila(info, "sodio").vd_texto == "5"
    # Proteínas: 4,575 g por porción -> 1 decimal, 6 % VD
    assert _fila(info, "proteinas").por_porcion_texto == "4,6"
    assert _fila(info, "proteinas").vd_texto == "6"
    _cerca(_fila(info, "carbohidratos").por_100, "61.7286")
    assert _fila(info, "carbohidratos").por_porcion_texto == "31"
    # Grasas trans: 0 -> no significativo, se declara "0,0" (como el rótulo de
    # referencia de la cátedra) y sin %VD (la guía excluye las trans del %VD).
    trans = _fila(info, "grasas_trans")
    assert trans.no_significativo and trans.por_porcion_texto == "0,0"
    assert trans.vd_texto == ""
    assert not _fila(info, "azucares_totales").vd_establecido
    # La tabla declara "0,0" y además la frase los nombra al pie (activada).
    assert "grasas trans" in info.leyenda_no_significativo
    assert info.mostrar_por_100


def test_redondeo_sale_de_los_parametros(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    proteinas = db_session.get(ParametroNutriente, "proteinas")
    proteinas.decimales_menor_10 = 2
    proteinas.valor_diario = Decimal("50")
    db_session.commit()
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert _fila(info, "proteinas").por_porcion_texto == "4,58"
    assert _fila(info, "proteinas").vd_texto == "9"


def test_funciones_de_expresion():
    regla = calculo.ReglaNutriente("x", "X", "g", Decimal("10"), Decimal("0.5"), 1, 0)
    assert calculo.expresar(Decimal("9.96"), regla, False) == "10,0"
    assert calculo.expresar(Decimal("12.5"), regla, False) == "13"
    assert calculo.expresar(Decimal("1234.4"), regla, False) == "1.234"
    assert calculo.es_no_significativo(Decimal("0.5"), regla)
    assert calculo.porcentaje_vd(Decimal("2.54"), regla, False) == (Decimal("25"), "25")


def test_rendimiento_en_unidades_necesita_peso_por_unidad(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    un = _unidad("unidad", "un")
    _sin_auditoria(db_session, un)
    version = VersionReceta(receta_id=receta["version"].receta_id, numero=2,
                            rendimiento=Decimal("2"), unidad_medida=un)
    renglon = RecetaIngrediente(version=version, ingrediente=receta["harina"], cantidad=Decimal("100"),
                           unidad_medida=receta["g"], es_aditivo=False)
    _sin_auditoria(db_session, version, renglon)

    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.version.numero == 2
    assert info.estado == "incompleta"
    assert any("peso por unidad" in p for p in info.problemas)

    services.guardar_configuracion(
        db_session, receta["producto"].id,
        schemas.ConfiguracionProductoIn(porcion=Decimal("50"), medida_casera="1 porción",
                                        peso_unidad_g=Decimal("50")),
    )
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.estado == "completa"
    _cerca(_fila(info, "energia").por_100, "341")


# ── Datos incompletos (historia 3) ─────────────────────────────────────────


def test_detecta_ingredientes_incompletos_y_recalcula_al_completar(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    # Al huevo le falta el sodio.
    sin_sodio = {k: v for k, v in HUEVO.items() if k != "sodio"}
    services.guardar_datos_ingrediente(
        db_session, receta["huevo"].id,
        schemas.DatosNutricionalesIn(valores=_valores(sin_sodio)), usuario,
    )
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.estado == "incompleta"
    assert [i.nombre for i in info.incompletos] == ["Huevo"]
    assert info.incompletos[0].faltantes == ["Sodio"]
    # El sodio no se muestra armado con datos faltantes (ni como "no significativo").
    sodio = _fila(info, "sodio")
    assert sodio.faltan_datos and sodio.por_porcion_texto == "—"
    assert "sodio" not in (info.leyenda_no_significativo or "")
    assert not _fila(info, "energia").faltan_datos
    # El sorbato es aditivo sin aporte ni datos: no cuenta como incompleto.
    sorbato = next(i for i in info.ingredientes if i.nombre == "Sorbato")
    assert sorbato.completo and not sorbato.exige_datos and not sorbato.incluido

    services.guardar_datos_ingrediente(
        db_session, receta["huevo"].id,
        schemas.DatosNutricionalesIn(valores=_valores(HUEVO)), usuario,
    )
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.estado == "completa"


def test_aditivo_marcado_como_aportante_exige_energia_y_sodio(db_session, receta, usuario):
    services.guardar_datos_ingrediente(
        db_session, receta["sorbato"].id,
        schemas.DatosNutricionalesIn(aporta_energia_sodio=True, valores=[]), usuario,
    )
    datos = services.obtener_datos_ingrediente(db_session, receta["sorbato"].id)
    assert datos.completitud.exige_datos
    assert datos.completitud.faltantes == ["Valor energético", "Sodio"]


def test_ingrediente_en_litros_necesita_densidad(db_session, usuario):
    litro = _unidad("litro", "L")
    leche = Ingrediente(nombre="Leche", unidad_medida=litro)
    _sin_auditoria(db_session, litro, leche)
    datos = services.guardar_datos_ingrediente(
        db_session, leche.id, schemas.DatosNutricionalesIn(valores=_valores(HUEVO)), usuario
    )
    assert datos.completitud.faltantes == ["la densidad (g/ml)"]
    datos = services.guardar_datos_ingrediente(
        db_session, leche.id,
        schemas.DatosNutricionalesIn(densidad_g_ml=Decimal("1.03"), valores=_valores(HUEVO)),
        usuario,
    )
    assert datos.completitud.completo
    # Queda en el ingrediente: es el mismo dato que usa la composición porcentual.
    db_session.refresh(leche)
    assert Decimal(str(leche.densidad_g_ml)) == Decimal("1.03")


def test_guardar_sin_densidad_no_borra_la_del_ingrediente(db_session, usuario):
    litro = _unidad("litro", "L")
    leche = Ingrediente(nombre="Leche", unidad_medida=litro, densidad_g_ml=1.03)
    _sin_auditoria(db_session, litro, leche)

    datos = services.guardar_datos_ingrediente(
        db_session, leche.id, schemas.DatosNutricionalesIn(valores=_valores(HUEVO)), usuario
    )

    assert datos.densidad_g_ml == Decimal("1.03")
    assert datos.completitud.completo


def test_rendimiento_por_docena_cuenta_doce_unidades(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    docena = _unidad("docena", "doc")
    _sin_auditoria(db_session, docena)
    version = VersionReceta(receta_id=receta["version"].receta_id, numero=2,
                            rendimiento=Decimal("1"), unidad_medida=docena)
    renglon = RecetaIngrediente(version=version, ingrediente=receta["harina"], cantidad=Decimal("120"),
                           unidad_medida=receta["g"], es_aditivo=False)
    _sin_auditoria(db_session, version, renglon)
    services.guardar_configuracion(
        db_session, receta["producto"].id,
        schemas.ConfiguracionProductoIn(porcion=Decimal("10"), medida_casera="1 unidad",
                                        peso_unidad_g=Decimal("10")),
    )

    info = services.calcular_info_nutricional(db_session, receta["producto"].id)

    # 1 docena x 12 x 10 g = 120 g de producto, todo harina.
    assert info.cantidad_base == Decimal("120")


# ── Carga de datos (historia 1) ────────────────────────────────────────────


def test_carga_desde_base_registra_fuente_y_marca_modificados(db_session, receta, usuario):
    alimento = AlimentoReferencia(base="SARA 2", nombre="Harina de trigo", **HARINA)
    _sin_auditoria(db_session, alimento)

    def desde_base(clave, valor):
        return schemas.ValorIn(nutriente=clave, valor=Decimal(str(valor)),
                               fuente="base_referencia", alimento_referencia_id=alimento.id)

    valores = [desde_base(k, v) for k, v in HARINA.items()]
    # La persona corrige la fibra respecto de la base.
    valores[8] = desde_base("fibra", "3.1")
    datos = services.guardar_datos_ingrediente(
        db_session, receta["harina"].id, schemas.DatosNutricionalesIn(valores=valores), usuario
    )
    fibra = next(v for v in datos.valores if v.nutriente == "fibra")
    energia = next(v for v in datos.valores if v.nutriente == "energia")
    assert energia.referencia == "SARA 2: Harina de trigo"
    assert energia.cargado_por == "Nora Nutri" and not energia.modificado
    assert fibra.modificado and fibra.valor_fuente == Decimal("2.7000")
    assert fibra.modificado_por == "Nora Nutri" and fibra.modificado_en is not None

    # Editar después un valor de la misma carga también queda marcado.
    valores[0] = desde_base("energia", 350)
    datos = services.guardar_datos_ingrediente(
        db_session, receta["harina"].id, schemas.DatosNutricionalesIn(valores=valores), usuario
    )
    energia = next(v for v in datos.valores if v.nutriente == "energia")
    assert energia.modificado and energia.valor == Decimal("350.0000")


def test_aditivo_solo_admite_energia_y_sodio(db_session, receta, usuario):
    from src.nutricion.exceptions import NutrienteNoAdmitidoAditivo

    with pytest.raises(NutrienteNoAdmitidoAditivo):
        services.guardar_datos_ingrediente(
            db_session, receta["bicarbonato"].id,
            schemas.DatosNutricionalesIn(valores=_valores({"proteinas": 1})), usuario,
        )


def test_importar_csv_de_base(db_session):
    contenido = "codigo;nombre;energia;proteinas;sodio\nA1;Avena;389;16,9;2\n;;;;\nA2;Mal;abc;1;1\n"
    resultado = services.importar_alimentos(db_session, "Base propia", contenido.encode())
    assert resultado.creados == 1 and len(resultado.errores) == 1
    avena = services.listar_alimentos(db_session, "aven")[0]
    assert avena.proteinas == Decimal("16.9000") and avena.carbohidratos is None
    resultado = services.importar_alimentos(db_session, "Base propia", contenido.encode())
    assert resultado.actualizados == 1


# Primeras columnas y filas reales del `AlimentoyComposicion.csv` de SARA 1
# (export de su base Access que entregó la cátedra), recortado.
SARA1 = (
    'Codigo,Alimento,UnidadMedida,Decimales,FactorCorreccion,Id,Agua,E,Prot,Lip,HCtotal,'
    'HCdisp,Fibra,Cen,Na,K,AGSat,AGMI\n'
    '"A001","Almidón de maíz","gramos","sin",1.0000000000000000e+00,325,8.3200000000000003e+00,'
    '3.6297000000000003e+02,2.6000000000000001e-01,5.0000000000000003e-02,9.1269999999999996e+01,'
    '9.0370000000000005e+01,9.0000000000000002e-01,8.9999999999999997e-02,9.0000000000000000e+00,'
    '3.0000000000000000e+00,8.9999999999999993e-03,1.6000000000000000e-02\n'
    '"L010","Leche en polvo entera","mililitros","sin",1.0,1,2.5,4.9040000000000003e+02,'
    '2.5800000000000001e+01,2.4800000000000001e+01,4.1e+01,4.1000000000000000e+01,0.0,6.0,'
    '4.0400000000000000e+02,1.0,1.4760000000000000e+01,7.0\n'
    '"S001","Hierro (elemental)","miligramos","sin",1.0,2,0,0,0,0,0,0,0,0,0,0,0,0\n'
)


def test_importar_csv_de_sara1_tal_como_viene(db_session):
    resultado = services.importar_alimentos(db_session, "SARA 1", SARA1.encode())
    assert resultado.creados == 2 and not resultado.errores

    almidon = services.listar_alimentos(db_session, "almidón")[0]
    assert almidon.codigo == "A001"
    assert almidon.energia == Decimal("362.9700")
    # Carbohidratos disponibles (HCdisp), no totales: es lo que va en el rótulo.
    assert almidon.carbohidratos == Decimal("90.3700")
    assert almidon.proteinas == Decimal("0.2600") and almidon.grasas_totales == Decimal("0.0500")
    assert almidon.grasas_saturadas == Decimal("0.0090")
    assert almidon.fibra == Decimal("0.9000") and almidon.sodio == Decimal("9.0000")
    # SARA 1 no trae azúcares ni grasas trans.
    assert almidon.azucares_totales is None and almidon.grasas_trans is None

    # "mililitros" es cómo se registra el consumo: el valor es por 100 g.
    leche = services.listar_alimentos(db_session, "leche en polvo")[0]
    assert leche.energia == Decimal("490.4000")
    # Los nutrientes aislados (mg, µg, UI) no son alimentos.
    assert services.listar_alimentos(db_session, "hierro") == []

    assert any("azúcares totales, azúcares añadidos y grasas trans" in a for a in resultado.avisos)
    assert any("Hierro (elemental)" in a for a in resultado.avisos)

    otra_vez = services.importar_alimentos(db_session, "SARA 1", SARA1.encode())
    assert otra_vez.creados == 0 and otra_vez.actualizados == 2


def test_importar_otro_csv_de_sara1_sin_alimentos_falla(db_session):
    # Otro archivo del mismo export (p. ej. Provincias.csv): no hay alimentos.
    with pytest.raises(exceptions.CsvInvalido):
        services.importar_alimentos(db_session, "SARA 1", b"IdProvincia,Provincia\n1,Salta\n")


def test_alimento_de_sara1_completa_lo_que_tiene(db_session, receta, usuario):
    """Tomar valores de SARA 1 deja al ingrediente incompleto hasta cargar los azúcares
    y las grasas trans con otra fuente."""
    services.importar_alimentos(db_session, "SARA 1", SARA1.encode())
    almidon = services.listar_alimentos(db_session, "almidón")[0]
    desde_base = [
        schemas.ValorIn(nutriente=k, valor=getattr(almidon, k), fuente="base_referencia",
                        alimento_referencia_id=almidon.id)
        for k in ("energia", "carbohidratos", "proteinas", "grasas_totales",
                  "grasas_saturadas", "fibra", "sodio")
    ]
    datos = services.guardar_datos_ingrediente(
        db_session, receta["harina"].id, schemas.DatosNutricionalesIn(valores=desde_base), usuario
    )
    assert not datos.completitud.completo
    assert set(datos.completitud.faltantes) == {"Azúcares totales", "Azúcares añadidos", "Grasas trans"}

    rotulo = _valores({"azucares_totales": 0, "azucares_anadidos": 0, "grasas_trans": 0})
    datos = services.guardar_datos_ingrediente(
        db_session, receta["harina"].id,
        schemas.DatosNutricionalesIn(valores=desde_base + rotulo), usuario,
    )
    assert datos.completitud.completo
    energia = next(v for v in datos.valores if v.nutriente == "energia")
    assert energia.referencia == "SARA 1: Almidón de maíz"


# ── API y PDF (historia 4) ─────────────────────────────────────────────────


@pytest.fixture
def client_nutricion(db_session):
    app = FastAPI()
    app.include_router(nutricion_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_api_tabla_y_pdf_con_leyenda(client_nutricion, db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    token, _, _ = crear_access_token(str(usuario.id))
    h = {"Authorization": f"Bearer {token}"}
    producto_id = receta["producto"].id
    r = client_nutricion.get(f"/nutricion/productos/{producto_id}", headers=h)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["estado"] == "completa"
    assert "profesional" in cuerpo["leyenda_calculo"]
    assert cuerpo["configuracion"]["medida_casera"] == "1 porción"

    r = client_nutricion.get(f"/nutricion/productos/{producto_id}/pdf", headers=h)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")


def test_api_exige_permiso_de_administrar(client_nutricion, db_session, receta):
    operador = Personal(
        nombre="Op", apellido="Erador", dni="11223344", email="op@test.local",
        password="x", puede_operar=True, puede_administrar=False,
    )
    _sin_auditoria(db_session, operador)
    token, _, _ = crear_access_token(str(operador.id))
    r = client_nutricion.get(
        f"/nutricion/productos/{receta['producto'].id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ── Ajustes según la guía de rotulado de la cátedra ────────────────────────


def test_grasas_totales_cero_solo_si_saturadas_y_trans_tambien(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    # Con un umbral alto las grasas totales serían "no significativas"...
    db_session.get(ParametroNutriente, "grasas_totales").umbral_no_significativo = Decimal("5")
    db_session.commit()
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    # ...pero las saturadas (0,7 g por porción) sí lo son: se declara el valor.
    totales = _fila(info, "grasas_totales")
    assert not totales.no_significativo
    assert totales.por_porcion_texto == "2,3"


def test_laboratorio_reemplaza_el_calculo_y_cubre_el_faltante(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    sin_sodio = {k: v for k, v in HUEVO.items() if k != "sodio"}
    services.guardar_datos_ingrediente(
        db_session, receta["huevo"].id,
        schemas.DatosNutricionalesIn(valores=_valores(sin_sodio)), usuario,
    )
    assert services.calcular_info_nutricional(db_session, receta["producto"].id).estado == "incompleta"

    # Sodio determinado en laboratorio: 315 mg/100 g (como la milanesa de la cátedra).
    services.guardar_laboratorio(
        db_session, receta["producto"].id,
        schemas.LaboratorioIn(
            referencia="Informe 123",
            valores=[schemas.ValorLaboratorioIn(nutriente="sodio", valor_100=Decimal("315"))],
        ),
        usuario,
    )
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.estado == "completa", (info.problemas, info.incompletos)
    sodio = _fila(info, "sodio")
    assert sodio.de_laboratorio and not sodio.faltan_datos
    assert sodio.por_porcion_texto == "158"  # 315 * 50 / 100 = 157,5
    assert info.laboratorio[0].referencia == "Informe 123"
    assert info.leyenda_laboratorio == "** Determinado en laboratorio."

    # Sacar el valor de laboratorio vuelve a dejar la tabla incompleta.
    services.guardar_laboratorio(
        db_session, receta["producto"].id, schemas.LaboratorioIn(valores=[]), usuario
    )
    assert services.calcular_info_nutricional(db_session, receta["producto"].id).estado == "incompleta"


def test_azucares_anadidos_salen_de_los_ingredientes_que_los_aportan(db_session, receta, usuario):
    _cargar_todo(db_session, receta, usuario)
    # El azúcar se marca como ingrediente de azúcar añadido: no hace falta
    # cargarle "azúcares añadidos", se toman sus azúcares totales.
    sin_anadidos = {k: v for k, v in AZUCAR.items() if k != "azucares_anadidos"}
    datos = services.guardar_datos_ingrediente(
        db_session, receta["azucar"].id,
        schemas.DatosNutricionalesIn(azucares_son_anadidos=True, valores=_valores(sin_anadidos)),
        usuario,
    )
    assert datos.completitud.completo and datos.azucares_son_anadidos
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.estado == "completa"
    # 250 g de azúcar en 700 g de producto -> 35,7 g de azúcares añadidos /100 g
    _cerca(_fila(info, "azucares_anadidos").por_100, "35.714")


def test_columna_por_100_es_optativa(client_nutricion, db_session, usuario):
    token, _, _ = crear_access_token(str(usuario.id))
    h = {"Authorization": f"Bearer {token}"}
    actuales = client_nutricion.get("/nutricion/parametros", headers=h).json()
    assert actuales["generales"]["mostrar_por_100"] is True
    actuales["generales"]["mostrar_por_100"] = False
    r = client_nutricion.put("/nutricion/parametros", json=actuales, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["generales"]["mostrar_por_100"] is False


def test_azucares_y_grasas_trans_no_admiten_valor_diario(client_nutricion, db_session, receta, usuario):
    token, _, _ = crear_access_token(str(usuario.id))
    h = {"Authorization": f"Bearer {token}"}
    actuales = client_nutricion.get("/nutricion/parametros", headers=h).json()
    trans = next(n for n in actuales["nutrientes"] if n["clave"] == "grasas_trans")
    assert trans["admite_vd"] is False and trans["valor_diario"] is None
    assert next(n for n in actuales["nutrientes"] if n["clave"] == "sodio")["admite_vd"]

    # La API rechaza cargarle un VD a las grasas trans.
    trans["valor_diario"] = "2"
    r = client_nutricion.put("/nutricion/parametros", json=actuales, headers=h)
    assert r.status_code == 400
    assert "Valor Diario" in r.json()["detail"]

    # Y un VD que haya quedado guardado de antes no se usa en el cálculo.
    _cargar_todo(db_session, receta, usuario)
    db_session.get(ParametroNutriente, "azucares_totales").valor_diario = Decimal("50")
    db_session.commit()
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert _fila(info, "azucares_totales").vd_texto == ""


def test_leyendas_obligatorias_son_fijas(client_nutricion, db_session, receta, usuario):
    token, _, _ = crear_access_token(str(usuario.id))
    h = {"Authorization": f"Bearer {token}"}
    actuales = client_nutricion.get("/nutricion/parametros", headers=h).json()
    assert "profesional" in actuales["leyendas_fijas"]["leyenda_calculo"]
    assert "necesidades energéticas" in actuales["leyendas_fijas"]["leyenda_vd"]
    assert "leyenda_calculo" not in actuales["generales"]

    # Aunque alguien mande otro texto por la API, no se guarda ni se usa.
    actuales["generales"]["leyenda_calculo"] = " "
    actuales["generales"]["leyenda_vd"] = ""
    assert "factor_kj" not in actuales["generales"]
    assert "leyenda_laboratorio" not in actuales["generales"]
    actuales["generales"]["factor_kj"] = "1"
    r = client_nutricion.put("/nutricion/parametros", json=actuales, headers=h)
    assert r.status_code == 200, r.text
    _cargar_todo(db_session, receta, usuario)
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.leyenda_calculo.startswith("Valores calculados")
    assert "necesidades energéticas" in info.leyenda_vd
    # El factor kcal -> kJ sigue siendo 4,2 (163 kcal = 684 kJ).
    assert _fila(info, "energia").por_porcion_texto == "163 kcal = 684 kJ"


def test_frase_no_significativo_se_arma_sola(db_session, receta, usuario):
    from src.nutricion.models import ParametroNutricion

    _cargar_todo(db_session, receta, usuario)
    # Desactivada: los no significativos siguen en "0,0" pero sin frase.
    db_session.get(ParametroNutricion, "frase_no_significativo").valor = "0"
    db_session.commit()
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    assert info.leyenda_no_significativo is None
    assert _fila(info, "grasas_trans").por_porcion_texto == "0,0"

    db_session.get(ParametroNutricion, "frase_no_significativo").valor = "1"
    db_session.commit()
    info = services.calcular_info_nutricional(db_session, receta["producto"].id)
    # El texto es el de la guía y la lista sale del cálculo del producto.
    assert info.leyenda_no_significativo.startswith("No aporta cantidades significativas de ")
    assert "grasas trans" in info.leyenda_no_significativo
    assert "sodio" not in info.leyenda_no_significativo

