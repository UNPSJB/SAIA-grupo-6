from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class ClaseFuncional(ModeloBase):
    """Clase funcional de un aditivo (conservante, colorante, aromatizante...).

    Es una lista que se mantiene desde la app. `ins_opcional` marca las clases
    que se declaran solo por su función (aromatizantes).

    Antes había además una tabla `aditivos` (la lista de referencia con nombre
    e INS) a la que apuntaba cada ingrediente aditivo. Ahora el ingrediente
    guarda su propia clase e INS, y la lista de referencia
    (`src.aditivos.referencia`) solo se usa para sugerirlos al cargarlo.
    """

    __tablename__ = "clases_funcionales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    ins_opcional: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
