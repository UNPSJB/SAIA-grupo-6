import logging
from fastapi import HTTPException

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora
from src.lotes.services import obtener_lote as obtener_lote_service
from src.nutricion.services import calcular_info_nutricional as calcular_nutricion_service
from src.productos.models import Producto
from src.productos.services import obtener_producto as obtener_producto_service
from src.recetas.composicion_services import calcular_composicion as calcular_composicion_service
from src.recetas.models import Receta, VersionReceta
from src.recetas.services import (
    obtener_version as obtener_version_service,
    version_vigente as version_vigente_service,
)
from src.rotulado import exceptions, schemas
from src.rotulado import declaraciones_services as declaraciones
from src.rotulado.constants import (
    CAMPO_COMPLETO,
    CAMPO_NO_APLICABLE,
    CAMPO_PENDIENTE,
    CAMPO_SIN_DATOS_ORIGEN,
    CAMPOS_IMPORTADOR,
    CAMPOS_LOTE,
    CAMPOS_NUTRICION,
    ORIGEN_LOTE,
    ORIGEN_MANUAL,
    ORIGEN_NUTRICION,
    ORIGEN_PRODUCTO,
    ORIGEN_RECETA,
    TIPO_AUTOCOMPLETADO,
    TIPO_EDICION_MANUAL,
)
from src.rotulado.models import BorradorRotulado, CampoRotuladoEditado


def _nombre_persona(usuario: Optional[object]) -> Optional[str]:
    if usuario is None:
        return None
    nombre = getattr(usuario, "nombre", None)
    apellido = getattr(usuario, "apellido", None)
    partes = [p for p in (nombre, apellido) if p]
    return " ".join(partes) if partes else None


def _registrar_edicion(
    db: Session,
    borrador: BorradorRotulado,
    campo: str,
    valor_original: Optional[str],
    valor_nuevo: Optional[str],
    origen: str,
    tipo_operacion: str,
    usuario_id: Optional[int],
) -> None:
    edicion = CampoRotuladoEditado(
        borrador_id=borrador.id,
        campo=campo,
        valor_original=valor_original,
        valor_nuevo=valor_nuevo,
        origen=origen,
        tipo_operacion=tipo_operacion,
        usuario_id=usuario_id,
        modificado_en=ahora(),
    )
    db.add(edicion)


def _texto_si_cambio(valor_actual: Optional[str], valor_nuevo: Optional[str]) -> bool:
    return valor_actual != valor_nuevo


def _formatear_ingredientes(composicion) -> str:
    """Construye la lista de ingredientes a partir del resultado de E10.

    Ingredientes y aditivos se declaran separados, con nombre, cantidad y
    porcentaje cuando están disponibles. El orden es el que devuelve
    `calcular_composicion` (orden de la versión de receta).
    """
    lineas: list[str] = []
    if composicion.ingredientes:
        for item in composicion.ingredientes:
            linea = item.insumo.nombre
            if item.porcentaje is not None:
                linea += f" ({item.porcentaje} %)"
            lineas.append(linea)
    if composicion.aditivos:
        for item in composicion.aditivos:
            linea = item.insumo.nombre
            if item.porcentaje is not None:
                linea += f" ({item.porcentaje} %)"
            lineas.append(linea)
    return "; ".join(lineas) if lineas else None


def _serializar_nutricion(info_nutricional) -> Optional[str]:
    """Serializa la información nutricional de E11 como JSON estructurado.

    No modifica E11; solo guarda una instantánea de lectura.
    """
    import json

    datos = {
        "version_id": getattr(getattr(info_nutricional, "version", None), "id", None),
        "version_numero": getattr(
            getattr(info_nutricional, "version", None), "numero", None
        ),
        "producto": getattr(info_nutricional, "producto", None),
        "estado": getattr(info_nutricional, "estado", None),
        "problemas": getattr(info_nutricional, "problemas", None) or [],
        "expresar_en": getattr(info_nutricional, "expresar_en", None),
        "porcion": (
            float(getattr(info_nutricional.configuracion, "porcion"))
            if getattr(info_nutricional, "configuracion", None)
            and getattr(info_nutricional.configuracion, "porcion", None) is not None
            else None
        ),
        "medida_casera": (
            getattr(info_nutricional.configuracion, "medida_casera", None)
            if getattr(info_nutricional, "configuracion", None)
            else None
        ),
        "filas": [
            {
                "clave": f.clave,
                "nombre": f.nombre,
                "unidad": f.unidad,
                "por_100": float(f.por_100) if f.por_100 is not None else None,
                "por_porcion": (
                    float(f.por_porcion) if f.por_porcion is not None else None
                ),
                "vd": float(f.vd) if f.vd is not None else None,
                "por_100_texto": f.por_100_texto,
                "por_porcion_texto": f.por_porcion_texto,
                "vd_texto": f.vd_texto,
                "no_significativo": f.no_significativo,
                "faltan_datos": f.faltan_datos,
                "de_laboratorio": f.de_laboratorio,
            }
            for f in (getattr(info_nutricional, "filas", None) or [])
        ],
        "calculado_en": (
            getattr(info_nutricional, "calculado_en", None).isoformat()
            if getattr(info_nutricional, "calculado_en", None)
            else None
        ),
    }
    return json.dumps(datos, ensure_ascii=False)


