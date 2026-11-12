"""E12.1: saber si aplica el rotulado frontal (sin calcular sellos)."""

from copy import deepcopy
from datetime import date
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.aditivos.models import Aditivo, ClaseFuncional
from src.auth.services import crear_access_token
from src.database import get_db
from src.insumos.models import TIPO_ADITIVO, Insumo
from src.nutricion.models import PerfilNutricionalInsumo
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaInsumo, VersionReceta
from src.rotulado_frontal import constants as rotulado_constants
from src.rotulado_frontal.models import ReglaRotuladoFrontal
from src.rotulado_frontal.router import router as rotulado_router
from src.unidadMedida.models import UnidadMedida


def _sin_auditoria(db, *objetos):
    db.info["sin_auditoria"] = True
    try:
        db.add_all(objetos)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


@pytest.fixture
def client(db_session):
    app = FastAPI()
    app.include_router(rotulado_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def usuarios(db_session):
    admin = Personal(
        nombre="Ada",
        apellido="Admin",
        dni="30000001",
        email="admin.rotulado@test.local",
        password="x",
        puede_operar=True,
        puede_administrar=True,
    )
    operador = Personal(
        nombre="Omar",
        apellido="Operador",
        dni="30000002",
        email="operador.rotulado@test.local",
        password="x",
        puede_operar=True,
        puede_administrar=False,
    )
    _sin_auditoria(db_session, admin, operador)
    return {
        "admin": {"Authorization": f"Bearer {crear_access_token(str(admin.id))[0]}"},
        "operador": {"Authorization": f"Bearer {crear_access_token(str(operador.id))[0]}"},
    }


@pytest.fixture
def regla(db_session):
    fila = ReglaRotuladoFrontal(
        version=1,
        vigente=True,
        vigencia_desde=date(2022, 3, 23),
        norma_origen="Ley 27.642 y Decreto 151/2022",
        requiere_envasado=True,
        obliga_azucares=True,
        obliga_grasas=True,
        obliga_sodio=True,
        obliga_edulcorantes=True,
        obliga_cafeina=True,
        clases_edulcorante=["Edulcorante"],
    )
    _sin_auditoria(db_session, fila)
    return fila


@pytest.fixture
def productos(db_session):
    g = UnidadMedida(nombre="gramo", simbolo="g")
    kg = UnidadMedida(nombre="kilogramo", simbolo="kg")

    azucar = Insumo(nombre="Azúcar", unidad_medida=g)
    sal = Insumo(nombre="Sal", unidad_medida=g)
    cafe = Insumo(nombre="Café", unidad_medida=g)
    harina = Insumo(nombre="Harina", unidad_medida=g)
    tomate = Insumo(nombre="Tomate", unidad_medida=g)
    extracto_te = Insumo(nombre="Extracto de té", unidad_medida=g)

    edulcorante = ClaseFuncional(nombre="Edulcorante")
    aspartamo_ref = Aditivo(
        clase_funcional=edulcorante, nombre="Aspartamo", numero_ins="951"
    )
    aspartamo = Insumo(
        nombre="Aspartamo", tipo=TIPO_ADITIVO, aditivo=aspartamo_ref, unidad_medida=g
    )
    # Comparte la clase "Edulcorante" pero su INS es de textura: no debe
    # detectarse como edulcorante.
    espesante_ref = Aditivo(
        clase_funcional=edulcorante,
        nombre="Carboximetilcelulosa",
        numero_ins="466",
    )
    espesante = Insumo(
        nombre="Carboximetilcelulosa",
        tipo=TIPO_ADITIVO,
        aditivo=espesante_ref,
        unidad_medida=g,
    )

    con_marcas = Producto(nombre="Bebida con marcas", unidad_medida=kg)
    limpio = Producto(nombre="Producto limpio", unidad_medida=kg)
    sin_receta = Producto(nombre="Producto sin receta", unidad_medida=kg)
    cafeina_intrinseca = Producto(nombre="Bebida con té", unidad_medida=kg)

    receta_marcas = Receta(producto=con_marcas)
    version_marcas = VersionReceta(
        receta=receta_marcas,
        numero=1,
        rendimiento=Decimal("1"),
        unidad_medida=kg,
    )
    receta_limpia = Receta(producto=limpio)
    version_limpia = VersionReceta(
        receta=receta_limpia,
        numero=1,
        rendimiento=Decimal("1"),
        unidad_medida=kg,
    )
    receta_te = Receta(producto=cafeina_intrinseca)
    version_te = VersionReceta(
        receta=receta_te,
        numero=1,
        rendimiento=Decimal("1"),
        unidad_medida=kg,
    )

    renglones = [
        RecetaInsumo(
            version=version_marcas,
            insumo=insumo,
            cantidad=Decimal("10"),
            unidad_medida=g,
            clasificacion=insumo.tipo or "ingrediente",
        )
        for insumo in (azucar, sal, cafe, aspartamo, espesante)
    ]
    renglon_limpio = RecetaInsumo(
        version=version_limpia,
        insumo=harina,
        cantidad=Decimal("10"),
        unidad_medida=g,
        clasificacion="ingrediente",
    )
    renglon_tomate = RecetaInsumo(
        version=version_limpia,
        insumo=tomate,
        cantidad=Decimal("10"),
        unidad_medida=g,
        clasificacion="ingrediente",
    )
    renglon_te = RecetaInsumo(
        version=version_te,
        insumo=extracto_te,
        cantidad=Decimal("10"),
        unidad_medida=g,
        clasificacion="ingrediente",
    )
    _sin_auditoria(
        db_session,
        g,
        kg,
        azucar,
        sal,
        cafe,
        harina,
        tomate,
        extracto_te,
        edulcorante,
        aspartamo_ref,
        aspartamo,
        espesante_ref,
        espesante,
        con_marcas,
        limpio,
        sin_receta,
        cafeina_intrinseca,
        receta_marcas,
        version_marcas,
        receta_limpia,
        version_limpia,
        receta_te,
        version_te,
        *renglones,
        renglon_limpio,
        renglon_tomate,
        renglon_te,
    )
    _sin_auditoria(
        db_session,
        PerfilNutricionalInsumo(
            insumo_id=azucar.id,
            azucares_son_anadidos=True,
            grasas_son_anadidas=True,
        ),
        PerfilNutricionalInsumo(insumo_id=sal.id, sodio_es_anadido=True),
        PerfilNutricionalInsumo(insumo_id=cafe.id, contiene_cafeina=True),
    )
    return {
        "con_marcas": con_marcas,
        "limpio": limpio,
        "sin_receta": sin_receta,
        "cafeina_intrinseca": cafeina_intrinseca,
        "espesante_id": espesante.id,
    }


def _guardar(client, producto_id, headers, **datos):
    return client.put(
        f"/rotulado-frontal/productos/{producto_id}",
        json=datos,
        headers=headers,
    )


def test_sin_respuesta_de_envasado_queda_sin_definir(client, usuarios, regla, productos):
    respuesta = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}",
        headers=usuarios["admin"],
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "sin_definir"
    assert body_has_no_sellos(cuerpo)
    assert cuerpo["configuracion"]["envasado_sin_cliente"] is None
    assert any("envasado" in faltante for faltante in cuerpo["faltantes"])


