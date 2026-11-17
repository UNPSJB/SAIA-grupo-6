from decimal import Decimal

from sqlalchemy.orm import Session

from src.recetas import schemas
from src.recetas.constants import (
    CLASIFICACION_INGREDIENTE,
    CLASIFICACION_ADITIVO,
    MotivoFaltante,
)
from src.recetas.models import RecetaInsumo
from src.recetas.services import obtener_version
from src.unidadMedida.constants import TIPO_MASA, TIPO_UNIDAD, TIPO_VOLUMEN

_GRAMOS = Decimal("0.001")
_PORCENTAJE = Decimal("0.01")
_TOLERANCIA_POR_ITEM = Decimal("0.005")  # error máximo de redondear a 2 decimales


def _a_gramos(linea: RecetaInsumo) -> tuple[Decimal | None, str | None]:
    """Devuelve (gramos, None) o (None, motivo) si falta algún dato."""
    unidad, insumo = linea.unidad_medida, linea.insumo
    if unidad.tipo is None or unidad.factor_a_base is None:
        return None, MotivoFaltante.UNIDAD_SIN_EQUIVALENCIA

    base = linea.cantidad * unidad.factor_a_base
    if unidad.tipo == TIPO_MASA:
        return base, None
    if unidad.tipo == TIPO_VOLUMEN:
        if insumo.densidad_g_ml is None:
            return None, MotivoFaltante.SIN_DENSIDAD
        return base * insumo.densidad_g_ml, None
    if unidad.tipo == TIPO_UNIDAD:
        if insumo.peso_unitario_g is None:
            return None, MotivoFaltante.SIN_PESO_UNITARIO
        return base * insumo.peso_unitario_g, None
    return None, MotivoFaltante.UNIDAD_SIN_EQUIVALENCIA


def _item(linea: RecetaInsumo, gramos: Decimal, total: Decimal) -> schemas.ComposicionItem:
    return schemas.ComposicionItem(
        insumo=schemas.InsumoResumen.model_validate(linea.insumo),
        unidad_medida=schemas.UnidadResumen.model_validate(linea.unidad_medida),
        cantidad=linea.cantidad,
        gramos=gramos.quantize(_GRAMOS),
        porcentaje=(gramos / total * 100).quantize(_PORCENTAJE),
    )


def calcular_composicion(db: Session, version_id: int) -> schemas.Composicion:
    version = obtener_version(db, version_id)
    base = {
        "version_id": version.id,
        "version_numero": version.numero,
        "receta_id": version.receta_id,
        "producto_nombre": version.receta.producto.nombre,
    }

    pesos: list[tuple[RecetaInsumo, Decimal]] = []
    faltantes: list[schemas.ComposicionFaltante] = []
    for linea in version.insumos:
        gramos, motivo = _a_gramos(linea)
        if gramos is None:
            faltantes.append(schemas.ComposicionFaltante(
                insumo=schemas.InsumoResumen.model_validate(linea.insumo),
                clasificacion=linea.clasificacion,
                motivo=motivo,
            ))
        else:
            pesos.append((linea, gramos))

    # Con datos faltantes no hay % confiables: se informa y no se calcula nada.
    if faltantes:
        return schemas.Composicion(**base, completa=False, faltantes=faltantes)

    # total > 0: la versión tiene al menos un insumo y todas las cantidades,
    # factores, densidades y pesos son positivos.
    total = sum((g for _, g in pesos), Decimal(0))
    items = [(linea.clasificacion, _item(linea, g, total)) for linea, g in pesos]
    ingredientes = [i for c, i in items if c == CLASIFICACION_INGREDIENTE]
    aditivos = [i for c, i in items if c == CLASIFICACION_ADITIVO]

    todos = ingredientes + aditivos
    suma = sum((i.porcentaje for i in todos), Decimal(0))
    return schemas.Composicion(
        **base,
        completa=True,
        total_gramos=total.quantize(_GRAMOS),
        ingredientes=ingredientes,
        aditivos=aditivos,
        suma_porcentajes=suma,
        suma_correcta=abs(suma - 100) <= _TOLERANCIA_POR_ITEM * len(todos),
    )