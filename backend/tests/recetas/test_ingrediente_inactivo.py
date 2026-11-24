"""El detalle de una versión informa si cada ingrediente sigue activo en el maestro."""

from decimal import Decimal

from src.ingredientes.models import Ingrediente
from src.productos.models import Producto
from src.recetas import services
from src.recetas.models import Receta, RecetaIngrediente, TareaReceta, TareaRecetaIngrediente, VersionReceta
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


def test_detalle_de_version_marca_ingrediente_dado_de_baja(db_session):
    # Arrange
    db = db_session
    db.info["sin_auditoria"] = True
    try:
        kg = UnidadMedida(nombre="Kilogramo inactivo", simbolo="kg", tipo="masa")
        db.add(kg)
        db.commit()
        harina = Ingrediente(nombre="Harina activa", unidad_medida_id=kg.id)
        coco = Ingrediente(nombre="Coco dado de baja", unidad_medida_id=kg.id, activo=False)
        producto = Producto(nombre="Alfajor inactivo", unidad_medida_id=kg.id)
        db.add_all([harina, coco, producto])
        db.commit()
        receta = Receta(producto_id=producto.id, activo=True)
        db.add(receta)
        db.commit()
        version = VersionReceta(receta_id=receta.id, numero=1, rendimiento=Decimal("1"), unidad_medida_id=kg.id)
        db.add(version)
        db.commit()
        lineas = [
            RecetaIngrediente(version_receta_id=version.id, ingrediente_id=i.id, cantidad=Decimal("1"),
                              unidad_medida_id=kg.id, es_aditivo=False)
            for i in (harina, coco)
        ]
        db.add_all(lineas)
        db.commit()
        tarea = TareaReceta(version_receta_id=version.id, orden=1, descripcion="Mezclar")
        db.add(tarea)
        db.commit()
        db.add_all([
            TareaRecetaIngrediente(tarea_receta_id=tarea.id, receta_ingrediente_id=l.id, cantidad=Decimal("1"))
            for l in lineas
        ])
        db.commit()
        db.refresh(version)
    finally:
        db.info.pop("sin_auditoria", None)

    # Act
    detalle = services.a_detalle(version)

    # Assert
    activos = {i.ingrediente.nombre: i.ingrediente.activo for i in detalle.ingredientes}
    assert activos == {"Harina activa": True, "Coco dado de baja": False}
