from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.lotes import services as lotes_services
from src.lotes.constants import TIPO_CONSUMO_DESPERDICIO, TIPO_CONSUMO_REAL
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo import services as lotes_insumo_services
from src.lotesInsumo.models import LoteInsumo
from src.personal.models import Personal
from src.productos.models import Producto
from src.salidas.constants import ESTADO_CANCELADO, ESTADO_ENTREGADO
from src.salidas.models import Salida
from src.trazabilidad import schemas

_MILESIMA = Decimal("0.001")
CERO = Decimal("0.000")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_MILESIMA)


def _usuario(db: Session, usuario_id: int | None) -> schemas.UsuarioResumen | None:
    if usuario_id is None:
        return None
    persona = db.get(Personal, usuario_id)
    if persona is None:
        return None
    nombre = f"{persona.nombre} {persona.apellido or ''}".strip()
    return schemas.UsuarioResumen(id=persona.id, nombre=nombre)


def _lote_insumo_traza(lote: LoteInsumo) -> schemas.LoteInsumoTraza:
    return schemas.LoteInsumoTraza(
        id=lote.id,
        ingrediente_id=lote.ingrediente_id,
        ingrediente_nombre=lote.ingrediente.nombre,
        insumo_id=lote.insumo_id,
        insumo_nombre=lote.insumo.nombre,
        numero_lote=lote.numero_lote,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_vencimiento=lote.fecha_vencimiento,
        activo=lote.activo,
        proveedor=schemas.ProveedorTraza(
            id=lote.proveedor.id,
            nombre=lote.proveedor.nombre,
            matricula=lote.proveedor.matricula,
        ),
    )


def trazar_lote_producto(db: Session, lote_id: int) -> schemas.TrazabilidadLoteProducto:
    """Hacia atrás: receta y versión, quién lo elaboró, tareas, consumos, lotes de insumo y proveedores."""
    lote = lotes_services.obtener_lote(db, lote_id)
    detalle = lotes_services.detalle(db, lote)
    planificado_por_item = {item.id: item.ingredientes for item in detalle.checklist}

    receta = None
    version = lote.version_receta
    if version is not None:
        receta = schemas.RecetaTraza(
            receta_id=version.receta_id,
            version_id=version.id,
            version_numero=version.numero,
            rendimiento=version.rendimiento,
            unidad=version.unidad_medida.simbolo,
            creada_en=version.creado_en,
            creada_por=_usuario(db, version.creado_por_id),
        )

    tareas = []
    lotes_insumo: dict[int, schemas.LoteInsumoTraza] = {}
    for item in sorted(lote.checklist, key=lambda i: i.tarea.orden):
        consumos = []
        for consumo in item.consumos:
            traza = _lote_insumo_traza(consumo.lote_insumo)
            lotes_insumo.setdefault(traza.id, traza)
            consumos.append(
                schemas.ConsumoTraza(
                    id=consumo.id,
                    tipo=consumo.tipo,
                    cantidad=_q(consumo.cantidad),
                    unidad=consumo.lote_insumo.ingrediente.unidad_medida.simbolo,
                    motivo=consumo.motivo,
                    registrado_por=_usuario(db, consumo.registrado_por_id),
                    registrado_en=consumo.registrado_en,
                    lote_insumo=traza,
                )
            )
        tareas.append(
            schemas.TareaTraza(
                item_id=item.id,
                orden=item.tarea.orden,
                descripcion=item.tarea.descripcion,
                completado_por=_usuario(db, item.completado_por_id),
                completado_en=item.completado_en,
                planificado=planificado_por_item[item.id],
                consumos=consumos,
            )
        )

    proveedores: dict[int, schemas.ProveedorTraza] = {}
    for traza in lotes_insumo.values():
        proveedores.setdefault(traza.proveedor.id, traza.proveedor)

    return schemas.TrazabilidadLoteProducto(
        lote=lotes_services.resumen(lote),
        elaborado_por=_usuario(db, lote.creado_por_id),
        receta=receta,
        tareas=tareas,
        lotes_insumo=list(lotes_insumo.values()),
        proveedores=list(proveedores.values()),
    )


