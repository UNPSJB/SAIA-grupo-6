import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.common.fechas import ahora
from src.common.texto import normalizar_texto
from src.insumos.models import TIPO_ADITIVO, Insumo
from src.nutricion.models import PerfilNutricionalInsumo
from src.productos.models import Producto
from src.recetas import exceptions as recetas_exceptions
from src.recetas.models import Receta, VersionReceta
from src.recetas.services import obtener_version, version_vigente
from src.rotulado_frontal import constants as c, exceptions, schemas
from src.rotulado_frontal.models import (
    ConfiguracionModuloRotulado,
    ConfiguracionRotuladoProducto,
    EvaluacionRotulado,
    ReglaRotuladoFrontal,
)


# --------------------------------------------------------------------------
# Producto y reglas
# --------------------------------------------------------------------------

def _obtener_producto(db: Session, producto_id: int) -> Producto:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise exceptions.ProductoNoEncontrado()
    return producto


def regla_vigente(db: Session) -> ReglaRotuladoFrontal:
    regla = db.scalar(
        select(ReglaRotuladoFrontal)
        .where(ReglaRotuladoFrontal.vigente.is_(True))
        .order_by(ReglaRotuladoFrontal.version.desc())
        .limit(1)
    )
    if regla is None:
        raise exceptions.SinReglaVigente()
    return regla


def listar_reglas(db: Session) -> list[ReglaRotuladoFrontal]:
    return list(
        db.scalars(
            select(ReglaRotuladoFrontal).order_by(ReglaRotuladoFrontal.version.desc())
        ).all()
    )


def crear_regla(db: Session, datos: schemas.ReglaRotuladoIn) -> ReglaRotuladoFrontal:
    ultima = db.scalar(select(func.max(ReglaRotuladoFrontal.version))) or 0
    regla = ReglaRotuladoFrontal(
        **datos.model_dump(),
        version=ultima + 1,
        vigente=False,
    )
    db.add(regla)
    db.commit()
    db.refresh(regla)
    return regla


def activar_regla(db: Session, regla_id: int) -> ReglaRotuladoFrontal:
    regla = db.get(ReglaRotuladoFrontal, regla_id)
    if regla is None:
        raise exceptions.ReglaNoEncontrada()
    if not regla.vigente:
        for activa in db.scalars(
            select(ReglaRotuladoFrontal).where(ReglaRotuladoFrontal.vigente.is_(True))
        ).all():
            activa.vigente = False
        regla.vigente = True
        db.commit()
        db.refresh(regla)
    return regla


def ajuste_modulo(db: Session) -> ConfiguracionModuloRotulado:
    """Interruptor global; si falta la fila, se crea activo."""
    ajuste = db.get(ConfiguracionModuloRotulado, 1)
    if ajuste is None:
        ajuste = ConfiguracionModuloRotulado(id=1, modulo_activo=True)
        db.add(ajuste)
        db.commit()
        db.refresh(ajuste)
    return ajuste


def actualizar_modulo(
    db: Session, modulo_activo: bool
) -> ConfiguracionModuloRotulado:
    ajuste = ajuste_modulo(db)
    ajuste.modulo_activo = modulo_activo
    db.commit()
    db.refresh(ajuste)
    return ajuste


# --------------------------------------------------------------------------
# Configuración y detección de marcas
# --------------------------------------------------------------------------

def _configuracion(
    db: Session, producto_id: int
) -> ConfiguracionRotuladoProducto | None:
    return db.get(ConfiguracionRotuladoProducto, producto_id)


def _respuesta_configuracion(
    config: ConfiguracionRotuladoProducto | None,
) -> schemas.ConfiguracionRotuladoResponse:
    if config is None:
        return schemas.ConfiguracionRotuladoResponse(
            configurada=False,
            envasado_sin_cliente=None,
            azucares_agregados=None,
            grasas_agregadas=None,
            sodio_agregado=None,
            edulcorantes=None,
            cafeina=None,
            canal_comercializacion=c.CANAL_MINORISTA,
        )
    return schemas.ConfiguracionRotuladoResponse(
        configurada=True,
        envasado_sin_cliente=config.envasado_sin_cliente,
        azucares_agregados=config.azucares_agregados,
        grasas_agregadas=config.grasas_agregadas,
        sodio_agregado=config.sodio_agregado,
        edulcorantes=config.edulcorantes,
        cafeina=config.cafeina,
        canal_comercializacion=config.canal_comercializacion or c.CANAL_MINORISTA,
    )


