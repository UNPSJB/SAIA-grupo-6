"""Paginación server-side compartida por todos los listados.

Antes cada tabla traía la lista completa del backend y recortaba en el
navegador (`usePaginas`), lo que pedía miles de filas para mostrar 10. Acá
vive el sobre de respuesta (`Pagina`) y la dependencia de FastAPI
(`ParamsPaginacion`) que leen `page` / `page_size` del query string.

Compatibilidad: los endpoints que además alimentan dropdowns y el dashboard
aceptan `page` como parámetro OPCIONAL. Sin `page` siguen devolviendo la
lista completa de siempre; con `page`, el sobre `Pagina`. Así los
consumidores que necesitan todo siguen funcionando sin cambios.

Uso en un router:

    @router.get("", response_model=Union[List[schemas.Insumo], schemas.InsumoPagina])
    def read_insumos(
        incluir_inactivos: bool = False,
        page: Optional[int] = Query(None, ge=1),
        page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
        db: Session = Depends(get_db),
    ):
        if page is None:
            return services.listar_insumos(db, incluir_inactivos)
        items, total = services.listar_insumos_paginado(db, incluir_inactivos, page, page_size)
        return schemas.InsumoPagina(
            items=items, total=total, page=page, page_size=page_size
        )
"""

import math
from typing import Generic, List, Tuple, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict, computed_field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

PAGE_SIZE_POR_DEFECTO = 10
PAGE_SIZE_MAXIMO = 100


class ParamsPaginacion:
    """Dependencia de FastAPI para endpoints SIEMPRE paginados.

    Los endpoints con consumidores que necesitan la lista completa usan los
    parámetros sueltos con `page` opcional (ver el docstring del módulo); este
    `Depends()` es para los que solo devuelven páginas.
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Número de página, desde 1."),
        page_size: int = Query(
            PAGE_SIZE_POR_DEFECTO,
            ge=1,
            le=PAGE_SIZE_MAXIMO,
            description="Filas por página.",
        ),
    ) -> None:
        self.page = page
        self.page_size = page_size


class Pagina(BaseModel, Generic[T]):
    """Sobre estándar de un listado paginado en el servidor.

    `total` es la cantidad de FILAS que cumple el filtro (no de páginas), que
    es lo que el componente `Paginacion` del frontend espera como `count`.
    """

    items: List[T]
    total: int
    page: int
    page_size: int

    # from_attributes para poder armar la página directo desde el router sin
    # convertir los ORM a dict a mano.
    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_paginas(self) -> int:
        if self.page_size <= 0:
            return 1
        return max(1, math.ceil(self.total / self.page_size))


def paginar(
    db: Session, consulta: Select, page: int, page_size: int
) -> Tuple[List, int]:
    """Ejecuta la consulta acotada a la página y cuenta el total de filas.

    Devuelve `(items, total)`. La consulta tiene que traer su propio
    `ORDER BY`: sin un orden estable, `OFFSET/LIMIT` puede repetir u omitir
    filas entre páginas.

    El COUNT se hace sobre la misma consulta SIN el `ORDER BY` (con
    `.order_by(None)`): contar no necesita ordenar nada, y dejarlo dentro de
    la subconsulta hace que la base ordene todo el rango solo para contar
    (además de que en SQL Server ni siquiera es válido).
    """
    total = db.scalar(
        select(func.count()).select_from(consulta.order_by(None).subquery())
    )

    items = list(
        db.scalars(consulta.offset((page - 1) * page_size).limit(page_size)).all()
    )
    return items, int(total or 0)
