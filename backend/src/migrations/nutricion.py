"""E11: carga inicial de los parámetros nutricionales y de la base de ejemplo.

Las tablas las crea `create_all`. Esto:

* agrega las columnas nuevas a tablas que ya existían;
* completa los parámetros que falten (idempotente);
* una sola vez, ajusta a la guía de rotulado de la cátedra los parámetros que
  nadie cambió (decimales de energía y sodio, %VD en blanco sin nota);
* una sola vez, activa la frase de "no significativo" (la tabla sigue
  declarando "0,0" y la frase nombra esos nutrientes al pie);
* si la base de composición está vacía, carga la base mínima de ejemplo.
"""

from sqlalchemy import select

from src.database import SessionLocal
from src.nutricion import constants as c
from src.nutricion.models import ParametroNutricion, ParametroNutriente
from src.nutricion.services import asegurar_parametros, cargar_alimentos_ejemplo

from .base import agregar_columna, marcar_migracion, migracion_ya_corrio, tablas

_CLAVE_GUIA_CATEDRA = "nutricion_guia_rotulado_catedra"
_CLAVE_FRASE_ACTIVADA = "nutricion_frase_no_significativo_activada"


def _ajustar_a_la_guia(db) -> None:
    for clave in (c.ENERGIA, c.SODIO):
        fila = db.get(ParametroNutriente, clave)
        if fila is not None and fila.decimales_menor_10 == 0:
            fila.decimales_menor_10 = 1
    for clave, (anterior, nuevo) in c.GENERALES_ANTERIORES.items():
        fila = db.scalar(select(ParametroNutricion).where(ParametroNutricion.clave == clave))
        if fila is not None and fila.valor == anterior:
            fila.valor = nuevo
    db.commit()


def migrar_nutricion() -> None:
    if "perfiles_nutricionales_insumo" in tablas():
        agregar_columna(
            "perfiles_nutricionales_insumo",
            "azucares_son_anadidos",
            "BOOLEAN NOT NULL DEFAULT 0",
        )
    with SessionLocal() as db:
        db.info["sin_auditoria"] = True
        ya_habia_parametros = db.scalar(select(ParametroNutriente.clave).limit(1)) is not None
        asegurar_parametros(db)
        if not migracion_ya_corrio(_CLAVE_GUIA_CATEDRA):
            if ya_habia_parametros:
                _ajustar_a_la_guia(db)
            marcar_migracion(_CLAVE_GUIA_CATEDRA)
        # La frase de "no significativo" era un texto libre: si alguien la había
        # cargado, queda activada la casilla (con el texto fijo de la guía).
        vieja = db.get(ParametroNutricion, "texto_no_significativo")
        nueva = db.get(ParametroNutricion, c.FRASE_NO_SIGNIFICATIVO)
        if vieja is not None and vieja.valor.strip() and nueva is not None:
            nueva.valor = "1"
        # Una sola vez: la frase pasa a estar activada por defecto ("0,0" en la
        # tabla y la frase al pie). Después se respeta lo que elija cada uno.
        if not migracion_ya_corrio(_CLAVE_FRASE_ACTIVADA):
            if nueva is not None:
                nueva.valor = "1"
            marcar_migracion(_CLAVE_FRASE_ACTIVADA)
        # Las leyendas obligatorias dejaron de ser editables (texto fijo).
        for clave in c.CLAVES_GENERALES_RETIRADAS:
            fila = db.get(ParametroNutricion, clave)
            if fila is not None:
                db.delete(fila)
        for clave in c.NUTRIENTES_SIN_VD:
            fila = db.get(ParametroNutriente, clave)
            if fila is not None and fila.valor_diario is not None:
                fila.valor_diario = None
        db.commit()
        cargar_alimentos_ejemplo(db)