def _canal(config: ConfiguracionRotuladoProducto | None) -> str:
    if config is None:
        return c.CANAL_MINORISTA
    return config.canal_comercializacion or c.CANAL_MINORISTA


def _envasado(
    config: ConfiguracionRotuladoProducto | None, regla: ReglaRotuladoFrontal
) -> bool | None:
    if regla.requiere_envasado:
        return config.envasado_sin_cliente if config is not None else None
    return True


def _receta_de(db: Session, producto_id: int) -> Receta | None:
    return db.scalar(select(Receta).where(Receta.producto_id == producto_id))


def _version_de(
    db: Session, receta: Receta | None, version_id: int | None
) -> VersionReceta | None:
    if receta is None:
        if version_id is not None:
            raise exceptions.VersionNoEncontrada()
        return None
    if version_id is not None:
        try:
            version = obtener_version(db, version_id)
        except recetas_exceptions.VersionNoEncontrada:
            raise exceptions.VersionNoEncontrada()
        if version.receta_id != receta.id:
            raise exceptions.VersionNoEncontrada()
        return version

    vigente = version_vigente(db, receta.id)
    if vigente is None:
        return None
    return obtener_version(db, vigente.id)


def _perfiles_de(
    db: Session, insumo_ids: list[int]
) -> dict[int, PerfilNutricionalInsumo]:
    if not insumo_ids:
        return {}
    return {
        perfil.insumo_id: perfil
        for perfil in db.scalars(
            select(PerfilNutricionalInsumo).where(
                PerfilNutricionalInsumo.insumo_id.in_(insumo_ids)
            )
        ).all()
    }


def _codigo_ins(valor: str | None) -> str | None:
    """Normaliza el INS: acepta "951", "E951" o "E 951" y devuelve "951"."""
    if not valor:
        return None
    digitos = "".join(caracter for caracter in valor if caracter.isdigit())
    return digitos or None


def _contiene_ingrediente(nombre: str, terminos: tuple[str, ...]) -> bool:
    """Coincide por palabra completa, no por fragmento ("tomate" ≠ "mate")."""
    palabras = set(re.findall(r"[a-z0-9]+", normalizar_texto(nombre)))
    for termino in terminos:
        partes = normalizar_texto(termino).split()
        if partes and all(parte in palabras for parte in partes):
            return True
    return False


def _fuentes_derivadas(
    db: Session, version: VersionReceta | None, regla: ReglaRotuladoFrontal
) -> dict[str, set[tuple[int, str, str, str]]]:
    fuentes: dict[str, set[tuple[int, str, str, str]]] = {
        clave: set() for clave in c.CLAVES_MARCA
    }
    if version is None:
        return fuentes

    ids = [renglon.insumo_id for renglon in version.insumos]
    perfiles = _perfiles_de(db, ids)
    clases_edulcorante = {
        normalizar_texto(clase)
        for clase in regla.clases_edulcorante
        if clase.strip()
    }
    ins_edulcorantes = {
        codigo
        for codigo in (_codigo_ins(valor) for valor in regla.ins_edulcorantes)
        if codigo is not None
    }
    ingredientes_cafeina = tuple(regla.ingredientes_cafeina)

    for renglon in version.insumos:
        insumo: Insumo = renglon.insumo
        perfil = perfiles.get(insumo.id)

        if perfil is not None:
            for clave, campo in c.CAMPO_PERFIL.items():
                if bool(getattr(perfil, campo)):
                    fuentes[clave].add(
                        (insumo.id, insumo.nombre, insumo.tipo, c.MOTIVO_PERFIL)
                    )

        if (
            insumo.tipo == TIPO_ADITIVO
            and insumo.aditivo is not None
            and insumo.aditivo.clase_funcional is not None
        ):
            aditivo = insumo.aditivo
            clase = aditivo.clase_funcional.nombre
            if normalizar_texto(clase) in clases_edulcorante:
                # La clase funcional por sí sola puede ser demasiado amplia.
                # Si la regla pide validar INS, se exige un código reconocido;
                # sin INS declarado se mantiene la marca por clase.
                codigo = _codigo_ins(aditivo.numero_ins)
                ins_valido = (
                    not regla.validar_ins_edulcorantes
                    or codigo is None
                    or codigo in ins_edulcorantes
                )
                if ins_valido:
                    detalle_ins = f" (INS {aditivo.numero_ins})" if codigo else ""
                    fuentes[c.EDULCORANTES].add(
                        (
                            insumo.id,
                            insumo.nombre,
                            insumo.tipo,
                            f"{c.MOTIVO_CLASE}: {clase}{detalle_ins}",
                        )
                    )

        # Cafeína intrínseca de materias primas compuestas: no hace falta que
        # el insumo sea "cafeína" pura ni que tenga el perfil marcado.
        if not any(fuente[0] == insumo.id for fuente in fuentes[c.CAFEINA]):
            if _contiene_ingrediente(insumo.nombre, ingredientes_cafeina):
                fuentes[c.CAFEINA].add(
                    (
                        insumo.id,
                        insumo.nombre,
                        insumo.tipo,
                        c.MOTIVO_CAFEINA_INTRINSECA,
                    )
                )

    return fuentes


