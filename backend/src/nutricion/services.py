import csv
import io
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora
from src.insumos.models import TIPO_ADITIVO, Insumo
from src.nutricion import calculo, constants as c, exceptions, schemas
from src.nutricion.models import (
    AlimentoReferencia,
    InfoNutricionalProducto,
    ParametroNutricion,
    ParametroNutriente,
    PerfilNutricionalInsumo,
    ValorLaboratorioProducto,
    ValorNutricionalInsumo,
)
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaInsumo, VersionReceta

_PRECISION = Decimal("0.0001")


def _q(valor: Decimal | None) -> Decimal | None:
    return None if valor is None else Decimal(valor).quantize(_PRECISION)


def _es_verdadero(texto: str) -> bool:
    return texto.strip().lower() in ("1", "true", "si", "sí")


def _nombre(persona: Personal | None) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido}".strip()


# ── Parámetros ─────────────────────────────────────────────────────────────


def asegurar_parametros(db: Session) -> None:
    """Carga los parámetros que falten con los valores iniciales.

    Se llama antes de leerlos: así una base nueva (o la de los tests) funciona
    sin depender de que haya corrido una migración.
    """
    existentes = set(db.scalars(select(ParametroNutriente.clave)).all())
    generales = set(db.scalars(select(ParametroNutricion.clave)).all())
    cambios = False
    for clave, nombre, unidad, orden in c.NUTRIENTES:
        if clave in existentes:
            continue
        vd, umbral, dec_menor, dec_mayor = c.PARAMETROS_INICIALES[clave]
        db.add(
            ParametroNutriente(
                clave=clave,
                nombre=nombre,
                unidad=unidad,
                orden=orden,
                valor_diario=vd,
                umbral_no_significativo=umbral,
                decimales_menor_10=dec_menor,
                decimales_desde_10=dec_mayor,
            )
        )
        cambios = True
    for clave, valor in c.PARAMETROS_GENERALES_INICIALES.items():
        if clave not in generales:
            db.add(ParametroNutricion(clave=clave, valor=valor))
            cambios = True
    if cambios:
        db.commit()


def _reglas(db: Session) -> dict[str, calculo.ReglaNutriente]:
    asegurar_parametros(db)
    filas = db.scalars(select(ParametroNutriente).order_by(ParametroNutriente.orden)).all()
    return {
        f.clave: calculo.ReglaNutriente(
            clave=f.clave,
            nombre=f.nombre,
            unidad=f.unidad,
            valor_diario=None if f.clave in c.NUTRIENTES_SIN_VD else f.valor_diario,
            umbral_no_significativo=f.umbral_no_significativo,
            decimales_menor_10=f.decimales_menor_10,
            decimales_desde_10=f.decimales_desde_10,
        )
        for f in filas
        if f.clave in c.CLAVES_NUTRIENTES
    }


def _generales(db: Session) -> dict[str, str]:
    asegurar_parametros(db)
    filas = db.scalars(select(ParametroNutricion)).all()
    return {f.clave: f.valor for f in filas}


def obtener_parametros(db: Session) -> schemas.ParametrosResponse:
    asegurar_parametros(db)
    nutrientes = db.scalars(
        select(ParametroNutriente)
        .where(ParametroNutriente.clave.in_(c.CLAVES_NUTRIENTES))
        .order_by(ParametroNutriente.orden)
    ).all()
    generales = _generales(db)
    return schemas.ParametrosResponse(
        nutrientes=[
            schemas.ParametroNutrienteSchema.model_validate(n).model_copy(
                update=(
                    {"admite_vd": False, "valor_diario": None}
                    if n.clave in c.NUTRIENTES_SIN_VD
                    else {}
                )
            )
            for n in nutrientes
        ],
        generales=schemas.ParametrosGenerales(
            **{
                k: (_es_verdadero(generales[k]) if k in c.GENERALES_BOOLEANOS else generales[k])
                for k in c.CLAVES_GENERALES
            }
        ),
        leyendas_fijas=schemas.LeyendasFijas(
            leyenda_calculo=c.LEYENDA_CALCULO_FIJA, leyenda_vd=c.LEYENDA_VD_FIJA
        ),
    )