def body_has_no_sellos(cuerpo: dict) -> bool:
    return not any("sello" in clave.lower() for clave in cuerpo)


def test_no_envasado_informa_que_no_aplica_y_no_calcula_sellos(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=False,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "no_aplica"
    assert "no corresponde" in cuerpo["mensaje"].lower()
    assert body_has_no_sellos(cuerpo)


def test_detecta_las_cinco_marcas_desde_perfiles_y_clase_edulcorante(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "aplica"
    marcas = {marca["clave"]: marca for marca in cuerpo["marcas"]}
    assert all(marcas[clave]["valor"] is True for clave in marcas)
    assert marcas["edulcorantes"]["fuentes"][0]["motivo"].startswith("clase funcional")
    assert marcas["azucares"]["origen"] == "receta"


def test_la_correccion_manual_prevalece_sobre_la_deteccion(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        azucares_agregados=False,
        cafeina=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    marcas = {marca["clave"]: marca for marca in cuerpo["marcas"]}
    assert marcas["azucares"]["valor"] is False
    assert marcas["azucares"]["origen"] == "correccion"
    assert marcas["cafeina"]["valor"] is True
    assert marcas["cafeina"]["origen"] == "correccion"
    assert cuerpo["estado"] == "aplica"


def test_producto_envasado_sin_marcas_queda_exceptuado(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["limpio"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "exceptuado"
    assert "exceptuado" in cuerpo["mensaje"].lower()
    assert body_has_no_sellos(cuerpo)


def test_producto_sin_receta_no_inventa_marcas_pero_permite_corregirlas(
    client, usuarios, regla, productos
):
    sin_corregir = client.get(
        f"/rotulado-frontal/productos/{productos['sin_receta'].id}",
        headers=usuarios["admin"],
    )
    assert sin_corregir.status_code == 200
    cuerpo = sin_corregir.json()
    assert cuerpo["estado"] == "sin_definir"
    assert cuerpo["advertencias"]
    assert all(marca["valor"] is None for marca in cuerpo["marcas"])

    corregido = _guardar(
        client,
        productos["sin_receta"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        azucares_agregados=True,
    )
    assert corregido.status_code == 200
    cuerpo = corregido.json()
    assert cuerpo["estado"] == "aplica"
    assert cuerpo["marcas"][0]["origen"] == "correccion"


def test_excepcion_por_naturaleza_no_evalua_el_perfil(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        categoria_exceptuada_por_ley=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "exceptuado"
    assert "artículo 9" in cuerpo["mensaje"]
    assert cuerpo["categoria_exceptuada_por_ley"] is True
    assert all(not marca["fuentes"] for marca in cuerpo["marcas"])


def test_canal_no_minorista_no_aplica_el_rotulado(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        canal_comercializacion="MAYORISTA_INDUSTRIAL",
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "no_aplica_canal_industrial"
    assert cuerpo["configuracion"]["canal_comercializacion"] == "MAYORISTA_INDUSTRIAL"
    assert "canal" in cuerpo["mensaje"].lower()


def test_edulcorante_exige_un_ins_valido_y_no_una_clase_amplia(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    marcas = {marca["clave"]: marca for marca in respuesta.json()["marcas"]}
    fuentes = marcas["edulcorantes"]["fuentes"]

    assert all(fuente["insumo_id"] != productos["espesante_id"] for fuente in fuentes)
    assert any("951" in fuente["motivo"] for fuente in fuentes)


def test_la_regla_versionada_controla_ins_y_cafeina(
    client, usuarios, regla, productos
):
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2026-01-01",
            "norma_origen": "Regla de prueba",
            "requiere_envasado": True,
            "obliga_azucares": True,
            "obliga_grasas": True,
            "obliga_sodio": True,
            "obliga_edulcorantes": True,
            "obliga_cafeina": True,
            "clases_edulcorante": ["Edulcorante"],
            "validar_ins_edulcorantes": False,
            "ins_edulcorantes": [],
            "ingredientes_cafeina": ["guarana"],
        },
    )
    assert nueva.status_code == 201
    activada = client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )
    assert activada.status_code == 200

    con_marcas = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    marcas = {marca["clave"]: marca for marca in con_marcas.json()["marcas"]}
    assert any(
        fuente["insumo_id"] == productos["espesante_id"]
        for fuente in marcas["edulcorantes"]["fuentes"]
    )

    con_te = _guardar(
        client,
        productos["cafeina_intrinseca"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    marcas_te = {marca["clave"]: marca for marca in con_te.json()["marcas"]}
    assert marcas_te["cafeina"]["valor"] is False


def test_detecta_cafeina_intrinseca_de_una_materia_prima_compuesta(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["cafeina_intrinseca"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    marcas = {marca["clave"]: marca for marca in cuerpo["marcas"]}
    assert cuerpo["estado"] == "aplica"
    assert marcas["cafeina"]["valor"] is True
    assert marcas["cafeina"]["fuentes"][0]["motivo"] == "cafeína intrínseca del ingrediente"


def test_la_evaluacion_devuelve_una_instantanea_con_regla_y_receta(
    client, usuarios, regla, productos
):
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    instantanea = cuerpo["instantanea"]

    assert instantanea["estado"] == cuerpo["estado"]
    assert instantanea["regla_version"] == regla.version
    assert instantanea["version_receta_id"] == cuerpo["version"]["id"]
    assert instantanea["version_receta_numero"] == cuerpo["version"]["numero"]
    assert instantanea["canal_comercializacion"] == "MINORISTA"


def test_crear_y_activar_una_version_deja_una_sola_vigente(
    client, usuarios, regla, productos
):
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2026-01-01",
            "norma_origen": "Norma actualizada",
            "requiere_envasado": True,
            "obliga_azucares": True,
            "obliga_grasas": False,
            "obliga_sodio": False,
            "obliga_edulcorantes": True,
            "obliga_cafeina": False,
            "clases_edulcorante": ["Edulcorante"],
        },
    )
    assert nueva.status_code == 201
    assert nueva.json()["version"] == 2
    assert nueva.json()["vigente"] is False

    activada = client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )
    assert activada.status_code == 200
    assert activada.json()["vigente"] is True

    reglas = client.get("/rotulado-frontal/reglas", headers=usuarios["admin"]).json()
    assert [regla["vigente"] for regla in reglas] == [True, False]


def test_sin_regla_vigente_devuelve_error_claro(client, usuarios, regla, productos, db_session):
    db_session.delete(regla)
    db_session.commit()

    respuesta = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}",
        headers=usuarios["admin"],
    )
    assert respuesta.status_code == 400
    assert "regla" in respuesta.json()["detail"].lower()


def test_operador_no_puede_administrar_rotulado(client, usuarios, productos):
    respuesta = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}",
        headers=usuarios["operador"],
    )
    assert respuesta.status_code == 403


def test_el_interruptor_global_desactiva_solo_el_modulo(
    client, usuarios, regla, productos
):
    inicial = client.get(
        "/rotulado-frontal/ajuste-modulo", headers=usuarios["admin"]
    )
    assert inicial.status_code == 200
    assert inicial.json()["modulo_activo"] is True

    apagado = client.put(
        "/rotulado-frontal/ajuste-modulo",
        headers=usuarios["admin"],
        json={"modulo_activo": False},
    )
    assert apagado.status_code == 200
    assert apagado.json()["modulo_activo"] is False

    evaluado = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}",
        headers=usuarios["admin"],
    )
    assert evaluado.status_code == 200
    cuerpo = evaluado.json()
    assert cuerpo["modulo_activo"] is False
    assert cuerpo["estado"] == "modulo_inactivo"
    assert "desactivado" in cuerpo["mensaje"].lower()
    assert all(not marca["fuentes"] for marca in cuerpo["marcas"])
    assert cuerpo["instantanea"]["modulo_activo"] is False
    assert body_has_no_sellos(cuerpo)

    reactivado = client.put(
        "/rotulado-frontal/ajuste-modulo",
        headers=usuarios["admin"],
        json={"modulo_activo": True},
    )
    assert reactivado.status_code == 200
    vuelto = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}",
        headers=usuarios["admin"],
    )
    assert vuelto.json()["estado"] == "sin_definir"


