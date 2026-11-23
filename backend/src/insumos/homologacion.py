"""Homologación de un insumo (marca) contra su ingrediente (especificación).

El ingrediente tiene los valores nutricionales de referencia y sus alérgenos;
con ellos se calcula la tabla del producto, así no cambia lote a lote si
cambia la marca. Cada marca carga lo que declara su rótulo y se compara:

* Nutrientes: cada uno puede apartarse hasta la tolerancia (por defecto
  ±20 %, parámetro editable). Si los dos valores están por debajo del umbral
  de "no significativo" de ese nutriente se consideran iguales.
* Alérgenos, sin tolerancia: lo que la marca *contiene* tiene que estar entre
  lo que el ingrediente *contiene*; lo que *puede contener*, entre lo que el
  ingrediente contiene o puede contener.

Un insumo *sin rótulo* (no elaborado o a granel: frutas, verduras, huevos)
no se compara: toma la composición y los alérgenos del ingrediente, así que
resulta apto y la aprobación es solo la decisión registrada del admin.

Resultado: apta (todo bien), observada (algún nutriente fuera de tolerancia o
sin dato en el rótulo: se aprueba solo con justificación) o rechazada (los
alérgenos no cumplen: no se puede aprobar). Solo un insumo aprobado recibe
lotes.
"""

import calendar
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.alergenos.constants import NIVEL_CONTIENE
from src.alergenos.models import Alergeno, IngredienteAlergeno, InsumoAlergeno
from src.common.fechas import ahora, hoy
from src.insumos import exceptions, schemas
from src.insumos.models import (
    ESTADO_APROBADA,
    ESTADO_RECHAZADA,
    ESTADO_REQUIERE_REVISION,
    Insumo,
    ValorRotuloInsumo,
)

RESULTADO_APTA = "apta"
RESULTADO_OBSERVADA = "observada"
RESULTADO_RECHAZADA = "rechazada"
_GRAVEDAD = {RESULTADO_APTA: 0, RESULTADO_OBSERVADA: 1, RESULTADO_RECHAZADA: 2}

ESTADO_OK = "ok"
ESTADO_FUERA = "fuera_de_tolerancia"
ESTADO_SIN_DATO = "sin_dato"
ESTADO_SIN_REFERENCIA = "sin_referencia"
ESTADO_BAJO_UMBRAL = "bajo_umbral"
ESTADO_SIN_ROTULO = "sin_rotulo"

CIEN = Decimal(100)


def _insumo(db: Session, insumo_id: int) -> Insumo:
    insumo = db.scalar(
        select(Insumo)
        .where(Insumo.id == insumo_id)
        .options(
            selectinload(Insumo.ingrediente),
            selectinload(Insumo.valores_rotulo),
            selectinload(Insumo.homologado_por),
        )
    )
    if insumo is None:
        raise exceptions.InsumoNoEncontrado()
    return insumo


def _q(valor: Decimal) -> Decimal:
    return Decimal(valor).quantize(Decimal("0.0001"))


def sumar_meses(fecha: date, meses: int) -> date:
    """31/01 + 1 mes = 28/02 (o 29): el último día si el mes no llega."""
    total = fecha.month - 1 + meses
    anio, mes = fecha.year + total // 12, total % 12 + 1
    return date(anio, mes, min(fecha.day, calendar.monthrange(anio, mes)[1]))


def vigencia_meses(db: Session) -> int:
    from src.nutricion import constants as c
    from src.nutricion.services import _generales

    return int(_generales(db).get(c.VIGENCIA_HOMOLOGACION, "12"))


def vigente_hasta(insumo: Insumo, meses: int) -> Optional[date]:
    """Vencimiento de la aprobación; None si la marca no está aprobada."""
    if insumo.estado_homologacion != ESTADO_APROBADA or insumo.homologado_en is None:
        return None
    desde = insumo.homologado_en.date() if isinstance(insumo.homologado_en, datetime) else insumo.homologado_en
    return sumar_meses(desde, meses)


_ETIQUETA_ESTADO = {
    "pendiente": "pendiente",
    "rechazada": "rechazada",
    "requiere_revision": "requiere revisión",
}


def motivo_no_utilizable(db: Session, insumo: Insumo, meses: Optional[int] = None) -> Optional[str]:
    """Por qué no se puede recibir ni consumir esta marca; None si se puede.

    Solo sirve una marca aprobada y con la aprobación vigente (la vigencia sale
    de Parámetros nutricionales). Una aprobada sin fecha de decisión (datos
    viejos) se toma como vigente.
    """
    if insumo.estado_homologacion != ESTADO_APROBADA:
        estado = _ETIQUETA_ESTADO.get(insumo.estado_homologacion, insumo.estado_homologacion)
        return f"La marca «{insumo.nombre}» no tiene la homologación aprobada (está {estado})."
    vence = vigente_hasta(insumo, meses if meses is not None else vigencia_meses(db))
    if vence is not None and vence < hoy():
        return (
            f"La homologación de la marca «{insumo.nombre}» venció el {vence:%d/%m/%Y}: "
            "revisá su rótulo y volvé a aprobarla."
        )
    return None


