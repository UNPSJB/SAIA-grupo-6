"""Búsqueda, orden y paginación compartidos por los listados."""

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from sqlalchemy import Select, and_, case, or_
from sqlalchemy.orm import Session

from src.common.paginacion import paginar
from src.common.texto import contiene_texto


@dataclass(frozen=True)
class ColumnaOrden:
    expresiones: tuple[Any, ...]
    descendente: bool = False
    nulos_al_final: bool = False


def filtro_busqueda(campos: Sequence[Any], texto: str | None) -> Any | None:
    """Cada palabra tiene que aparecer en alguno de los campos."""
    terminos = (texto or "").split()
    if not terminos:
        return None

    return and_(
        *(
            or_(*(contiene_texto(campo, termino) for campo in campos))
            for termino in terminos
        )
    )


def aplicar_orden(
    consulta: Select,
    modelo: Any,
    orden: str | None,
    disponibles: Mapping[str, ColumnaOrden],
    por_defecto: str,
) -> Select:
    """Aplica el orden pedido. Siempre desempata por `id` para no saltar filas entre páginas."""
    clave = orden if orden in disponibles else por_defecto
    columna = disponibles[clave]

    criterios: list[Any] = []
    for expresion in columna.expresiones:
        if columna.nulos_al_final:
            criterios.append(case((expresion.is_(None), 1), else_=0))
        criterios.append(
            expresion.desc() if columna.descendente else expresion.asc()
        )

    criterios.append(
        modelo.id.desc() if columna.descendente else modelo.id.asc()
    )
    return consulta.order_by(*criterios)


def paginar_consulta(
    db: Session,
    consulta: Select,
    *,
    modelo: Any,
    filtros: Sequence[Any] = (),
    orden: str | None = None,
    ordenes: Mapping[str, ColumnaOrden] | None = None,
    por_defecto: str = "id",
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[Any], int]:
    if filtros:
        consulta = consulta.where(*filtros)

    if ordenes:
        consulta = aplicar_orden(consulta, modelo, orden, ordenes, por_defecto)
    else:
        consulta = consulta.order_by(modelo.id)

    return paginar(db, consulta, page, page_size)
