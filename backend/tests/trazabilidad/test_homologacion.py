"""Homologación de un insumo (marca) contra su ingrediente (especificación).

Nutrientes con tolerancia (±20 % por defecto; bajo el umbral de "no
significativo" se toman como iguales). Alérgenos sin tolerancia. Solo un
insumo aprobado recibe lotes, y si la referencia del ingrediente cambia y la
comparación empeora, vuelve a revisión.
"""

from decimal import Decimal

import pytest

from src.alergenos import schemas as alergenos_schemas
from src.alergenos import services as alergenos_services
from src.insumos import exceptions
from src.insumos import homologacion
from src.insumos import schemas
from src.insumos import services as insumos_services
from src.lotesInsumo import exceptions as lotes_exceptions
from src.lotesInsumo import schemas as lotes_schemas
from src.lotesInsumo import services as lotes_services
from src.nutricion import schemas as nutricion_schemas
from src.nutricion import services as nutricion_services

GLUTEN = "Trigo"


@pytest.fixture
def ctx(escenario):
    """Harina con referencia (energía 340 kcal, proteínas 10 g, sodio 2 mg) y gluten."""
    alergenos_services.cargar_alergenos_iniciales(escenario.db)
    catalogo = {a.nombre: a for a in alergenos_services.listar_alergenos(escenario.db)}
    nutricion_services.guardar_datos_ingrediente(
        escenario.db,
        escenario.harina.id,
        nutricion_schemas.DatosNutricionalesIn(
            valores=[
                nutricion_schemas.ValorIn(nutriente=n, valor=Decimal(v), fuente="valor_propio")
                for n, v in (("energia", "340"), ("proteinas", "10"), ("sodio", "2"))
            ]
        ),
        escenario.admin,
    )
    alergenos_services.guardar_alergenos_de_ingrediente(
        escenario.db,
        escenario.harina.id,
        alergenos_schemas.AlergenosDeIngredienteIn(
            alergenos=[
                alergenos_schemas.AlergenoDeIngredienteIn(alergeno_id=catalogo[GLUTEN].id, nivel="contiene"),
                alergenos_schemas.AlergenoDeIngredienteIn(alergeno_id=catalogo["Soja"].id, nivel="puede_contener"),
            ]
        ),
    )
    insumo = insumos_services.crear_insumo(
        escenario.db,
        schemas.InsumoCreate(ingrediente_id=escenario.harina.id, marca="Cañuelas", proveedor_ids=[escenario.molino.id]),
    )
    escenario.catalogo = catalogo
    escenario.insumo = insumo
    return escenario


def _rotulo(ctx, valores, alergenos=()):
    return homologacion.guardar_rotulo(
        ctx.db,
        ctx.insumo.id,
        schemas.RotuloInsumoIn(
            referencia="Rótulo del envase",
            valores=[schemas.ValorRotuloIn(nutriente=n, valor=Decimal(v)) for n, v in valores.items()],
            alergenos=[
                schemas.AlergenoRotuloIn(alergeno_id=ctx.catalogo[nombre].id, nivel=nivel) for nombre, nivel in alergenos
            ],
        ),
    )


def _decidir(ctx, decision, justificacion=None):
    return homologacion.decidir(
        ctx.db, ctx.insumo.id, schemas.DecisionHomologacionIn(decision=decision, justificacion=justificacion), ctx.admin
    )


def _estado(resultado, nutriente):
    return next(f for f in resultado.comparacion.nutrientes if f.nutriente == nutriente)


def test_dentro_de_la_tolerancia_es_apta(ctx):
    resultado = _rotulo(ctx, {"energia": "360", "proteinas": "9", "sodio": "1"}, [(GLUTEN, "contiene")])

    assert resultado.comparacion.resultado == "apta"
    assert _estado(resultado, "energia").desvio_pct == Decimal("5.8824")
    # 2 mg y 1 mg están bajo el umbral de "no significativo" del sodio (5 mg).
    assert _estado(resultado, "sodio").estado == "bajo_umbral"
    # Sin referencia no se compara ni afecta el resultado.
    assert _estado(resultado, "fibra").estado == "sin_referencia"


def test_fuera_de_tolerancia_queda_observada(ctx):
    resultado = _rotulo(ctx, {"energia": "420", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])

    assert resultado.comparacion.resultado == "observada"
    assert _estado(resultado, "energia").estado == "fuera_de_tolerancia"
    assert any("Valor energético" in p for p in resultado.comparacion.problemas)


def test_un_dato_que_falta_en_el_rotulo_queda_observado(ctx):
    resultado = _rotulo(ctx, {"energia": "340", "sodio": "2"}, [(GLUTEN, "contiene")])

    assert resultado.comparacion.resultado == "observada"
    assert _estado(resultado, "proteinas").estado == "sin_dato"


