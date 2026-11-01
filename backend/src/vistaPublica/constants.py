"""Catálogo de indicadores que puede publicar la vista pública.

Todos los indicadores son agregados y "positivos": un porcentaje donde más
alto es mejor. El catálogo no incluye incidentes, no conformidades ni ningún
dato que identifique a una persona, porque la vista pública es anónima.

`disponible=False` deja la definición en el catálogo pero la bloquea para
exponerla. Hoy todas están disponibles; el campo existe para poder reservar
indicadores futuros sin que el frontend los ofrezca.

Un indicador habilitado que todavía no tiene datos suficientes (o que no
alcanza el universo mínimo para publicarse sin identificar a nadie) no se
muestra a los visitantes: nunca se publica un "Sin datos".
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DefinicionIndicador:
    clave: str
    etiqueta: str
    descripcion: str
    formato: str = "porcentaje"
    disponible: bool = True
    # Los indicadores seguros arrancan encendidos: la vista pública ya es
    # opt-in a nivel global y, al activarla, el establecimiento muestra algo
    # sin tener que configurar cada tarjeta. El que el VSM reserva al tablero
    # interno (cumplimiento de limpieza) arranca apagado: el admin lo habilita
    # a propósito.
    habilitado_por_defecto: bool = True
    # Ventana de cálculo, cuando el indicador mira un período.
    periodo_dias: Optional[int] = None


CATALOGO: tuple[DefinicionIndicador, ...] = (
    DefinicionIndicador(
        clave="cumplimiento_poes",
        etiqueta="Cumplimiento de limpieza",
        descripcion=(
            "Porcentaje de tareas del plan de limpieza completadas en los "
            "últimos 30 días."
        ),
        periodo_dias=30,
        # El VSM reserva el gráfico de cumplimiento al tablero interno. La
        # vista pública solo puede mostrar el agregado, y el admin decide.
        habilitado_por_defecto=False,
    ),
    DefinicionIndicador(
        clave="equipos_al_dia",
        etiqueta="Equipos con calibración y mantenimiento al día",
        descripcion=(
            "Equipos activos cuyos planes de calibración y de mantenimiento "
            "están vigentes."
        ),
    ),
    DefinicionIndicador(
        clave="personal_apto",
        etiqueta="Personal con aptitudes vigentes",
        descripcion=(
            "Vencimientos de aptitud del personal activo que están al día. "
            "No se identifica a ninguna persona."
        ),
    ),
    DefinicionIndicador(
        clave="documentos_vigentes",
        etiqueta="Documentación al día",
        descripcion=(
            "Documentos con una versión vigente y sin vencer."
        ),
    ),
    DefinicionIndicador(
        clave="elementos_al_dia",
        etiqueta="Elementos de limpieza al día",
        descripcion=(
            "Elementos activos con recambio configurado que están dentro del "
            "plazo recomendado."
        ),
    ),
)

CATALOGO_POR_CLAVE = {definicion.clave: definicion for definicion in CATALOGO}