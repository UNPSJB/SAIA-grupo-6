from sqlalchemy import text

from src.database import engine

from .base import agregar_columna, tablas

#: Tipo de incidente de circuito -> su tipo de riesgo propio. Antes contaban
#: como "Higiene y contaminación" según su causa.
_TIPOS_DE_CIRCUITO = {
    "reclamo_cliente": "RECLAMO_CLIENTE",
    "retiro_lote": "RETIRO_LOTE",
    "entrega_rechazada": "ENTREGA_RECHAZADA",
}


def migrar_planes_accion() -> None:
    """Columnas agregadas a las tablas de planes de acción después de su
    primera versión."""
    if "riesgos_elemento_plan" in tablas():
        # Riesgo tratado del elemento en cada momento (el real está en `puntaje`).
        # Los registros anteriores quedan en NULL: se leen como iguales al real.
        agregar_columna("riesgos_elemento_plan", "puntaje_tratado", "FLOAT")
    if "situaciones_plan" in tablas():
        # Último riesgo medido de cada situación del plan (para mostrar lo que
        # los planes ya corrigieron, cuando la situación ya no se detecta).
        agregar_columna("situaciones_plan", "ultimo_impacto", "INTEGER")
        agregar_columna("situaciones_plan", "ultima_probabilidad", "FLOAT")
        agregar_columna("situaciones_plan", "ultimo_puntaje", "FLOAT")
    _separar_tipos_de_circuito()


def _separar_tipos_de_circuito() -> None:
    """Los reclamos, retiros y rechazos tienen ahora su propio tipo de riesgo.
    Se reetiqueta su historial (y los planes que nacieron de ellos) para no
    perder persistencia ni recurrencia. Idempotente."""
    if not {"situaciones_riesgo", "incidentes"} <= tablas():
        return
    with engine.begin() as conexion:
        for tipo_incidente, tipo_riesgo in _TIPOS_DE_CIRCUITO.items():
            conexion.execute(
                text(
                    "UPDATE situaciones_riesgo SET tipo = :nuevo "
                    "WHERE tipo = 'HIGIENE_CONTAMINACION' AND clave IN "
                    "(SELECT 'incidente-' || id FROM incidentes WHERE tipo = :incidente)"
                ),
                {"nuevo": tipo_riesgo, "incidente": tipo_incidente},
            )
        if "planes_accion" in tablas():
            conexion.execute(
                text(
                    "UPDATE planes_accion SET tipo = (SELECT s.tipo FROM situaciones_riesgo s "
                    "WHERE s.id = planes_accion.situacion_origen_id) "
                    "WHERE tipo = 'HIGIENE_CONTAMINACION' AND EXISTS (SELECT 1 FROM "
                    "situaciones_riesgo s WHERE s.id = planes_accion.situacion_origen_id "
                    "AND s.tipo != 'HIGIENE_CONTAMINACION')"
                )
            )
