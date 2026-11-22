from decimal import Decimal
from itertools import groupby

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.aditivos.services import resumen as resumen_aditivo
from src.common.fechas import ahora
from src.personal.models import Personal
from src.recetas import exceptions, schemas
from src.recetas.constants import (
    CLASIFICACION_INGREDIENTE,
    CLASIFICACION_ADITIVO,
    MotivoFaltante,
)
from src.recetas.models import OrdenManualInsumo, RecetaInsumo
from src.recetas.services import obtener_version
from src.unidadMedida.constants import TIPO_MASA, TIPO_UNIDAD, TIPO_VOLUMEN

_GRAMOS = Decimal("0.001")
_PORCENTAJE = Decimal("0.01")
_TOLERANCIA_POR_ITEM = Decimal("0.005")  # error máximo de redondear a 2 decimales
_SIN_POSICION = 10**9  # sin decisión manual: queda detrás de los que sí la tienen


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


def _nombre_personal(persona: Personal | None) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _cargar_decisiones(db: Session, version_id: int) -> dict[int, OrdenManualInsumo]:
    """Decisiones manuales de la versión, por id de insumo."""
    filas = db.scalars(
        select(OrdenManualInsumo)
        .where(OrdenManualInsumo.version_receta_id == version_id)
        .options(selectinload(OrdenManualInsumo.decidido_por))
    ).all()
    return {fila.insumo_id: fila for fila in filas}


def _item(
    linea: RecetaInsumo,
    gramos: Decimal,
    total: Decimal,
    grupo_empate: int | None = None,
    decision: OrdenManualInsumo | None = None,
) -> schemas.ComposicionItem:
    return schemas.ComposicionItem(
        insumo=schemas.InsumoResumen.model_validate(linea.insumo),
        unidad_medida=schemas.UnidadResumen.model_validate(linea.unidad_medida),
        cantidad=linea.cantidad,
        gramos=gramos.quantize(_GRAMOS),
        porcentaje=(gramos / total * 100).quantize(_PORCENTAJE),
        aditivo=resumen_aditivo(linea.insumo.aditivo),
        grupo_empate=grupo_empate,
        orden_decidido_por=_nombre_personal(decision.decidido_por) if decision else None,
        orden_decidido_en=decision.decidido_en if decision else None,
    )


def _clase_funcional(linea: RecetaInsumo) -> str:
    aditivo = linea.insumo.aditivo
    return aditivo.clase_funcional.nombre if aditivo is not None else ""


def _clave_empate_ingrediente(linea: RecetaInsumo, gramos: Decimal):
    return gramos


def _clave_empate_aditivo(linea: RecetaInsumo, gramos: Decimal):
    return (_clase_funcional(linea).casefold(), gramos)


def _ordenar_ingredientes(pesos, posiciones):
    """De mayor a menor masa. A igual masa manda la decisión manual si existe y,
    si no, el orden de carga.

    El orden se decide con la masa exacta y no con el porcentaje que se ve:
    dos ingredientes pueden mostrar el mismo porcentaje redondeado y no estar
    empatados.
    """
    return sorted(
        pesos,
        key=lambda par: (-par[1], posiciones.get(par[0].insumo_id, _SIN_POSICION)),
    )


def _ordenar_aditivos(pesos, posiciones):
    """Agrupados por clase funcional (A-Z, sin clase al final) y, dentro de
    cada clase, de mayor a menor masa (con la decisión manual en los empates)."""

    def clave(par):
        linea, gramos = par
        clase = _clase_funcional(linea)
        return (
            clase == "",
            clase.casefold(),
            -gramos,
            posiciones.get(linea.insumo_id, _SIN_POSICION),
        )

    return sorted(pesos, key=clave)


def _construir_items(pesos_ordenados, clave_empate, total, primer_grupo, decisiones):
    """Arma los items en el orden recibido y numera los grupos de empate.

    Devuelve (items, siguiente_numero_de_grupo). Los números de grupo siguen
    una sola secuencia para ingredientes y aditivos, así nunca se repiten.
    """
    items: list[schemas.ComposicionItem] = []
    grupo = primer_grupo
    for _, juntos in groupby(pesos_ordenados, key=lambda par: clave_empate(*par)):
        juntos = list(juntos)
        empatados = len(juntos) > 1
        for linea, gramos in juntos:
            items.append(
                _item(
                    linea,
                    gramos,
                    total,
                    grupo if empatados else None,
                    decisiones.get(linea.insumo_id) if empatados else None,
                )
            )
        if empatados:
            grupo += 1
    return items, grupo


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
    decisiones = _cargar_decisiones(db, version.id)
    posiciones = {insumo_id: fila.posicion for insumo_id, fila in decisiones.items()}
    pesos_ingredientes = _ordenar_ingredientes(
        [(linea, g) for linea, g in pesos if linea.clasificacion == CLASIFICACION_INGREDIENTE],
        posiciones,
    )
    pesos_aditivos = _ordenar_aditivos(
        [(linea, g) for linea, g in pesos if linea.clasificacion == CLASIFICACION_ADITIVO],
        posiciones,
    )
    ingredientes, siguiente = _construir_items(
        pesos_ingredientes, _clave_empate_ingrediente, total, 1, decisiones
    )
    aditivos, _ = _construir_items(
        pesos_aditivos, _clave_empate_aditivo, total, siguiente, decisiones
    )

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


def decidir_orden_empate(
    db: Session, version_id: int, insumo_ids: list[int], usuario: Personal
) -> schemas.Composicion:
    """Fija el orden de un grupo de insumos que pesan lo mismo y deja constancia.

    `insumo_ids` es el orden elegido, del primero al último, y tiene que ser un
    grupo de empate completo y sin repetir. La versión no se modifica: la
    decisión se guarda aparte, con quién la tomó y cuándo.
    """
    composicion = calcular_composicion(db, version_id)
    if not composicion.completa:
        raise exceptions.OrdenEmpateSinComposicion()

    grupos: dict[int, set[int]] = {}
    for item in [*composicion.ingredientes, *composicion.aditivos]:
        if item.grupo_empate is not None:
            grupos.setdefault(item.grupo_empate, set()).add(item.insumo.id)
    if len(insumo_ids) != len(set(insumo_ids)) or set(insumo_ids) not in grupos.values():
        raise exceptions.OrdenEmpateInvalido()

    existentes = {
        fila.insumo_id: fila
        for fila in db.scalars(
            select(OrdenManualInsumo).where(
                OrdenManualInsumo.version_receta_id == version_id,
                OrdenManualInsumo.insumo_id.in_(insumo_ids),
            )
        )
    }
    momento = ahora()
    for posicion, insumo_id in enumerate(insumo_ids, start=1):
        fila = existentes.get(insumo_id)
        if fila is None:
            db.add(
                OrdenManualInsumo(
                    version_receta_id=version_id,
                    insumo_id=insumo_id,
                    posicion=posicion,
                    decidido_por=usuario,
                    decidido_en=momento,
                )
            )
        else:
            fila.posicion = posicion
            fila.decidido_por = usuario
            fila.decidido_en = momento
    db.commit()
    return calcular_composicion(db, version_id)
