"""Propuestas HU106. Las consultas no escriben; toda revisión conserva sus fuentes."""
import copy
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from sqlalchemy.orm import selectinload

from src.alergenos.constants import (
    EVALUACION_EVALUADA,
    GLUTEN_DESCONOCIDO,
    GLUTEN_PRESENTE,
    NIVEL_CONTIENE,
    VERSION_REGLAS,
)
from src.alergenos.models import IngredienteAlergeno
from src.alergenos.services import catalogo_por_codigo
from src.common.fechas import ahora
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, VersionReceta
from src.rotulado.declaraciones_schemas import ConservacionProducto
from src.rotulado.models import BorradorRotulado, CampoRotuladoEditado, RevisionDeclaracionRotulado


def _huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def _admin(db, usuario):
    persona = db.get(Personal, getattr(usuario, "id", None)) if usuario is not None else None
    if persona is None or not persona.activo or not (persona.puede_administrar or persona.es_super_admin):
        raise HTTPException(403, "Se requiere permiso de administrar.")
    db.info["usuario_id"] = persona.id
    return persona


def _reservar_escritura(db):
    """Serializa leer/comprobar/escribir en SQLite sin actualizar filas ficticias."""
    conexion = db.connection()
    if conexion.dialect.name == "sqlite" and not conexion.connection.driver_connection.in_transaction:
        conexion.exec_driver_sql("BEGIN IMMEDIATE")


def borrador_por_id(db, identificador):
    borrador = db.get(BorradorRotulado, identificador)
    if borrador is None or borrador.archivado:
        raise HTTPException(404, "Borrador no encontrado.")
    return borrador


def resolver_version(db, producto_id, version_id=None, lote_id=None):
    from src.rotulado import exceptions
    if lote_id is not None:
        from src.lotes.models import LoteProducto
        lote = db.get(LoteProducto, lote_id)
        if lote is None:
            raise exceptions.LoteNoEncontrado()
        if lote.producto_id != producto_id:
            raise exceptions.LoteNoPerteneceAlProducto()
        if version_id is not None and lote.version_receta_id != version_id:
            raise exceptions.LoteVersionIncompatible()
        version_id = lote.version_receta_id
    if version_id is None:
        version = db.scalar(select(VersionReceta).join(Receta).where(
            Receta.producto_id == producto_id
        ).order_by(VersionReceta.numero.desc()))
    else:
        version = db.get(VersionReceta, version_id)
        if version is None:
            raise exceptions.VersionNoEncontrada()
        if version.receta.producto_id != producto_id:
            raise exceptions.VersionNoPerteneceAlProducto()
    return version


def _alergenos_por_ingrediente(db, ingrediente_ids):
    """{ingrediente_id: [IngredienteAlergeno]} en el orden del catálogo."""
    por_ingrediente = {i: [] for i in ingrediente_ids}
    if not ingrediente_ids:
        return por_ingrediente
    filas = db.scalars(
        select(IngredienteAlergeno)
        .where(IngredienteAlergeno.ingrediente_id.in_(ingrediente_ids))
        .options(selectinload(IngredienteAlergeno.alergeno))
    ).all()
    for fila in sorted(filas, key=lambda f: f.alergeno_id):
        por_ingrediente[fila.ingrediente_id].append(fila)
    return por_ingrediente


