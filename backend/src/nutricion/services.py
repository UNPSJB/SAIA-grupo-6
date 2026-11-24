import csv
import io
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora
from src.ingredientes.models import Ingrediente
from src.nutricion import calculo, constants as c, exceptions, schemas
from src.nutricion.models import (
    AlimentoReferencia,
    InfoNutricionalProducto,
    ParametroNutricion,
    ParametroNutriente,
    PerfilNutricionalIngrediente,
    ValorLaboratorioProducto,
    ValorNutricionalIngrediente,
)
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaIngrediente, VersionReceta

_PRECISION = Decimal("0.0001")


def _q(valor: Decimal | None) -> Decimal | None:
    return None if valor is None else Decimal(valor).quantize(_PRECISION)


def _decimal(valor: Decimal | float | None) -> Decimal | None:
    """Densidad / peso del ingrediente como Decimal (la columna está tipada como float)."""
    return None if valor is None else Decimal(str(valor))


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


def _reglas(db: Session, inicializar: bool = True) -> dict[str, calculo.ReglaNutriente]:
    if inicializar:
        asegurar_parametros(db)
    filas = db.scalars(select(ParametroNutriente).order_by(ParametroNutriente.orden)).all()
    if not inicializar:
        existentes = {f.clave for f in filas}
        for clave, nombre, unidad, orden in c.NUTRIENTES:
            if clave not in existentes:
                vd, umbral, menor, mayor = c.PARAMETROS_INICIALES[clave]
                filas.append(ParametroNutriente(clave=clave, nombre=nombre, unidad=unidad,
                    orden=orden, valor_diario=vd, umbral_no_significativo=umbral,
                    decimales_menor_10=menor, decimales_desde_10=mayor))
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


def _generales(db: Session, inicializar: bool = True) -> dict[str, str]:
    if inicializar:
        asegurar_parametros(db)
    filas = db.scalars(select(ParametroNutricion)).all()
    return {**c.PARAMETROS_GENERALES_INICIALES, **{f.clave: f.valor for f in filas}}


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
    # La vigencia de la homologación cambia qué marcas están por vencer.
    from src.notificaciones.invalidacion import invalidar_notificaciones

    invalidar_notificaciones(db)
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
    # Admite "1.234,5", "1234.5" y la notación científica de SARA 1
    # ("3.6297000000000003e+02").
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    valor = Decimal(texto)
    if not valor.is_finite() or valor < 0:
        raise InvalidOperation
    return _q(valor)


def _columnas_csv(nombres: list[str]) -> dict[str, str]:
    """Dato del sistema -> columna del archivo, según `COLUMNAS_IMPORTACION`."""
    presentes = {(nombre or "").strip().lower(): nombre for nombre in nombres}
    columnas = {}
    for dato, alias in c.COLUMNAS_IMPORTACION.items():
        encontrada = next((presentes[a] for a in alias if a in presentes), None)
        if encontrada is not None:
            columnas[dato] = encontrada
    if c.COLUMNA_UNIDAD_SARA1 in presentes:
        columnas[c.COLUMNA_UNIDAD_SARA1] = presentes[c.COLUMNA_UNIDAD_SARA1]
    return columnas


def _lista_corta(nombres: list[str], maximo: int = 6) -> str:
    """"a, b y c"; con más de `maximo`, "a, b, ... y 4 más"."""
    if len(nombres) > maximo:
        return f"{', '.join(nombres[:maximo])} y {len(nombres) - maximo} más"
    if len(nombres) <= 1:
        return "".join(nombres)
    return f"{', '.join(nombres[:-1])} y {nombres[-1]}"