def a_100(valor: Decimal, porcion: Optional[Decimal]) -> Decimal:
    """Valor declarado por porción -> por 100 g/ml (sin porción, queda igual)."""
    if porcion is None:
        return _q(valor)
    return _q(Decimal(valor) * CIEN / Decimal(porcion))


# ── Rótulo del insumo ──────────────────────────────────────────────────────


def _alergenos_de_insumo(db: Session, insumo_id: int) -> dict[int, InsumoAlergeno]:
    return {
        f.alergeno_id: f
        for f in db.scalars(
            select(InsumoAlergeno)
            .where(InsumoAlergeno.insumo_id == insumo_id)
            .options(selectinload(InsumoAlergeno.alergeno))
        ).all()
    }


def guardar_rotulo(
    db: Session, insumo_id: int, datos: schemas.RotuloInsumoIn
) -> schemas.HomologacionInsumo:
    """Reemplaza el rótulo (valores y alérgenos) por el que llega."""
    from src.nutricion.services import _admitidos, asegurar_parametros

    insumo = _insumo(db, insumo_id)
    if insumo.sin_rotulo:
        raise exceptions.InsumoSinRotulo()
    asegurar_parametros(db)
    admitidos = _admitidos(insumo.ingrediente)
    vistos: set[str] = set()
    for item in datos.valores:
        if item.nutriente not in admitidos:
            raise exceptions.NutrienteNoAdmitido()
        if item.nutriente in vistos:
            raise exceptions.NutrienteRepetido()
        vistos.add(item.nutriente)

    ids = [a.alergeno_id for a in datos.alergenos]
    if len(set(ids)) != len(ids):
        raise exceptions.AlergenoRepetido()
    actuales = _alergenos_de_insumo(db, insumo.id)
    catalogo = {a.id: a for a in db.scalars(select(Alergeno).where(Alergeno.id.in_(ids))).all()} if ids else {}
    for item in datos.alergenos:
        alergeno = catalogo.get(item.alergeno_id)
        if alergeno is None or (not alergeno.activo and item.alergeno_id not in actuales):
            raise exceptions.AlergenoNoValido()

    insumo.rotulo_referencia = datos.referencia
    insumo.rotulo_porcion = datos.porcion
    insumo.valores_rotulo = [
        ValorRotuloInsumo(
            nutriente=item.nutriente,
            valor_declarado=item.valor,
            valor_100=a_100(item.valor, datos.porcion),
        )
        for item in datos.valores
    ]
    for alergeno_id, fila in actuales.items():
        if alergeno_id not in catalogo:
            db.delete(fila)
    for item in datos.alergenos:
        fila = actuales.get(item.alergeno_id)
        if fila is None:
            db.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=item.alergeno_id, nivel=item.nivel))
        else:
            fila.nivel = item.nivel
    db.flush()
    _revisar(db, insumo)
    db.commit()
    return obtener_homologacion(db, insumo.id)


# ── Comparación ────────────────────────────────────────────────────────────