def test_la_tolerancia_es_un_parametro(ctx):
    parametros = nutricion_services.obtener_parametros(ctx.db)
    generales = parametros.generales.model_copy(update={"tolerancia_homologacion_pct": Decimal("30")})
    nutricion_services.actualizar_parametros(
        ctx.db,
        nutricion_schemas.ParametrosUpdate(
            nutrientes=[nutricion_schemas.ParametroNutrienteUpdate(**n.model_dump()) for n in parametros.nutrientes],
            generales=generales,
        ),
    )

    resultado = _rotulo(ctx, {"energia": "420", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    assert resultado.comparacion.resultado == "apta"
    assert resultado.comparacion.tolerancia_pct == Decimal("30")


def test_alergeno_que_el_ingrediente_no_tiene_rechaza(ctx):
    resultado = _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene"), ("Huevo", "contiene")])

    assert resultado.comparacion.resultado == "rechazada"
    with pytest.raises(exceptions.AlergenosNoCumplen):
        _decidir(ctx, "aprobar", "La marca es buena")


def test_contiene_en_la_marca_exige_contiene_en_el_ingrediente(ctx):
    # El ingrediente solo "puede contener" soja: una marca que la contiene no entra.
    contiene = _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [("Soja", "contiene")])
    puede = _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [("Soja", "puede_contener")])

    assert contiene.comparacion.resultado == "rechazada"
    # Declarar menos que la especificación (sin gluten) o lo mismo, está bien.
    assert puede.comparacion.resultado == "apta"


def test_observada_se_aprueba_solo_con_justificacion(ctx):
    _rotulo(ctx, {"energia": "420", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])

    with pytest.raises(exceptions.JustificacionRequerida):
        _decidir(ctx, "aprobar")
    aprobado = _decidir(ctx, "aprobar", "Lote de prueba aceptado por la profesional")
    assert (aprobado.estado, aprobado.resultado_al_decidir) == ("aprobada", "observada")
    assert aprobado.homologado_por == "Ada Admin"


def _recibir(ctx):
    return lotes_services.crear_lote_insumo(
        ctx.db,
        lotes_schemas.LoteInsumoCreate(
            insumo_id=ctx.insumo.id, proveedor_id=ctx.molino.id, numero_lote="C-1", cantidad_recibida=Decimal("10")
        ),
        ctx.admin,
    )


def test_solo_un_insumo_aprobado_recibe_lotes(ctx):
    with pytest.raises(lotes_exceptions.InsumoNoHomologado):
        _recibir(ctx)

    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar")
    assert _recibir(ctx).insumo_id == ctx.insumo.id

    _decidir(ctx, "rechazar", "Cambió la formulación")
    with pytest.raises(lotes_exceptions.InsumoNoHomologado):
        lotes_services.crear_lote_insumo(
            ctx.db,
            lotes_schemas.LoteInsumoCreate(
                insumo_id=ctx.insumo.id, proveedor_id=ctx.molino.id, numero_lote="C-2", cantidad_recibida=Decimal("10")
            ),
            ctx.admin,
        )


def test_si_cambia_la_referencia_y_empeora_vuelve_a_revision(ctx):
    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar")

    # La referencia de energía pasa a 250 kcal: la marca (340) queda a +36 %.
    nutricion_services.guardar_datos_ingrediente(
        ctx.db,
        ctx.harina.id,
        nutricion_schemas.DatosNutricionalesIn(
            valores=[
                nutricion_schemas.ValorIn(nutriente=n, valor=Decimal(v), fuente="valor_propio")
                for n, v in (("energia", "250"), ("proteinas", "10"), ("sodio", "2"))
            ]
        ),
        ctx.admin,
    )

    assert homologacion.obtener_homologacion(ctx.db, ctx.insumo.id).estado == "requiere_revision"
    with pytest.raises(lotes_exceptions.InsumoNoHomologado):
        _recibir(ctx)


def test_quitar_un_alergeno_del_ingrediente_manda_a_revision(ctx):
    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar")

    alergenos_services.guardar_alergenos_de_ingrediente(
        ctx.db, ctx.harina.id, alergenos_schemas.AlergenosDeIngredienteIn(alergenos=[])
    )

    assert homologacion.obtener_homologacion(ctx.db, ctx.insumo.id).estado == "requiere_revision"


def test_una_mejora_no_cambia_el_estado(ctx):
    _rotulo(ctx, {"energia": "420", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar", "Aceptado con observación")

    resultado = _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])

    assert resultado.estado == "aprobada"