def test_la_instantanea_congela_umbrales_formulas_y_canal(
    client, usuarios, regla, productos
):
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-01-01",
            "norma_origen": "Norma con parametros propios",
            "umbrales_sellos": [
                {
                    "clave": "energia_solidos",
                    "etiqueta": "Energia en solidos",
                    "valor": 300,
                    "unidad": "kcal/100 g",
                }
            ],
            "formulas_nutricionales": [
                {
                    "clave": "kcal_por_g_grasas",
                    "etiqueta": "Energia por gramo de grasas",
                    "valor": 8.5,
                    "unidad": "kcal/g",
                }
            ],
        },
    )
    assert nueva.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )

    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    parametros = cuerpo["instantanea"]["parametros"]

    assert parametros["regla_version"] == 2
    assert parametros["umbrales_sellos"] == [
        {
            "clave": "energia_solidos",
            "etiqueta": "Energia en solidos",
            "valor": 300.0,
            "unidad": "kcal/100 g",
        }
    ]
    assert parametros["formulas_nutricionales"][0]["valor"] == 8.5
    assert parametros["reglas_aplicabilidad"]["canales_consumo_final"] == [
        "MINORISTA"
    ]
    assert cuerpo["instantanea"]["configuracion"]["envasado_sin_cliente"] is True
    assert cuerpo["instantanea"]["categoria_rotulado"] is None
    assert cuerpo["instantanea"]["marcas"] == cuerpo["marcas"]