def generar_propuesta_declaraciones(db, producto_id, version_id=None, lote_id=None, texto_ingredientes=None):
    """Arma la propuesta con los alérgenos de los ingredientes de la versión.

    Los datos salen del maestro de ingredientes (`ingredientes_alergenos` y la
    evaluación de cada uno). Si un ingrediente contiene un alérgeno, el
    producto lo contiene aunque otro diga que solo puede contenerlo.
    """
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(404, "Producto no encontrado.")
    version = resolver_version(db, producto_id, version_id, lote_id)
    fuentes, detectados, posibles, pendientes = [], {}, {}, []
    gluten_presente, gluten_desconocido = False, False
    lineas = sorted(version.ingredientes if version else [], key=lambda l: l.ingrediente_id)
    if not lineas:
        pendientes.append("No hay una versión de receta con ingredientes para evaluar.")
        gluten_desconocido = True
    alergenos = _alergenos_por_ingrediente(db, [l.ingrediente_id for l in lineas])
    for linea in lineas:
        ingrediente = linea.ingrediente
        propios = alergenos[ingrediente.id]
        perfil = {
            "evaluacion": ingrediente.evaluacion_alergenos,
            "gluten": ingrediente.gluten,
            "respaldo": ingrediente.respaldo_alergenos,
            "contiene": [{"codigo": f.alergeno.codigo, "forma": f.forma}
                         for f in propios if f.nivel == NIVEL_CONTIENE],
            "puede_contener": [f.alergeno.codigo for f in propios if f.nivel != NIVEL_CONTIENE],
        }
        fuentes.append({"ingrediente_id": ingrediente.id, "nombre": ingrediente.nombre,
                        "es_aditivo": linea.es_aditivo, "perfil": perfil})
        if ingrediente.evaluacion_alergenos != EVALUACION_EVALUADA:
            estado = ingrediente.evaluacion_alergenos.replace("_", " ")
            pendientes.append(f"{ingrediente.nombre}: evaluación de alérgenos {estado}.")
        if ingrediente.gluten == GLUTEN_DESCONOCIDO:
            pendientes.append(f"{ingrediente.nombre}: información de gluten insuficiente.")
            gluten_desconocido = True
        gluten_presente |= ingrediente.gluten == GLUTEN_PRESENTE
        for fila in propios:
            destino = detectados if fila.nivel == NIVEL_CONTIENE else posibles
            item = destino.setdefault(fila.alergeno.codigo, {
                "codigo": fila.alergeno.codigo, "nombre": fila.alergeno.nombre,
                "condicionada": fila.alergeno.condicionada, "fuentes": [],
            })
            fuente = {"ingrediente_id": ingrediente.id, "nombre": ingrediente.nombre}
            if fila.nivel == NIVEL_CONTIENE:
                fuente["forma"] = fila.forma
            item["fuentes"].append(fuente)
    # Gana "contiene": lo que ya se declara presente no va como "puede contener".
    for codigo in detectados:
        posibles.pop(codigo, None)
    gluten = "presente" if gluten_presente else "informacion_insuficiente" if gluten_desconocido else "sin_presencia_declarada"
    origen = {"version_receta_id": version.id if version else None,
              "reglas": VERSION_REGLAS, "fuentes": fuentes,
              "conservacion_producto": producto.conservacion,
              "lista_ingredientes_declarada": texto_ingredientes}
    return {**origen, "detectados": list(detectados.values()),
            "puede_contener": list(posibles.values()), "gluten": gluten,
            "pendientes_origen": pendientes, "huella_origen": _huella(origen),
            "conservacion": copy.deepcopy(producto.conservacion),
            "conservacion_origen": "producto", "contaminacion_cruzada": [], "evaluaciones": []}


def ultima_revision(db, borrador_id):
    return db.scalar(select(RevisionDeclaracionRotulado).where(
        RevisionDeclaracionRotulado.borrador_id == borrador_id
    ).order_by(RevisionDeclaracionRotulado.numero.desc()))


def _es_condicionada(item):
    # Las revisiones anteriores a la unificación no guardaban la marca.
    return item.get("condicionada", item["codigo"] == "sulfitos")


def _nombres(db):
    return {codigo: a.nombre for codigo, a in catalogo_por_codigo(db).items()}


def pendientes_contenido(contenido, nombres):
    pendientes = list(contenido["pendientes_origen"])
    if contenido["conservacion"] is None:
        pendientes.append("Indicá condiciones de conservación.")
    else:
        pendientes.extend("Conservación: " + p for p in
                          ConservacionProducto.model_validate(contenido["conservacion"]).pendientes())
    evaluaciones = {e["codigo"]: e for e in contenido["evaluaciones"]}
    for item in contenido["detectados"]:
        if _es_condicionada(item) and item["codigo"] not in evaluaciones:
            pendientes.append(f"{item['nombre']}: evaluá la concentración en el producto final y documentá el respaldo.")
    presentes = {d["codigo"] for d in contenido["detectados"]}
    for item in contenido["contaminacion_cruzada"]:
        if not item.get("respaldo"):
            pendientes.append(f"Contaminación cruzada de {nombres.get(item['codigo'], item['codigo'])}: falta respaldo de autorización sanitaria.")
        if item["codigo"] in presentes:
            pendientes.append(f"{nombres.get(item['codigo'], item['codigo'])} ya está presente: revisá la declaración cruzada.")
    return pendientes


def _texto(contenido):
    evaluaciones = {e["codigo"]: e for e in contenido["evaluaciones"]}
    directos, derivados = [], []
    for item in contenido["detectados"]:
        codigo = item["codigo"]
        if _es_condicionada(item) and codigo not in evaluaciones:
            continue
        if codigo in evaluaciones and not evaluaciones[codigo]["declarar"]:
            continue
        formas = {f["forma"] for f in item["fuentes"]}
        (directos if "directa" in formas else derivados).append(item["nombre"].upper())
    partes = []
    if directos:
        partes.append("CONTIENE " + ", ".join(directos))
    if derivados:
        partes.append("CONTIENE DERIVADOS DE " + ", ".join(derivados))
    return ". ".join(partes)


