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
from src.salidas.constants import (
    ESTADO_CANCELADO,
    ESTADO_DESPACHADO,
    ESTADO_ENTREGADO,
    ESTADO_RECHAZADA,
)
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
        unidad=lote_insumo.ingrediente.unidad_medida.simbolo,
        lotes_producto=lotes_producto,
    )


def _fecha(valor) -> str | None:
    return valor.isoformat() if valor else None


def _nombre_persona(persona) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _tono_salida(estado: str) -> str:
    if estado == ESTADO_ENTREGADO:
        return "ok"
    if estado == ESTADO_RECHAZADA:
        return "peligro"
    if estado == ESTADO_DESPACHADO:
        return "info"
    return "neutro"


def obtener_grafo_trazabilidad_lote(
    db: Session, lote_id: int
) -> schemas.GrafoTrazabilidadResponse:
    """Grafo de trazabilidad del lote, de punta a punta.

    proveedor -> lote de insumo -> lote de producto -> salida -> cliente.
    Cada lote de insumo informa en qué etapas del checklist se consumió
    (`checklist_items`), para que el grafo lo conecte con el paso correcto.
    """
    lote = lotes_services.obtener_lote(db, lote_id)
    unidad_producto = (
        lote.producto.unidad_medida.simbolo
        if lote.producto and lote.producto.unidad_medida
        else ""
    )

    proveedores_map: dict[int, Any] = {}
    lotes_insumo_map: dict[int, LoteInsumo] = {}
    usado: dict[int, Decimal] = defaultdict(lambda: CERO)
    desperdicio: dict[int, Decimal] = defaultdict(lambda: CERO)
    items_por_lote_insumo: dict[int, list[int]] = defaultdict(list)

    for item in sorted(lote.checklist, key=lambda i: i.tarea.orden):
        for c in item.consumos:
            li = c.lote_insumo
            lotes_insumo_map[li.id] = li
            proveedores_map[li.proveedor.id] = li.proveedor
            if c.tipo == TIPO_CONSUMO_DESPERDICIO:
                desperdicio[li.id] += _q(c.cantidad)
            else:
                usado[li.id] += _q(c.cantidad)
            if item.id not in items_por_lote_insumo[li.id]:
                items_por_lote_insumo[li.id].append(item.id)

    nodos: list[schemas.NodoGrafo] = []
    conexiones: list[schemas.ConexionGrafo] = []

    # Proveedores
    for p in proveedores_map.values():
        nodos.append(
            schemas.NodoGrafo(
                id=f"prov_{p.id}",
                columna="proveedor",
                tipo="proveedor",
                titulo=p.nombre,
                subtitulo=f"Matrícula: {p.matricula}" if p.matricula else None,
                # Los proveedores no se homologan (se homologan las marcas):
                # se informa si tiene certificación requerida y si sigue activo.
                badge="Certificado" if p.es_certificado else None,
                tono_badge="ok" if p.es_certificado else "neutro",
                metadatos={
                    "id": p.id,
                    "nombre": p.nombre,
                    "matricula": p.matricula,
                    "cuit": getattr(p, "cuit", None),
                    "es_certificado": bool(p.es_certificado),
                    "activo": bool(p.activo),
                },
            )
        )

    # Lotes de insumo, con lo que salió de cada uno hacia este lote
    for li in lotes_insumo_map.values():
        unidad = li.ingrediente.unidad_medida.simbolo if li.ingrediente.unidad_medida else ""
        total = usado[li.id] + desperdicio[li.id]
        vence = li.fecha_vencimiento
        nodos.append(
            schemas.NodoGrafo(
                id=f"ins_{li.id}",
                columna="insumo",
                tipo="materia_prima",
                titulo=li.ingrediente.nombre,
                subtitulo=f"{li.insumo.nombre} · Lote: {li.numero_lote}",
                badge=f"Vence {vence.strftime('%d/%m/%Y')}" if vence else None,
                tono_badge="info" if vence else "neutro",
                metadatos={
                    "lote_insumo_id": li.id,
                    "numero_lote": li.numero_lote,
                    "marca": li.insumo.nombre,
                    "fecha_ingreso": _fecha(li.fecha_ingreso),
                    "vence": _fecha(vence),
                    "cantidad_usada": str(usado[li.id]),
                    "cantidad_desperdicio": str(desperdicio[li.id]),
                    "unidad": unidad,
                    "checklist_items": items_por_lote_insumo[li.id],
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
        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_ins{li.id}_lote{lote.id}",
                origen_id=f"ins_{li.id}",
                destino_id=f"lote_{lote.id}",
                etiqueta=f"{total} {unidad}".strip(),
            )
        )

    # Lote de producto
    version = lote.version_receta
    nodos.append(
        schemas.NodoGrafo(
            id=f"lote_{lote.id}",
            columna="lote_producto",
            tipo="lote_elaboracion",
            titulo=f"{lote.producto.nombre} - Lote {lote.numero_lote}",
            subtitulo=f"Receta v{version.numero}" if version else None,
            badge=lote.estado.replace("_", " ").capitalize(),
            tono_badge="ok" if lote.estado == "terminado" else ("peligro" if lote.estado == "cancelado" else "info"),
            metadatos={
                # Sin cantidad producida el lote no cerró: el objetivo no se informa como producido.
                "producido": str(lote.cantidad_producida) if lote.cantidad_producida is not None else None,
                "objetivo": str(lote.cantidad_objetivo) if lote.cantidad_objetivo is not None else None,
                "unidad": unidad_producto,
                "inicio": _fecha(lote.fecha_inicio),
                "vencimiento": _fecha(lote.fecha_vencimiento),
                "version_receta": version.numero if version else None,
                "operario": _nombre_persona(lote.creado_por),
            },
        )
    )

    # Salidas (sin las canceladas) y clientes
    clientes_agregados: set[int] = set()
    for s in lote.salidas or []:
        if s.estado == ESTADO_CANCELADO:
            continue
        transportista = s.transportista.razon_social if s.transportista else None
        certificaciones = [
            sc.certificacion.numero
            for sc in (getattr(s, "certificaciones", None) or [])
            if getattr(sc, "certificacion", None)
        ]
        nodos.append(
            schemas.NodoGrafo(
                id=f"salida_{s.id}",
                columna="despacho",
                tipo="transporte",
                titulo=f"Salida #{s.id}",
                subtitulo=transportista or "Retira el cliente",
                badge=s.estado,
                tono_badge=_tono_salida(s.estado),
                metadatos={
                    "salida_id": s.id,
                    "cantidad": str(s.cantidad),
                    "unidad": unidad_producto,
                    "forma_entrega": s.forma_entrega,
                    "fecha_reserva": _fecha(s.fecha_reserva),
                    "fecha_despacho": _fecha(s.fecha_despacho),
                    "fecha_entrega": _fecha(s.fecha_entrega),
                    "recibido_por": s.recibido_por,
                    "transportista": transportista,
                    "certificaciones_transportista": certificaciones,
                    "estado_salida": s.estado,
                    "cliente_id": s.cliente_id,
                },
            )
        )
        conexiones.append(
            schemas.ConexionGrafo(
                id=f"c_lote{lote.id}_salida{s.id}",
                origen_id=f"lote_{lote.id}",
                destino_id=f"salida_{s.id}",
                etiqueta=f"{s.cantidad} {unidad_producto}".strip(),
                cliente_id=s.cliente_id,
            )
        )

        if s.cliente is None:
            continue
        if s.cliente_id not in clientes_agregados:
            clientes_agregados.add(s.cliente_id)
            c = s.cliente
            # Un cliente puede recibir varias salidas del lote: el estado de
            # cada entrega queda en su salida, no en el cliente.
            nodos.append(
                schemas.NodoGrafo(
                    id=f"cli_{c.id}",
                    columna="cliente",
                    tipo="cliente",
                    titulo=c.nombre,
                    subtitulo=f"CUIT/DNI: {c.documento}" if c.documento else None,
                    metadatos={
                        "cliente_id": c.id,
                        "nombre": c.nombre,
                        "documento": c.documento,
                        "direccion": c.domicilio,
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
        producto_nombre=lote.producto.nombre,
        estado_lote=lote.estado,
        nodos=nodos,
        conexiones=conexiones,
    )
