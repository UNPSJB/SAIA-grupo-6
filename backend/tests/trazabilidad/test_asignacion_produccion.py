"""Asignación de las tareas de un lote de producción (como en el checklist de
limpieza): quien opera ve solo los lotes donde tiene trabajo y registra solo
sus tareas o las que no tienen a nadie asignado. Quien administra asigna,
reasigna y puede todo.
"""

from decimal import Decimal

import pytest

from src.lotes import exceptions, schemas, services
from tests.produccion_helpers import registrar_lo_planificado

from .conftest import _usuario


@pytest.fixture
def otra(escenario):
    """Una segunda persona que opera."""
    persona, headers = _usuario(
        escenario.db, nombre="Olga", apellido="Otra", dni="10000004", email="olga@test.local",
        puede_administrar=False, puede_operar=True,
    )
    escenario.otra, escenario.h_otra = persona, headers
    return persona


def _crear(escenario, responsable=None, usuario=None):
    return services.crear_lote(
        escenario.db,
        schemas.LoteCreate(
            producto_id=escenario.pan.id,
            cantidad_objetivo=Decimal("10"),
            responsable_id=responsable.id if responsable else None,
        ),
        usuario or escenario.admin,
    )


def _consumir(escenario, lote, usuario, indice=0, cantidad="1"):
    item = sorted(lote.checklist, key=lambda i: i.tarea.orden)[indice]
    return services.registrar_consumo(
        escenario.db, lote.id, item.id,
        schemas.ConsumoCreate(lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal(cantidad)), usuario,
    )


def test_el_responsable_queda_asignado_a_todas_las_tareas(escenario):
    lote = _crear(escenario, responsable=escenario.operador)

    assert {i.asignado_a_id for i in lote.checklist} == {escenario.operador.id}
    detalle = services.detalle(escenario.db, lote)
    assert detalle.checklist[0].asignado_a_nombre == "Omar Operador"


def test_solo_quien_administra_elige_responsable(escenario):
    with pytest.raises(exceptions.AsignacionSoloAdministra):
        _crear(escenario, responsable=escenario.operador, usuario=escenario.operador)
    # Sin responsable, quien opera puede iniciar el lote (E9): queda sin asignar.
    lote = _crear(escenario, usuario=escenario.operador)
    assert {i.asignado_a_id for i in lote.checklist} == {None}


def test_no_se_asigna_a_quien_no_opera(escenario):
    sin_permiso, _ = _usuario(
        escenario.db, nombre="Nadia", apellido="Nadie", dni="10000005", email="nadia@test.local",
        puede_administrar=False, puede_operar=False,
    )
    with pytest.raises(exceptions.PersonaNoAsignable):
        _crear(escenario, responsable=sin_permiso)


def test_la_tarea_de_otra_persona_no_se_registra(escenario, otra):
    lote = _crear(escenario, responsable=otra)
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]

    with pytest.raises(exceptions.TareaAsignadaAOtro):
        _consumir(escenario, lote, escenario.operador)
    with pytest.raises(exceptions.TareaAsignadaAOtro):
        services.completar_item(escenario.db, lote.id, amasar.id, escenario.operador)
    # La persona asignada sí, y quien administra también.
    assert _consumir(escenario, lote, otra)[0].id
    assert _consumir(escenario, lote, escenario.admin)[0].id


def test_una_tarea_sin_asignar_la_hace_cualquiera(escenario, otra):
    lote = _crear(escenario)

    assert _consumir(escenario, lote, escenario.operador)[0].id
    assert _consumir(escenario, lote, otra)[0].id


def test_reasignar_una_tarea_pendiente(escenario, otra):
    lote = _crear(escenario, responsable=escenario.operador)
    amasar, condimentar = sorted(lote.checklist, key=lambda i: i.tarea.orden)

    lote = services.asignar_tarea(
        escenario.db, lote.id, amasar.id, schemas.AsignacionTarea(asignado_a_id=otra.id), escenario.admin
    )
    assert next(i for i in lote.checklist if i.id == amasar.id).asignado_a_id == otra.id
    # Liberarla: queda para cualquiera.
    lote = services.asignar_tarea(
        escenario.db, lote.id, condimentar.id, schemas.AsignacionTarea(asignado_a_id=None), escenario.admin
    )
    assert next(i for i in lote.checklist if i.id == condimentar.id).asignado_a_id is None

    with pytest.raises(exceptions.AsignacionSoloAdministra):
        services.asignar_tarea(
            escenario.db, lote.id, amasar.id, schemas.AsignacionTarea(asignado_a_id=None), escenario.operador
        )