def importar_alimentos(db: Session, base: str, contenido: bytes) -> schemas.ResultadoImportacion:
    """Importa (o actualiza) alimentos desde un CSV.

    Acepta la plantilla del sistema (`nombre`, `codigo` y una columna por
    nutriente con su clave) y el CSV de SARA 1 tal como viene
    (`AlimentoyComposicion.csv`: `Alimento`, `Codigo`, `E`, `HCdisp`...); ver
    `COLUMNAS_IMPORTACION`. Todo por 100 g. Acepta coma, punto y coma o
    tabulador como separador.
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
    columnas = _columnas_csv(lector.fieldnames)
    if "nombre" not in columnas:
        raise exceptions.CsvInvalido()

    existentes = {
        a.nombre.lower(): a
        for a in db.scalars(select(AlimentoReferencia).where(AlimentoReferencia.base == base))
    }
    creados = actualizados = 0
    errores: list[str] = []
    omitidos: list[str] = []
    for numero, fila in enumerate(lector, start=2):
        nombre = (fila.get(columnas["nombre"]) or "").strip()[:200]
        if not nombre:
            continue
        if c.COLUMNA_UNIDAD_SARA1 in columnas:
            unidad = (fila.get(columnas[c.COLUMNA_UNIDAD_SARA1]) or "").strip().lower()
            if unidad not in c.UNIDADES_ALIMENTO_SARA1:
                omitidos.append(nombre)
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

    avisos: list[str] = []
    faltan = [n[1].lower() for n in c.NUTRIENTES if n[0] not in columnas]
    if faltan:
        avisos.append(
            f"El archivo no trae {_lista_corta(faltan, maximo=len(faltan))}. Al tomar valores de "
            "esta base, esos nutrientes quedan vacíos y se completan con otra fuente "
            "(por ejemplo, el rótulo del proveedor)."
        )
    if omitidos:
        avisos.append(
            f"Se omitieron {len(omitidos)} filas que no son alimentos sino nutrientes "
            f"aislados medidos en mg, µg o UI: {_lista_corta(omitidos)}."
        )
    return schemas.ResultadoImportacion(
        base=base, creados=creados, actualizados=actualizados, errores=errores, avisos=avisos
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


# ── Datos nutricionales del ingrediente ─────────────────────────────────────────


def _obtener_ingrediente(db: Session, ingrediente_id: int) -> Ingrediente:
    ingrediente = db.scalar(
        select(Ingrediente)
        .where(Ingrediente.id == ingrediente_id)
        .options(selectinload(Ingrediente.unidad_medida))
    )
    if ingrediente is None:
        raise exceptions.IngredienteNoEncontrado()
    return ingrediente


def _admitidos(ingrediente: Ingrediente) -> tuple[str, ...]:
    return c.NUTRIENTES_ADITIVO if ingrediente.es_aditivo else c.CLAVES_NUTRIENTES


def _azucares_son_anadidos(ingrediente: Ingrediente, perfil: PerfilNutricionalIngrediente | None) -> bool:
    """Ingrediente cuyo azúcar se agrega al producto (azúcar, miel, jarabes...).

    La guía de rotulado pide calcular los azúcares añadidos desde la
    composición: se suman los azúcares de los ingredientes que los aportan.
    Para esos ingredientes, sus azúcares añadidos son sus azúcares totales.
    """
    return not ingrediente.es_aditivo and bool(perfil and perfil.azucares_son_anadidos)


def requeridos_de(ingrediente: Ingrediente, perfil: PerfilNutricionalIngrediente | None) -> tuple[str, ...]:
    """Nutrientes que hay que cargarle al ingrediente (si se le exigen datos)."""
    if ingrediente.es_aditivo:
        return c.NUTRIENTES_ADITIVO
    if _azucares_son_anadidos(ingrediente, perfil):
        return tuple(k for k in c.CLAVES_NUTRIENTES if k != c.AZUCARES_ANADIDOS)
    return c.CLAVES_NUTRIENTES


def evaluar_ingrediente(
    ingrediente: Ingrediente,
    perfil: PerfilNutricionalIngrediente | None,
    valores: dict[str, ValorNutricionalIngrediente],
    reglas: dict[str, calculo.ReglaNutriente],
    cubiertos: frozenset[str] = frozenset(),
) -> schemas.Completitud:
    """Qué le falta al ingrediente para entrar en el cálculo.

    Un aditivo no se considera incompleto salvo que esté marcado como
    aportante de energía o sodio; en ese caso se le piden esos dos datos.
    `cubiertos` son los nutrientes que el producto ya tiene determinados en
    laboratorio: para esos no hace falta el dato del ingrediente.
    """
    exige = bool(perfil and perfil.aporta_energia_sodio) if ingrediente.es_aditivo else True
    requeridos = tuple(k for k in requeridos_de(ingrediente, perfil) if k not in cubiertos)

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
        unidad = ingrediente.unidad_medida
        conversion = calculo.tipo_unidad(unidad)
        if conversion is None:
            faltantes.append(f"una unidad convertible a gramos (hoy está en {unidad.simbolo})")
        elif conversion[0] == c.VOLUMEN and not ingrediente.densidad_g_ml:
            faltantes.append("la densidad (g/ml)")
        elif conversion[0] == c.POR_UNIDAD and not ingrediente.peso_unitario_g:
            faltantes.append("el peso por unidad (g)")
    return schemas.Completitud(
        completo=not faltantes, exige_datos=exige, faltantes=faltantes
    )


def _valores_de(db: Session, ingrediente_ids: list[int]) -> dict[int, dict[str, ValorNutricionalIngrediente]]:
    resultado: dict[int, dict[str, ValorNutricionalIngrediente]] = {i: {} for i in ingrediente_ids}
    if not ingrediente_ids:
        return resultado
    filas = db.scalars(
        select(ValorNutricionalIngrediente)
        .where(ValorNutricionalIngrediente.ingrediente_id.in_(ingrediente_ids))
        .options(
            selectinload(ValorNutricionalIngrediente.cargado_por),
            selectinload(ValorNutricionalIngrediente.modificado_por),
        )
    ).all()
    for fila in filas:
        resultado[fila.ingrediente_id][fila.nutriente] = fila
    return resultado


def _perfiles_de(db: Session, ingrediente_ids: list[int]) -> dict[int, PerfilNutricionalIngrediente]:
    if not ingrediente_ids:
        return {}
    return {
        p.ingrediente_id: p
        for p in db.scalars(
            select(PerfilNutricionalIngrediente).where(
                PerfilNutricionalIngrediente.ingrediente_id.in_(ingrediente_ids)
            )
        ).all()
    }


def obtener_datos_ingrediente(db: Session, ingrediente_id: int) -> schemas.DatosNutricionalesResponse:
    ingrediente = _obtener_ingrediente(db, ingrediente_id)
    reglas = _reglas(db)
    perfil = _perfiles_de(db, [ingrediente.id]).get(ingrediente.id)
    valores = _valores_de(db, [ingrediente.id])[ingrediente.id]
    conversion = calculo.tipo_unidad(ingrediente.unidad_medida)
    return schemas.DatosNutricionalesResponse(
        ingrediente_id=ingrediente.id,
        nombre=ingrediente.nombre,
        es_aditivo=ingrediente.es_aditivo,
        unidad=ingrediente.unidad_medida.simbolo,
        unidad_tipo=conversion[0] if conversion else None,
        # Son datos del ingrediente (los mismos que usa la composición porcentual).
        peso_unidad_g=_decimal(ingrediente.peso_unitario_g),
        densidad_g_ml=_decimal(ingrediente.densidad_g_ml),
        aporta_energia_sodio=bool(perfil and perfil.aporta_energia_sodio),
        azucares_son_anadidos=bool(perfil and perfil.azucares_son_anadidos),
        grasas_son_anadidas=bool(perfil and perfil.grasas_son_anadidas),
        sodio_es_anadido=bool(perfil and perfil.sodio_es_anadido),
        contiene_edulcorantes=bool(perfil and perfil.contiene_edulcorantes),
        contiene_cafeina=bool(perfil and perfil.contiene_cafeina),
        nutrientes_admitidos=list(_admitidos(ingrediente)),
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
        completitud=evaluar_ingrediente(ingrediente, perfil, valores, reglas),
    )


def guardar_datos_ingrediente(
    db: Session, ingrediente_id: int, datos: schemas.DatosNutricionalesIn, usuario: Personal | None
) -> schemas.DatosNutricionalesResponse:
    ingrediente = _obtener_ingrediente(db, ingrediente_id)
    asegurar_parametros(db)
    admitidos = _admitidos(ingrediente)

    vistos: set[str] = set()
    for item in datos.valores:
        if item.nutriente not in c.CLAVES_NUTRIENTES:
            raise exceptions.NutrienteDesconocido()
        if item.nutriente in vistos:
            raise exceptions.NutrienteRepetido()
        if item.nutriente not in admitidos:
            raise exceptions.NutrienteNoAdmitidoAditivo()
        vistos.add(item.nutriente)

    # La densidad y el peso por unidad se guardan en el ingrediente: es el mismo
    # dato que pide su alta y que usa la composición porcentual. Un valor
    # vacío no lo borra (el alta del ingrediente puede exigirlo según la unidad).
    if datos.peso_unidad_g is not None:
        ingrediente.peso_unitario_g = datos.peso_unidad_g
    if datos.densidad_g_ml is not None:
        ingrediente.densidad_g_ml = datos.densidad_g_ml

    perfil = db.get(PerfilNutricionalIngrediente, ingrediente.id)
    if perfil is None:
        perfil = PerfilNutricionalIngrediente(ingrediente_id=ingrediente.id)
        db.add(perfil)
    perfil.aporta_energia_sodio = ingrediente.es_aditivo and datos.aporta_energia_sodio
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
            select(ValorNutricionalIngrediente).where(ValorNutricionalIngrediente.ingrediente_id == ingrediente.id)
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
                actual = ValorNutricionalIngrediente(ingrediente_id=ingrediente.id, nutriente=item.nutriente)
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
    # Cambió la referencia: las marcas aprobadas cuya comparación empeoró
    # pasan a revisión (ver `src.insumos.homologacion`).
    from src.insumos.homologacion import revisar_insumos_de_ingrediente

    revisar_insumos_de_ingrediente(db, ingrediente.id)
    return obtener_datos_ingrediente(db, ingrediente.id)


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
            selectinload(VersionReceta.ingredientes).selectinload(RecetaIngrediente.ingrediente).selectinload(
                Ingrediente.unidad_medida
            ),
            selectinload(VersionReceta.ingredientes).selectinload(RecetaIngrediente.unidad_medida),
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
    conversion = calculo.tipo_unidad(unidad)
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
        # El factor cuenta unidades: una docena son 12.
        masa = version.rendimiento * factor * config.peso_unidad_g
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


def _gramos_ingrediente(renglon: RecetaIngrediente) -> Decimal | None:
    """Cantidad del renglón en gramos, o None si al ingrediente le falta el dato."""
    conversion = calculo.tipo_unidad(renglon.unidad_medida)
    if conversion is None:
        return None
    tipo, factor = conversion
    base = renglon.cantidad * factor
    if tipo == c.MASA:
        return base
    ingrediente = renglon.ingrediente
    if tipo == c.VOLUMEN:
        densidad = _decimal(ingrediente.densidad_g_ml)
        return base * densidad if densidad else None
    peso = _decimal(ingrediente.peso_unitario_g)
    return base * peso if peso else None


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
    db: Session, producto_id: int, version_id: int | None = None, *,
    inicializar_parametros: bool = True,
    fuentes: list[schemas.FuenteCalculo] | None = None,
) -> schemas.InfoNutricionalResponse:
    """Tabla del producto a partir de la receta, los datos de cada ingrediente y el rendimiento.

    Se calcula siempre en el momento: completar un dato faltante recalcula la
    tabla sin pasos extra, y el estado "incompleta" nunca queda desactualizado.
    Un nutriente determinado en laboratorio reemplaza al calculado (la cátedra
    pide poder combinar ambas fuentes). No se modelan pérdidas por cocción.
    """
    producto = _obtener_producto(db, producto_id)
    reglas = _reglas(db, inicializar_parametros)
    generales = _generales(db, inicializar_parametros)
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

    ids = [r.ingrediente_id for r in version.ingredientes]
    perfiles = _perfiles_de(db, ids)
    valores = _valores_de(db, ids)

    totales = {clave: Decimal(0) for clave in reglas}
    # Nutrientes a los que les falta el aporte de algún ingrediente: no se muestran
    # números armados con datos faltantes (un "0" parecería un dato real).
    sin_datos: set[str] = set()
    ingredientes: list[schemas.IngredienteCalculo] = []
    for renglon in version.ingredientes:
        ingrediente = renglon.ingrediente
        perfil = perfiles.get(ingrediente.id)
        datos = valores[ingrediente.id]
        completitud = evaluar_ingrediente(ingrediente, perfil, datos, reglas, cubiertos)
        gramos = _gramos_ingrediente(renglon)
        incluido = gramos is not None and bool(datos)
        if completitud.exige_datos or datos:
            if gramos is None:
                sin_datos.update(reglas)
            elif completitud.exige_datos:
                sin_datos.update(k for k in requeridos_de(ingrediente, perfil) if k not in datos)
        if incluido:
            aportes = {clave: fila.valor for clave, fila in datos.items()}
            azucar_anadida = _azucares_son_anadidos(ingrediente, perfil)
            if azucar_anadida:
                # Todo su azúcar es añadido: se toma el total (guía de rotulado).
                aportes[c.AZUCARES_ANADIDOS] = aportes.get(c.AZUCARES_TOTALES, Decimal(0))
            for clave, valor in aportes.items():
                if clave in totales:
                    aporte = gramos / calculo.CIEN * valor
                    totales[clave] += aporte
                    if fuentes is not None and clave not in cubiertos:
                        clave_fuente = c.AZUCARES_TOTALES if azucar_anadida and clave == c.AZUCARES_ANADIDOS else clave
                        fila = datos.get(clave_fuente)
                        if fila is not None:
                            fuentes.append(schemas.FuenteCalculo(
                                insumo=ingrediente.nombre, nutriente=reglas[clave].nombre,
                                valor_por_100_g=valor, gramos=gramos, aporte=aporte,
                                fuente=c.FUENTES.get(fila.fuente, fila.fuente),
                                referencia=fila.referencia or (
                                    f"Alimento de referencia #{fila.alimento_referencia_id}"
                                    if fila.alimento_referencia_id is not None else None
                                ),
                                valor_fuente=fila.valor_fuente,
                                nutriente_fuente=reglas[clave_fuente].nombre if clave_fuente in reglas else clave_fuente,
                            ))
        ingredientes.append(
            schemas.IngredienteCalculo(
                ingrediente_id=ingrediente.id,
                nombre=ingrediente.nombre,
                es_aditivo=ingrediente.es_aditivo,
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