def _numero(valor: Decimal) -> str:
    """4.1850 -> "4,185" (como se muestra en pantalla)."""
    texto = f"{valor.normalize():f}" if valor == valor.to_integral() else f"{valor:f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def evaluar(db: Session, insumo: Insumo) -> schemas.ComparacionHomologacion:
    """Compara el rótulo del insumo con la referencia de su ingrediente. No guarda nada."""
    from src.nutricion import constants as c
    from src.nutricion.services import _admitidos, _generales, _reglas, _valores_de

    reglas = _reglas(db)
    tolerancia = Decimal(str(_generales(db).get(c.TOLERANCIA_HOMOLOGACION, "20")))
    ingrediente = insumo.ingrediente
    referencia = {k: v.valor for k, v in _valores_de(db, [ingrediente.id])[ingrediente.id].items()}
    rotulo = {
        v.nutriente: v.valor_100
        for v in db.scalars(select(ValorRotuloInsumo).where(ValorRotuloInsumo.insumo_id == insumo.id)).all()
    }

    filas: list[schemas.FilaComparacion] = []
    for clave in _admitidos(ingrediente):
        regla = reglas.get(clave)
        ref = referencia.get(clave)
        rot = rotulo.get(clave)
        desvio: Optional[Decimal] = None
        if insumo.sin_rotulo:
            # Sin rótulo propio: se toma el valor del ingrediente tal cual.
            estado = ESTADO_SIN_ROTULO
            rot = None
        elif ref is None:
            estado = ESTADO_SIN_REFERENCIA
        elif rot is None:
            estado = ESTADO_SIN_DATO
        else:
            umbral = regla.umbral_no_significativo if regla else None
            if umbral is not None and ref <= umbral and rot <= umbral:
                estado = ESTADO_BAJO_UMBRAL
            elif ref == 0:
                estado = ESTADO_OK if rot == 0 else ESTADO_FUERA
            else:
                desvio = _q((Decimal(rot) - Decimal(ref)) / Decimal(ref) * CIEN)
                estado = ESTADO_OK if abs(desvio) <= tolerancia else ESTADO_FUERA
        filas.append(
            schemas.FilaComparacion(
                nutriente=clave,
                nombre=regla.nombre if regla else clave,
                unidad=regla.unidad if regla else "",
                referencia=_q(ref) if ref is not None else None,
                rotulo=_q(rot) if rot is not None else None,
                desvio_pct=desvio,
                estado=estado,
            )
        )

    del_ingrediente = {
        f.alergeno_id: f
        for f in db.scalars(
            select(IngredienteAlergeno)
            .where(IngredienteAlergeno.ingrediente_id == ingrediente.id)
            .options(selectinload(IngredienteAlergeno.alergeno))
        ).all()
    }
    # Sin rótulo, la marca no declara alérgenos propios: rigen los del ingrediente.
    del_insumo = {} if insumo.sin_rotulo else _alergenos_de_insumo(db, insumo.id)
    alergenos: list[schemas.FilaAlergeno] = []
    for alergeno_id in sorted(set(del_ingrediente) | set(del_insumo)):
        fila_ing = del_ingrediente.get(alergeno_id)
        fila_ins = del_insumo.get(alergeno_id)
        nombre = (fila_ins or fila_ing).alergeno.nombre
        if fila_ins is None:
            cumple = True  # la marca declara menos que la especificación: está bien
        elif fila_ins.nivel == NIVEL_CONTIENE:
            cumple = fila_ing is not None and fila_ing.nivel == NIVEL_CONTIENE
        else:
            cumple = fila_ing is not None
        alergenos.append(
            schemas.FilaAlergeno(
                alergeno_id=alergeno_id,
                nombre=nombre,
                nivel_ingrediente=fila_ing.nivel if fila_ing else None,
                nivel_insumo=fila_ins.nivel if fila_ins else None,
                cumple=cumple,
            )
        )
    alergenos.sort(key=lambda a: a.nombre)

    problemas: list[str] = []
    for a in alergenos:
        if not a.cumple:
            problemas.append(
                f"El rótulo declara {a.nombre.lower()} ({'contiene' if a.nivel_insumo == NIVEL_CONTIENE else 'puede contener'}) "
                "y el ingrediente no lo admite en ese nivel."
            )
    for f in filas:
        if f.estado == ESTADO_FUERA:
            problemas.append(
                f"{f.nombre}: {_numero(f.rotulo)} {f.unidad} en el rótulo contra {_numero(f.referencia)} {f.unidad}"
                " de referencia"
                + (f" ({_numero(round(f.desvio_pct, 1)) if f.desvio_pct < 0 else '+' + _numero(round(f.desvio_pct, 1))}%)."
                   if f.desvio_pct is not None else ".")
            )
        elif f.estado == ESTADO_SIN_DATO:
            problemas.append(f"{f.nombre}: el rótulo no tiene el dato.")

    if any(not a.cumple for a in alergenos):
        resultado = RESULTADO_RECHAZADA
    elif any(f.estado in (ESTADO_FUERA, ESTADO_SIN_DATO) for f in filas):
        resultado = RESULTADO_OBSERVADA
    else:
        resultado = RESULTADO_APTA
    return schemas.ComparacionHomologacion(
        resultado=resultado,
        tolerancia_pct=tolerancia,
        nutrientes=filas,
        alergenos=alergenos,
        problemas=problemas,
    )