def test_los_parametros_normativos_no_admiten_claves_repetidas(
    client, usuarios, regla, productos
):
    respuesta = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-01-01",
            "norma_origen": "Norma invalida",
            "umbrales_sellos": [
                {
                    "clave": "energia_solidos",
                    "etiqueta": "Uno",
                    "valor": 300,
                    "unidad": "kcal/100 g",
                },
                {
                    "clave": "energia_solidos",
                    "etiqueta": "Dos",
                    "valor": 310,
                    "unidad": "kcal/100 g",
                },
            ],
        },
    )

    assert respuesta.status_code == 422
    assert "repetida" in respuesta.text.lower()


def test_las_categorias_exceptuadas_se_leen_de_la_regla(
    client, usuarios, regla, productos
):
    aplicabilidad = deepcopy(rotulado_constants.REGLAS_APLICABILIDAD_INICIALES)
    aplicabilidad["categorias_exceptuadas"] = [
        {"clave": "sal_comun", "etiqueta": "Sal común de mesa"}
    ]
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-01-01",
            "norma_origen": "Categorías reducidas",
            "reglas_aplicabilidad": aplicabilidad,
        },
    )
    assert nueva.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )

    con_azucar = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        categoria_rotulado="azucar_comun",
    )
    assert con_azucar.status_code == 200
    assert con_azucar.json()["estado"] == "aplica"
    assert con_azucar.json()["categoria_rotulado"] == "azucar_comun"

    client.post(
        f"/rotulado-frontal/reglas/{regla.id}/activar",
        headers=usuarios["admin"],
    )
    vuelto = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        categoria_rotulado="azucar_comun",
    )
    assert vuelto.json()["estado"] == "exceptuado"
    assert "artículo 9" in vuelto.json()["mensaje"]