def actualizar_parametros(db: Session, datos: schemas.ParametrosUpdate) -> schemas.ParametrosResponse:
    asegurar_parametros(db)
    filas = {f.clave: f for f in db.scalars(select(ParametroNutriente)).all()}
    for item in datos.nutrientes:
        fila = filas.get(item.clave)
        if fila is None:
            raise exceptions.ParametroDesconocido()
        if item.clave in c.NUTRIENTES_SIN_VD and item.valor_diario is not None:
            raise exceptions.VdNoAdmitido()
        fila.nombre = item.nombre.strip()
        fila.valor_diario = item.valor_diario
        fila.umbral_no_significativo = item.umbral_no_significativo
        fila.decimales_menor_10 = item.decimales_menor_10
        fila.decimales_desde_10 = item.decimales_desde_10
    generales = {f.clave: f for f in db.scalars(select(ParametroNutricion)).all()}
    for clave, valor in datos.generales.model_dump().items():
        if isinstance(valor, bool):
            valor = "1" if valor else "0"
        generales[clave].valor = str(valor).strip()
    db.commit()
    return obtener_parametros(db)


# ── Base de composición ────────────────────────────────────────────────────


def listar_alimentos(
    db: Session, buscar: str | None = None, base: str | None = None, limite: int = 50
) -> list[AlimentoReferencia]:
    consulta = select(AlimentoReferencia)
    if buscar and buscar.strip():
        consulta = consulta.where(
            func.lower(AlimentoReferencia.nombre).contains(buscar.strip().lower())
        )
    if base:
        consulta = consulta.where(AlimentoReferencia.base == base)
    return list(
        db.scalars(
            consulta.order_by(AlimentoReferencia.base, AlimentoReferencia.nombre).limit(limite)
        ).all()
    )


def listar_bases(db: Session) -> list[str]:
    return list(
        db.scalars(
            select(AlimentoReferencia.base).distinct().order_by(AlimentoReferencia.base)
        ).all()
    )


def _numero_csv(texto: str | None) -> Decimal | None:
    if texto is None:
        return None
    texto = texto.strip().replace(" ", "")
    if texto in ("", "-", "—", "tr", "Tr"):
        return None
    # Admite "1.234,5" y "1234.5".
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    valor = Decimal(texto)
    if valor < 0:
        raise InvalidOperation
    return valor


def importar_alimentos(db: Session, base: str, contenido: bytes) -> schemas.ResultadoImportacion:
    """Importa (o actualiza) alimentos desde un CSV.

    Columnas: `nombre` (obligatoria), `codigo` y una por nutriente con la
    misma clave que usa el sistema (`energia`, `carbohidratos`, ... `sodio`),
    todo por 100 g. Acepta coma, punto y coma o tabulador como separador.
    """
    base = (base or "").strip()[:100]
    if not base:
        raise exceptions.BaseVacia()
    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = contenido.decode("latin-1")
    try:
        dialecto = csv.Sniffer().sniff(texto[:4096], delimiters=",;\t")
    except csv.Error:
        dialecto = csv.excel
    lector = csv.DictReader(io.StringIO(texto), dialect=dialecto)
    if not lector.fieldnames:
        raise exceptions.CsvInvalido()
    columnas = {(nombre or "").strip().lower(): nombre for nombre in lector.fieldnames}
    if "nombre" not in columnas:
        raise exceptions.CsvInvalido()

    existentes = {
        a.nombre.lower(): a
        for a in db.scalars(select(AlimentoReferencia).where(AlimentoReferencia.base == base))
    }
    creados = actualizados = 0
    errores: list[str] = []
    for numero, fila in enumerate(lector, start=2):
        nombre = (fila.get(columnas["nombre"]) or "").strip()[:200]
        if not nombre:
            continue
        try:
            valores = {
                clave: _numero_csv(fila.get(columnas[clave])) if clave in columnas else None
                for clave in c.CLAVES_NUTRIENTES
            }
        except (InvalidOperation, ValueError):
            errores.append(f"Fila {numero} ({nombre}): hay un valor que no es un número válido.")
            continue
        codigo = (fila.get(columnas["codigo"]) or "").strip()[:40] if "codigo" in columnas else ""
        alimento = existentes.get(nombre.lower())
        if alimento is None:
            alimento = AlimentoReferencia(base=base, nombre=nombre)
            db.add(alimento)
            existentes[nombre.lower()] = alimento
            creados += 1
        else:
            actualizados += 1
        alimento.codigo = codigo or None
        alimento.importado_en = ahora()
        for clave, valor in valores.items():
            setattr(alimento, clave, valor)
    db.commit()
    return schemas.ResultadoImportacion(
        base=base, creados=creados, actualizados=actualizados, errores=errores
    )