def trazar_lote_insumo(db: Session, lote_insumo_id: int) -> schemas.TrazabilidadLoteInsumo:
    """Hacia adelante: lotes de producto (de cualquier estado) que consumieron ese lote de insumo."""
    lote_insumo = lotes_insumo_services.obtener_lote_insumo(db, lote_insumo_id)

    filas = db.execute(
        select(LoteProducto, ConsumoInsumo.tipo, ConsumoInsumo.cantidad)
        .join(ChecklistProduccion, ChecklistProduccion.lote_producto_id == LoteProducto.id)
        .join(ConsumoInsumo, ConsumoInsumo.checklist_produccion_id == ChecklistProduccion.id)
        .where(ConsumoInsumo.lote_insumo_id == lote_insumo_id)
        .options(selectinload(LoteProducto.producto).selectinload(Producto.unidad_medida))
        .order_by(LoteProducto.fecha_inicio, LoteProducto.id)
    ).all()

    acumulado: dict[int, dict] = {}
    totales = defaultdict(lambda: {TIPO_CONSUMO_REAL: CERO, TIPO_CONSUMO_DESPERDICIO: CERO})
    for lote, tipo, cantidad in filas:
        acumulado.setdefault(lote.id, lote)
        totales[lote.id][tipo] += _q(cantidad)

    lotes_producto = [
        schemas.LoteProductoUsoIngrediente(
            lote_producto_id=lote.id,
            numero_lote=lote.numero_lote,
            producto_id=lote.producto_id,
            producto_nombre=lote.producto.nombre,
            estado=lote.estado,
            fecha_inicio=lote.fecha_inicio,
            unidad=lote.producto.unidad_medida.simbolo,
            cantidad_objetivo=lote.cantidad_objetivo,
            factor_escala=lote.factor_escala,
            cantidad_producida=lote.cantidad_producida,
            consumo_real=totales[lote.id][TIPO_CONSUMO_REAL],
            desperdicio=totales[lote.id][TIPO_CONSUMO_DESPERDICIO],
        )
        for lote in acumulado.values()
    ]
    return schemas.TrazabilidadLoteInsumo(
        lote_insumo=_lote_insumo_traza(lote_insumo),
        cantidad_recibida=_q(lote_insumo.cantidad_recibida),
        saldo=lotes_insumo_services.saldo_lote_insumo(db, lote_insumo),
        lotes_producto=lotes_producto,
    )


