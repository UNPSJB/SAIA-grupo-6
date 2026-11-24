import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.alergenos import exceptions, schemas
from src.alergenos.constants import ALERGENOS_INICIALES, NIVEL_CONTIENE, NIVEL_PUEDE_CONTENER
from src.common.fechas import ahora
from src.common.texto import normalizar_texto
from src.alergenos.models import Alergeno, IngredienteAlergeno
from src.ingredientes.models import Ingrediente
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaIngrediente, VersionReceta
from src.recetas.services import obtener_version, version_vigente


# ── Catálogo ───────────────────────────────────────────────────────────────


def cargar_alergenos_iniciales(db: Session) -> None:
    """Carga inicial del catálogo, solo si está vacío."""
    if db.scalar(select(func.count()).select_from(Alergeno)):
        return
    db.add_all(
        Alergeno(codigo=codigo, nombre=nombre, condicionada=condicionada)
        for codigo, nombre, condicionada in ALERGENOS_INICIALES
    )
    db.commit()


def codigo_para(db: Session, nombre: str, excepto_id: Optional[int] = None) -> str:
    """Código estable a partir del nombre ("Castaña de cajú" -> "castana_de_caju"),
    con un sufijo si ya está tomado."""
    base = re.sub(r"[^a-z0-9]+", "_", normalizar_texto(nombre)).strip("_")[:36] or "alergeno"
    codigo, n = base, 2
    while True:
        consulta = select(Alergeno.id).where(Alergeno.codigo == codigo)
        if excepto_id is not None:
            consulta = consulta.where(Alergeno.id != excepto_id)
        if db.scalar(consulta) is None:
            return codigo
        codigo, n = f"{base}_{n}", n + 1


def catalogo_por_codigo(db: Session) -> dict[str, Alergeno]:
    """Todo el catálogo (también los dados de baja: las revisiones viejas los nombran)."""
    return {a.codigo: a for a in db.scalars(select(Alergeno)).all()}


def listar_alergenos(db: Session, incluir_inactivos: bool = False) -> list[Alergeno]:
    consulta = select(Alergeno).order_by(Alergeno.nombre)
    if not incluir_inactivos:
        consulta = consulta.where(Alergeno.activo.is_(True))
    return list(db.scalars(consulta).all())


def obtener_alergeno(db: Session, alergeno_id: int) -> Alergeno:
    alergeno = db.get(Alergeno, alergeno_id)
    if alergeno is None:
        raise exceptions.AlergenoNoEncontrado()
    return alergeno


def _verificar_nombre_libre(db: Session, nombre: str, excepto_id: Optional[int] = None) -> None:
    consulta = select(Alergeno.id).where(func.lower(Alergeno.nombre) == nombre.lower())
    if excepto_id is not None:
        consulta = consulta.where(Alergeno.id != excepto_id)
    if db.scalar(consulta) is not None:
        raise exceptions.AlergenoYaExiste()


def crear_alergeno(db: Session, datos: schemas.AlergenoCreate) -> Alergeno:
    _verificar_nombre_libre(db, datos.nombre)
    # El código no cambia aunque después se renombre: las revisiones del
    # rótulo lo guardan.
    alergeno = Alergeno(
        codigo=codigo_para(db, datos.nombre), nombre=datos.nombre, condicionada=datos.condicionada
    )
    db.add(alergeno)
    db.commit()
    db.refresh(alergeno)
    return alergeno


def actualizar_alergeno(db: Session, alergeno_id: int, datos: schemas.AlergenoUpdate) -> Alergeno:
    alergeno = obtener_alergeno(db, alergeno_id)
    if datos.nombre is not None:
        _verificar_nombre_libre(db, datos.nombre, excepto_id=alergeno.id)
        alergeno.nombre = datos.nombre
    if datos.condicionada is not None:
        alergeno.condicionada = datos.condicionada
    if datos.activo is not None:
        alergeno.activo = datos.activo
    db.commit()
    db.refresh(alergeno)
    return alergeno


def dar_de_baja(db: Session, alergeno_id: int) -> Alergeno:
    """Baja lógica: deja de ofrecerse para asignar, pero los ingredientes que
    ya lo tienen lo siguen declarando (nunca se pierde un alérgeno del rótulo)."""
    alergeno = obtener_alergeno(db, alergeno_id)
    alergeno.activo = False
    db.commit()
    db.refresh(alergeno)
    return alergeno