def cargar_alimentos_ejemplo(db: Session) -> None:
    """Base mínima de ejemplo, solo si la tabla está vacía."""
    if db.scalar(select(func.count()).select_from(AlimentoReferencia)):
        return
    for fila in c.ALIMENTOS_EJEMPLO:
        nombre, *valores = fila
        alimento = AlimentoReferencia(base=c.BASE_EJEMPLO, nombre=nombre)
        for clave, valor in zip(c.CLAVES_NUTRIENTES, valores):
            setattr(alimento, clave, Decimal(str(valor)))
        db.add(alimento)
    db.commit()


# ── Datos nutricionales del insumo ─────────────────────────────────────────


def _obtener_insumo(db: Session, insumo_id: int) -> Insumo:
    insumo = db.scalar(
        select(Insumo)
        .where(Insumo.id == insumo_id)
        .options(selectinload(Insumo.unidad_medida))
    )
    if insumo is None:
        raise exceptions.InsumoNoEncontrado()
    return insumo


def _admitidos(insumo: Insumo) -> tuple[str, ...]:
    return c.NUTRIENTES_ADITIVO if insumo.tipo == TIPO_ADITIVO else c.CLAVES_NUTRIENTES


def _azucares_son_anadidos(insumo: Insumo, perfil: PerfilNutricionalInsumo | None) -> bool:
    """Ingrediente cuyo azúcar se agrega al producto (azúcar, miel, jarabes...).

    La guía de rotulado pide calcular los azúcares añadidos desde la
    composición: se suman los azúcares de los ingredientes que los aportan.
    Para esos ingredientes, sus azúcares añadidos son sus azúcares totales.
    """
    return insumo.tipo != TIPO_ADITIVO and bool(perfil and perfil.azucares_son_anadidos)


def requeridos_de(insumo: Insumo, perfil: PerfilNutricionalInsumo | None) -> tuple[str, ...]:
    """Nutrientes que hay que cargarle al insumo (si se le exigen datos)."""
    if insumo.tipo == TIPO_ADITIVO:
        return c.NUTRIENTES_ADITIVO
    if _azucares_son_anadidos(insumo, perfil):
        return tuple(k for k in c.CLAVES_NUTRIENTES if k != c.AZUCARES_ANADIDOS)
    return c.CLAVES_NUTRIENTES


def evaluar_insumo(
    insumo: Insumo,
    perfil: PerfilNutricionalInsumo | None,
    valores: dict[str, ValorNutricionalInsumo],
    reglas: dict[str, calculo.ReglaNutriente],
    cubiertos: frozenset[str] = frozenset(),
) -> schemas.Completitud:
    """Qué le falta al insumo para entrar en el cálculo.

    Un aditivo no se considera incompleto salvo que esté marcado como
    aportante de energía o sodio; en ese caso se le piden esos dos datos.
    `cubiertos` son los nutrientes que el producto ya tiene determinados en
    laboratorio: para esos no hace falta el dato del insumo.
    """
    exige = bool(perfil and perfil.aporta_energia_sodio) if insumo.tipo == TIPO_ADITIVO else True
    requeridos = tuple(k for k in requeridos_de(insumo, perfil) if k not in cubiertos)

    faltantes: list[str] = []
    # Un aditivo sin aporte que igual tiene datos cargados entra en la suma:
    # para eso también necesita poder pasar a gramos.
    necesita_conversion = (exige and bool(requeridos)) or any(k not in cubiertos for k in valores)
    if exige:
        for clave in requeridos:
            valor = valores.get(clave)
            if valor is None or not valor.fuente:
                faltantes.append(reglas[clave].nombre if clave in reglas else clave)
    if necesita_conversion:
        unidad = insumo.unidad_medida
        conversion = calculo.tipo_unidad(unidad.simbolo, unidad.nombre)
        if conversion is None:
            faltantes.append(f"una unidad convertible a gramos (hoy está en {unidad.simbolo})")
        elif conversion[0] == c.VOLUMEN and not (perfil and perfil.densidad_g_ml):
            faltantes.append("la densidad (g/ml)")
        elif conversion[0] == c.POR_UNIDAD and not (perfil and perfil.peso_unidad_g):
            faltantes.append("el peso por unidad (g)")
    return schemas.Completitud(
        completo=not faltantes, exige_datos=exige, faltantes=faltantes
    )