def _fuentes_lista(
    fuentes: set[tuple[int, str, str, str]]
) -> list[schemas.FuenteMarca]:
    return [
        schemas.FuenteMarca(
            insumo_id=insumo_id,
            nombre=nombre,
            tipo=tipo,
            motivo=motivo,
        )
        for insumo_id, nombre, tipo, motivo in sorted(
            fuentes, key=lambda item: (item[1].lower(), item[3].lower())
        )
    ]


def _marca(
    clave: str,
    regla: ReglaRotuladoFrontal,
    config: ConfiguracionRotuladoProducto | None,
    fuentes_derivadas: set[tuple[int, str, str, str]],
    derivable: bool,
) -> schemas.MarcaRotulado:
    fuentes = _fuentes_lista(fuentes_derivadas)
    obligatoria = bool(getattr(regla, c.CAMPO_OBLIGA[clave]))
    correccion = (
        getattr(config, c.CAMPO_CONFIGURACION[clave]) if config is not None else None
    )

    if correccion is not None:
        return schemas.MarcaRotulado(
            clave=clave,
            nombre=c.NOMBRES_MARCA[clave],
            obligatoria=obligatoria,
            valor=correccion,
            origen=c.ORIGEN_CORRECCION,
            resuelta=True,
            fuentes=fuentes,
        )

    if derivable:
        return schemas.MarcaRotulado(
            clave=clave,
            nombre=c.NOMBRES_MARCA[clave],
            obligatoria=obligatoria,
            valor=bool(fuentes),
            origen=c.ORIGEN_RECETA,
            resuelta=True,
            fuentes=fuentes,
        )

    return schemas.MarcaRotulado(
        clave=clave,
        nombre=c.NOMBRES_MARCA[clave],
        obligatoria=obligatoria,
        valor=None,
        origen=None,
        resuelta=False,
        fuentes=fuentes,
    )


def _reglas_de(regla: ReglaRotuladoFrontal) -> schemas.ReglasAplicabilidad:
    return schemas.ReglasAplicabilidad.model_validate(regla.reglas_aplicabilidad)


def _comparar(actual, operador: str, esperado) -> bool:
    if operador == "es_verdadero":
        return actual is True
    if operador == "es_falso":
        return actual is False
    if operador == "es_nulo":
        return actual is None
    if operador == "no_es_nulo":
        return actual is not None
    if operador == "igual":
        return actual == esperado
    if operador == "distinto":
        return actual != esperado
    return False


def _cumple_todas(
    condiciones: list[schemas.CondicionAplicabilidad], hechos: dict
) -> bool:
    return all(
        _comparar(
            hechos.get(condicion.campo),
            condicion.operador,
            condicion.valor,
        )
        for condicion in condiciones
    )


def _resultado_de(
    resultado: schemas.CondicionReglaAplicabilidad
    | schemas.ResultadoReglaAplicabilidad,
    marcas_pendientes: list[str],
) -> tuple[str, str, list[str]]:
    texto_marcas = ", ".join(marcas_pendientes)
    faltantes = list(resultado.faltantes)
    if resultado.incluir_marcas_pendientes:
        faltantes.extend(marcas_pendientes)
    mensaje = resultado.mensaje.replace("{marcas}", texto_marcas)
    if resultado.mensaje_extra_marcas and marcas_pendientes:
        extra = resultado.mensaje_extra_marcas.replace("{marcas}", texto_marcas)
        mensaje = f"{mensaje} {extra}"
    return resultado.estado, mensaje, faltantes