def revision_salida(db, borrador, revision):
    if revision is None:
        return {"revision": 0, "estado": "sugerida", "vigencia": "desactualizada",
                "pendientes": ["Generá la propuesta de declaraciones."], "contenido": None,
                "confirmado_por_id": None, "confirmado_por_nombre": None, "confirmado_en": None,
                "declaracion": "", "declaracion_cruzada": ""}
    contenido = revision.contenido
    actual = generar_propuesta_declaraciones(db, borrador.producto_id,
                                             borrador.version_receta_id, borrador.lote_producto_id,
                                             borrador.lista_ingredientes)
    vigente = revision.huella_origen == actual["huella_origen"]
    nombres = _nombres(db)
    pendientes = pendientes_contenido(contenido, nombres)
    if not vigente:
        pendientes.append("Los datos de origen cambiaron. Regenerá y revisá la propuesta.")
    return {"revision": revision.numero,
            "estado": "confirmada" if revision.confirmado_en else "sugerida",
            "vigencia": "vigente" if vigente else "desactualizada", "pendientes": pendientes,
            "contenido": contenido, "confirmado_por_id": revision.confirmado_por_id,
            "confirmado_por_nombre": (f"{revision.confirmado_por.nombre} {revision.confirmado_por.apellido or ''}".strip()
                                      if revision.confirmado_por else None),
            "confirmado_en": revision.confirmado_en,
            "declaracion": _texto(contenido),
            "declaracion_cruzada": _texto_cruzado(contenido, nombres)}


def _texto_cruzado(contenido, nombres):
    """PUEDE CONTENER: lo que declaran los ingredientes y la contaminación
    cruzada de la planta, sin repetir."""
    codigos = [p["codigo"] for p in contenido.get("puede_contener", [])]
    codigos += [c["codigo"] for c in contenido["contaminacion_cruzada"] if c["codigo"] not in codigos]
    if not codigos:
        return ""
    return "PUEDE CONTENER " + ", ".join(nombres.get(c, c).upper() for c in codigos)


def consultar(db, borrador_id):
    borrador = borrador_por_id(db, borrador_id)
    return revision_salida(db, borrador, ultima_revision(db, borrador_id))


def _registrar(db, borrador, anterior, contenido, usuario):
    revision = RevisionDeclaracionRotulado(
        borrador_id=borrador.id, numero=(anterior.numero + 1 if anterior else 1),
        contenido=contenido, huella_origen=contenido["huella_origen"],
        creado_por_id=getattr(usuario, "id", None),
    )
    db.add(revision)
    db.add(CampoRotuladoEditado(
        borrador_id=borrador.id, campo="declaraciones", origen="manual" if anterior else "receta",
        tipo_operacion="revision", usuario_id=getattr(usuario, "id", None),
        valor_original=str(anterior.numero) if anterior else None, valor_nuevo=str(revision.numero),
    ))
    borrador.actualizado_en = ahora()
    borrador.actualizado_por_id = getattr(usuario, "id", None)
    borrador.estado = "borrador"
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Otra operación creó una revisión. Recargá antes de continuar.") from None
    return revision


def generar_revision(db, borrador, usuario=None, usar_conservacion_producto=False):
    """Participa en la transacción del llamador; no confirma ni hace commit."""
    anterior = ultima_revision(db, borrador.id)
    contenido = generar_propuesta_declaraciones(db, borrador.producto_id,
                                               borrador.version_receta_id, borrador.lote_producto_id,
                                               borrador.lista_ingredientes)
    borrador.version_receta_id = contenido["version_receta_id"]
    if anterior:
        contenido["contaminacion_cruzada"] = copy.deepcopy(anterior.contenido["contaminacion_cruzada"])
        if anterior.contenido["conservacion_origen"] == "manual" and not usar_conservacion_producto:
            contenido["conservacion"] = copy.deepcopy(anterior.contenido["conservacion"])
            contenido["conservacion_origen"] = "manual"
        # Las evaluaciones regulatorias dependen del origen: se revisan de nuevo si cambia.
        if anterior.huella_origen == contenido["huella_origen"]:
            contenido["evaluaciones"] = copy.deepcopy(anterior.contenido["evaluaciones"])
        if anterior.contenido == contenido:
            return anterior
    return _registrar(db, borrador, anterior, contenido, usuario)


