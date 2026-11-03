"""Endpoints de /configuracion: días de antelación de los vencimientos del personal.

Usan el `client` y los usuarios de prueba de `conftest.py` (un admin y un
operador). La base de test es compartida por toda la sesión, así que el test
que modifica el valor lo deja otra vez en el valor por defecto.
"""

DIAS_POR_DEFECTO = 15
URL = "/configuracion/alertas"


def test_obtener_alertas_requiere_sesion(client):
    # Act
    respuesta = client.get(URL)

    # Assert
    assert respuesta.status_code == 401


def test_obtener_alertas_rechaza_a_un_operador(client, usuarios):
    # Act
    respuesta = client.get(URL, headers=usuarios["operador"])

    # Assert
    assert respuesta.status_code == 403


def test_actualizar_alertas_rechaza_a_un_operador(client, usuarios):
    # Act
    respuesta = client.put(
        URL,
        json={"dias_alerta_vencimiento_personal": 30},
        headers=usuarios["operador"],
    )

    # Assert
    assert respuesta.status_code == 403


def test_actualizar_alertas_guarda_y_devuelve_el_valor(client, usuarios):
    # Act
    try:
        guardado = client.put(
            URL,
            json={"dias_alerta_vencimiento_personal": 30},
            headers=usuarios["admin"],
        )
        leido = client.get(URL, headers=usuarios["admin"])
    finally:
        # La base de test es de toda la sesión: se restaura el valor por defecto.
        client.put(
            URL,
            json={"dias_alerta_vencimiento_personal": DIAS_POR_DEFECTO},
            headers=usuarios["admin"],
        )

    # Assert
    assert guardado.status_code == 200
    assert guardado.json() == {"dias_alerta_vencimiento_personal": 30}
    assert leido.status_code == 200
    assert leido.json() == {"dias_alerta_vencimiento_personal": 30}


def test_actualizar_alertas_valida_el_rango(client, usuarios):
    for invalido in (0, -1, 366):
        # Act
        respuesta = client.put(
            URL,
            json={"dias_alerta_vencimiento_personal": invalido},
            headers=usuarios["admin"],
        )

        # Assert
        assert respuesta.status_code == 422, invalido


def test_los_endpoints_viejos_de_notificaciones_ya_no_existen(client, usuarios):
    # Act
    respuesta = client.get("/notificaciones/configuracion", headers=usuarios["admin"])

    # Assert
    assert respuesta.status_code == 404