def test_se_puede_quitar_una_categoria_exceptuada(
    client, usuarios, regla, productos
):
    _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        categoria_rotulado="azucar_comun",
    )
    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        categoria_rotulado=None,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["categoria_rotulado"] is None
    assert respuesta.json()["estado"] == "aplica"


def test_los_canales_y_condiciones_tambien_salen_de_la_regla(
    client, usuarios, regla, productos
):
    aplicabilidad = deepcopy(rotulado_constants.REGLAS_APLICABILIDAD_INICIALES)
    aplicabilidad["canales_consumo_final"] = ["MINORISTA", "MAYORISTA"]
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-01-01",
            "norma_origen": "Canal mayorista incluido",
            "reglas_aplicabilidad": aplicabilidad,
        },
    )
    assert nueva.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )

    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
        canal_comercializacion="MAYORISTA",
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "aplica"

    aplicabilidad["condiciones"][0] = {
        "clave": "regla_dinamica",
        "cuando": [{"campo": "siempre", "operador": "es_verdadero"}],
        "estado": "exceptuado",
        "mensaje": "Resultado definido por la regla versionada.",
    }
    otra = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2028-01-01",
            "norma_origen": "Condición dinámica",
            "reglas_aplicabilidad": aplicabilidad,
        },
    )
    assert otra.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{otra.json()['id']}/activar",
        headers=usuarios["admin"],
    )

    dinamica = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    assert dinamica.status_code == 200
    assert dinamica.json()["estado"] == "exceptuado"
    assert dinamica.json()["mensaje"] == (
        "Resultado definido por la regla versionada."
    )


