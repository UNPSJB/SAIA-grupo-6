import pytest
from tests.database import db_session, multiples_equipos, sector, unico_equipo
from src.Equipo import services, exceptions
from src.Equipo.schemas import EquipoCreate, EquipoUpdate


def test_listar_equipos_oculta_inactivos(db_session, multiples_equipos):
    equipos = services.listar_equipos(db_session)
    assert len(equipos) == 2                      # el inactivo no aparece
    assert all(e.activo for e in equipos)


def test_listar_equipos_incluyendo_inactivos(db_session, multiples_equipos):
    equipos = services.listar_equipos(db_session, incluir_inactivos=True)
    assert len(equipos) == 3


def test_crear_equipo(db_session, sector):
    datos = EquipoCreate(nombre="Balanza-01", sector_id=sector.id, tipo="Balanza")
    equipo = services.crear_equipo(db_session, datos)
    assert equipo.id is not None
    assert equipo.activo is True


def test_obtener_equipo_inexistente(db_session):
    with pytest.raises(exceptions.EquipoNoEncontrado):
        services.obtener_equipo(db_session, 999)


def test_actualizar_equipo(db_session, unico_equipo):
    actualizado = services.actualizar_equipo(

        db_session, unico_equipo.id, EquipoUpdate(tipo="Medición")
    )
    assert actualizado.tipo == "Medición"
    assert actualizado.nombre == "Heladera-01"    # lo que no se envió no cambia


def test_dar_de_baja_equipo(db_session, unico_equipo):
    baja = services.dar_de_baja_equipo(db_session, unico_equipo.id)
    assert baja.activo is False                   # baja lógica, la fila sigue existiendo