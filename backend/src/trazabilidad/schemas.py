from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from src.lotes.schemas import InsumoPlanificado, LoteResumen


class UsuarioResumen(BaseModel):
    id: int
    nombre: str


class ProveedorTraza(BaseModel):
    id: int
    nombre: str
    matricula: str


class LoteInsumoTraza(BaseModel):
    id: int
    insumo_id: int
    insumo_nombre: str
    numero_lote: str
    fecha_ingreso: date
    fecha_vencimiento: date | None
    activo: bool
    proveedor: ProveedorTraza


class ConsumoTraza(BaseModel):
    id: int
    tipo: str
    cantidad: Decimal
    unidad: str
    motivo: str | None
    registrado_por: UsuarioResumen | None
    registrado_en: datetime
    lote_insumo: LoteInsumoTraza


class TareaTraza(BaseModel):
    item_id: int
    orden: int
    descripcion: str
    completado_por: UsuarioResumen | None
    completado_en: datetime | None
    planificado: list[InsumoPlanificado]
    consumos: list[ConsumoTraza]


class RecetaTraza(BaseModel):
    receta_id: int
    version_id: int
    version_numero: int
    rendimiento: Decimal
    unidad: str
    creada_en: datetime
    creada_por: UsuarioResumen | None


class TrazabilidadLoteProducto(BaseModel):
    """Hacia atrás: del lote producido hasta el proveedor de cada insumo."""

    lote: LoteResumen
    elaborado_por: UsuarioResumen | None
    receta: RecetaTraza | None
    tareas: list[TareaTraza]
    lotes_insumo: list[LoteInsumoTraza]
    proveedores: list[ProveedorTraza]


class LoteProductoUsoInsumo(BaseModel):
    lote_producto_id: int
    numero_lote: str
    producto_id: int
    producto_nombre: str
    estado: str
    fecha_inicio: datetime
    consumo_real: Decimal
    desperdicio: Decimal


class TrazabilidadLoteInsumo(BaseModel):
    """Hacia adelante: de un lote de insumo a los lotes de producto que lo usaron."""

    lote_insumo: LoteInsumoTraza
    cantidad_recibida: Decimal
    saldo: Decimal
    lotes_producto: list[LoteProductoUsoInsumo]


ColumnaGrafo = Literal['proveedor', 'insumo', 'lote_producto', 'despacho', 'cliente']


class NodoGrafo(BaseModel):
    id: str  # ej: "prov_1", "ins_5", "lote_10", "salida_3", "cli_2"
    columna: ColumnaGrafo
    tipo: str  # 'proveedor', 'materia_prima', 'lote_elaboracion', 'transporte', 'cliente'
    titulo: str
    subtitulo: str | None = None
    badge: str | None = None  # ej: 'Homologado', 'Venc: 15/12/2026', 'ENTREGADO'
    tono_badge: str | None = None  # 'ok', 'alerta', 'peligro', 'info', 'neutro'
    metadatos: dict[str, Any] = Field(default_factory=dict)


class ConexionGrafo(BaseModel):
    id: str  # ej: "c_prov1_ins5"
    origen_id: str
    destino_id: str
    etiqueta: str | None = None  # ej: "25 kg", "300 u"
    cliente_id: int | None = None  # Para filtrar la rama del cliente cuando se hace foco


class GrafoTrazabilidadResponse(BaseModel):
    lote_id: int
    numero_lote: str
    producto_nombre: str
    estado_lote: str
    nodos: list[NodoGrafo]
    conexiones: list[ConexionGrafo]

