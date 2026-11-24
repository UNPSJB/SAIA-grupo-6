from .base import agregar_columna, tablas


def migrar_planes_accion() -> None:
    """Columnas agregadas a las tablas de planes de acción después de su
    primera versión."""
    if "riesgos_elemento_plan" in tablas():
        # Riesgo tratado del elemento en cada momento (el real está en `puntaje`).
        # Los registros anteriores quedan en NULL: se leen como iguales al real.
        agregar_columna("riesgos_elemento_plan", "puntaje_tratado", "FLOAT")