def test_el_resultado_por_defecto_tambien_sale_de_la_regla(
    client, usuarios, regla, productos
):
    aplicabilidad = deepcopy(rotulado_constants.REGLAS_APLICABILIDAD_INICIALES)
    aplicabilidad["condiciones"] = [
        {
            "clave": "nunca_coincide",
            "cuando": [{"campo": "modulo_activo", "operador": "es_falso"}],
            "estado": "aplica",
            "mensaje": "No debería usarse.",
        }
    ]
    aplicabilidad["resultado_por_defecto"] = {
        "clave": "defecto_configurado",
        "estado": "no_aplica",
        "mensaje": "Resultado configurado por defecto.",
        "faltantes": [],
    }
    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-06-01",
            "norma_origen": "Norma con resultado por defecto",
            "reglas_aplicabilidad": aplicabilidad,
        },
    )
    assert nueva.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )

    respuesta = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "no_aplica"
    assert respuesta.json()["mensaje"] == "Resultado configurado por defecto."
    assert (
        respuesta.json()["instantanea"]["parametros"]["reglas_aplicabilidad"][
            "resultado_por_defecto"
        ]["clave"]
        == "defecto_configurado"
    )


def test_el_historial_conserva_el_snapshot_de_cada_version(
    client, usuarios, regla, productos
):
    actual = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    assert actual.status_code == 200

    nueva = client.post(
        "/rotulado-frontal/reglas",
        headers=usuarios["admin"],
        json={
            "vigencia_desde": "2027-07-01",
            "norma_origen": "Norma con un solo umbral",
            "umbrales_sellos": [
                {
                    "clave": "energia_solidos",
                    "etiqueta": "Energía en sólidos",
                    "valor": 999.0,
                    "unidad": "kcal/100 g",
                }
            ],
        },
    )
    assert nueva.status_code == 201
    client.post(
        f"/rotulado-frontal/reglas/{nueva.json()['id']}/activar",
        headers=usuarios["admin"],
    )
    actualizado = _guardar(
        client,
        productos["con_marcas"].id,
        usuarios["admin"],
        envasado_sin_cliente=True,
    )
    assert actualizado.status_code == 200

    historial = client.get(
        f"/rotulado-frontal/productos/{productos['con_marcas'].id}/evaluaciones",
        headers=usuarios["admin"],
    )
    assert historial.status_code == 200
    guardadas = historial.json()
    vieja = next(
        fila for fila in guardadas if fila["regla_version"] == regla.version
    )
    nueva_guardada = next(
        fila for fila in guardadas if fila["regla_version"] == nueva.json()["version"]
    )

    assert vieja["instantanea"]["version_esquema"] == 4
    assert vieja["instantanea"]["norma_origen"] == regla.norma_origen
    assert len(vieja["instantanea"]["parametros"]["umbrales_sellos"]) == 6
    assert nueva_guardada["instantanea"]["norma_origen"] == (
        "Norma con un solo umbral"
    )
    assert len(nueva_guardada["instantanea"]["parametros"]["umbrales_sellos"]) == 1
    assert nueva_guardada["instantanea"]["parametros"]["umbrales_sellos"][0][
        "valor"
    ] == 999.0