def obtener_grafo_trazabilidad_lote(
    db: Session, lote_id: int
) -> schemas.GrafoTrazabilidadResponse:
    """Construye el grafo/árbol de trazabilidad bidireccional (extremo a extremo)."""
    lote = lotes_services.obtener_lote(db, lote_id)

    # Ingredientes consumidos y sus proveedores
    proveedores_map: dict[int, Any] = {}
    lotes_insumo_map: dict[int, Any] = {}
    consumo_por_lote_insumo: dict[int, Decimal] = defaultdict(lambda: CERO)
    unidad_por_lote_insumo: dict[int, str] = {}

    for item in lote.checklist:
        for c in item.consumos:
            li = c.lote_insumo
            lotes_insumo_map[li.id] = li
            prov = li.proveedor
            proveedores_map[prov.id] = prov
            consumo_por_lote_insumo[li.id] += _q(c.cantidad)
            unidad_por_lote_insumo[li.id] = (
                li.ingrediente.unidad_medida.simbolo
                if li.ingrediente and li.ingrediente.unidad_medida
                else ""
            )

    nodos: list[schemas.NodoGrafo] = []
    conexiones: list[schemas.ConexionGrafo] = []

    # A. COLUMNA 1 - PROVEEDORES
    for p in proveedores_map.values():
        nodos.append(
            schemas.NodoGrafo(
                id=f"prov_{p.id}",
                columna="proveedor",
                tipo="proveedor",
                titulo=p.nombre,
                subtitulo=f"Matrícula: {p.matricula}" if getattr(p, "matricula", None) else None,
                # Los proveedores no se homologan (se homologan las marcas):
                # se informa si tiene certificación requerida y si sigue activo.
                badge="Certificado" if p.es_certificado else None,
                tono_badge="ok" if p.es_certificado else "neutro",
                metadatos={
                    "id": p.id,
                    "nombre": p.nombre,
                    "matricula": getattr(p, "matricula", None),
                    "cuit": getattr(p, "cuit", None),
                    "es_certificado": bool(p.es_certificado),
                    "activo": bool(p.activo),
                },
            )
        )

    # B. COLUMNA 2 - LOTES DE INSUMO
    for li_id, li in lotes_insumo_map.items():
        vence_str = (
            li.fecha_vencimiento.strftime("%d/%m/%Y")
            if getattr(li, "fecha_vencimiento", None)
            else None
        )
        nodos.append(
            schemas.NodoGrafo(
                id=f"ins_{li.id}",
                columna="insumo",
                tipo="materia_prima",
                titulo=li.ingrediente.nombre if li.ingrediente else f"Ingrediente #{li.ingrediente_id}",
                subtitulo=f"{li.insumo.nombre} · Lote: {li.numero_lote}" if li.insumo else f"Lote: {li.numero_lote}",
                badge=f"Vence {vence_str}" if vence_str else None,
                tono_badge="info" if vence_str else "neutro",
                metadatos={
                    "lote_insumo_id": li.id,
                    "numero_lote": li.numero_lote,
                    "marca": li.insumo.nombre if li.insumo else None,
                    "fecha_ingreso": str(li.fecha_ingreso) if getattr(li, "fecha_ingreso", None) else None,
                    "vence": str(li.fecha_vencimiento) if getattr(li, "fecha_vencimiento", None) else None,
                    "cantidad_usada": str(consumo_por_lote_insumo[li.id]),
                },
            )
        )
        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_prov{li.proveedor_id}_ins{li.id}",
                origen_id=f"prov_{li.proveedor_id}",
                destino_id=f"ins_{li.id}",
            )
        )

    # C. COLUMNA 3 - NODO CENTRAL (LOTE DE PRODUCTO)
    receta_sub = (
        f"Receta v{lote.version_receta.numero}"
        if lote.version_receta
        else "Receta v1"
    )
    badge_lote = lote.estado.replace("_", " ").capitalize() if lote.estado else "En proceso"
    nodos.append(
        schemas.NodoGrafo(
            id=f"lote_{lote.id}",
            columna="lote_producto",
            tipo="lote_elaboracion",
            titulo=f"{lote.producto.nombre if lote.producto else 'Producto'} - Lote {lote.numero_lote}",
            subtitulo=receta_sub,
            badge=badge_lote,
            tono_badge="ok" if lote.estado == "terminado" else ("peligro" if lote.estado == "cancelado" else "info"),
            metadatos={
                "producido": str(lote.cantidad_producida or lote.cantidad_objetivo or 0),
                "inicio": str(lote.fecha_inicio) if lote.fecha_inicio else None,
                "vencimiento": str(lote.fecha_vencimiento) if lote.fecha_vencimiento else None,
                "version_receta": lote.version_receta.numero if lote.version_receta else None,
                "operario": f"{lote.creado_por.nombre} {lote.creado_por.apellido or ''}".strip() if lote.creado_por else None,
            },
        )
    )

    for li_id, li in lotes_insumo_map.items():
        cant = consumo_por_lote_insumo[li_id]
        unidad = unidad_por_lote_insumo.get(li_id, "")
        etiqueta = f"{cant} {unidad}".strip()
        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_ins{li.id}_lote{lote.id}",
                origen_id=f"ins_{li.id}",
                destino_id=f"lote_{lote.id}",
                etiqueta=etiqueta,
            )
        )

    # D. COLUMNA 4 - DESPACHO / TRANSPORTE (Salidas) & E. COLUMNA 5 - CLIENTES
    salidas_validas = [s for s in (lote.salidas or []) if s.estado != ESTADO_CANCELADO]
    clientes_agregados: set[int] = set()

    for s in salidas_validas:
        transportista_nombre = s.transportista.razon_social if (s.transportista and hasattr(s.transportista, "razon_social")) else (
            getattr(s.transportista, "nombre", None) if s.transportista else None
        )
        subtitulo_salida = transportista_nombre if transportista_nombre else "Retira cliente"

        certificaciones_transportista = []
        if hasattr(s, "certificaciones") and s.certificaciones:
            for sc in s.certificaciones:
                if hasattr(sc, "certificacion") and sc.certificacion:
                    certificaciones_transportista.append(sc.certificacion.numero)

        nodos.append(
            schemas.NodoGrafo(
                id=f"salida_{s.id}",
                columna="despacho",
                tipo="transporte",
                titulo=f"Salida #{s.id} ({s.forma_entrega or 'Despacho'})",
                subtitulo=subtitulo_salida,
                badge=s.estado,
                tono_badge="ok" if s.estado == ESTADO_ENTREGADO else ("info" if s.estado == "DESPACHADO" else "neutro"),
                metadatos={
                    "salida_id": s.id,
                    "cantidad": str(s.cantidad),
                    "fecha_despacho": str(s.fecha_despacho) if s.fecha_despacho else None,
                    "transportista": transportista_nombre,
                    "certificaciones_transportista": certificaciones_transportista,
                },
            )
        )

        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_lote{lote.id}_salida{s.id}",
                origen_id=f"lote_{lote.id}",
                destino_id=f"salida_{s.id}",
                etiqueta=f"{s.cantidad} u",
                cliente_id=s.cliente_id,
            )
        )

        # E. COLUMNA 5 - CLIENTE
        if s.cliente and s.cliente_id not in clientes_agregados:
            clientes_agregados.add(s.cliente_id)
            c = s.cliente
            cuit_doc = getattr(c, "documento", None) or getattr(c, "cuit", None) or "Consumidor Final"
            nodos.append(
                schemas.NodoGrafo(
                    id=f"cli_{c.id}",
                    columna="cliente",
                    tipo="cliente",
                    titulo=c.nombre,
                    subtitulo=f"CUIT: {cuit_doc}",
                    badge="Entrega Conforme" if s.estado == ESTADO_ENTREGADO else s.estado,
                    tono_badge="ok" if s.estado == ESTADO_ENTREGADO else "neutro",
                    metadatos={
                        "cliente_id": c.id,
                        "nombre": c.nombre,
                        "direccion": getattr(c, "domicilio", "") or getattr(c, "direccion", ""),
                        "cuit": cuit_doc,
                        "fecha_entrega": str(s.fecha_entrega) if s.fecha_entrega else None,
                        "recibido_por": s.recibido_por,
                        "estado_salida": s.estado,
                    },
                )
            )

        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_salida{s.id}_cli{s.cliente_id}",
                origen_id=f"salida_{s.id}",
                destino_id=f"cli_{s.cliente_id}",
                cliente_id=s.cliente_id,
            )
        )

    return schemas.GrafoTrazabilidadResponse(
        lote_id=lote.id,
        numero_lote=lote.numero_lote,
        producto_nombre=lote.producto.nombre if lote.producto else "",
        estado_lote=lote.estado,
        nodos=nodos,
        conexiones=conexiones,
    )