def obtener_borrador(db: Session, borrador_id: int) -> BorradorRotulado:
    borrador = db.get(BorradorRotulado, borrador_id)
    if borrador is None or borrador.archivado:
        raise exceptions.BorradorNoEncontrado()
    return borrador


def obtener_borradores_por_producto(
    db: Session, producto_id: int
) -> list[BorradorRotulado]:
    from sqlalchemy import select

    consulta = (
        select(BorradorRotulado)
        .where(BorradorRotulado.producto_id == producto_id)
        .where(BorradorRotulado.archivado.is_(False))
        .order_by(BorradorRotulado.actualizado_en.desc())
    )
    return list(db.scalars(consulta).all())


def crear_borrador(
    db: Session,
    producto_id: int,
    datos: schemas.BorradorRotuladoCreate,
    usuario: Optional[object] = None,
) -> BorradorRotulado:
    producto = obtener_producto_service(db, producto_id)
    if producto is None:
        raise exceptions.ProductoNoEncontrado()

    version_receta = None
    if datos.version_receta_id is not None:
        version_receta = obtener_version_service(db, datos.version_receta_id)
        if version_receta is None:
            raise exceptions.VersionNoEncontrada()
        if version_receta is not None:
            # version_receta.receta_id es el id de la receta, no del producto.
            # La receta pertenece al producto mediante receta.producto_id.
    
            receta = db.get(Receta, version_receta.receta_id)
            if receta is None or receta.producto_id != producto_id:
                raise exceptions.VersionNoPerteneceAlProducto()

    lote_producto = None
    if datos.lote_producto_id is not None:
        lote_producto = obtener_lote_service(db, datos.lote_producto_id)
        if lote_producto is None:
            raise exceptions.LoteNoEncontrado()
        if lote_producto.producto_id != producto_id:
            raise exceptions.LoteNoPerteneceAlProducto()
        if (
            datos.version_receta_id is not None
            and lote_producto.version_receta_id is not None
            and lote_producto.version_receta_id != datos.version_receta_id
        ):
            raise exceptions.LoteVersionIncompatible()

    usuario_id = getattr(usuario, "id", None) if usuario is not None else None

    borrador = BorradorRotulado(
        producto_id=producto_id,
        version_receta_id=datos.version_receta_id,
        lote_producto_id=datos.lote_producto_id,
        denominacion_venta=datos.denominacion_venta,
        lista_ingredientes=datos.lista_ingredientes,
        contenido_neto=datos.contenido_neto,
        rnpa_rppa=datos.rnpa_rppa,
        razon_social=datos.razon_social,
        domicilio=datos.domicilio,
        identificacion_lote=datos.identificacion_lote,
        fecha_produccion=datos.fecha_produccion,
        fecha_cierre=datos.fecha_cierre,
        fecha_duracion=datos.fecha_duracion,
        instrucciones_uso=datos.instrucciones_uso,
        es_importado=datos.es_importado,
        importador_razon_social=datos.importador_razon_social,
        importador_domicilio=datos.importador_domicilio,
        estado=datos.estado or "borrador",
        datos_nutricionales_json=datos.datos_nutricionales_json,
        sellos_disponibles=datos.sellos_disponibles,
        creado_por_id=usuario_id,
        actualizado_por_id=usuario_id,
    )
    if datos.estado == "completado":
        raise HTTPException(422, "Confirmá las declaraciones antes de completar el borrador.")
    db.add(borrador)
    db.flush()
    declaraciones.generar_revision(db, borrador, usuario)
    db.commit()
    db.refresh(borrador)
    return borrador


