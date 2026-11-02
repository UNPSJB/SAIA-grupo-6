from datetime import datetime
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.auth.services import crear_access_token
from src.database import get_db
from src.insumos.models import TIPO_INSUMO, TIPO_PRODUCTO, Insumo
from src.insumos.router import router as insumos_router
from src.lotes.models import (
    ESTADO_CANCELADO,
    ESTADO_FINALIZADO,
    ESTADO_PENDIENTE,
    ESTADOS_LOTE_CERRADOS,
    InsumoLote,
    LoteProduccion,
)
from src.lotes.router import router as lotes_router
from src.lotes.schemas import InsumosLoteCreate, LoteCreate, LoteResponse
from src.personal.models import Personal
from src.unidadMedida.models import UnidadMedida


def _datos(**cambios):
    base = {
        "codigo_lote": "L-001",
        "producto_nombre": "Pan",
        "cantidad_planificada": 100,
    }
    base.update(cambios)
    return base


def _valores_modelo(datos: LoteCreate) -> dict:
    return datos.model_dump(exclude={"producto_id"}, exclude_none=True)


def _personal(**cambios):
    base = {
        "nombre": "Persona",
        "apellido": "Lotes",
        "dni": "12345678",
        "email": "persona.lotes@test.local",
        "password": "x",
        "puede_operar": True,
    }
    base.update(cambios)
    return Personal(**base)


def test_alta_lote_recorta_datos_y_aplica_defaults(db_session):
    datos = LoteCreate(**_datos(codigo_lote=" L-001 ", producto_nombre=" Pan "))
    lote = LoteProduccion(**_valores_modelo(datos))

    db_session.add(lote)
    db_session.commit()
    db_session.refresh(lote)

    assert lote.id is not None
    assert lote.codigo_lote == "L-001"
    assert lote.producto_nombre == "Pan"
    assert lote.cantidad_planificada == 100
    assert lote.cantidad_producida == 0
    assert lote.estado == ESTADO_PENDIENTE
    assert lote.fecha_inicio is not None


def test_alta_con_cantidad_producida_usa_esa_cantidad_como_planificada():
    datos = LoteCreate(producto_nombre="Pan", cantidad_producida=25)

    assert datos.cantidad_producida == 25
    assert datos.cantidad_planificada == 25


def test_codigo_lote_duplicado_es_rechazado(db_session):
    db_session.add(LoteProduccion(**_datos()))
    db_session.commit()

    db_session.add(LoteProduccion(**_datos(producto_nombre="Otro producto")))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "cambios",
    [
        {"codigo_lote": "   "},
        {"producto_nombre": "   "},
        {"cantidad_planificada": 0},
        {"cantidad_planificada": -1},
    ],
)
def test_datos_invalidos_son_rechazados_por_el_esquema(cambios):
    with pytest.raises(ValidationError):
        LoteCreate(**_datos(**cambios))


def test_el_alta_exige_producto_y_cantidad():
    with pytest.raises(ValidationError):
        LoteCreate(codigo_lote="L-001", cantidad_planificada=10)
    with pytest.raises(ValidationError):
        LoteCreate(producto_nombre="Pan")


@pytest.mark.parametrize(
    "cambios",
    [
        {"cantidad_producida": -1},
        {"estado": "Estado inexistente"},
    ],
)
def test_restricciones_de_la_base_rechazan_datos_invalidos(db_session, cambios):
    db_session.add(LoteProduccion(**_datos(**cambios)))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_respuesta_se_construye_desde_el_modelo(db_session):
    lote = LoteProduccion(**_datos())
    db_session.add(lote)
    db_session.commit()
    db_session.refresh(lote)

    respuesta = LoteResponse.model_validate(lote)

    assert respuesta.id == lote.id
    assert respuesta.codigo_lote == "L-001"
    assert respuesta.producto_nombre == "Pan"
    assert respuesta.cantidad_planificada == 100
    assert respuesta.cantidad_producida == 0
    assert respuesta.estado == ESTADO_PENDIENTE
    assert respuesta.fecha_inicio == lote.fecha_inicio
    assert respuesta.insumos == []


def test_bulk_rechaza_insumos_repetidos_en_el_esquema():
    with pytest.raises(ValidationError):
        InsumosLoteCreate(
            insumos=[
                {"insumo_id": 1, "cantidad": "1"},
                {"insumo_id": 1, "cantidad": "2"},
            ]
        )