# ── Alérgenos de un ingrediente ────────────────────────────────────────────


def _ingrediente(db: Session, ingrediente_id: int) -> Ingrediente:
    ingrediente = db.get(Ingrediente, ingrediente_id)
    if ingrediente is None:
        raise exceptions.IngredienteNoEncontrado()
    return ingrediente


def _filas_de(db: Session, ingrediente_ids: list[int]) -> list[IngredienteAlergeno]:
    if not ingrediente_ids:
        return []
    return list(
        db.scalars(
            select(IngredienteAlergeno)
            .where(IngredienteAlergeno.ingrediente_id.in_(ingrediente_ids))
            .options(selectinload(IngredienteAlergeno.alergeno))
        ).all()
    )


def alergenos_de_ingrediente(db: Session, ingrediente_id: int) -> schemas.AlergenosDeIngrediente:
    ingrediente = _ingrediente(db, ingrediente_id)
    filas = sorted(_filas_de(db, [ingrediente_id]), key=lambda f: f.alergeno.nombre)
    actualizado_por = None
    if ingrediente.alergenos_actualizado_por_id is not None:
        from src.personal.models import Personal

        persona = db.get(Personal, ingrediente.alergenos_actualizado_por_id)
        if persona is not None:
            actualizado_por = f"{persona.nombre} {persona.apellido or ''}".strip()
    return schemas.AlergenosDeIngrediente(
        ingrediente_id=ingrediente_id,
        alergenos=[
            schemas.AlergenoDeIngrediente(
                alergeno_id=f.alergeno_id,
                codigo=f.alergeno.codigo,
                nombre=f.alergeno.nombre,
                nivel=f.nivel,
                forma=f.forma,
            )
            for f in filas
        ],
        evaluacion=ingrediente.evaluacion_alergenos,
        gluten=ingrediente.gluten,
        respaldo=ingrediente.respaldo_alergenos,
        observaciones=ingrediente.observaciones_alergenos,
        actualizado_en=ingrediente.alergenos_actualizado_en,
        actualizado_por=actualizado_por,
    )


def guardar_alergenos_de_ingrediente(
    db: Session,
    ingrediente_id: int,
    datos: schemas.AlergenosDeIngredienteIn,
    usuario_id: Optional[int] = None,
) -> schemas.AlergenosDeIngrediente:
    """Reemplaza la lista del ingrediente por la que llega y actualiza su evaluación."""
    ingrediente = _ingrediente(db, ingrediente_id)
    ids = [a.alergeno_id for a in datos.alergenos]
    if len(set(ids)) != len(ids):
        raise exceptions.AlergenoRepetido()

    actuales = {f.alergeno_id: f for f in _filas_de(db, [ingrediente_id])}
    catalogo = {a.id: a for a in db.scalars(select(Alergeno).where(Alergeno.id.in_(ids))).all()} if ids else {}
    for item in datos.alergenos:
        alergeno = catalogo.get(item.alergeno_id)
        # Uno dado de baja solo se acepta si el ingrediente ya lo tenía.
        if alergeno is None or (not alergeno.activo and item.alergeno_id not in actuales):
            raise exceptions.AlergenoNoValido()

    for alergeno_id, fila in actuales.items():
        if alergeno_id not in catalogo:
            db.delete(fila)
    for item in datos.alergenos:
        fila = actuales.get(item.alergeno_id)
        if fila is None:
            db.add(
                IngredienteAlergeno(
                    ingrediente_id=ingrediente_id,
                    alergeno_id=item.alergeno_id,
                    nivel=item.nivel,
                    forma=item.forma,
                )
            )
        else:
            fila.nivel = item.nivel
            fila.forma = item.forma

    if datos.evaluacion is not None:
        ingrediente.evaluacion_alergenos = datos.evaluacion
    if datos.gluten is not None:
        ingrediente.gluten = datos.gluten
    # Los textos sí se borran mandándolos vacíos o en null.
    if "respaldo" in datos.model_fields_set:
        ingrediente.respaldo_alergenos = datos.respaldo
    if "observaciones" in datos.model_fields_set:
        ingrediente.observaciones_alergenos = datos.observaciones
    ingrediente.alergenos_actualizado_en = ahora()
    ingrediente.alergenos_actualizado_por_id = usuario_id
    db.commit()
    # Cambiaron los alérgenos de la especificación: las marcas aprobadas cuya
    # comparación empeoró pasan a revisión.
    from src.insumos.homologacion import revisar_insumos_de_ingrediente

    revisar_insumos_de_ingrediente(db, ingrediente_id)
    return alergenos_de_ingrediente(db, ingrediente_id)