def actualizar_borrador(
    db: Session,
    borrador_id: int,
    datos: schemas.BorradorRotuladoUpdate,
    usuario: Optional[object] = None,
) -> BorradorRotulado:
    declaraciones._reservar_escritura(db)
    borrador = obtener_borrador(db, borrador_id)
    usuario_id = getattr(usuario, "id", None) if usuario is not None else None
    momento = ahora()

    campos = datos.model_dump(exclude_unset=True)
    version_id = campos.get("version_receta_id", borrador.version_receta_id)
    lote_id = campos.get("lote_producto_id", borrador.lote_producto_id)
    version = declaraciones.resolver_version(db, borrador.producto_id, version_id, lote_id)
    cambio_origen = (version.id if version else None) != borrador.version_receta_id or lote_id != borrador.lote_producto_id
    if datos.estado == "completado":
        evaluacion = declaraciones.consultar(db, borrador_id)
        cambio_lista = "lista_ingredientes" in campos and campos["lista_ingredientes"] != borrador.lista_ingredientes
        if cambio_origen or cambio_lista or evaluacion["estado"] != "confirmada" or evaluacion["pendientes"]:
            raise HTTPException(422, "Confirmá declaraciones vigentes antes de completar.")
    for campo, valor in campos.items():
        valor_actual = getattr(borrador, campo, None)
        if _texto_si_cambio(valor_actual, valor):
            _registrar_edicion(
                db,
                borrador,
                campo,
                str(valor_actual) if valor_actual is not None else None,
                str(valor) if valor is not None else None,
                ORIGEN_MANUAL,
                TIPO_EDICION_MANUAL,
                usuario_id,
            )
        setattr(borrador, campo, valor)

    if cambio_origen:
        borrador.version_receta_id = version.id if version else None
        declaraciones.generar_revision(db, borrador, usuario)
    borrador.actualizado_en = momento
    borrador.actualizado_por_id = usuario_id
    db.add(borrador)
    db.commit()
    db.refresh(borrador)
    return borrador


def eliminar_borrador(db: Session, borrador_id: int) -> None:
    borrador = obtener_borrador(db, borrador_id)
    # Se retira de los listados sin eliminar las revisiones históricas HU106.
    borrador.archivado = True
    db.commit()