def _aplicar_reglas(
    reglas: schemas.ReglasAplicabilidad,
    hechos: dict,
    marcas_pendientes: list[str],
) -> tuple[str, str, list[str]]:
    """Motor ciego: la primera condición que se cumple define el resultado."""
    for condicion in reglas.condiciones:
        if _cumple_todas(condicion.cuando, hechos):
            return _resultado_de(condicion, marcas_pendientes)
    return _resultado_de(reglas.resultado_por_defecto, marcas_pendientes)


def _parametros_congelados(
    regla: ReglaRotuladoFrontal,
) -> schemas.InstantaneaParametrosRotulado:
    return schemas.InstantaneaParametrosRotulado(
        regla_id=regla.id,
        regla_version=regla.version,
        vigente=regla.vigente,
        vigencia_desde=regla.vigencia_desde,
        norma_origen=regla.norma_origen,
        requiere_envasado=regla.requiere_envasado,
        obliga_azucares=regla.obliga_azucares,
        obliga_grasas=regla.obliga_grasas,
        obliga_sodio=regla.obliga_sodio,
        obliga_edulcorantes=regla.obliga_edulcorantes,
        obliga_cafeina=regla.obliga_cafeina,
        clases_edulcorante=list(regla.clases_edulcorante),
        validar_ins_edulcorantes=regla.validar_ins_edulcorantes,
        ins_edulcorantes=list(regla.ins_edulcorantes),
        ingredientes_cafeina=list(regla.ingredientes_cafeina),
        umbrales_sellos=[
            schemas.ParametroNormativo.model_validate(parametro)
            for parametro in regla.umbrales_sellos
        ],
        formulas_nutricionales=[
            schemas.ParametroNormativo.model_validate(parametro)
            for parametro in regla.formulas_nutricionales
        ],
        reglas_aplicabilidad=_reglas_de(regla),
    )


def _registrar_evaluacion(
    db: Session,
    producto: Producto,
    instantanea: schemas.InstantaneaRotulado,
) -> None:
    db.add(
        EvaluacionRotulado(
            producto_id=producto.id,
            producto_nombre=producto.nombre,
            receta_id=instantanea.receta_id,
            version_receta_id=instantanea.version_receta_id,
            regla_id=instantanea.regla_id,
            regla_version=instantanea.regla_version,
            norma_origen=instantanea.norma_origen,
            estado=instantanea.estado,
            mensaje=instantanea.mensaje,
            evaluado_en=instantanea.evaluado_en,
            instantanea=instantanea.model_dump(mode="json"),
        )
    )
    db.commit()


def listar_evaluaciones(
    db: Session, producto_id: int, limite: int = 20
) -> list[EvaluacionRotulado]:
    _obtener_producto(db, producto_id)
    return list(
        db.scalars(
            select(EvaluacionRotulado)
            .where(EvaluacionRotulado.producto_id == producto_id)
            .order_by(EvaluacionRotulado.evaluado_en.desc())
            .limit(limite)
        ).all()
    )


