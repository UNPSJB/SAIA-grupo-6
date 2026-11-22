from src.ingredientes.constants import ErrorCode
from src.exceptions import NotFound, BadRequest


class IngredienteYaExiste(BadRequest):
    DETAIL = ErrorCode.INGREDIENTE_YA_EXISTE

class IngredienteNoEncontrado(NotFound):
    DETAIL = ErrorCode.INGREDIENTE_NO_ENCONTRADO

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO

class UnidadMedidaNoExiste(BadRequest):
    DETAIL = "La unidad de medida seleccionada no existe."

class UnidadMedidaInactiva(BadRequest):
    DETAIL = "La unidad de medida seleccionada está inactiva."

class AditivoSinClase(BadRequest):
    DETAIL = "Un aditivo necesita su clase funcional (conservante, colorante, aromatizante...)."

class ClaseFuncionalNoValida(BadRequest):
    DETAIL = "La clase funcional elegida no existe o está dada de baja."

class InsObligatorio(BadRequest):
    DETAIL = (
        "El número INS es obligatorio para esta clase funcional "
        "(solo es opcional en las que se declaran por su función, como los aromatizantes)."
    )


class UnidadEnUso(BadRequest):
    DETAIL = (
        "No se puede cambiar la unidad de medida: el ingrediente ya tiene lotes recibidos o está en recetas, "
        "y sus cantidades quedarían expresadas en otra unidad. Si la unidad está mal, creá un ingrediente nuevo "
        "y dá de baja este."
    )


class InsRepetido(BadRequest):
    """Un aditivo es un solo ingrediente: sus marcas se cargan como insumos."""

    DETAIL = "Ya hay un ingrediente con ese número INS."

    def __init__(self, nombre: str, activo: bool) -> None:
        super().__init__(
            f"El INS ya está cargado en el ingrediente «{nombre}»"
            + ("" if activo else " (dado de baja: reactivalo en vez de crear otro)")
            + ". Un aditivo es un solo ingrediente; las distintas marcas se cargan como insumos del ingrediente."
        )


class DensidadRequeridaParaVolumen(BadRequest):
    DETAIL = "La densidad (g/ml) es obligatoria cuando la unidad de medida es de tipo Volumen."


class PesoUnitarioRequeridoParaUnidad(BadRequest):
    DETAIL = "El peso unitario (g) es obligatorio cuando la unidad de medida es de tipo Unidad."