def autocompletar_borrador(
    db: Session,
    borrador_id: int,
    version_id: Optional[int],
    lote_id: Optional[int],
    forzar: bool,
    usuario: Optional[object] = None,
) -> BorradorRotulado:
    declaraciones._reservar_escritura(db)
    borrador = obtener_borrador(db, borrador_id)
    producto = obtener_producto_service(db, borrador.producto_id)
    if producto is None:
        raise exceptions.ProductoNoEncontrado()

    lote_id = lote_id if lote_id is not None else borrador.lote_producto_id
    usuario_id = getattr(usuario, "id", None) if usuario is not None else None
    cambios_registrados = False

    # ── Validar versión de receta ──
    version_receta = None
    if version_id is not None:
        version_receta = obtener_version_service(db, version_id)
        if version_receta is None:
            raise exceptions.VersionNoEncontrada()

        receta = db.get(Receta, version_receta.receta_id)
        if receta is None or receta.producto_id != borrador.producto_id:
            raise exceptions.VersionNoPerteneceAlProducto()

    # ── Validar lote ──
    lote_producto = None
    if lote_id is not None:
        lote_producto = obtener_lote_service(db, lote_id)
        if lote_producto is None:
            raise exceptions.LoteNoEncontrado()
        if lote_producto.producto_id != borrador.producto_id:
            raise exceptions.LoteNoPerteneceAlProducto()
        if (
            version_receta is not None
            and lote_producto.version_receta_id is not None
            and lote_producto.version_receta_id != version_receta.id
        ):
            raise exceptions.LoteVersionIncompatible()

    # ── Denominación de venta desde Producto ──
    if version_receta is None:
        origen_id = (lote_producto.version_receta_id if lote_producto else None) or borrador.version_receta_id
        if origen_id is not None:
            version_receta = obtener_version_service(db, origen_id)
        else:
            from sqlalchemy import select
            receta_origen = db.scalar(select(Receta).where(Receta.producto_id == borrador.producto_id))
            if receta_origen is not None:
                version_receta = version_vigente_service(db, receta_origen.id)

    if forzar or not borrador.denominacion_venta:
        valor_original = borrador.denominacion_venta
        borrador.denominacion_venta = producto.nombre
        if _texto_si_cambio(valor_original, producto.nombre):
            _registrar_edicion(
                db,
                borrador,
                "denominacion_venta",
                str(valor_original) if valor_original is not None else None,
                producto.nombre,
                ORIGEN_PRODUCTO,
                TIPO_AUTOCOMPLETADO,
                usuario_id,
            )
            cambios_registrados = True

    # ── Lista de ingredientes desde E10 ──
    if version_receta is not None:
        composicion = calcular_composicion_service(db, version_receta.id)
        texto_ingredientes = _formatear_ingredientes(composicion)
        if texto_ingredientes is not None:
            if forzar or not borrador.lista_ingredientes:
                valor_original = borrador.lista_ingredientes
                borrador.lista_ingredientes = texto_ingredientes
                if _texto_si_cambio(valor_original, texto_ingredientes):
                    _registrar_edicion(
                        db,
                        borrador,
                        "lista_ingredientes",
                        str(valor_original) if valor_original is not None else None,
                        texto_ingredientes,
                        ORIGEN_RECETA,
                        TIPO_AUTOCOMPLETADO,
                        usuario_id,
                    )
                    cambios_registrados = True

    # ── Información nutricional desde E11 ──
    if version_receta is not None:
        try:
            info_nutricional = calcular_nutricion_service(
                db, borrador.producto_id, version_receta.id
            )
            json_nutricion = _serializar_nutricion(info_nutricional)
            if json_nutricion is not None:
                if forzar or not borrador.datos_nutricionales_json:
                    valor_original = borrador.datos_nutricionales_json
                    borrador.datos_nutricionales_json = json_nutricion
                    if _texto_si_cambio(valor_original, json_nutricion):
                        _registrar_edicion(
                            db,
                            borrador,
                            "datos_nutricionales_json",
                            str(valor_original) if valor_original is not None else None,
                            json_nutricion,
                            ORIGEN_NUTRICION,
                            TIPO_AUTOCOMPLETADO,
                            usuario_id,
                        )
                        cambios_registrados = True
        except Exception:
            logging.getLogger(__name__).exception("No se pudo calcular nutrici?n para rotulado")
            # E11 puede no tener datos configurados; no bloquea el autocompletado.
            pass

    # ── Datos de lote desde E8 ──
    if lote_producto is not None:
        if forzar or not borrador.identificacion_lote:
            valor_original = borrador.identificacion_lote
            borrador.identificacion_lote = lote_producto.numero_lote
            if _texto_si_cambio(valor_original, lote_producto.numero_lote):
                _registrar_edicion(
                    db,
                    borrador,
                    "identificacion_lote",
                    str(valor_original) if valor_original is not None else None,
                    lote_producto.numero_lote,
                    ORIGEN_LOTE,
                    TIPO_AUTOCOMPLETADO,
                    usuario_id,
                )
                cambios_registrados = True
        if lote_producto.fecha_inicio is not None:
            if forzar or borrador.fecha_produccion is None:
                borrador.fecha_produccion = lote_producto.fecha_inicio
        if lote_producto.fecha_cierre is not None:
            if forzar or borrador.fecha_cierre is None:
                borrador.fecha_cierre = lote_producto.fecha_cierre
        if lote_producto.fecha_vencimiento is not None:
            if forzar or borrador.fecha_duracion is None:
                borrador.fecha_duracion = lote_producto.fecha_vencimiento

    if version_receta is not None:
        borrador.version_receta_id = version_receta.id
    if lote_producto is not None:
        borrador.lote_producto_id = lote_producto.id

    declaraciones.resolver_version(db, borrador.producto_id,
                                  borrador.version_receta_id, borrador.lote_producto_id)
    declaraciones.generar_revision(db, borrador, usuario)
    borrador.actualizado_en = ahora()
    borrador.actualizado_por_id = usuario_id
    db.add(borrador)
    db.commit()
    db.refresh(borrador)
    return borrador