def test_un_rotulo_por_porcion_se_compara_por_100(ctx):
    # Rótulo por porción de 30 g: 102 kcal y 3 g de proteínas son 340 y 10 por 100 g.
    resultado = homologacion.guardar_rotulo(
        ctx.db,
        ctx.insumo.id,
        schemas.RotuloInsumoIn(
            porcion=Decimal("30"),
            valores=[
                schemas.ValorRotuloIn(nutriente="energia", valor=Decimal("102")),
                schemas.ValorRotuloIn(nutriente="proteinas", valor=Decimal("3")),
                schemas.ValorRotuloIn(nutriente="sodio", valor=Decimal("0.6")),
            ],
            alergenos=[schemas.AlergenoRotuloIn(alergeno_id=ctx.catalogo[GLUTEN].id, nivel="contiene")],
        ),
    )

    assert resultado.rotulo.porcion == Decimal("30.00")
    energia = next(v for v in resultado.rotulo.valores if v.nutriente == "energia")
    assert (energia.valor, energia.valor_100) == (Decimal("102.0000"), Decimal("340.0000"))
    assert _estado(resultado, "energia").desvio_pct == Decimal("0.0000")
    assert resultado.comparacion.resultado == "apta"


def test_a_un_aditivo_solo_se_le_cargan_energia_y_sodio(ctx):
    sal = insumos_services.crear_insumo(
        ctx.db, schemas.InsumoCreate(ingrediente_id=ctx.sal.id, marca="Otra sal", proveedor_ids=[ctx.salinas.id])
    )
    with pytest.raises(exceptions.NutrienteNoAdmitido):
        homologacion.guardar_rotulo(
            ctx.db,
            sal.id,
            schemas.RotuloInsumoIn(valores=[schemas.ValorRotuloIn(nutriente="proteinas", valor=Decimal("1"))]),
        )


def test_api_homologacion(client, ctx):
    rotulo = client.put(
        f"/insumos/{ctx.insumo.id}/rotulo",
        json={
            "referencia": "Envase 1 kg",
            "valores": [{"nutriente": "energia", "valor": "345"}, {"nutriente": "proteinas", "valor": "10"}, {"nutriente": "sodio", "valor": "2"}],
            "alergenos": [{"alergeno_id": ctx.catalogo[GLUTEN].id, "nivel": "contiene"}],
        },
        headers=ctx.h_admin,
    )
    assert rotulo.status_code == 200
    assert rotulo.json()["comparacion"]["resultado"] == "apta"

    aprobado = client.post(f"/insumos/{ctx.insumo.id}/homologacion", json={"decision": "aprobar"}, headers=ctx.h_admin)
    assert aprobado.json()["estado"] == "aprobada"
    listado = client.get(f"/insumos?ingrediente_id={ctx.harina.id}", headers=ctx.h_admin).json()
    assert {i["marca"]: i["estado_homologacion"] for i in listado}["Cañuelas"] == "aprobada"
    assert client.get(f"/insumos/{ctx.insumo.id}/homologacion", headers=ctx.h_operador).status_code == 403


def test_sumar_meses_respeta_el_fin_de_mes():
    from datetime import date

    assert homologacion.sumar_meses(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert homologacion.sumar_meses(date(2026, 11, 21), 12) == date(2027, 11, 21)


def test_avisa_la_homologacion_vencida_o_por_vencer(ctx, monkeypatch):
    from datetime import date, datetime

    from src.notificaciones import services as notificaciones

    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    aprobado = _decidir(ctx, "aprobar")
    # Vigencia por defecto: 12 meses desde la aprobación.
    assert aprobado.vigente_hasta == homologacion.sumar_meses(aprobado.homologado_en.date(), 12)
    assert notificaciones.obtener_notificaciones_homologacion_insumos(ctx.db) == []

    ctx.insumo.homologado_en = datetime(2025, 11, 1, 10, 0)
    ctx.db.commit()
    monkeypatch.setattr(notificaciones, "hoy", lambda: date(2026, 10, 25))
    (por_vencer,) = notificaciones.obtener_notificaciones_homologacion_insumos(ctx.db)
    assert (por_vencer.nivel, por_vencer.fecha_referencia) == ("PROXIMO_A_VENCER", date(2026, 11, 1))
    assert por_vencer.link_destino == f"/insumos/{ctx.insumo.id}/homologacion"

    monkeypatch.setattr(notificaciones, "hoy", lambda: date(2026, 11, 2))
    (vencida,) = notificaciones.obtener_notificaciones_homologacion_insumos(ctx.db)
    assert vencida.nivel == "VENCIDO"
    assert vencida.tipo == "HOMOLOGACION_INSUMO"

    # Rechazada, ya no avisa (no recibe lotes de todos modos).
    _decidir(ctx, "rechazar", "Cambió la formulación")
    assert notificaciones.obtener_notificaciones_homologacion_insumos(ctx.db) == []

def _consumir(ctx, lote_insumo):
    from src.lotes import schemas as produccion_schemas
    from src.lotes import services as produccion_services

    lote = produccion_services.crear_lote(
        ctx.db, produccion_schemas.LoteCreate(producto_id=ctx.pan.id, cantidad_objetivo=Decimal("10")), ctx.admin
    )
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]
    return produccion_services.registrar_consumo(
        ctx.db, lote.id, amasar.id,
        produccion_schemas.ConsumoCreate(lote_insumo_id=lote_insumo.id, cantidad=Decimal("1")), ctx.operador,
    )