# ── Alérgenos de un producto (desde su receta) ─────────────────────────────


def _en_frase(nombres: list[str]) -> str:
    """["Huevo", "Leche", "Soja"] -> "huevo, leche y soja"."""
    minusculas = [n[:1].lower() + n[1:] for n in nombres]
    if len(minusculas) == 1:
        return minusculas[0]
    return ", ".join(minusculas[:-1]) + " y " + minusculas[-1]


def leyenda(contiene: list[str], puede_contener: list[str]) -> Optional[str]:
    """Texto para el rótulo, o None si la receta no tiene alérgenos."""
    partes = []
    if contiene:
        partes.append(f"Contiene: {_en_frase(contiene)}.")
    if puede_contener:
        partes.append(f"Puede contener: {_en_frase(puede_contener)}.")
    return " ".join(partes) or None


def alergenos_de_version(db: Session, version: VersionReceta) -> tuple[
    list[schemas.AlergenoDeProducto], list[schemas.AlergenoDeProducto]
]:
    """(contiene, puede_contener) de una versión de receta.

    Gana *contiene*: si algún ingrediente lo contiene, el producto lo contiene.
    """
    renglones = list(
        db.scalars(
            select(RecetaIngrediente)
            .where(RecetaIngrediente.version_receta_id == version.id)
            .options(selectinload(RecetaIngrediente.ingrediente))
        ).all()
    )
    nombre_de = {r.ingrediente_id: r.ingrediente.nombre for r in renglones}
    filas = _filas_de(db, list(nombre_de))

    por_alergeno: dict[int, dict] = {}
    for fila in filas:
        dato = por_alergeno.setdefault(
            fila.alergeno_id,
            {"nombre": fila.alergeno.nombre, NIVEL_CONTIENE: [], NIVEL_PUEDE_CONTENER: []},
        )
        dato[fila.nivel].append(nombre_de[fila.ingrediente_id])

    contiene, puede = [], []
    for alergeno_id, dato in sorted(por_alergeno.items(), key=lambda item: item[1]["nombre"]):
        if dato[NIVEL_CONTIENE]:
            contiene.append(
                schemas.AlergenoDeProducto(
                    alergeno_id=alergeno_id, nombre=dato["nombre"], ingredientes=sorted(dato[NIVEL_CONTIENE])
                )
            )
        else:
            puede.append(
                schemas.AlergenoDeProducto(
                    alergeno_id=alergeno_id,
                    nombre=dato["nombre"],
                    ingredientes=sorted(dato[NIVEL_PUEDE_CONTENER]),
                )
            )
    return contiene, puede


def alergenos_de_producto(
    db: Session, producto_id: int, version_id: Optional[int] = None
) -> schemas.AlergenosDeProducto:
    if db.get(Producto, producto_id) is None:
        raise exceptions.ProductoNoEncontrado()
    version: Optional[VersionReceta] = None
    if version_id is not None:
        version = obtener_version(db, version_id)
        receta = db.get(Receta, version.receta_id)
        if receta is None or receta.producto_id != producto_id:
            raise exceptions.ProductoNoEncontrado()
    else:
        receta = db.scalar(select(Receta).where(Receta.producto_id == producto_id))
        version = version_vigente(db, receta.id) if receta else None

    if version is None:
        return schemas.AlergenosDeProducto(
            producto_id=producto_id, version_id=None, contiene=[], puede_contener=[], leyenda=None
        )
    contiene, puede = alergenos_de_version(db, version)
    return schemas.AlergenosDeProducto(
        producto_id=producto_id,
        version_id=version.id,
        contiene=contiene,
        puede_contener=puede,
        leyenda=leyenda([a.nombre for a in contiene], [a.nombre for a in puede]),
    )
