"""Endpoints de /configuracion: alertas de vencimientos y plazo de reclamos.

Usan el `client` y los usuarios de prueba de `conftest.py` (un admin y un
operador). La base de test es compartida por toda la sesión, así que cada test
que modifica un valor lo deja otra vez en el valor que tenía.
"""

DIAS_POR_DEFECTO = 15
URL = "/configuracion/alertas"
URL_PLAZO = "/configuracion/plazo-reclamo"


def _configuracion(client, headers):
    respuesta = client.get(URL, headers=headers)
    assert respuesta.status_code == 200
    return respuesta.json()


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
    # Arrange
    antes = _configuracion(client, usuarios["admin"])

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
    esperado = {
        "dias_alerta_vencimiento_personal": 30,
        "plazo_reclamo_dias": antes["plazo_reclamo_dias"],
        "meta_cumplimiento_limpieza": antes["meta_cumplimiento_limpieza"],
    }
    assert guardado.status_code == 200
    assert guardado.json() == esperado
    assert leido.status_code == 200
    assert leido.json() == esperado


def test_actualizar_solo_los_dias_de_alerta_no_pisa_el_plazo(client, usuarios):
    # Arrange
    antes = _configuracion(client, usuarios["admin"])
    nuevos_dias = 30 if antes["dias_alerta_vencimiento_personal"] != 30 else 31

    # Act
    try:
        respuesta = client.put(
            URL,
            json={"dias_alerta_vencimiento_personal": nuevos_dias},
            headers=usuarios["admin"],
        )
    finally:
        client.put(
            URL,
            json={
                "dias_alerta_vencimiento_personal": antes[
                    "dias_alerta_vencimiento_personal"
                ]
            },
            headers=usuarios["admin"],
        )

    # Assert
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "dias_alerta_vencimiento_personal": nuevos_dias,
        "plazo_reclamo_dias": antes["plazo_reclamo_dias"],
        "meta_cumplimiento_limpieza": antes["meta_cumplimiento_limpieza"],
    }


def test_actualizar_solo_el_plazo_no_pisa_los_dias_de_alerta(client, usuarios):
    # Arrange
    antes = _configuracion(client, usuarios["admin"])
    nuevo_plazo = 45 if antes["plazo_reclamo_dias"] != 45 else 46

    # Act
    try:
        respuesta = client.put(
            URL,
            json={"plazo_reclamo_dias": nuevo_plazo},
            headers=usuarios["admin"],
        )
    finally:
        client.put(
            URL,
            json={"plazo_reclamo_dias": antes["plazo_reclamo_dias"]},
            headers=usuarios["admin"],
        )

    # Assert
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "dias_alerta_vencimiento_personal": antes[
            "dias_alerta_vencimiento_personal"
        ],
        "plazo_reclamo_dias": nuevo_plazo,
        "meta_cumplimiento_limpieza": antes["meta_cumplimiento_limpieza"],
    }


def test_actualizar_alertas_ignora_los_campos_nulos(client, usuarios):
    # Arrange
    antes = _configuracion(client, usuarios["admin"])

    # Act
    respuesta = client.put(
        URL,
        json={"dias_alerta_vencimiento_personal": None, "plazo_reclamo_dias": None},
        headers=usuarios["admin"],
    )

    # Assert
    assert respuesta.status_code == 200
    assert respuesta.json() == antes


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


def test_obtener_plazo_reclamo_requiere_sesion(client):
    # Act
    respuesta = client.get(URL_PLAZO)

    # Assert
    assert respuesta.status_code == 401


def test_obtener_plazo_reclamo_para_un_operador(client, usuarios):
    # Arrange
    esperado = _configuracion(client, usuarios["admin"])["plazo_reclamo_dias"]

    # Act
    respuesta = client.get(URL_PLAZO, headers=usuarios["operador"])

    # Assert
    assert respuesta.status_code == 200
    assert respuesta.json() == {"plazo_reclamo_dias": esperado}


def test_actualizar_el_plazo_rechaza_a_un_operador(client, usuarios):
    # Act
    respuesta = client.put(
        URL,
        json={"plazo_reclamo_dias": 40},
        headers=usuarios["operador"],
    )

    # Assert
    assert respuesta.status_code == 403


def test_actualizar_el_plazo_valida_el_rango(client, usuarios):
    for invalido in (0, -1, 366):
        # Act
        respuesta = client.put(
            URL,
            json={"plazo_reclamo_dias": invalido},
            headers=usuarios["admin"],
        )

        # Assert
        assert respuesta.status_code == 422, invalido


def test_los_endpoints_viejos_de_notificaciones_ya_no_existen(client, usuarios):
    # Act
    respuesta = client.get("/notificaciones/configuracion", headers=usuarios["admin"])

    # Assert
    assert respuesta.status_code == 404


def test_meta_de_limpieza_por_defecto_y_actualizable(client, usuarios):
    # Arrange
    antes = _configuracion(client, usuarios["admin"])

    # Act
    try:
        guardado = client.put(URL, json={"meta_cumplimiento_limpieza": 90}, headers=usuarios["admin"])
        fuera_de_rango = client.put(URL, json={"meta_cumplimiento_limpieza": 120}, headers=usuarios["admin"])
        leido = _configuracion(client, usuarios["admin"])
    finally:
        client.put(
            URL,
            json={"meta_cumplimiento_limpieza": antes["meta_cumplimiento_limpieza"]},
            headers=usuarios["admin"],
        )

    # Assert
    assert antes["meta_cumplimiento_limpieza"] == 100
    assert guardado.status_code == 200
    assert fuera_de_rango.status_code == 422
    assert leido["meta_cumplimiento_limpieza"] == 90
    # Cambiar la meta no toca los otros ajustes.
    assert leido["plazo_reclamo_dias"] == antes["plazo_reclamo_dias"]