def _valores_de(db: Session, insumo_ids: list[int]) -> dict[int, dict[str, ValorNutricionalInsumo]]:
    resultado: dict[int, dict[str, ValorNutricionalInsumo]] = {i: {} for i in insumo_ids}
    if not insumo_ids:
        return resultado
    filas = db.scalars(
        select(ValorNutricionalInsumo)
        .where(ValorNutricionalInsumo.insumo_id.in_(insumo_ids))
        .options(
            selectinload(ValorNutricionalInsumo.cargado_por),
            selectinload(ValorNutricionalInsumo.modificado_por),
        )
    ).all()
    for fila in filas:
        resultado[fila.insumo_id][fila.nutriente] = fila
    return resultado


def _perfiles_de(db: Session, insumo_ids: list[int]) -> dict[int, PerfilNutricionalInsumo]:
    if not insumo_ids:
        return {}
    return {
        p.insumo_id: p
        for p in db.scalars(
            select(PerfilNutricionalInsumo).where(
                PerfilNutricionalInsumo.insumo_id.in_(insumo_ids)
            )
        ).all()
    }


def obtener_datos_insumo(db: Session, insumo_id: int) -> schemas.DatosNutricionalesResponse:
    insumo = _obtener_insumo(db, insumo_id)
    reglas = _reglas(db)
    perfil = _perfiles_de(db, [insumo.id]).get(insumo.id)
    valores = _valores_de(db, [insumo.id])[insumo.id]
    conversion = calculo.tipo_unidad(insumo.unidad_medida.simbolo, insumo.unidad_medida.nombre)
    return schemas.DatosNutricionalesResponse(
        insumo_id=insumo.id,
        nombre=insumo.nombre,
        tipo=insumo.tipo,
        unidad=insumo.unidad_medida.simbolo,
        unidad_tipo=conversion[0] if conversion else None,
        peso_unidad_g=perfil.peso_unidad_g if perfil else None,
        densidad_g_ml=perfil.densidad_g_ml if perfil else None,
        aporta_energia_sodio=bool(perfil and perfil.aporta_energia_sodio),
        azucares_son_anadidos=bool(perfil and perfil.azucares_son_anadidos),
        grasas_son_anadidas=bool(perfil and perfil.grasas_son_anadidas),
        sodio_es_anadido=bool(perfil and perfil.sodio_es_anadido),
        contiene_edulcorantes=bool(perfil and perfil.contiene_edulcorantes),
        contiene_cafeina=bool(perfil and perfil.contiene_cafeina),
        nutrientes_admitidos=list(_admitidos(insumo)),
        valores=[
            schemas.ValorResponse(
                nutriente=clave,
                nombre=regla.nombre,
                unidad=regla.unidad,
                valor=v.valor,
                fuente=v.fuente,
                fuente_etiqueta=c.FUENTES.get(v.fuente, v.fuente),
                referencia=v.referencia,
                alimento_referencia_id=v.alimento_referencia_id,
                valor_fuente=v.valor_fuente,
                cargado_en=v.cargado_en,
                cargado_por=_nombre(v.cargado_por),
                modificado=v.modificado,
                modificado_en=v.modificado_en,
                modificado_por=_nombre(v.modificado_por),
            )
            for clave, regla in reglas.items()
            if (v := valores.get(clave)) is not None
        ],
        completitud=evaluar_insumo(insumo, perfil, valores, reglas),
    )