def calcular_completitud(db: Session, borrador_id: int) -> schemas.CompletitudRotulado:
    borrador = obtener_borrador(db, borrador_id)

    campos: list[schemas.CampoCompletitud] = []
    estado_global = CAMPO_COMPLETO

    def agregar_campo(
        nombre: str,
        etiqueta: str,
        valor: Optional[object],
        aplicable: bool = True,
        sin_datos_origen: bool = False,
    ) -> None:
        nonlocal estado_global
        if not aplicable:
            estado_campo = CAMPO_NO_APLICABLE
        elif sin_datos_origen:
            estado_campo = CAMPO_SIN_DATOS_ORIGEN
        elif valor is None or (isinstance(valor, str) and not valor.strip()):
            estado_campo = CAMPO_PENDIENTE
        else:
            estado_campo = CAMPO_COMPLETO

        if estado_campo in (CAMPO_PENDIENTE, CAMPO_SIN_DATOS_ORIGEN):
            if estado_global == CAMPO_COMPLETO:
                estado_global = CAMPO_PENDIENTE

        campos.append(
            schemas.CampoCompletitud(
                nombre=nombre,
                etiqueta=etiqueta,
                estado=estado_campo,
            )
        )

    # Campos base siempre aplicables
    agregar_campo(
        "denominacion_venta",
        "Denominación de venta",
        borrador.denominacion_venta,
    )
    agregar_campo(
        "lista_ingredientes",
        "Lista de ingredientes",
        borrador.lista_ingredientes,
    )
    agregar_campo(
        "contenido_neto",
        "Contenido neto",
        borrador.contenido_neto,
    )
    agregar_campo(
        "rnpa_rppa",
        "Registro del producto (RNPA/RPPA)",
        borrador.rnpa_rppa,
    )
    agregar_campo(
        "razon_social",
        "Razón social del establecimiento",
        borrador.razon_social,
    )
    agregar_campo(
        "domicilio",
        "Domicilio del establecimiento",
        borrador.domicilio,
    )
    agregar_campo(
        "fecha_duracion",
        "Fecha de duración",
        borrador.fecha_duracion,
    )

    # Lote: aplicable solo si se seleccionó un lote
    lote_aplicable = borrador.lote_producto_id is not None
    agregar_campo(
        "identificacion_lote",
        "Identificación del lote",
        borrador.identificacion_lote,
        aplicable=lote_aplicable,
    )
    agregar_campo(
        "fecha_produccion",
        "Fecha de producción",
        borrador.fecha_produccion,
        aplicable=lote_aplicable,
    )
    agregar_campo(
        "fecha_cierre",
        "Fecha de cierre",
        borrador.fecha_cierre,
        aplicable=lote_aplicable,
    )

    # Instrucciones de uso: condicional (cuando corresponda)
    # Por ahora se considera aplicable si el producto no es un producto simple sin preparación.
    # El campo queda como pendiente si está vacío; no aplicable no se marca por defecto.
    agregar_campo(
        "instrucciones_uso",
        "Preparación e instrucciones de uso",
        borrador.instrucciones_uso,
    )

    # Información nutricional: sin datos de origen si E11 no tiene información
    nutricion_aplicable = borrador.datos_nutricionales_json is not None
    sin_datos_nutricion = (
        borrador.version_receta_id is not None
        and borrador.datos_nutricionales_json is None
    )
    agregar_campo(
        "datos_nutricionales_json",
        "Información nutricional",
        borrador.datos_nutricionales_json,
        aplicable=nutricion_aplicable,
        sin_datos_origen=sin_datos_nutricion,
    )

    # Datos del importador: solo aplicable si es_importado
    importador_aplicable = borrador.es_importado
    agregar_campo(
        "importador_razon_social",
        "Razón social del importador",
        borrador.importador_razon_social,
        aplicable=importador_aplicable,
    )
    agregar_campo(
        "importador_domicilio",
        "Domicilio del importador",
        borrador.importador_domicilio,
        aplicable=importador_aplicable,
    )

    # Sellos de advertencia: informativo, no bloqueante
    if not borrador.sellos_disponibles:
        campos.append(
            schemas.CampoCompletitud(
                nombre="sellos_advertencia",
                etiqueta="Sellos de advertencia",
                estado=CAMPO_NO_APLICABLE,
                motivo="Módulo E12 no disponible o sin datos para este producto",
            )
        )

    evaluacion = declaraciones.consultar(db, borrador_id)
    pendiente = evaluacion["estado"] != "confirmada" or bool(evaluacion["pendientes"])
    campos.append(schemas.CampoCompletitud(
        nombre="declaraciones", etiqueta="Alérgenos, gluten y conservación",
        estado=CAMPO_PENDIENTE if pendiente else CAMPO_COMPLETO,
        motivo="; ".join(evaluacion["pendientes"]) or ("Pendiente de confirmación" if pendiente else None),
    ))
    if pendiente:
        estado_global = CAMPO_PENDIENTE
    return schemas.CompletitudRotulado(
        borrador_id=borrador.id,
        estado_global=estado_global,
        campos=campos,
    )


