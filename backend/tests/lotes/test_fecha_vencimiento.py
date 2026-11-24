"""Tests para cálculo automático de fecha_vencimiento al cerrar lotes de producción."""

from datetime import date, timedelta
from decimal import Decimal

from src.lotes import schemas, services
from src.lotes.constants import ESTADO_TERMINADO
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, VersionReceta
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


_contador = 0


def _usuario(db):
    global _contador
    _contador += 1
    persona = Personal(
        nombre="Operador",
        apellido="Test",
        dni=f"1000{_contador:04d}",
        email=f"op_{_contador}@test.local",
        password="x",
        puede_operar=True,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(persona)
        db.commit()
        db.refresh(persona)
    finally:
        db.info.pop("sin_auditoria", None)
    return persona


def _escenario(db, vida_util_dias=7):
    """Producto con receta vigente + un lote creado y checklist completo."""
    db.info["sin_auditoria"] = True
    try:
        kg = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa")
        producto = Producto(nombre=f"Pan test {vida_util_dias}", unidad_medida=kg)
        receta = Receta(producto=producto, activo=True)
        version = VersionReceta(
            receta=receta,
            numero=1,
            rendimiento=Decimal("10"),
            unidad_medida=kg,
            vida_util_dias=vida_util_dias,
        )
        db.add_all([kg, producto, receta, version])
        db.commit()
        db.refresh(producto)
        db.refresh(version)

        lote = services.crear_lote(
            db,
            schemas.LoteCreate(
                producto_id=producto.id, cantidad_objetivo=Decimal("40")
            ),
        )
        # Completar checklist para poder cerrar.
        operador = _usuario(db)
        for item in lote.checklist:
            services.completar_item(db, lote.id, item.id, operador)

        return {"db": db, "producto": producto, "version": version, "receta": receta, "lote": lote, "kg": kg}
    finally:
        db.info.pop("sin_auditoria", None)


def test_cerrar_lote_calcula_fecha_vencimiento_desde_version_receta(db_session):
    db = db_session
    e = _escenario(db, vida_util_dias=7)
    lote_id = e["lote"].id

    cerrado = services.cerrar_lote(
        db, lote_id, schemas.LoteCierre(cantidad_producida=Decimal("40"))
    )

    assert cerrado.estado == ESTADO_TERMINADO
    assert cerrado.fecha_cierre is not None
    esperado = cerrado.fecha_cierre.date() + timedelta(days=7)
    assert cerrado.fecha_vencimiento == esperado


def test_cerrar_lote_sin_vida_util_en_receta_deja_vencimiento_none(db_session):
    db = db_session
    e = _escenario(db, vida_util_dias=None)
    lote_id = e["lote"].id

    cerrado = services.cerrar_lote(
        db, lote_id, schemas.LoteCierre(cantidad_producida=Decimal("40"))
    )

    assert cerrado.estado == ESTADO_TERMINADO
    assert cerrado.fecha_vencimiento is None


def test_cerrar_lote_sin_vida_util_guarda_vencimiento_cargado_a_mano(db_session):
    db = db_session
    e = _escenario(db, vida_util_dias=None)
    vence = date.today() + timedelta(days=30)

    cerrado = services.cerrar_lote(
        db,
        e["lote"].id,
        schemas.LoteCierre(cantidad_producida=Decimal("40"), fecha_vencimiento=vence),
    )

    assert cerrado.fecha_vencimiento == vence


def test_cerrar_lote_rechaza_vencimiento_anterior_al_cierre(db_session):
    import pytest

    from src.lotes import exceptions

    db = db_session
    e = _escenario(db, vida_util_dias=None)

    with pytest.raises(exceptions.VencimientoAnteriorAlCierre):
        services.cerrar_lote(
            db,
            e["lote"].id,
            schemas.LoteCierre(
                cantidad_producida=Decimal("40"),
                fecha_vencimiento=date.today() - timedelta(days=1),
            ),
        )


def test_resumen_y_detalle_lote_exponen_vida_util_dias(db_session):
    db = db_session
    e = _escenario(db, vida_util_dias=14)
    lote = e["lote"]

    resumen = services.resumen(lote, db)
    assert resumen.vida_util_dias == 14

    detalle = services.detalle(db, lote)
    assert detalle.vida_util_dias == 14


def test_nueva_version_con_distinta_vida_util_conserva_lotes_anteriores(db_session):
    db = db_session
    e = _escenario(db, vida_util_dias=10)
    lote1 = e["lote"]

    # Cerrar lote 1 elaborado con versión 1 (vida útil = 10)
    cerrado1 = services.cerrar_lote(
        db, lote1.id, schemas.LoteCierre(cantidad_producida=Decimal("40"))
    )
    esperado1 = cerrado1.fecha_cierre.date() + timedelta(days=10)
    assert cerrado1.fecha_vencimiento == esperado1

    # Crear versión 2 con vida útil = 30
    db.info["sin_auditoria"] = True
    try:
        v2 = VersionReceta(
            receta=e["receta"],
            numero=2,
            rendimiento=Decimal("10"),
            unidad_medida=e["kg"],
            vida_util_dias=30,
        )
        db.add(v2)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    # Crear lote 2 (usará versión vigente = 2)
    lote2 = services.crear_lote(
        db,
        schemas.LoteCreate(
            producto_id=e["producto"].id, cantidad_objetivo=Decimal("20")
        ),
    )
    operador = _usuario(db)
    for item in lote2.checklist:
        services.completar_item(db, lote2.id, item.id, operador)

    cerrado2 = services.cerrar_lote(
        db, lote2.id, schemas.LoteCierre(cantidad_producida=Decimal("20"))
    )
    esperado2 = cerrado2.fecha_cierre.date() + timedelta(days=30)
    assert cerrado2.fecha_vencimiento == esperado2

    # El lote 1 sigue intacto con su fecha original de vencimiento
    db.refresh(cerrado1)
    assert cerrado1.fecha_vencimiento == esperado1
