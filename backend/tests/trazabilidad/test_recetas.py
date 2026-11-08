from decimal import Decimal

import pytest

from src.recetas import exceptions, schemas, services
from src.recetas.models import RecetaInsumo, TareaReceta, VersionReceta

from .conftest import receta_datos


def test_la_receta_nace_con_version_1_y_sus_tareas_pertenecen_a_la_version(escenario):
    version = escenario.version1

    assert version.numero == 1
    assert [t.orden for t in version.tareas] == [1, 2]
    assert [t.descripcion for t in version.tareas] == ["Amasar", "Condimentar"]
    assert {i.clasificacion for i in version.insumos} == {"ingrediente", "aditivo"}
    assert all(t.version_receta_id == version.id for t in version.tareas)


def test_modificar_la_receta_crea_una_version_nueva_y_deja_intacta_la_anterior(escenario):
    db = escenario.db
    datos = receta_datos(
        escenario,
        harina_total="12",
        tareas=[
            {"descripcion": "Amasar fuerte", "insumos": [{"insumo_id": escenario.harina.id, "cantidad": "12"}]},
            {"descripcion": "Condimentar", "insumos": [{"insumo_id": escenario.sal.id, "cantidad": "2"}]},
            {"descripcion": "Hornear", "insumos": []},
        ],
    )

    version2 = services.crear_version(db, escenario.receta.id, datos, escenario.admin)

    assert version2.numero == 2
    assert services.version_vigente(db, escenario.receta.id).id == version2.id
    v1 = db.get(VersionReceta, escenario.version1.id)
    assert [t.descripcion for t in v1.tareas] == ["Amasar", "Condimentar"]
    harina_v1 = next(i for i in v1.insumos if i.insumo_id == escenario.harina.id)
    assert harina_v1.cantidad == Decimal("10")


def test_una_version_creada_es_de_solo_lectura(escenario):
    db = escenario.db
    version = db.get(VersionReceta, escenario.version1.id)

    version.rendimiento = Decimal("99")
    with pytest.raises(exceptions.VersionRecetaInmutableError):
        db.commit()
    db.rollback()

    tarea = db.get(TareaReceta, escenario.version1.tareas[0].id)
    tarea.descripcion = "Cambio a escondidas"
    with pytest.raises(exceptions.VersionRecetaInmutableError):
        db.commit()
    db.rollback()

    insumo = db.query(RecetaInsumo).first()
    db.delete(insumo)
    with pytest.raises(exceptions.VersionRecetaInmutableError):
        db.commit()
    db.rollback()


def test_un_producto_solo_tiene_una_receta(escenario):
    with pytest.raises(exceptions.RecetaYaExiste):
        services.crear_receta(
            escenario.db,
            schemas.RecetaCreate(producto_id=escenario.pan.id, version=receta_datos(escenario)),
            escenario.admin,
        )


def test_el_reparto_entre_tareas_debe_sumar_el_total_de_cada_insumo(escenario):
    datos = receta_datos(
        escenario,
        tareas=[
            {"descripcion": "Amasar", "insumos": [{"insumo_id": escenario.harina.id, "cantidad": "4"}]},
            {"descripcion": "Condimentar", "insumos": [{"insumo_id": escenario.sal.id, "cantidad": "2"}]},
        ],
    )

    with pytest.raises(exceptions.RepartoIncompleto):
        services.crear_version(escenario.db, escenario.receta.id, datos, escenario.admin)


def test_un_insumo_puede_repartirse_en_varias_tareas(escenario):
    datos = receta_datos(
        escenario,
        tareas=[
            {"descripcion": "Pre-mezcla", "insumos": [{"insumo_id": escenario.harina.id, "cantidad": "4"}]},
            {
                "descripcion": "Mezcla final",
                "insumos": [
                    {"insumo_id": escenario.harina.id, "cantidad": "6"},
                    {"insumo_id": escenario.sal.id, "cantidad": "2"},
                ],
            },
        ],
    )

    version = services.crear_version(escenario.db, escenario.receta.id, datos, escenario.admin)

    assert [len(t.insumos) for t in version.tareas] == [1, 2]


def test_la_unidad_de_la_receta_debe_ser_la_del_insumo(escenario):
    from src.unidadMedida.models import UnidadMedida

    gramo = UnidadMedida(nombre="Gramo", simbolo="g")
    escenario.db.add(gramo)
    escenario.db.commit()
    datos = receta_datos(escenario)
    datos.insumos[0].unidad_medida_id = gramo.id

    with pytest.raises(exceptions.UnidadNoCoincide):
        services.crear_version(escenario.db, escenario.receta.id, datos, escenario.admin)


def test_api_el_operador_consulta_recetas_en_solo_lectura(client, escenario):
    """E9: quien opera consulta la receta vigente, pero no la modifica."""
    assert client.get("/recetas", headers=escenario.h_sin_permisos).status_code == 403

    respuesta = client.get("/recetas", headers=escenario.h_operador)
    assert respuesta.status_code == 200
    assert respuesta.json()[0]["version_vigente"]["numero"] == 1

    version_id = respuesta.json()[0]["version_vigente"]["id"]
    detalle = client.get(f"/recetas/versiones/{version_id}", headers=escenario.h_operador)
    assert detalle.status_code == 200

    cuerpo = receta_datos(escenario).model_dump(mode="json")
    nueva = client.post(
        f"/recetas/{escenario.receta.id}/versiones", json=cuerpo, headers=escenario.h_operador
    )
    assert nueva.status_code == 403


def test_api_crear_version_devuelve_el_detalle(client, escenario):
    cuerpo = {
        "rendimiento": "20",
        "unidad_medida_id": escenario.kg.id,
        "insumos": [
            {
                "insumo_id": escenario.harina.id,
                "cantidad": "9",
                "unidad_medida_id": escenario.kg.id,
            }
        ],
        "tareas": [
            {"descripcion": "Amasar", "insumos": [{"insumo_id": escenario.harina.id, "cantidad": "9"}]}
        ],
    }

    respuesta = client.post(
        f"/recetas/{escenario.receta.id}/versiones", json=cuerpo, headers=escenario.h_admin
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["numero"] == 2
    assert respuesta.json()["tareas"][0]["insumos"][0]["cantidad"] == "9.000"
