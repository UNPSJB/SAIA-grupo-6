from decimal import Decimal

from sqlalchemy.orm import Session

from src.recetas import schemas
from src.recetas.constants import MotivoFaltante
from src.recetas.models import RecetaIngrediente
from src.recetas.services import obtener_version
from src.unidadMedida.constants import TIPO_MASA, TIPO_UNIDAD, TIPO_VOLUMEN

_GRAMOS = Decimal("0.001")
_PORCENTAJE = Decimal("0.01")
_TOLERANCIA_POR_ITEM = Decimal("0.005")  # error máximo de redondear a 2 decimales


def _a_gramos(linea: RecetaIngrediente) -> tuple[Decimal | None, str | None]:
    """Devuelve (gramos, None) o (None, motivo) si falta algún dato."""
    unidad, ingrediente = linea.unidad_medida, linea.ingrediente
    if unidad.tipo is None or unidad.factor_a_base is None:
        return None, MotivoFaltante.UNIDAD_SIN_EQUIVALENCIA

    base = linea.cantidad * unidad.factor_a_base
    if unidad.tipo == TIPO_MASA:
        return base, None
    if unidad.tipo == TIPO_VOLUMEN:
        if ingrediente.densidad_g_ml is None:
            return None, MotivoFaltante.SIN_DENSIDAD
        return base * ingrediente.densidad_g_ml, None
    if unidad.tipo == TIPO_UNIDAD:
        if ingrediente.peso_unitario_g is None:
            return None, MotivoFaltante.SIN_PESO_UNITARIO
        return base * ingrediente.peso_unitario_g, None
    return None, MotivoFaltante.UNIDAD_SIN_EQUIVALENCIA


def _item(linea: RecetaIngrediente, gramos: Decimal, total: Decimal) -> schemas.ComposicionItem:
    return schemas.ComposicionItem(
        ingrediente=schemas.IngredienteResumen.model_validate(linea.ingrediente),
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

    pesos: list[tuple[RecetaIngrediente, Decimal]] = []
    faltantes: list[schemas.ComposicionFaltante] = []
    for linea in version.ingredientes:
        gramos, motivo = _a_gramos(linea)
        if gramos is None:
            faltantes.append(schemas.ComposicionFaltante(
                ingrediente=schemas.IngredienteResumen.model_validate(linea.ingrediente),
                es_aditivo=linea.es_aditivo,
                motivo=motivo,
            ))
        else:
            pesos.append((linea, gramos))

    # Con datos faltantes no hay % confiables: se informa y no se calcula nada.
    if faltantes:
        return schemas.Composicion(**base, completa=False, faltantes=faltantes)

    # total > 0: la versión tiene al menos un ingrediente y todas las cantidades,
    # factores, densidades y pesos son positivos.
    total = sum((g for _, g in pesos), Decimal(0))
    items = [(linea.es_aditivo, _item(linea, g, total)) for linea, g in pesos]
    ingredientes = [i for es_aditivo, i in items if not es_aditivo]
    aditivos = [i for es_aditivo, i in items if es_aditivo]

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