def guardar_datos_insumo(
    db: Session, insumo_id: int, datos: schemas.DatosNutricionalesIn, usuario: Personal | None
) -> schemas.DatosNutricionalesResponse:
    insumo = _obtener_insumo(db, insumo_id)
    asegurar_parametros(db)
    admitidos = _admitidos(insumo)

    vistos: set[str] = set()
    for item in datos.valores:
        if item.nutriente not in c.CLAVES_NUTRIENTES:
            raise exceptions.NutrienteDesconocido()
        if item.nutriente in vistos:
            raise exceptions.NutrienteRepetido()
        if item.nutriente not in admitidos:
            raise exceptions.NutrienteNoAdmitidoAditivo()
        vistos.add(item.nutriente)

    perfil = db.get(PerfilNutricionalInsumo, insumo.id)
    if perfil is None:
        perfil = PerfilNutricionalInsumo(insumo_id=insumo.id)
        db.add(perfil)
    perfil.peso_unidad_g = datos.peso_unidad_g
    perfil.densidad_g_ml = datos.densidad_g_ml
    perfil.aporta_energia_sodio = insumo.tipo == TIPO_ADITIVO and datos.aporta_energia_sodio
    perfil.azucares_son_anadidos = datos.azucares_son_anadidos
    perfil.grasas_son_anadidas = datos.grasas_son_anadidas
    perfil.sodio_es_anadido = datos.sodio_es_anadido
    perfil.contiene_edulcorantes = datos.contiene_edulcorantes
    perfil.contiene_cafeina = datos.contiene_cafeina

    usuario_id = usuario.id if usuario is not None else None
    momento = ahora()
    alimentos: dict[int, AlimentoReferencia] = {}
    existentes = {
        v.nutriente: v
        for v in db.scalars(
            select(ValorNutricionalInsumo).where(ValorNutricionalInsumo.insumo_id == insumo.id)
        ).all()
    }

    for item in datos.valores:
        valor = _q(item.valor)
        referencia = item.referencia
        alimento_id = None
        valor_fuente = valor
        if item.fuente == c.FUENTE_BASE:
            if item.alimento_referencia_id is None:
                raise exceptions.AlimentoNoEncontrado()
            alimento = alimentos.get(item.alimento_referencia_id) or db.get(
                AlimentoReferencia, item.alimento_referencia_id
            )
            if alimento is None:
                raise exceptions.AlimentoNoEncontrado()
            alimentos[alimento.id] = alimento
            dato_base = getattr(alimento, item.nutriente)
            if dato_base is None:
                raise exceptions.AlimentoSinDato()
            alimento_id = alimento.id
            valor_fuente = _q(dato_base)
            referencia = f"{alimento.base}: {alimento.nombre}"[:300]

        actual = existentes.pop(item.nutriente, None)
        misma_carga = (
            actual is not None
            and actual.fuente == item.fuente
            and actual.alimento_referencia_id == alimento_id
            and (actual.referencia or None) == (referencia or None)
        )
        if not misma_carga:
            # Carga nueva (o cambio de fuente): arranca su propia historia.
            if actual is None:
                actual = ValorNutricionalInsumo(insumo_id=insumo.id, nutriente=item.nutriente)
                db.add(actual)
            actual.fuente = item.fuente
            actual.referencia = referencia
            actual.alimento_referencia_id = alimento_id
            actual.valor_fuente = valor_fuente
            actual.valor = valor
            actual.cargado_en = momento
            actual.cargado_por_id = usuario_id
            actual.modificado = valor != valor_fuente
            actual.modificado_en = momento if actual.modificado else None
            actual.modificado_por_id = usuario_id if actual.modificado else None
        elif _q(actual.valor) != valor:
            actual.valor = valor
            actual.modificado = valor != _q(actual.valor_fuente)
            actual.modificado_en = momento if actual.modificado else None
            actual.modificado_por_id = usuario_id if actual.modificado else None

    for sobrante in existentes.values():
        db.delete(sobrante)
    db.commit()
    return obtener_datos_insumo(db, insumo.id)


# ── Información nutricional del producto ───────────────────────────────────


def _obtener_producto(db: Session, producto_id: int) -> Producto:
    producto = db.get(Producto, producto_id)
    if producto is None:
        raise exceptions.ProductoNoEncontrado()
    return producto


def _config(db: Session, producto_id: int) -> schemas.ConfiguracionProducto:
    fila = db.get(InfoNutricionalProducto, producto_id)
    if fila is None:
        return schemas.ConfiguracionProducto(configurada=False)
    return schemas.ConfiguracionProducto(
        configurada=True,
        expresar_en=fila.expresar_en,
        porcion=fila.porcion,
        medida_casera=fila.medida_casera,
        densidad_g_ml=fila.densidad_g_ml,
        peso_unidad_g=fila.peso_unidad_g,
    )


def guardar_configuracion(
    db: Session, producto_id: int, datos: schemas.ConfiguracionProductoIn
) -> schemas.ConfiguracionProducto:
    _obtener_producto(db, producto_id)
    fila = db.get(InfoNutricionalProducto, producto_id)
    if fila is None:
        fila = InfoNutricionalProducto(producto_id=producto_id)
        db.add(fila)
    for campo, valor in datos.model_dump().items():
        setattr(fila, campo, valor)
    db.commit()
    return _config(db, producto_id)


