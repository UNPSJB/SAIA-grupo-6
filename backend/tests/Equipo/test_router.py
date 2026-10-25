from tests.database import client, unico_equipo, multiples_equipos, db_session



def test_get_equipo(client, unico_equipo):
    response = client.get(f"/equipos/{unico_equipo.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == unico_equipo.id
    assert data["nombre"] == "Heladera-01"


def test_listar_equipos(client, multiples_equipos):
    response = client.get("/equipos")
    assert response.status_code == 200
    assert len(response.json()) == 2              # sin inactivos


def test_listar_equipos_incluyendo_inactivos(client, multiples_equipos):
    response = client.get("/equipos", params={"incluir_inactivos": True})
    assert len(response.json()) == 3


def test_get_equipo_inexistente(client):
    response = client.get("/equipos/999")
    assert response.status_code == 404


def test_crear_equipo(client):
    body = {"nombre": "Horno-01", "tipo": "Horno", "ubicacion": "Cocina"}
    response = client.post("/equipos", json=body)
    assert response.status_code == 201
    assert response.json()["nombre"] == "Horno-01"


def test_dar_de_baja_equipo(client, unico_equipo):
    response = client.delete(f"/equipos/{unico_equipo.id}")
    assert response.status_code == 200
    assert response.json()["activo"] is False

def test_actualizar_equipo(client, unico_equipo):
    response = client.patch(f"/equipos/{unico_equipo.id}", json={"ubicacion": "Depósito"})
    assert response.status_code == 200
    assert response.json()["ubicacion"] == "Depósito"