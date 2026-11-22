"""Lo que un operario no puede hacer aunque tenga sesión (las pantallas ya no
se lo ofrecen; esto cubre la API).

* Registrar, editar o borrar calibraciones y mantenimientos (E4: administra).
* Ver el grafo de trazabilidad, que muestra proveedores y clientes (las demás
  consultas de trazabilidad ya eran solo de administradores).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.database import get_db
from src.Equipo.router import router as equipos_router
from src.trazabilidad.router import router as trazabilidad_router


def _cliente(escenario):
    app = FastAPI()
    app.include_router(equipos_router)
    app.include_router(trazabilidad_router)
    app.dependency_overrides[get_db] = lambda: escenario.db
    return TestClient(app)


def test_un_operario_no_registra_edita_ni_borra_intervenciones(escenario):
    cliente = _cliente(escenario)
    h = escenario.h_operador

    # El permiso se controla antes de buscar el equipo: da 403 aunque no exista.
    alta = cliente.post(
        "/equipos/1/calibraciones",
        data={"fecha_realizacion": "2026-11-01", "tipo": "calibracion"},
        files={"certificado": ("cert.pdf", b"%PDF-1.4", "application/pdf")},
        headers=h,
    )
    assert alta.status_code == 403
    assert cliente.patch("/equipos/1/calibraciones/1", headers=h).status_code == 403
    assert cliente.delete("/equipos/1/calibraciones/1", headers=h).status_code == 403
    # El historial de intervenciones lo sigue pudiendo consultar.
    assert cliente.get("/equipos/1/calibraciones", headers=h).status_code != 403


def test_el_grafo_de_trazabilidad_es_solo_para_administradores(escenario):
    cliente = _cliente(escenario)

    assert cliente.get("/trazabilidad/lotes-producto/1/grafo", headers=escenario.h_operador).status_code == 403
    assert cliente.get("/trazabilidad/lotes-producto/9999/grafo", headers=escenario.h_admin).status_code == 404