def _version(db: Session, producto_id: int, version_id: int | None) -> tuple[Receta | None, VersionReceta | None]:
    receta = db.scalar(select(Receta).where(Receta.producto_id == producto_id))
    if receta is None:
        return None, None
    consulta = select(VersionReceta).where(VersionReceta.receta_id == receta.id)
    if version_id is not None:
        consulta = consulta.where(VersionReceta.id == version_id)
    else:
        consulta = consulta.order_by(VersionReceta.numero.desc()).limit(1)
    version = db.scalar(
        consulta.options(
            selectinload(VersionReceta.unidad_medida),
            selectinload(VersionReceta.insumos).selectinload(RecetaInsumo.insumo).selectinload(
                Insumo.unidad_medida
            ),
            selectinload(VersionReceta.insumos).selectinload(RecetaInsumo.unidad_medida),
        )
    )
    if version is None and version_id is not None:
        raise exceptions.VersionNoEncontrada()
    return receta, version


def _cantidad_base(
    version: VersionReceta, config: schemas.ConfiguracionProducto, problemas: list[str]
) -> Decimal | None:
    """Rendimiento de la receta en g (o ml, según cómo se expresa la tabla)."""
    unidad = version.unidad_medida
    conversion = calculo.tipo_unidad(unidad.simbolo, unidad.nombre)
    masa = volumen = None
    if conversion is None:
        problemas.append(
            f"El rendimiento de la receta está en {unidad.simbolo}, que no se puede pasar a gramos."
        )
        return None
    tipo, factor = conversion
    if tipo == c.MASA:
        masa = version.rendimiento * factor
    elif tipo == c.VOLUMEN:
        volumen = version.rendimiento * factor
    elif config.peso_unidad_g:
        masa = version.rendimiento * config.peso_unidad_g
    else:
        problemas.append(
            "El rendimiento está en unidades: indicá el peso por unidad del producto (g)."
        )
        return None

    if config.expresar_en == c.EXPRESAR_G:
        if masa is not None:
            return masa
        if config.densidad_g_ml:
            return volumen * config.densidad_g_ml
        problemas.append(
            "El rendimiento está en volumen y la tabla en gramos: indicá la densidad del producto."
        )
        return None
    if volumen is not None:
        return volumen
    if config.densidad_g_ml:
        return masa / config.densidad_g_ml
    problemas.append(
        "El rendimiento está en peso y la tabla en ml: indicá la densidad del producto."
    )
    return None


def _gramos_insumo(
    renglon: RecetaInsumo, perfil: PerfilNutricionalInsumo | None
) -> Decimal | None:
    unidad = renglon.unidad_medida
    conversion = calculo.tipo_unidad(unidad.simbolo, unidad.nombre)
    if conversion is None:
        return None
    tipo, factor = conversion
    if tipo == c.MASA:
        return renglon.cantidad * factor
    if tipo == c.VOLUMEN:
        return renglon.cantidad * factor * perfil.densidad_g_ml if perfil and perfil.densidad_g_ml else None
    return renglon.cantidad * perfil.peso_unidad_g if perfil and perfil.peso_unidad_g else None


def _laboratorio(db: Session, producto_id: int) -> dict[str, ValorLaboratorioProducto]:
    return {
        v.nutriente: v
        for v in db.scalars(
            select(ValorLaboratorioProducto)
            .where(ValorLaboratorioProducto.producto_id == producto_id)
            .options(selectinload(ValorLaboratorioProducto.cargado_por))
        ).all()
    }


def guardar_laboratorio(
    db: Session, producto_id: int, datos: schemas.LaboratorioIn, usuario: Personal | None
) -> list[schemas.ValorLaboratorio]:
    """Reemplaza los resultados de laboratorio del producto por los enviados."""
    _obtener_producto(db, producto_id)
    asegurar_parametros(db)
    vistos: set[str] = set()
    for item in datos.valores:
        if item.nutriente not in c.CLAVES_NUTRIENTES:
            raise exceptions.NutrienteDesconocido()
        if item.nutriente in vistos:
            raise exceptions.NutrienteRepetido()
        vistos.add(item.nutriente)

    existentes = _laboratorio(db, producto_id)
    momento = ahora()
    for item in datos.valores:
        fila = existentes.pop(item.nutriente, None)
        valor = _q(item.valor_100)
        cambio = (
            fila is None
            or _q(fila.valor_100) != valor
            or (fila.referencia or None) != datos.referencia
            or fila.fecha_analisis != datos.fecha_analisis
        )
        if fila is None:
            fila = ValorLaboratorioProducto(producto_id=producto_id, nutriente=item.nutriente)
            db.add(fila)
        if cambio:
            fila.valor_100 = valor
            fila.referencia = datos.referencia
            fila.fecha_analisis = datos.fecha_analisis
            fila.cargado_en = momento
            fila.cargado_por_id = usuario.id if usuario is not None else None
    for sobrante in existentes.values():
        db.delete(sobrante)
    db.commit()
    return _a_laboratorio(_laboratorio(db, producto_id), _reglas(db))