def test_una_tarea_hecha_no_se_reasigna(escenario):
    lote = _crear(escenario)
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]
    registrar_lo_planificado(escenario.db, lote.id, amasar.id, escenario.operador)
    services.completar_item(escenario.db, lote.id, amasar.id, escenario.operador)

    with pytest.raises(exceptions.ItemYaCompletado):
        services.asignar_tarea(
            escenario.db, lote.id, amasar.id, schemas.AsignacionTarea(asignado_a_id=escenario.admin.id),
            escenario.admin,
        )


def test_quien_opera_ve_solo_los_lotes_donde_tiene_trabajo(escenario, otra):
    propio = _crear(escenario, responsable=escenario.operador)
    ajeno = _crear(escenario, responsable=otra)
    libre = _crear(escenario)

    ids = {l.id for l in services.listar_lotes(escenario.db, usuario=escenario.operador)}
    assert ids == {propio.id, libre.id}
    # Quien administra ve todos.
    assert {propio.id, ajeno.id, libre.id} <= {l.id for l in services.listar_lotes(escenario.db, usuario=escenario.admin)}
    with pytest.raises(exceptions.LoteNoEncontrado):
        services.lote_visible(escenario.db, ajeno.id, escenario.operador)


def test_quien_opera_no_lista_los_lotes_cerrados(escenario):
    """Aunque haya trabajado en él, un lote terminado sale del listado de quien
    opera; la ficha (de solo lectura) se sigue pudiendo abrir desde una salida,
    un reclamo o un retiro."""
    terminado = _crear(escenario, responsable=escenario.operador)
    en_proceso = _crear(escenario, responsable=escenario.operador)
    terminado.estado = "terminado"
    escenario.db.commit()

    ids = {l.id for l in services.listar_lotes(escenario.db, usuario=escenario.operador)}
    assert ids == {en_proceso.id}
    assert services.lote_visible(escenario.db, terminado.id, escenario.operador).id == terminado.id
    # Quien administra los sigue listando todos.
    assert terminado.id in {l.id for l in services.listar_lotes(escenario.db, usuario=escenario.admin)}


def test_api_asignacion_y_lotes_visibles(client, escenario, otra):
    ajeno = _crear(escenario, responsable=otra)
    item = ajeno.checklist[0]

    url = f"/lotes/{ajeno.id}/checklist/{item.id}/asignacion"
    assert client.put(url, json={"asignado_a_id": escenario.operador.id}, headers=escenario.h_operador).status_code == 403
    assert client.get(f"/lotes/{ajeno.id}", headers=escenario.h_operador).status_code == 404

    asignado = client.put(url, json={"asignado_a_id": escenario.operador.id}, headers=escenario.h_admin)
    assert asignado.status_code == 200
    assert client.get(f"/lotes/{ajeno.id}", headers=escenario.h_operador).status_code == 200


def test_el_inicio_de_quien_opera_lista_sus_tareas_de_produccion(escenario, otra):
    from src.paneles import services as paneles

    propio = _crear(escenario, responsable=escenario.operador)
    _crear(escenario, responsable=otra)
    libre = _crear(escenario)

    tareas = paneles.panel_inicio(escenario.db, escenario.operador, False).tareas_produccion
    # Las dos tareas propias primero, después las dos del lote sin asignar.
    assert [(t.lote_id, t.asignada) for t in tareas] == [
        (propio.id, True), (propio.id, True), (libre.id, False), (libre.id, False)
    ]
    assert [t.descripcion for t in tareas[:2]] == ["Amasar", "Condimentar"]
    # Las etapas van en orden: la segunda queda en espera hasta completar la primera.
    assert [t.habilitada for t in tareas[:2]] == [True, False]
    # Quien administra no recibe esta lista (ve las cifras de cada área).
    assert paneles.panel_inicio(escenario.db, escenario.admin, True).tareas_produccion is None