@pytest.fixture
def client_lotes(db_session):
    app = FastAPI()
    app.include_router(lotes_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def client_insumos(db_session):
    app = FastAPI()
    app.include_router(insumos_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _headers(db_session, **cambios):
    usuario = _personal(**cambios)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(usuario)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    token, _, _ = crear_access_token(str(usuario.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_operador(db_session):
    return _headers(
        db_session,
        dni="12345678",
        email="operador.lotes@test.local",
        puede_operar=True,
        puede_administrar=False,
    )


@pytest.fixture
def headers_admin(db_session):
    return _headers(
        db_session,
        nombre="Admin",
        dni="87654321",
        email="admin.lotes@test.local",
        puede_operar=True,
        puede_administrar=True,
    )


@pytest.fixture
def lote(db_session):
    lote = LoteProduccion(**_datos())
    db_session.add(lote)
    db_session.commit()
    db_session.refresh(lote)
    return lote


@pytest.fixture
def insumo(db_session):
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg")
    insumo = Insumo(nombre="Harina", unidad_medida=unidad)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([unidad, insumo])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    db_session.refresh(insumo)
    return insumo


@pytest.fixture
def segundo_insumo(db_session):
    unidad = UnidadMedida(nombre="Litro", simbolo="l")
    insumo = Insumo(nombre="Agua", unidad_medida=unidad)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([unidad, insumo])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    db_session.refresh(insumo)
    return insumo


@pytest.fixture
def producto(db_session):
    unidad = UnidadMedida(nombre="Unidad", simbolo="u")
    producto = Insumo(
        nombre="Pan",
        tipo=TIPO_PRODUCTO,
        unidad_medida=unidad,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([unidad, producto])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    db_session.refresh(producto)
    return producto


def test_post_registra_un_lote(client_lotes, headers_operador, db_session):
    respuesta = client_lotes.post(
        "/lotes",
        json={
            "codigo_lote": " L-001 ",
            "producto_nombre": " Pan ",
            "cantidad_planificada": 100,
        },
        headers=headers_operador,
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    producto = db_session.scalar(
        select(Insumo).where(
            Insumo.nombre == "Pan",
            Insumo.tipo == TIPO_PRODUCTO,
        )
    )
    assert producto is not None
    assert datos["producto_id"] == producto.id
    assert datos["codigo_lote"] == "L-001"
    assert datos["producto_nombre"] == "Pan"
    assert datos["cantidad_planificada"] == 100
    assert datos["cantidad_producida"] == 0
    assert datos["estado"] == ESTADO_PENDIENTE
    assert datos["fecha_inicio"] is not None
    assert datos["insumos"] == []


def test_post_registra_lote_simple_con_cantidad_producida_y_fecha(
    client_lotes, headers_operador, db_session
):
    respuesta = client_lotes.post(
        "/lotes",
        json={
            "producto_nombre": "Mermelada",
            "cantidad_producida": 25,
            "fecha_inicio": "2026-05-10",
        },
        headers=headers_operador,
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["codigo_lote"].startswith("L-2026")
    assert datos["producto_nombre"] == "Mermelada"
    assert datos["cantidad_planificada"] == 25
    assert datos["cantidad_producida"] == 25
    assert datos["fecha_inicio"].startswith("2026-05-10")

    producto = db_session.scalar(
        select(Insumo).where(
            Insumo.nombre == "Mermelada",
            Insumo.tipo == TIPO_PRODUCTO,
        )
    )
    assert producto is not None
    assert datos["producto_id"] == producto.id


def test_post_acepta_producto_del_catalogo(
    client_lotes, headers_operador, producto
):
    respuesta = client_lotes.post(
        "/lotes",
        json={
            "producto_id": producto.id,
            "cantidad_producida": 10,
        },
        headers=headers_operador,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["producto_id"] == producto.id
    assert respuesta.json()["producto_nombre"] == "Pan"


def test_post_rechaza_producto_inexistente(client_lotes, headers_operador):
    respuesta = client_lotes.post(
        "/lotes",
        json={"producto_id": 999, "cantidad_producida": 10},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Producto no encontrado."


def test_post_rechaza_codigo_duplicado(client_lotes, headers_operador):
    datos = {
        "codigo_lote": "L-001",
        "producto_nombre": "Pan",
        "cantidad_planificada": 100,
    }

    assert client_lotes.post("/lotes", json=datos, headers=headers_operador).status_code == 201
    respuesta = client_lotes.post("/lotes", json=datos, headers=headers_operador)

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == "El código de lote ya existe."


def test_post_rechaza_datos_invalidos(client_lotes, headers_operador):
    respuesta = client_lotes.post(
        "/lotes",
        json={
            "codigo_lote": "   ",
            "producto_nombre": "Pan",
            "cantidad_planificada": 0,
        },
        headers=headers_operador,
    )

    assert respuesta.status_code == 422


def test_post_exige_sesion(client_lotes):
    respuesta = client_lotes.post(
        "/lotes",
        json={
            "codigo_lote": "L-001",
            "producto_nombre": "Pan",
            "cantidad_planificada": 100,
        },
    )

    assert respuesta.status_code == 401


def test_get_devuelve_el_historial_ordenado_por_fecha_descendente(
    client_lotes, headers_admin, db_session
):
    db_session.add_all(
        [
            LoteProduccion(
                **_datos(codigo_lote="L-001", fecha_inicio=datetime(2026, 1, 1))
            ),
            LoteProduccion(
                **_datos(codigo_lote="L-003", fecha_inicio=datetime(2026, 3, 1))
            ),
            LoteProduccion(
                **_datos(codigo_lote="L-002", fecha_inicio=datetime(2026, 2, 1))
            ),
        ]
    )
    db_session.commit()

    respuesta = client_lotes.get("/lotes", headers=headers_admin)

    assert respuesta.status_code == 200
    assert [lote["codigo_lote"] for lote in respuesta.json()] == [
        "L-003",
        "L-002",
        "L-001",
    ]


def test_get_filtra_por_producto_y_rango_de_fechas(
    client_lotes, headers_admin, db_session
):
    db_session.add_all(
        [
            LoteProduccion(
                **_datos(
                    codigo_lote="L-001",
                    producto_nombre="Pan",
                    fecha_inicio=datetime(2026, 1, 10),
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-002",
                    producto_nombre="Pan",
                    fecha_inicio=datetime(2026, 2, 10),
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-003",
                    producto_nombre="Mermelada",
                    fecha_inicio=datetime(2026, 2, 15),
                )
            ),
        ]
    )
    db_session.commit()

    respuesta = client_lotes.get(
        "/lotes",
        params={
            "producto": "pan",
            "fecha_desde": "2026-02-01",
            "fecha_hasta": "2026-02-28",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    assert [lote["codigo_lote"] for lote in respuesta.json()] == ["L-002"]


def test_get_rechaza_rango_de_fechas_invertido(client_lotes, headers_admin):
    respuesta = client_lotes.get(
        "/lotes",
        params={"fecha_desde": "2026-03-01", "fecha_hasta": "2026-02-01"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400


def test_get_sin_lotes_devuelve_lista_vacia(client_lotes, headers_admin):
    respuesta = client_lotes.get("/lotes", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_get_exige_sesion(client_lotes):
    respuesta = client_lotes.get("/lotes")

    assert respuesta.status_code == 401


def test_get_exige_permiso_de_administrar(client_lotes, headers_operador):
    respuesta = client_lotes.get("/lotes", headers=headers_operador)

    assert respuesta.status_code == 403


def test_dashboard_sin_lotes_devuelve_totales_en_cero(
    client_lotes, headers_admin
):
    respuesta = client_lotes.get("/lotes/dashboard", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "total_lotes": 0,
        "total_cantidad_planificada": 0,
        "total_cantidad_producida": 0,
        "porcentaje_cumplimiento": 0.0,
        "por_estado": [
            {"estado": "Pendiente", "cantidad": 0},
            {"estado": "En proceso", "cantidad": 0},
            {"estado": "Finalizado", "cantidad": 0},
            {"estado": "Cancelado", "cantidad": 0},
        ],
        "por_producto": [],
    }


def test_dashboard_agrega_totales_y_cuenta_por_estado(
    client_lotes, headers_admin, db_session
):
    db_session.add_all(
        [
            LoteProduccion(
                **_datos(
                    codigo_lote="L-001",
                    cantidad_planificada=100,
                    cantidad_producida=40,
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-002",
                    cantidad_planificada=50,
                    cantidad_producida=50,
                    estado="Finalizado",
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-003",
                    cantidad_planificada=30,
                    cantidad_producida=0,
                    estado="En proceso",
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-004",
                    cantidad_planificada=20,
                    cantidad_producida=0,
                    estado="Cancelado",
                )
            ),
        ]
    )
    db_session.commit()

    respuesta = client_lotes.get("/lotes/dashboard", headers=headers_admin)

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["total_lotes"] == 4
    assert datos["total_cantidad_planificada"] == 200
    assert datos["total_cantidad_producida"] == 90
    assert datos["porcentaje_cumplimiento"] == 45.0
    assert datos["por_estado"] == [
        {"estado": "Pendiente", "cantidad": 1},
        {"estado": "En proceso", "cantidad": 1},
        {"estado": "Finalizado", "cantidad": 1},
        {"estado": "Cancelado", "cantidad": 1},
    ]
    assert datos["por_producto"] == [
        {"producto": "Pan", "cantidad_producida": 90, "cantidad_lotes": 4}
    ]


def test_dashboard_agrupa_por_producto_y_respeta_el_rango(
    client_lotes, headers_admin, db_session
):
    db_session.add_all(
        [
            LoteProduccion(
                **_datos(
                    codigo_lote="L-001",
                    producto_nombre="Pan",
                    cantidad_producida=10,
                    fecha_inicio=datetime(2026, 1, 10),
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-002",
                    producto_nombre="Pan",
                    cantidad_producida=15,
                    fecha_inicio=datetime(2026, 2, 10),
                )
            ),
            LoteProduccion(
                **_datos(
                    codigo_lote="L-003",
                    producto_nombre="Mermelada",
                    cantidad_producida=7,
                    fecha_inicio=datetime(2026, 2, 15),
                )
            ),
        ]
    )
    db_session.commit()

    respuesta = client_lotes.get(
        "/lotes/dashboard",
        params={"fecha_desde": "2026-02-01", "fecha_hasta": "2026-02-28"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["total_lotes"] == 2
    assert datos["total_cantidad_producida"] == 22
    assert datos["por_producto"] == [
        {"producto": "Pan", "cantidad_producida": 15, "cantidad_lotes": 1},
        {"producto": "Mermelada", "cantidad_producida": 7, "cantidad_lotes": 1},
    ]


def test_dashboard_exige_sesion(client_lotes):
    respuesta = client_lotes.get("/lotes/dashboard")

    assert respuesta.status_code == 401


def test_dashboard_exige_permiso_de_administrar(client_lotes, headers_operador):
    respuesta = client_lotes.get("/lotes/dashboard", headers=headers_operador)

    assert respuesta.status_code == 403


def test_productos_disponibles_para_operador(
    client_lotes, headers_operador, producto
):
    respuesta = client_lotes.get("/lotes/productos", headers=headers_operador)

    assert respuesta.status_code == 200
    assert respuesta.json() == [{"id": producto.id, "nombre": "Pan"}]


def test_insumos_disponibles_para_operador(
    client_lotes, headers_operador, insumo
):
    respuesta = client_lotes.get(
        "/lotes/insumos-disponibles", headers=headers_operador
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == [
        {
            "id": insumo.id,
            "nombre": "Harina",
            "unidad_medida": {"id": insumo.unidad_medida.id, "nombre": "Kilogramo", "simbolo": "kg"},
        }
    ]


def test_listado_de_e1_separa_productos_de_insumos(
    db_session, producto, insumo
):
    from src.insumos import services

    assert services.listar_insumos(db_session) == [insumo]
    assert services.listar_insumos(db_session, tipo=TIPO_PRODUCTO) == [producto]
    assert services.listar_insumos(db_session, tipo=None) == [producto, insumo]


def test_listado_e1_muestra_insumos_y_productos_con_su_tipo(
    client_insumos, headers_admin, producto, insumo
):
    respuesta = client_insumos.get(
        "/insumos?page=1&page_size=10", headers=headers_admin
    )

    assert respuesta.status_code == 200
    items = respuesta.json()["items"]
    assert {item["nombre"]: item["tipo"] for item in items} == {
        "Harina": TIPO_INSUMO,
        "Pan": TIPO_PRODUCTO,
    }


def test_listado_e1_filtra_por_tipo(
    client_insumos, headers_admin, producto, insumo
):
    respuesta = client_insumos.get(
        "/insumos?tipo=producto", headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert [item["nombre"] for item in respuesta.json()] == ["Pan"]
    assert respuesta.json()[0]["tipo"] == TIPO_PRODUCTO


def test_productos_disponibles_no_incluye_insumos(
    client_lotes, headers_operador, producto, insumo
):
    respuesta = client_lotes.get("/lotes/productos", headers=headers_operador)

    assert respuesta.status_code == 200
    assert respuesta.json() == [{"id": producto.id, "nombre": "Pan"}]


def test_insumos_disponibles_no_incluye_productos(
    client_lotes, headers_operador, producto, insumo
):
    respuesta = client_lotes.get(
        "/lotes/insumos-disponibles", headers=headers_operador
    )

    assert respuesta.status_code == 200
    assert [item["id"] for item in respuesta.json()] == [insumo.id]
    assert insumo.tipo == TIPO_INSUMO


def test_post_rechaza_producto_con_nombre_de_insumo(
    client_lotes, headers_operador, insumo
):
    respuesta = client_lotes.post(
        "/lotes",
        json={"producto_nombre": "Harina", "cantidad_producida": 10},
        headers=headers_operador,
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == (
        "Ya existe un insumo con ese nombre. "
        "Elige otro nombre para el producto."
    )


def test_post_rechaza_insumo_como_producto(
    client_lotes, headers_operador, insumo
):
    respuesta = client_lotes.post(
        "/lotes",
        json={"producto_id": insumo.id, "cantidad_producida": 10},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Producto no encontrado."


def test_post_bulk_rechaza_producto_como_insumo(
    client_lotes, headers_operador, lote, producto
):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos/bulk",
        json={"insumos": [{"insumo_id": producto.id, "cantidad": "1"}]},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == f"Insumo no encontrado: {producto.id}."


def test_post_rechaza_producto_como_insumo(
    client_lotes, headers_operador, lote, producto
):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": producto.id, "cantidad": "1"},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Insumo no encontrado."


def test_relaciones_entre_lote_e_insumo(db_session, lote, insumo):
    registro = InsumoLote(lote=lote, insumo=insumo, cantidad=Decimal("1.250"))
    db_session.add(registro)
    db_session.commit()
    db_session.refresh(registro)

    assert registro.lote.codigo_lote == "L-001"
    assert registro.insumo.nombre == "Harina"
    assert registro.insumo.unidad_medida.simbolo == "kg"
    assert registro in lote.insumos


def test_post_registra_insumo_en_lote(
    client_lotes, headers_operador, lote, insumo
):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": "2.500"},
        headers=headers_operador,
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["lote_id"] == lote.id
    assert datos["insumo_id"] == insumo.id
    assert datos["cantidad"] == "2.500"
    assert datos["insumo"]["nombre"] == "Harina"
    assert datos["insumo"]["unidad_medida"]["simbolo"] == "kg"
    assert datos["fecha_registro"] is not None


def test_post_bulk_registra_varios_insumos(
    client_lotes, headers_operador, headers_admin, lote, insumo, segundo_insumo
):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos/bulk",
        json={
            "insumos": [
                {"insumo_id": insumo.id, "cantidad": "2.500"},
                {"insumo_id": segundo_insumo.id, "cantidad": "1"},
            ]
        },
        headers=headers_operador,
    )

    assert respuesta.status_code == 201
    assert [item["insumo"]["nombre"] for item in respuesta.json()] == [
        "Harina",
        "Agua",
    ]

    historial = client_lotes.get("/lotes", headers=headers_admin)
    assert historial.status_code == 200
    assert [item["insumo"]["nombre"] for item in historial.json()[0]["insumos"]] == [
        "Harina",
        "Agua",
    ]


def test_post_bulk_rechaza_insumos_ya_registrados(
    client_lotes, headers_operador, lote, insumo
):
    datos = {"insumos": [{"insumo_id": insumo.id, "cantidad": "1"}]}
    assert (
        client_lotes.post(
            f"/lotes/{lote.id}/insumos/bulk", json=datos, headers=headers_operador
        ).status_code
        == 201
    )

    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos/bulk", json=datos, headers=headers_operador
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == (
        "Uno o más insumos ya están registrados en el lote."
    )


def test_get_lista_los_insumos_del_lote(
    client_lotes, headers_operador, lote, insumo
):
    client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": "2.500"},
        headers=headers_operador,
    )

    respuesta = client_lotes.get(
        f"/lotes/{lote.id}/insumos", headers=headers_operador
    )

    assert respuesta.status_code == 200
    assert [item["insumo"]["nombre"] for item in respuesta.json()] == ["Harina"]


def test_get_lote_por_id_incluye_sus_insumos(
    client_lotes, headers_operador, lote, insumo
):
    client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": "2.500"},
        headers=headers_operador,
    )

    respuesta = client_lotes.get(f"/lotes/{lote.id}", headers=headers_operador)

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["id"] == lote.id
    assert datos["producto_nombre"] == "Pan"
    assert [item["insumo"]["nombre"] for item in datos["insumos"]] == ["Harina"]


def test_get_lote_inexistente_da_404(client_lotes, headers_operador):
    respuesta = client_lotes.get("/lotes/999", headers=headers_operador)

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Lote no encontrado."


@pytest.mark.parametrize("estado", ESTADOS_LOTE_CERRADOS)
def test_post_rechaza_asociar_insumos_en_lote_cerrado(
    client_lotes, headers_operador, db_session, lote, insumo, estado
):
    lote.estado = estado
    db_session.commit()

    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": "1"},
        headers=headers_operador,
    )
    respuesta_bulk = client_lotes.post(
        f"/lotes/{lote.id}/insumos/bulk",
        json={"insumos": [{"insumo_id": insumo.id, "cantidad": "1"}]},
        headers=headers_operador,
    )

    detalle = "No se pueden asociar insumos a un lote finalizado o cancelado."
    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == detalle
    assert respuesta_bulk.status_code == 400
    assert respuesta_bulk.json()["detail"] == detalle


def test_post_permite_asociar_insumos_en_lote_pendiente(
    client_lotes, headers_operador, lote, insumo
):
    assert lote.estado == ESTADO_PENDIENTE

    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": "1"},
        headers=headers_operador,
    )

    assert respuesta.status_code == 201


def test_post_rechaza_insumo_duplicado(
    client_lotes, headers_operador, lote, insumo
):
    datos = {"insumo_id": insumo.id, "cantidad": "2.500"}

    assert (
        client_lotes.post(
            f"/lotes/{lote.id}/insumos", json=datos, headers=headers_operador
        ).status_code
        == 201
    )
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos", json=datos, headers=headers_operador
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == "El insumo ya está registrado en el lote."


def test_get_insumos_de_lote_inexistente_da_404(client_lotes, headers_operador):
    respuesta = client_lotes.get("/lotes/999/insumos", headers=headers_operador)

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Lote no encontrado."


def test_post_insumo_de_lote_inexistente_da_404(
    client_lotes, headers_operador, insumo
):
    respuesta = client_lotes.post(
        "/lotes/999/insumos",
        json={"insumo_id": insumo.id, "cantidad": "1"},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Lote no encontrado."


def test_post_insumo_inexistente_da_404(client_lotes, headers_operador, lote):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": 999, "cantidad": "1"},
        headers=headers_operador,
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Insumo no encontrado."


@pytest.mark.parametrize("cantidad", ["0", "-1"])
def test_post_cantidad_invalida_da_422(
    client_lotes, headers_operador, lote, insumo, cantidad
):
    respuesta = client_lotes.post(
        f"/lotes/{lote.id}/insumos",
        json={"insumo_id": insumo.id, "cantidad": cantidad},
        headers=headers_operador,
    )

    assert respuesta.status_code == 422


def test_insumos_del_lote_exigen_sesion(client_lotes, lote):
    assert client_lotes.get(f"/lotes/{lote.id}/insumos").status_code == 401
    assert (
        client_lotes.post(
            f"/lotes/{lote.id}/insumos",
            json={"insumo_id": 1, "cantidad": "1"},
        ).status_code
        == 401
    )


def test_la_app_principal_incluye_el_router_de_lotes():
    from src.main import app

    rutas = app.openapi()["paths"]
    assert "/lotes" in rutas
    assert "/lotes/{lote_id}" in rutas
    assert "/lotes/dashboard" in rutas
    assert "/lotes/productos" in rutas
    assert "/lotes/insumos-disponibles" in rutas
    assert "/lotes/{lote_id}/insumos" in rutas
    assert "/lotes/{lote_id}/insumos/bulk" in rutas
