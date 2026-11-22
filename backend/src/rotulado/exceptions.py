from src.exceptions import BadRequest, NotFound


class BorradorNoEncontrado(NotFound):
    DETAIL = "El borrador de rotulado no fue encontrado."


class ProductoNoEncontrado(BadRequest):
    DETAIL = "El producto no fue encontrado o no está activo."


class VersionNoEncontrada(BadRequest):
    DETAIL = "La versión de receta no fue encontrada."


class VersionNoPerteneceAlProducto(BadRequest):
    DETAIL = "La versión de receta no pertenece al producto indicado."


class LoteNoEncontrado(BadRequest):
    DETAIL = "El lote de producto no fue encontrado."


class LoteNoPerteneceAlProducto(BadRequest):
    DETAIL = "El lote no pertenece al producto indicado."


class LoteVersionIncompatible(BadRequest):
    DETAIL = (
        "El lote no fue producido con la versión de receta indicada para el borrador."
    )


class NutricionBorradorNoDisponible(BadRequest):
    DETAIL = "No se pudo recalcular la tabla nutricional. Se conservó la tabla del borrador."