def evaluar(
    db: Session, producto_id: int, version_id: int | None = None
) -> schemas.EvaluacionRotuladoResponse:
    producto = _obtener_producto(db, producto_id)
    regla = regla_vigente(db)
    ajuste = ajuste_modulo(db)
    config = _configuracion(db, producto_id)

    receta = _receta_de(db, producto_id)
    version = _version_de(db, receta, version_id)
    derivable = version is not None
    evaluado_en = ahora()

    canal = _canal(config)
    envasado = _envasado(config, regla)
    reglas = _reglas_de(regla)
    categorias_exceptuadas = {
        categoria.clave for categoria in reglas.categorias_exceptuadas
    }
    categoria_exceptuada = bool(
        producto.categoria_rotulado
        and producto.categoria_rotulado in categorias_exceptuadas
    )
    hechos = {
        "modulo_activo": ajuste.modulo_activo,
        "canal_consumo_final": canal in reglas.canales_consumo_final,
        "categoria_exceptuada": categoria_exceptuada,
        "envasado": envasado,
        "siempre": True,
    }

    advertencias: list[str] = []
    if receta is None:
        advertencias.append(c.ADVERTENCIA_SIN_RECETA)
    elif version is None:
        advertencias.append(c.ADVERTENCIA_SIN_VERSION)

    # El cruce de la receta también es una decisión de la regla: si sus
    # condiciones no se cumplen, no se consultan ingredientes ni perfiles.
    evaluar_perfil = _cumple_todas(reglas.evaluar_perfil_cuando, hechos)
    if evaluar_perfil:
        fuentes = _fuentes_derivadas(db, version, regla)
    else:
        fuentes = {clave: set() for clave in c.CLAVES_MARCA}

    marcas = [
        _marca(clave, regla, config, fuentes[clave], derivable and evaluar_perfil)
        for clave in c.CLAVES_MARCA
    ]
    pendientes = [m.nombre for m in marcas if m.obligatoria and not m.resuelta]
    hechos["alguna_marca_obligatoria"] = any(
        marca.obligatoria and marca.valor for marca in marcas
    )
    hechos["hay_marcas_pendientes"] = bool(pendientes)
    estado, mensaje, faltantes = _aplicar_reglas(reglas, hechos, pendientes)

    version_resumen = None
    if version is not None:
        version_resumen = schemas.VersionRotuladoResumen(
            id=version.id,
            numero=version.numero,
            rendimiento=version.rendimiento,
            unidad=version.unidad_medida.simbolo,
        )

    configuracion = _respuesta_configuracion(config)
    instantanea = schemas.InstantaneaRotulado(
        evaluado_en=evaluado_en,
        estado=estado,
        mensaje=mensaje,
        modulo_activo=ajuste.modulo_activo,
        parametros=_parametros_congelados(regla),
        regla_id=regla.id,
        regla_version=regla.version,
        norma_origen=regla.norma_origen,
        receta_id=receta.id if receta is not None else None,
        version_receta_id=version.id if version is not None else None,
        version_receta_numero=version.numero if version is not None else None,
        configuracion=configuracion,
        categoria_rotulado=producto.categoria_rotulado,
        categoria_exceptuada_por_ley=producto.categoria_exceptuada_por_ley,
        canal_comercializacion=canal,
        envasado_sin_cliente=config.envasado_sin_cliente
        if config is not None
        else None,
        faltantes=list(faltantes),
        advertencias=list(advertencias),
        marcas=marcas,
    )

    respuesta = schemas.EvaluacionRotuladoResponse(
        producto_id=producto.id,
        producto=producto.nombre,
        receta_id=receta.id if receta is not None else None,
        version=version_resumen,
        regla=schemas.ReglaRotuladoResponse.model_validate(regla),
        configuracion=configuracion,
        categoria_rotulado=producto.categoria_rotulado,
        categoria_exceptuada_por_ley=producto.categoria_exceptuada_por_ley,
        modulo_activo=ajuste.modulo_activo,
        estado=estado,
        mensaje=mensaje,
        faltantes=faltantes,
        advertencias=advertencias,
        marcas=marcas,
        evaluado_en=evaluado_en,
        instantanea=instantanea,
    )
    _registrar_evaluacion(db, producto, instantanea)
    return respuesta


def guardar_configuracion(
    db: Session, producto_id: int, datos: schemas.ConfiguracionRotuladoIn
) -> schemas.EvaluacionRotuladoResponse:
    producto = _obtener_producto(db, producto_id)
    config = _configuracion(db, producto_id)
    if config is None:
        config = ConfiguracionRotuladoProducto(producto_id=producto_id)
        db.add(config)

    for campo in c.CAMPO_CONFIGURACION.values():
        setattr(config, campo, getattr(datos, campo))

    config.envasado_sin_cliente = datos.envasado_sin_cliente

    if datos.canal_comercializacion is not None:
        config.canal_comercializacion = datos.canal_comercializacion
    elif config.canal_comercializacion is None:
        config.canal_comercializacion = c.CANAL_MINORISTA

    if "categoria_rotulado" in datos.model_fields_set:
        producto.categoria_rotulado = datos.categoria_rotulado or None
        producto.categoria_exceptuada_por_ley = bool(producto.categoria_rotulado)
    elif "categoria_exceptuada_por_ley" in datos.model_fields_set:
        # Compatibilidad con clientes anteriores: una marca booleana se traduce
        # a la categoría genérica, que también puede quedar fuera de la lista.
        producto.categoria_exceptuada_por_ley = bool(
            datos.categoria_exceptuada_por_ley
        )
        if producto.categoria_exceptuada_por_ley and not producto.categoria_rotulado:
            producto.categoria_rotulado = "otra_exceptuada"
        elif not producto.categoria_exceptuada_por_ley:
            producto.categoria_rotulado = None

    db.commit()
    return evaluar(db, producto_id)