def test_una_marca_que_deja_de_estar_aprobada_no_se_consume(ctx):
    from src.lotes import exceptions as produccion_exceptions

    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar")
    lote_insumo = _recibir(ctx)
    assert _consumir(ctx, lote_insumo)[0].id

    _decidir(ctx, "rechazar", "Cambió la formulación")
    with pytest.raises(produccion_exceptions.InsumoNoHomologado) as error:
        _consumir(ctx, lote_insumo)
    assert "rechazada" in error.value.detail


def test_una_homologacion_vencida_no_recibe_ni_se_consume(ctx):
    from datetime import datetime

    from src.lotes import exceptions as produccion_exceptions

    _rotulo(ctx, {"energia": "340", "proteinas": "10", "sodio": "2"}, [(GLUTEN, "contiene")])
    _decidir(ctx, "aprobar")
    lote_insumo = _recibir(ctx)
    # Aprobada hace casi dos años, con la vigencia por defecto (12 meses): vencida.
    ctx.insumo.homologado_en = datetime(2024, 12, 10, 9, 0)
    ctx.db.commit()

    with pytest.raises(produccion_exceptions.InsumoNoHomologado) as error:
        _consumir(ctx, lote_insumo)
    assert "venció" in error.value.detail
    with pytest.raises(lotes_exceptions.InsumoNoHomologado):
        lotes_services.crear_lote_insumo(
            ctx.db,
            lotes_schemas.LoteInsumoCreate(
                insumo_id=ctx.insumo.id, proveedor_id=ctx.molino.id, numero_lote="C-9", cantidad_recibida=Decimal("5")
            ),
            ctx.admin,
        )
    # Volver a aprobarla renueva la vigencia.
    _decidir(ctx, "aprobar")
    assert _consumir(ctx, lote_insumo)[0].id


# ── Insumos sin rótulo (no elaborados o a granel) ─────────────────────────


def _marcar_sin_rotulo(ctx, valor=True):
    return insumos_services.actualizar_insumo(ctx.db, ctx.insumo.id, schemas.InsumoUpdate(sin_rotulo=valor))


def test_sin_rotulo_es_apto_sin_cargar_nada(ctx):
    _marcar_sin_rotulo(ctx)
    h = homologacion.obtener_homologacion(ctx.db, ctx.insumo.id)
    assert h.sin_rotulo is True
    assert h.comparacion.resultado == homologacion.RESULTADO_APTA
    assert {f.estado for f in h.comparacion.nutrientes} == {homologacion.ESTADO_SIN_ROTULO}
    # Rigen los alérgenos del ingrediente: no hay nada que pueda no cumplir.
    assert all(a.cumple for a in h.comparacion.alergenos)
    # Se aprueba sin justificación: no hay desvíos que justificar.
    assert _decidir(ctx, "aprobar").estado == "aprobada"


def test_sin_rotulo_no_admite_cargar_un_rotulo(ctx):
    _marcar_sin_rotulo(ctx)
    with pytest.raises(exceptions.InsumoSinRotulo):
        _rotulo(ctx, {"energia": "340"})


def test_marcarlo_sin_rotulo_borra_el_rotulo_cargado(ctx):
    _rotulo(ctx, {"energia": "500"}, [(GLUTEN, "contiene")])
    _marcar_sin_rotulo(ctx)
    h = homologacion.obtener_homologacion(ctx.db, ctx.insumo.id)
    assert h.rotulo.valores == [] and h.rotulo.alergenos == []


def test_quitarle_sin_rotulo_a_uno_aprobado_lo_manda_a_revision(ctx):
    _marcar_sin_rotulo(ctx)
    _decidir(ctx, "aprobar")
    insumo = _marcar_sin_rotulo(ctx, False)
    assert insumo.estado_homologacion == "requiere_revision"


def test_crear_un_insumo_sin_rotulo(ctx):
    nuevo = insumos_services.crear_insumo(
        ctx.db,
        schemas.InsumoCreate(
            ingrediente_id=ctx.harina.id, marca="A granel", proveedor_ids=[ctx.molino.id], sin_rotulo=True
        ),
    )
    assert insumos_services.a_respuesta(nuevo).sin_rotulo is True