def _a_laboratorio(
    filas: dict[str, ValorLaboratorioProducto], reglas: dict[str, calculo.ReglaNutriente]
) -> list[schemas.ValorLaboratorio]:
    return [
        schemas.ValorLaboratorio(
            nutriente=clave,
            nombre=regla.nombre,
            unidad=regla.unidad,
            valor_100=f.valor_100,
            referencia=f.referencia,
            fecha_analisis=f.fecha_analisis,
            cargado_en=f.cargado_en,
            cargado_por=_nombre(f.cargado_por),
        )
        for clave, regla in reglas.items()
        if (f := filas.get(clave)) is not None
    ]


def calcular_info_nutricional(
    db: Session, producto_id: int, version_id: int | None = None
) -> schemas.InfoNutricionalResponse:
    """Tabla del producto a partir de la receta, los datos de cada insumo y el rendimiento.

    Se calcula siempre en el momento: completar un dato faltante recalcula la
    tabla sin pasos extra, y el estado "incompleta" nunca queda desactualizado.
    Un nutriente determinado en laboratorio reemplaza al calculado (la cátedra
    pide poder combinar ambas fuentes). No se modelan pérdidas por cocción.
    """
    producto = _obtener_producto(db, producto_id)
    reglas = _reglas(db)
    generales = _generales(db)
    config = _config(db, producto_id)
    receta, version = _version(db, producto_id, version_id)
    laboratorio = _laboratorio(db, producto_id)
    cubiertos = frozenset(laboratorio)
    problemas: list[str] = []

    comunes = dict(
        leyenda_calculo=c.LEYENDA_CALCULO_FIJA,
        leyenda_vd=c.LEYENDA_VD_FIJA,
        leyenda_laboratorio=c.LEYENDA_LABORATORIO_FIJA,
        mostrar_por_100=_es_verdadero(generales[c.MOSTRAR_POR_100]),
        laboratorio=_a_laboratorio(laboratorio, reglas),
    )

    if version is None:
        return schemas.InfoNutricionalResponse(
            producto_id=producto.id,
            producto=producto.nombre,
            receta_id=receta.id if receta else None,
            version=None,
            configuracion=config,
            estado=c.ESTADO_SIN_RECETA,
            problemas=["El producto todavía no tiene receta: no hay de dónde calcular."],
            ingredientes=[],
            incompletos=[],
            cantidad_base=None,
            expresar_en=config.expresar_en,
            filas=[],
            leyenda_no_significativo=None,
            calculado_en=ahora(),
            **comunes,
        )

    ids = [r.insumo_id for r in version.insumos]
    perfiles = _perfiles_de(db, ids)
    valores = _valores_de(db, ids)

    totales = {clave: Decimal(0) for clave in reglas}
    # Nutrientes a los que les falta el aporte de algún insumo: no se muestran
    # números armados con datos faltantes (un "0" parecería un dato real).
    sin_datos: set[str] = set()
    ingredientes: list[schemas.IngredienteCalculo] = []
    for renglon in version.insumos:
        insumo = renglon.insumo
        perfil = perfiles.get(insumo.id)
        datos = valores[insumo.id]
        completitud = evaluar_insumo(insumo, perfil, datos, reglas, cubiertos)
        gramos = _gramos_insumo(renglon, perfil)
        incluido = gramos is not None and bool(datos)
        if completitud.exige_datos or datos:
            if gramos is None:
                sin_datos.update(reglas)
            elif completitud.exige_datos:
                sin_datos.update(k for k in requeridos_de(insumo, perfil) if k not in datos)
        if incluido:
            aportes = {clave: fila.valor for clave, fila in datos.items()}
            if _azucares_son_anadidos(insumo, perfil):
                # Todo su azúcar es añadido: se toma el total (guía de rotulado).
                aportes[c.AZUCARES_ANADIDOS] = aportes.get(c.AZUCARES_TOTALES, Decimal(0))
            for clave, valor in aportes.items():
                if clave in totales:
                    totales[clave] += gramos / calculo.CIEN * valor
        ingredientes.append(
            schemas.IngredienteCalculo(
                insumo_id=insumo.id,
                nombre=insumo.nombre,
                tipo=insumo.tipo,
                cantidad=renglon.cantidad,
                unidad=renglon.unidad_medida.simbolo,
                gramos=_q(gramos),
                exige_datos=completitud.exige_datos,
                completo=completitud.completo,
                faltantes=completitud.faltantes,
                incluido=incluido,
            )
        )
    incompletos = [i for i in ingredientes if not i.completo]

    # Si todo lo que se declara sale del laboratorio, el rendimiento no hace falta.
    base = _cantidad_base(version, config, problemas) if cubiertos < set(reglas) else None
    if config.porcion is None:
        problemas.append("Falta declarar la porción del producto.")
    if not config.medida_casera:
        problemas.append("Falta declarar la medida casera de la porción.")

    # 1) Valores por 100 y por porción.
    valores_100: dict[str, Decimal | None] = {}
    for clave in reglas:
        if clave in laboratorio:
            valores_100[clave] = laboratorio[clave].valor_100
        elif base and clave not in sin_datos:
            valores_100[clave] = totales[clave] / base * calculo.CIEN
        else:
            valores_100[clave] = None
    por_porcion = {
        clave: (v * config.porcion / calculo.CIEN if v is not None and config.porcion else None)
        for clave, v in valores_100.items()
    }

    # 2) No significativos (por porción; sin porción, por 100).
    no_sig = {
        clave: calculo.es_no_significativo(
            por_porcion[clave] if por_porcion[clave] is not None else valores_100[clave], regla
        )
        for clave, regla in reglas.items()
    }
    # Guía de rotulado: las grasas totales se declaran cero solo si también lo
    # son las saturadas y las trans.
    if c.GRASAS_TOTALES in no_sig:
        no_sig[c.GRASAS_TOTALES] = no_sig[c.GRASAS_TOTALES] and all(
            no_sig.get(k, True) for k in (c.GRASAS_SATURADAS, c.GRASAS_TRANS)
        )

    # 3) Textos.
    factor_kj = c.FACTOR_KJ_FIJO
    filas: list[schemas.FilaTabla] = []
    no_significativos: list[str] = []
    for clave, regla in reglas.items():
        v100, vpor, ns = valores_100[clave], por_porcion[clave], no_sig[clave]
        if ns:
            no_significativos.append(regla.nombre.lower())
        vd, vd_texto = calculo.porcentaje_vd(vpor, regla, ns)
        if clave == c.ENERGIA:
            texto_100 = calculo.texto_energia(v100, regla, factor_kj, ns)
            texto_porcion = calculo.texto_energia(vpor, regla, factor_kj, ns)
        else:
            texto_100 = calculo.expresar(v100, regla, ns)
            texto_porcion = calculo.expresar(vpor, regla, ns)
        filas.append(
            schemas.FilaTabla(
                clave=clave,
                nombre=regla.nombre,
                unidad=regla.unidad,
                por_100=_q(v100),
                por_porcion=_q(vpor),
                vd=vd,
                por_100_texto=texto_100,
                por_porcion_texto=texto_porcion,
                vd_texto=vd_texto,
                no_significativo=ns,
                vd_establecido=regla.valor_diario is not None,
                faltan_datos=clave in sin_datos and clave not in laboratorio,
                de_laboratorio=clave in laboratorio,
            )
        )

    leyenda_no_sig = None
    plantilla = c.TEXTO_NO_SIGNIFICATIVO_FIJO
    if no_significativos and _es_verdadero(generales[c.FRASE_NO_SIGNIFICATIVO]):
        nombres = (
            ", ".join(no_significativos[:-1]) + " y " + no_significativos[-1]
            if len(no_significativos) > 1
            else no_significativos[0]
        )
        leyenda_no_sig = plantilla.replace("{nutrientes}", nombres)

    estado = c.ESTADO_INCOMPLETA if incompletos or problemas else c.ESTADO_COMPLETA
    return schemas.InfoNutricionalResponse(
        producto_id=producto.id,
        producto=producto.nombre,
        receta_id=receta.id,
        version=schemas.VersionResumen(
            id=version.id,
            numero=version.numero,
            rendimiento=version.rendimiento,
            unidad=version.unidad_medida.simbolo,
        ),
        configuracion=config,
        estado=estado,
        problemas=problemas,
        ingredientes=ingredientes,
        incompletos=incompletos,
        cantidad_base=_q(base),
        expresar_en=config.expresar_en,
        filas=filas,
        leyenda_no_significativo=leyenda_no_sig,
        calculado_en=ahora(),
        **comunes,
    )
