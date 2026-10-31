import pytest

from src.exceptions import ConflictoRegistroInactivo
from src.proveedores import exceptions, schemas
from src.proveedores.services import (
    actualizar_proveedor,
    crear_proveedor,
    eliminar_proveedor,
    listar_proveedores,
    obtener_proveedor,
)


def test_crear_proveedor_recorta_los_datos_y_lista_activos(db):
    proveedor = crear_proveedor(
        db,
        schemas.ProveedorCreate(nombre="  Limpieza SA  ", matricula="  MAT-001  "),
    )

    assert proveedor.nombre == "Limpieza SA"
    assert proveedor.matricula == "MAT-001"
    assert proveedor.activo is True
    assert listar_proveedores(db) == [proveedor]


@pytest.mark.parametrize(
    ("campo", "valor", "excepcion"),
    [
        ("nombre", "   ", exceptions.NombreVacio),
        ("matricula", "   ", exceptions.MatriculaVacia),
    ],
)
def test_proveedor_rechaza_campos_obligatorios_vacios(campo, valor, excepcion):
    datos = {"nombre": "Proveedor", "matricula": "MAT-001", campo: valor}

    with pytest.raises(excepcion):
        schemas.ProveedorCreate(**datos)


def test_matricula_unica_y_reactivacion(db):
    proveedor = crear_proveedor(
        db, schemas.ProveedorCreate(nombre="Proveedor", matricula="MAT-001")
    )

    with pytest.raises(exceptions.MatriculaYaExiste):
        crear_proveedor(db, schemas.ProveedorCreate(nombre="Otro", matricula="MAT-001"))

    eliminado = eliminar_proveedor(db, proveedor.id)
    assert eliminado.activo is False
    assert listar_proveedores(db) == []
    assert listar_proveedores(db, incluir_inactivos=True) == [eliminado]

    with pytest.raises(ConflictoRegistroInactivo):
        crear_proveedor(db, schemas.ProveedorCreate(nombre="Nuevo nombre", matricula="MAT-001"))

    reactivado = actualizar_proveedor(
        db,
        proveedor.id,
        schemas.ProveedorUpdate(nombre="  Nombre actualizado  ", activo=True),
    )
    assert reactivado.nombre == "Nombre actualizado"
    assert reactivado.activo is True
    assert obtener_proveedor(db, proveedor.id) == reactivado
