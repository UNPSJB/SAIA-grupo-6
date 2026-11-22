"""Ayudas para los tests de producción.

Una tarea del checklist solo se completa cuando el consumo real de cada
ingrediente llega a lo que pide la receta. Los tests que no prueban los
consumos usan estas funciones para registrar justo lo planificado.
"""

from sqlalchemy import select

from src.lotes import services
from src.lotes.constants import TIPO_CONSUMO_REAL
from src.lotes.models import ConsumoInsumo
from src.lotesInsumo.models import LoteInsumo


def registrar_lo_planificado(db, lote_id, item_id, usuario):
    """Registra el consumo real que le falta a la tarea, del primer lote de cada ingrediente."""
    lote = services.obtener_lote(db, lote_id)
    item = next(i for i in lote.checklist if i.id == item_id)
    for planificado in services._planificados_del_item(db, lote, item):
        falta = planificado.cantidad_planificada - planificado.consumo_real
        if falta <= 0:
            continue
        lote_insumo = db.scalar(
            select(LoteInsumo)
            .where(LoteInsumo.ingrediente_id == planificado.ingrediente_id, LoteInsumo.activo.is_(True))
            .order_by(LoteInsumo.id)
        )
        assert lote_insumo is not None, f"No hay lotes de {planificado.ingrediente_nombre} para consumir"
        db.add(
            ConsumoInsumo(
                checklist_produccion_id=item.id,
                lote_insumo_id=lote_insumo.id,
                cantidad=falta,
                tipo=TIPO_CONSUMO_REAL,
                registrado_por_id=usuario.id,
            )
        )
    db.commit()
    db.expire_all()


def completar_tarea(db, lote_id, item_id, usuario):
    """Registra lo planificado que falte y completa la tarea."""
    registrar_lo_planificado(db, lote_id, item_id, usuario)
    return services.completar_item(db, lote_id, item_id, usuario)


def _version_minima(db, lote):
    """Receta de un ingrediente para el producto del lote, asignada al lote."""
    from src.ingredientes.models import Ingrediente
    from src.productos.models import Producto
    from src.recetas.models import Receta, RecetaIngrediente, VersionReceta

    producto = db.get(Producto, lote.producto_id)
    receta = db.scalar(select(Receta).where(Receta.producto_id == producto.id))
    if receta is None:
        receta = Receta(producto_id=producto.id)
        db.add(receta)
    ingrediente = Ingrediente(
        nombre=f"Ingrediente del lote {lote.id}", unidad_medida_id=producto.unidad_medida_id
    )
    version = VersionReceta(
        receta=receta, numero=1, rendimiento=1, unidad_medida_id=producto.unidad_medida_id
    )
    version.ingredientes = [
        RecetaIngrediente(
            ingrediente=ingrediente, cantidad=1, unidad_medida_id=producto.unidad_medida_id
        )
    ]
    db.add(version)
    db.flush()
    # UPDATE de Core: el lote puede estar cerrado y el ORM no deja tocarlo.
    from sqlalchemy import update

    from src.lotes.models import LoteProducto

    db.execute(
        update(LoteProducto).where(LoteProducto.id == lote.id).values(version_receta_id=version.id)
    )
    db.refresh(lote)
    return version


def rotular_lote(db, lote):
    """Borrador de rotulado completo vinculado al lote (sin él, el lote no se vende).

    Completo incluye las declaraciones de alérgenos, gluten y conservación
    confirmadas: los ingredientes de la receta quedan evaluados, el producto
    con su conservación y la revisión de las declaraciones, confirmada.
    """
    from datetime import date, timedelta

    from src.common.fechas import ahora
    from src.productos.models import Producto
    from src.recetas.models import VersionReceta
    from src.rotulado import declaraciones_services
    from src.rotulado.models import BorradorRotulado, RevisionDeclaracionRotulado

    cierre = (lote.fecha_cierre or lote.fecha_inicio).date()
    db.info["sin_auditoria"] = True
    try:
        version = db.get(VersionReceta, lote.version_receta_id) if lote.version_receta_id else None
        if version is None:
            # En la app todo lote sale de una receta; sin una, la declaración
            # de alérgenos no se puede confirmar.
            version = _version_minima(db, lote)
        for linea in version.ingredientes:
            if linea.ingrediente.evaluacion_alergenos != "evaluada":
                linea.ingrediente.evaluacion_alergenos = "evaluada"
                linea.ingrediente.gluten = "ausencia_declarada"
        producto = db.get(Producto, lote.producto_id)
        if not producto.conservacion:
            producto.conservacion = {"instrucciones": "Conservar en lugar fresco y seco."}
        borrador = BorradorRotulado(
            producto_id=lote.producto_id,
            version_receta_id=lote.version_receta_id,
            lote_producto_id=lote.id,
            denominacion_venta="Producto de prueba",
            lista_ingredientes="Ingredientes de prueba",
            contenido_neto="500 g",
            rnpa_rppa="RNPA 07-123456",
            razon_social="Alimentos de Prueba S.A.",
            domicilio="Calle Falsa 123",
            identificacion_lote=lote.numero_lote,
            fecha_produccion=lote.fecha_inicio.date() if lote.fecha_inicio else date.today(),
            fecha_cierre=cierre,
            fecha_duracion=lote.fecha_vencimiento or cierre + timedelta(days=180),
            instrucciones_uso="Conservar en lugar fresco y seco.",
        )
        db.add(borrador)
        db.flush()
        contenido = declaraciones_services.generar_propuesta_declaraciones(
            db, borrador.producto_id, borrador.version_receta_id, borrador.lote_producto_id,
            borrador.lista_ingredientes,
        )
        db.add(
            RevisionDeclaracionRotulado(
                borrador_id=borrador.id,
                numero=1,
                contenido=contenido,
                huella_origen=contenido["huella_origen"],
                confirmado_en=ahora(),
            )
        )
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

