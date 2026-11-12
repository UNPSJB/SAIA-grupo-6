"""E12.1: columnas de marcas y regla inicial de rotulado frontal."""

import json
from copy import deepcopy

from sqlalchemy import select, text

from src.database import SessionLocal
from src.rotulado_frontal import constants as c
from src.rotulado_frontal.models import (
    ConfiguracionModuloRotulado,
    ReglaRotuladoFrontal,
)

from .base import agregar_columna, marcar_migracion, migracion_ya_corrio, tablas


def _sembrar_regla_inicial(db) -> None:
    if migracion_ya_corrio(c.CLAVE_MIGRACION):
        return

    existente = db.scalar(select(ReglaRotuladoFrontal.id).limit(1))
    if existente is None:
        db.add(
            ReglaRotuladoFrontal(
                version=1,
                vigente=True,
                vigencia_desde=c.VIGENCIA_INICIAL,
                norma_origen=c.NORMATIVA_INICIAL,
                requiere_envasado=True,
                obliga_azucares=True,
                obliga_grasas=True,
                obliga_sodio=True,
                obliga_edulcorantes=True,
                obliga_cafeina=True,
                clases_edulcorante=list(c.CLASES_EDULCORANTE_INICIAL),
                validar_ins_edulcorantes=True,
                ins_edulcorantes=list(c.INS_EDULCORANTES_INICIAL),
                ingredientes_cafeina=list(c.INGREDIENTES_CON_CAFEINA_INICIAL),
                umbrales_sellos=[
                    dict(parametro) for parametro in c.UMBRALES_SELLOS_INICIALES
                ],
                formulas_nutricionales=[
                    dict(parametro)
                    for parametro in c.FORMULAS_NUTRICIONALES_INICIALES
                ],
                reglas_aplicabilidad=deepcopy(c.REGLAS_APLICABILIDAD_INICIALES),
            )
        )
        db.commit()

    marcar_migracion(c.CLAVE_MIGRACION)


def _sembrar_interruptor_modulo(db) -> None:
    if db.get(ConfiguracionModuloRotulado, 1) is not None:
        return
    db.add(ConfiguracionModuloRotulado(id=1, modulo_activo=True))
    db.commit()


def _completar_resultado_por_defecto(db) -> None:
    """Agrega el resultado por defecto a reglas creadas antes de existir.

    El motor ya no tiene un fallback hardcodeado: toda regla, incluida la
    rama que no coincide con ninguna condición, debe traer su resultado.
    """
    for regla in db.scalars(select(ReglaRotuladoFrontal)).all():
        datos = deepcopy(regla.reglas_aplicabilidad or {})
        if "resultado_por_defecto" in datos:
            continue
        datos["resultado_por_defecto"] = deepcopy(
            c.RESULTADO_APLICABILIDAD_INICIAL
        )
        regla.reglas_aplicabilidad = datos
    db.commit()


def migrar_rotulado_frontal() -> None:
    existentes = tablas()
    if "productos" in existentes:
        agregar_columna(
            "productos",
            "categoria_exceptuada_por_ley",
            "BOOLEAN NOT NULL DEFAULT 0",
        )
        agregar_columna(
            "productos",
            "categoria_rotulado",
            "VARCHAR(80) NULL",
        )
        with SessionLocal() as db:
            db.info["sin_auditoria"] = True
            db.execute(
                text(
                    "UPDATE productos SET categoria_rotulado = 'otra_exceptuada' "
                    "WHERE categoria_exceptuada_por_ley = 1 "
                    "AND (categoria_rotulado IS NULL OR categoria_rotulado = '')"
                )
            )
            db.commit()

    if "configuracion_rotulado_producto" in existentes:
        agregar_columna(
            "configuracion_rotulado_producto",
            "canal_comercializacion",
            "VARCHAR(30) NOT NULL DEFAULT 'MINORISTA'",
        )

    if "reglas_rotulado_frontal" in existentes:
        agregar_columna(
            "reglas_rotulado_frontal",
            "validar_ins_edulcorantes",
            "BOOLEAN NOT NULL DEFAULT 1",
        )
        ins_inicial = json.dumps(list(c.INS_EDULCORANTES_INICIAL), ensure_ascii=False)
        agregar_columna(
            "reglas_rotulado_frontal",
            "ins_edulcorantes",
            f"TEXT NOT NULL DEFAULT '{ins_inicial}'",
        )
        ingredientes_inicial = json.dumps(
            list(c.INGREDIENTES_CON_CAFEINA_INICIAL), ensure_ascii=False
        )
        agregar_columna(
            "reglas_rotulado_frontal",
            "ingredientes_cafeina",
            f"TEXT NOT NULL DEFAULT '{ingredientes_inicial}'",
        )
        umbrales_iniciales = json.dumps(
            [dict(parametro) for parametro in c.UMBRALES_SELLOS_INICIALES],
            ensure_ascii=False,
        )
        agregar_columna(
            "reglas_rotulado_frontal",
            "umbrales_sellos",
            f"TEXT NOT NULL DEFAULT '{umbrales_iniciales}'",
        )
        formulas_iniciales = json.dumps(
            [dict(parametro) for parametro in c.FORMULAS_NUTRICIONALES_INICIALES],
            ensure_ascii=False,
        )
        agregar_columna(
            "reglas_rotulado_frontal",
            "formulas_nutricionales",
            f"TEXT NOT NULL DEFAULT '{formulas_iniciales}'",
        )
        aplicabilidad_inicial = json.dumps(
            c.REGLAS_APLICABILIDAD_INICIALES, ensure_ascii=False
        )
        agregar_columna(
            "reglas_rotulado_frontal",
            "reglas_aplicabilidad",
            f"TEXT NOT NULL DEFAULT '{aplicabilidad_inicial}'",
        )

    if "configuracion_modulo_rotulado" in existentes:
        with SessionLocal() as db:
            db.info["sin_auditoria"] = True
            _sembrar_interruptor_modulo(db)

    if "perfiles_nutricionales_insumo" in existentes:
        for columna in (
            "grasas_son_anadidas",
            "sodio_es_anadido",
            "contiene_edulcorantes",
            "contiene_cafeina",
        ):
            agregar_columna(
                "perfiles_nutricionales_insumo",
                columna,
                "BOOLEAN NOT NULL DEFAULT 0",
            )

    if "reglas_rotulado_frontal" not in existentes:
        return

    with SessionLocal() as db:
        db.info["sin_auditoria"] = True
        _sembrar_regla_inicial(db)
        _completar_resultado_por_defecto(db)