def obtener_historial_ediciones(
    db: Session, borrador_id: int
) -> list[CampoRotuladoEditado]:
    from sqlalchemy import select

    consulta = (
        select(CampoRotuladoEditado)
        .where(CampoRotuladoEditado.borrador_id == borrador_id)
        .order_by(CampoRotuladoEditado.modificado_en.desc())
        .options(selectinload(CampoRotuladoEditado.usuario))
    )
    return list(db.scalars(consulta).all())


def preview_autocompletado(
    db: Session, producto_id: int, version_id: Optional[int] = None
) -> schemas.VistaPreviaAutocompletado:
    """Devuelve datos propuestos para autocompletar un borrador, sin guardar.

    No persiste nada en la base de datos. Solo consulta producto, receta,
    versión, composición (E10) y nutrición (E11) para proponer valores.
    """
    producto = obtener_producto_service(db, producto_id)
    if producto is None:
        raise exceptions.ProductoNoEncontrado()

    # Buscar la receta del producto
    from sqlalchemy import select

    receta = db.scalar(select(Receta).where(Receta.producto_id == producto_id))
    if receta is None:
        return schemas.VistaPreviaAutocompletado(
            producto_id=producto_id,
            producto_nombre=producto.nombre,
            denominacion_venta=producto.nombre,
            declaraciones=declaraciones.generar_propuesta_declaraciones(db, producto_id),
            receta_encontrada=False,
            mensaje="El producto no tiene receta asociada.",
        )

    # Determinar la versión de origen
    version_receta: Optional[VersionReceta] = None
    if version_id is not None:
        version_receta = obtener_version_service(db, version_id)
        if version_receta is None:
            raise exceptions.VersionNoEncontrada()
        receta_check = db.get(Receta, version_receta.receta_id)
        if receta_check is None or receta_check.producto_id != producto_id:
            raise exceptions.VersionNoPerteneceAlProducto()
    else:
        version_receta = version_vigente_service(db, receta.id)

    denominacion_venta = producto.nombre
    lista_ingredientes: Optional[str] = None
    datos_nutricionales_json: Optional[str] = None
    sellos_disponibles = False
    mensaje: Optional[str] = None

    if version_receta is not None:
        # ── Lista de ingredientes desde E10 ──
        composicion = calcular_composicion_service(db, version_receta.id)
        texto_ingredientes = _formatear_ingredientes(composicion)
        if texto_ingredientes is not None:
            lista_ingredientes = texto_ingredientes

        # ── Información nutricional desde E11 ──
        try:
            info_nutricional = calcular_nutricion_service(
                db, producto_id, version_receta.id, inicializar_parametros=False
            )
            json_nutricion = _serializar_nutricion(info_nutricional)
            if json_nutricion is not None:
                datos_nutricionales_json = json_nutricion
        except Exception:
            logging.getLogger(__name__).exception("No se pudo calcular nutrici?n para rotulado")
            # E11 puede no tener datos configurados; no bloquea la vista previa.
            mensaje = (
                mensaje or ""
            ) + " La información nutricional no está disponible para esta versión."

        if not composicion.completa:
            faltantes = ", ".join(
                f.insumo.nombre for f in (composicion.faltantes or [])
            )
            if faltantes:
                mensaje = (
                    mensaje or ""
                ) + f" Faltan datos de composición para: {faltantes}."
    else:
        mensaje = "No se encontró una versión de receta para este producto."

    return schemas.VistaPreviaAutocompletado(
        producto_id=producto_id,
        producto_nombre=producto.nombre,
        denominacion_venta=denominacion_venta,
        lista_ingredientes=lista_ingredientes,
        datos_nutricionales_json=datos_nutricionales_json,
        sellos_disponibles=sellos_disponibles,
        version_receta_id=version_receta.id if version_receta else None,
        version_receta_numero=version_receta.numero if version_receta else None,
        declaraciones=declaraciones.generar_propuesta_declaraciones(db, producto_id, version_receta.id if version_receta else None),
        receta_encontrada=version_receta is not None,
        mensaje=mensaje or None,
    )