def obtener_homologacion(db: Session, insumo_id: int) -> schemas.HomologacionInsumo:
    insumo = _insumo(db, insumo_id)
    persona = insumo.homologado_por
    vence = vigente_hasta(insumo, vigencia_meses(db))
    return schemas.HomologacionInsumo(
        insumo_id=insumo.id,
        insumo_nombre=insumo.nombre,
        ingrediente_id=insumo.ingrediente_id,
        ingrediente_nombre=insumo.ingrediente.nombre,
        es_aditivo=insumo.ingrediente.es_aditivo,
        sin_rotulo=insumo.sin_rotulo,
        estado=insumo.estado_homologacion,
        resultado_al_decidir=insumo.resultado_homologacion,
        justificacion=insumo.justificacion_homologacion,
        homologado_por=f"{persona.nombre} {persona.apellido or ''}".strip() if persona else None,
        homologado_en=insumo.homologado_en,
        vigente_hasta=vence,
        vencida=vence is not None and vence < hoy(),
        tolerancia_al_decidir=(insumo.instantanea_homologacion or {}).get("tolerancia_pct"),
        rotulo=schemas.RotuloInsumo(
            referencia=insumo.rotulo_referencia,
            porcion=insumo.rotulo_porcion,
            valores=[
                schemas.ValorRotulo(nutriente=v.nutriente, valor=v.valor_declarado, valor_100=v.valor_100)
                for v in insumo.valores_rotulo
            ],
            alergenos=[
                schemas.AlergenoRotulo(alergeno_id=f.alergeno_id, nombre=f.alergeno.nombre, nivel=f.nivel)
                for f in sorted(_alergenos_de_insumo(db, insumo.id).values(), key=lambda f: f.alergeno.nombre)
            ],
        ),
        comparacion=evaluar(db, insumo),
    )


# ── Decisión ───────────────────────────────────────────────────────────────


def decidir(
    db: Session, insumo_id: int, datos: schemas.DecisionHomologacionIn, usuario
) -> schemas.HomologacionInsumo:
    insumo = _insumo(db, insumo_id)
    comparacion = evaluar(db, insumo)
    if datos.decision == "aprobar":
        if comparacion.resultado == RESULTADO_RECHAZADA:
            raise exceptions.AlergenosNoCumplen()
        if comparacion.resultado == RESULTADO_OBSERVADA and not datos.justificacion:
            raise exceptions.JustificacionRequerida()
        insumo.estado_homologacion = ESTADO_APROBADA
    else:
        insumo.estado_homologacion = ESTADO_RECHAZADA
    insumo.resultado_homologacion = comparacion.resultado
    insumo.justificacion_homologacion = datos.justificacion
    insumo.homologado_por_id = getattr(usuario, "id", None)
    insumo.homologado_en = ahora()
    insumo.instantanea_homologacion = comparacion.model_dump(mode="json")
    db.commit()
    # La aprobación renueva (o el rechazo quita) el aviso de vencimiento.
    from src.notificaciones.invalidacion import invalidar_notificaciones

    invalidar_notificaciones(db)
    return obtener_homologacion(db, insumo.id)


def cambiar_sin_rotulo(db: Session, insumo: Insumo) -> None:
    """Se marcó o desmarcó "sin rótulo". No hace commit.

    Al marcarlo se borra el rótulo cargado (ya no se usa). Al desmarcarlo, una
    aprobación previa no vale para un rótulo que nadie cargó: si estaba
    aprobada, pasa a revisión.
    """
    if insumo.sin_rotulo:
        insumo.rotulo_referencia = None
        insumo.rotulo_porcion = None
        insumo.valores_rotulo = []
        for fila in _alergenos_de_insumo(db, insumo.id).values():
            db.delete(fila)
    elif insumo.estado_homologacion == ESTADO_APROBADA:
        insumo.estado_homologacion = ESTADO_REQUIERE_REVISION
    db.flush()


# ── Revisión automática ────────────────────────────────────────────────────


def _revisar(db: Session, insumo: Insumo) -> bool:
    """Si el insumo estaba aprobado y la comparación empeoró, pasa a revisión.

    No hace commit. Devuelve True si cambió de estado.
    """
    if insumo.estado_homologacion != ESTADO_APROBADA:
        return False
    actual = evaluar(db, insumo).resultado
    anterior = insumo.resultado_homologacion or RESULTADO_APTA
    if _GRAVEDAD[actual] > _GRAVEDAD.get(anterior, 0):
        insumo.estado_homologacion = ESTADO_REQUIERE_REVISION
        return True
    return False


def revisar_insumos_de_ingrediente(db: Session, ingrediente_id: int) -> int:
    """Se llama al cambiar la referencia de un ingrediente (valores o alérgenos).

    Hace commit. Devuelve cuántos insumos pasaron a revisión.
    """
    insumos = db.scalars(
        select(Insumo).where(Insumo.ingrediente_id == ingrediente_id, Insumo.estado_homologacion == ESTADO_APROBADA)
    ).all()
    cambiados = sum(1 for insumo in insumos if _revisar(db, insumo))
    if cambiados:
        db.commit()
    return cambiados