def _esperada(db, borrador_id, numero):
    revision = ultima_revision(db, borrador_id)
    if (revision.numero if revision else 0) != numero:
        raise HTTPException(409, "La revisión cambió. Recargá antes de continuar.")
    return revision


def _commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "La revisión cambió. Recargá antes de continuar.") from None


def regenerar(db, borrador_id, datos, usuario):
    _reservar_escritura(db)
    _admin(db, usuario)
    borrador = borrador_por_id(db, borrador_id)
    _esperada(db, borrador_id, datos.revision)
    if datos.version_id is not None:
        version = resolver_version(db, borrador.producto_id, datos.version_id, borrador.lote_producto_id)
        borrador.version_receta_id = version.id
    generar_revision(db, borrador, usuario, datos.usar_conservacion_producto)
    _commit(db)
    return consultar(db, borrador_id)


def editar(db, borrador_id, datos, usuario):
    _reservar_escritura(db)
    _admin(db, usuario)
    borrador = borrador_por_id(db, borrador_id)
    anterior = _esperada(db, borrador_id, datos.revision)
    if anterior is None:
        raise HTTPException(409, "Generá una propuesta antes de editar.")
    if consultar(db, borrador_id)["vigencia"] != "vigente":
        raise HTTPException(409, "El origen cambió. Regenerá antes de editar.")
    contenido = copy.deepcopy(anterior.contenido)
    cambios = datos.model_dump(mode="json", exclude_unset=True)
    for campo in ("conservacion", "contaminacion_cruzada", "evaluaciones"):
        if campo not in cambios:
            continue
        valor = cambios[campo]
        if campo == "conservacion":
            valor = ConservacionProducto.model_validate(valor).model_dump(mode="json") if valor is not None else None
            previa = contenido[campo]
            normalizada = ConservacionProducto.model_validate(previa).model_dump(mode="json") if previa is not None else None
            if normalizada == valor:
                continue
        if campo != "conservacion" and valor is None:
            raise HTTPException(422, "Usá una lista vacía para eliminar declaraciones.")
        if campo != "conservacion":
            codigos = [v["codigo"] for v in valor]
            if len(codigos) != len(set(codigos)):
                raise HTTPException(422, "Hay sustancias duplicadas.")
            if campo == "contaminacion_cruzada":
                catalogo = catalogo_por_codigo(db)
                previos = {c["codigo"] for c in contenido[campo]}
                # Uno dado de baja solo se acepta si ya estaba declarado.
                if any(c not in catalogo or (not catalogo[c].activo and c not in previos) for c in codigos):
                    raise HTTPException(422, "Sustancia desconocida.")
            if campo == "evaluaciones" and any(c not in {d["codigo"] for d in contenido["detectados"]} for c in codigos):
                raise HTTPException(422, "Solo se pueden evaluar sustancias detectadas.")
        contenido[campo] = valor
        if campo == "conservacion":
            contenido["conservacion_origen"] = "manual"
    if contenido != anterior.contenido:
        _registrar(db, borrador, anterior, contenido, usuario)
    _commit(db)
    return consultar(db, borrador_id)


def confirmar(db, borrador_id, datos, usuario):
    _reservar_escritura(db)
    persona = _admin(db, usuario)
    borrador = borrador_por_id(db, borrador_id)
    revision = _esperada(db, borrador_id, datos.revision)
    salida = consultar(db, borrador_id)
    if salida["vigencia"] != "vigente":
        raise HTTPException(409, "La propuesta está desactualizada. Regenerá antes de confirmar.")
    if salida["pendientes"]:
        raise HTTPException(422, {"mensaje": "Resolvé los pendientes antes de confirmar.", "pendientes": salida["pendientes"]})
    if revision.confirmado_en is None:
        revision.confirmado_por_id = persona.id
        revision.confirmado_en = ahora()
        db.add(CampoRotuladoEditado(
            borrador_id=borrador.id, campo="declaraciones", origen="manual",
            tipo_operacion="confirmacion", usuario_id=persona.id,
            valor_original="sugerida", valor_nuevo=f"confirmada: revisión {revision.numero}",
        ))
        db.flush()
        # Comprobar de nuevo después de adquirir la reserva de escritura de SQLite.
        db.expire_all()
        _esperada(db, borrador_id, datos.revision)
        if consultar(db, borrador_id)["vigencia"] != "vigente":
            db.rollback()
            raise HTTPException(409, "El origen cambió durante la confirmación.")
        _commit(db)
    return consultar(db, borrador_id)
