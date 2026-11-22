"""Tests de integración para el endpoint GET /lotes/{id}/timeline."""

from decimal import Decimal
import pytest

from src.auth.dependencies import require_operador
from src.database import get_db
from src.ingredientes.models import Ingrediente
from src.insumos.models import Insumo
from src.lotes import schemas, services
from src.lotes.constants import TIPO_CONSUMO_DESPERDICIO, TIPO_CONSUMO_REAL
from src.lotes.models import ConsumoInsumo
from tests.produccion_helpers import completar_tarea
from src.lotesInsumo.models import LoteInsumo
from src.main import app
from src.personal.models import Personal
from src.productos.models import Producto
from src.proveedores.models import Proveedor
from src.recetas.models import Receta, RecetaIngrediente, TareaReceta, TareaRecetaIngrediente, VersionReceta
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


_seq = 0


def _usuario(db, puede_operar=True, nombre="Juan", apellido="Pérez"):
    global _seq
    _seq += 1
    persona = Personal(
        nombre=nombre,
        apellido=apellido,
        dni=f"3000{_seq:04d}",
        email=f"user_tl_{_seq}@test.local",
        password="x",
        puede_operar=puede_operar,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(persona)
        db.commit()
        db.refresh(persona)
    finally:
        db.info.pop("sin_auditoria", None)
    return persona


@pytest.fixture
def auth_client(client, db_session):
    operario = _usuario(db_session, puede_operar=True, nombre="Carlos", apellido="Gómez")
    ant_db = app.dependency_overrides.get(get_db)
    ant_op = app.dependency_overrides.get(require_operador)

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[require_operador] = lambda: operario

    yield client, operario

    if ant_db is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = ant_db
    if ant_op is None:
        app.dependency_overrides.pop(require_operador, None)
    else:
        app.dependency_overrides[require_operador] = ant_op


def _crear_escenario_dos_tareas(db, operario, cantidad_objetivo=Decimal("100")):
    global _seq
    _seq += 1
    db.info["sin_auditoria"] = True
    try:
        kg = UnidadMedida(nombre=f"Kilogramo {_seq}", simbolo="kg", tipo="masa")
        db.add(kg)
        db.commit()

        ingrediente = Ingrediente(nombre=f"Harina {_seq}", unidad_medida_id=kg.id)
        proveedor = Proveedor(nombre=f"Molino {_seq}", matricula=f"MAT-TL2-{_seq}")
        db.add_all([ingrediente, proveedor])
        db.commit()

        insumo = Insumo(ingrediente_id=ingrediente.id, marca=f"Marca {_seq}", proveedores=[proveedor])
        db.add(insumo)
        db.commit()

        lote_ins = LoteInsumo(
            insumo_id=insumo.id,
            ingrediente_id=ingrediente.id,
            proveedor_id=proveedor.id,
            numero_lote=f"LOT-INS2-{_seq}",
            cantidad_recibida=Decimal("500"),
        )
        db.add(lote_ins)
        db.commit()

        producto = Producto(nombre=f"Pan Especial {_seq}", unidad_medida_id=kg.id)
        db.add(producto)
        db.commit()

        receta = Receta(producto_id=producto.id, activo=True)
        db.add(receta)
        db.commit()

        version = VersionReceta(
            receta_id=receta.id,
            numero=1,
            rendimiento=Decimal("10"),
            unidad_medida_id=kg.id,
            vida_util_dias=30,
        )
        db.add(version)
        db.commit()

        r_ins = RecetaIngrediente(
            version_receta_id=version.id,
            ingrediente_id=ingrediente.id,
            cantidad=Decimal("10"),
            unidad_medida_id=kg.id,
            es_aditivo=False,
        )
        db.add(r_ins)
        db.commit()

        t1 = TareaReceta(version_receta_id=version.id, orden=1, descripcion="Mezcla y amasado")
        t2 = TareaReceta(version_receta_id=version.id, orden=2, descripcion="Horneado")
        db.add_all([t1, t2])
        db.commit()

        ti1 = TareaRecetaIngrediente(tarea_receta_id=t1.id, receta_ingrediente_id=r_ins.id, cantidad=Decimal("10"))
        db.add(ti1)
        db.commit()

        lote = services.crear_lote(
            db,
            schemas.LoteCreate(producto_id=producto.id, cantidad_objetivo=cantidad_objetivo),
            usuario=operario,
        )

        return {
            "db": db,
            "operario": operario,
            "lote": lote,
            "lote_insumo": lote_ins,
            "ingrediente": ingrediente,
            "proveedor": proveedor,
            "receta": receta,
            "version": version,
            "tareas": [t1, t2],
        }
    finally:
        db.info.pop("sin_auditoria", None)


def test_obtener_timeline_lote_no_existente_retorna_404(auth_client):
    client, _ = auth_client
    res = client.get("/lotes/999999/timeline")
    assert res.status_code == 404


def test_obtener_timeline_lote_en_proceso_estructura_correcta(auth_client, db_session):
    client, operario = auth_client
    e = _crear_escenario_dos_tareas(db_session, operario)
    db = db_session
    lote = e["lote"]

    # Registrar consumo de ingrediente en la tarea 1 y completarla
    item1 = lote.checklist[0]
    db.info["sin_auditoria"] = True
    try:
        consumo = ConsumoInsumo(
            checklist_produccion_id=item1.id,
            lote_insumo_id=e["lote_insumo"].id,
            # Lo que pide la receta (10 por unidad de rendimiento, lote x10).
            cantidad=Decimal("100"),
            tipo=TIPO_CONSUMO_REAL,
            registrado_por_id=operario.id,
        )
        db.add(consumo)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    services.completar_item(db, lote.id, item1.id, operario)

    # La tarea 2 queda pendiente; lote sigue 'en_proceso'
    res = client.get(f"/lotes/{lote.id}/timeline")
    assert res.status_code == 200

    data = res.json()
    assert data["lote_id"] == lote.id
    assert data["numero_lote"] == lote.numero_lote

    nodos = data["nodos"]
    assert len(nodos) == 4

    # * Nodo 'inicio' en estado 'completado'.
    nodo_inicio = nodos[0]
    assert nodo_inicio["id"] == "inicio"
    assert nodo_inicio["tipo"] == "inicio"
    assert nodo_inicio["estado"] == "completado"

    # * Primer tarea en estado 'completado' con su lista de ingredientes_consumidos.
    nodo_t1 = nodos[1]
    assert nodo_t1["id"] == f"tarea_{item1.id}"
    assert nodo_t1["tipo"] == "tarea"
    assert nodo_t1["estado"] == "completado"
    assert len(nodo_t1["detalle"]["ingredientes_consumidos"]) == 1
    assert nodo_t1["detalle"]["ingredientes_consumidos"][0]["ingrediente_nombre"] == e["ingrediente"].nombre
    assert float(nodo_t1["detalle"]["ingredientes_consumidos"][0]["cantidad"]) == 100.0

    # * Segunda tarea en estado 'en_proceso'.
    item2 = lote.checklist[1]
    nodo_t2 = nodos[2]
    assert nodo_t2["id"] == f"tarea_{item2.id}"
    assert nodo_t2["tipo"] == "tarea"
    assert nodo_t2["estado"] == "en_proceso"

    # * Nodo 'cierre' en estado 'pendiente'.
    nodo_cierre = nodos[3]
    assert nodo_cierre["id"] == "cierre"
    assert nodo_cierre["tipo"] == "cierre"
    assert nodo_cierre["estado"] == "pendiente"


def test_obtener_timeline_lote_con_desperdicio_marca_desvio(auth_client, db_session):
    client, operario = auth_client
    e = _crear_escenario_dos_tareas(db_session, operario)
    db = db_session
    lote = e["lote"]

    item1 = lote.checklist[0]
    db.info["sin_auditoria"] = True
    try:
        desp = ConsumoInsumo(
            checklist_produccion_id=item1.id,
            lote_insumo_id=e["lote_insumo"].id,
            cantidad=Decimal("2.5"),
            tipo=TIPO_CONSUMO_DESPERDICIO,
            motivo="Materia prima derramada durante el mezclado",
            registrado_por_id=operario.id,
        )
        db.add(desp)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    res = client.get(f"/lotes/{lote.id}/timeline")
    assert res.status_code == 200

    data = res.json()
    nodo_t1 = next(n for n in data["nodos"] if n["id"] == f"tarea_{item1.id}")
    assert nodo_t1["tiene_desvio"] is True
    assert len(nodo_t1["detalle"]["desperdicios"]) == 1
    desperdicio = nodo_t1["detalle"]["desperdicios"][0]
    assert desperdicio["motivo"] == "Materia prima derramada durante el mezclado"
    assert float(desperdicio["cantidad"]) == 2.5


def test_obtener_timeline_lote_terminado_calcula_rendimiento(auth_client, db_session):
    client, operario = auth_client
    e = _crear_escenario_dos_tareas(db_session, operario, cantidad_objetivo=Decimal("100"))
    db = db_session
    lote = e["lote"]

    # Completar todas las tareas del checklist
    for item in lote.checklist:
        completar_tarea(db, lote.id, item.id, operario)

    # Cerrar lote (estado 'terminado', cantidad_objetivo=100, cantidad_producida=95)
    services.cerrar_lote(
        db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("95"))
    )

    res = client.get(f"/lotes/{lote.id}/timeline")
    assert res.status_code == 200

    data = res.json()
    nodo_cierre = next(n for n in data["nodos"] if n["id"] == "cierre")
    assert nodo_cierre["estado"] == "completado"

    rendimiento = nodo_cierre["detalle"]["rendimiento"]
    assert rendimiento is not None
    assert float(rendimiento["cantidad_objetivo"]) == 100.0
    assert float(rendimiento["cantidad_producida"]) == 95.0
    assert float(rendimiento["porcentaje_rendimiento"]) == 95.00
