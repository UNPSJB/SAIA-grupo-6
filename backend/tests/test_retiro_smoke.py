"""Smoke test para el flujo completo de retiro de lote.

Crea un lote TERMINADO con 3 salidas (RESERVADO, DESPACHADO, ENTREGADO)
y ejecuta:
1. GET /lotes/{id}/impacto-retiro  -> 200
2. POST /retiros                    -> 201
3. POST /retiros/{id}/afectados/{id}/notificar  -> 200 (x2)
4. POST /retiros/{id}/cerrar        -> 200
"""

import os

os.environ["DB_URL"] = "sqlite://"
os.environ["DB_URL_TEST"] = "sqlite://"
os.environ["SECRET_KEY"] = "clave-solo-para-tests-" + "x" * 32

import pytest  # noqa: E402
from datetime import date, datetime
from decimal import Decimal
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import src.all_models  # noqa: E402,F401
from src.auth.services import crear_access_token  # noqa: E402
from src.database import engine as app_engine, get_db  # noqa: E402
from src.main import app  # noqa: E402
from src.models import ModeloBase  # noqa: E402
from src.personal.models import Personal  # noqa: E402

# Registrar invalidación de notificaciones (como hace conftest)
from src.notificaciones.invalidacion import registrar_invalidacion_automatica  # noqa: E402
registrar_invalidacion_automatica()

# Crear motor y tablas en memoria
_motor = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(_motor, "connect")
def _fk_on(dbapi_conexion, _):
    dbapi_conexion.execute("PRAGMA foreign_keys = ON")


ModeloBase.metadata.create_all(_motor)
_Fabrica = sessionmaker(autocommit=False, autoflush=False, bind=_motor)


def _get_db():
    db = _Fabrica()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _get_db
client = TestClient(app)


def _headers(personal_id: int) -> dict:
    token, _, _ = crear_access_token(str(personal_id))
    return {"Authorization": f"Bearer {token}"}


def test_flujo_retiro_completo():
    with _Fabrica() as db:
        # 1. Crear unidad de medida
        from src.unidadMedida.models import UnidadMedida
        um = UnidadMedida(simbolo="kg", nombre="Kilogramo")
        db.add(um)
        db.flush()

        # 2. Crear producto
        from src.productos.models import Producto
        prod = Producto(nombre="Leche en polvo", unidad_medida_id=um.id, activo=True)
        db.add(prod)
        db.flush()

        # 3. Crear versión de receta mínima (necesaria para el lote)
        from src.recetas.models import Receta, VersionReceta
        receta = Receta(producto_id=prod.id, activo=True)
        db.add(receta)
        db.flush()
        version = VersionReceta(
            receta_id=receta.id, numero=1, rendimiento=Decimal("1"),
            unidad_medida_id=um.id,
        )
        db.add(version)
        db.flush()

        # 4. Crear personal admin
        admin = Personal(
            nombre="Ada", apellido="Admin", dni="10000001",
            email="admin@test.local", password="x",
            puede_administrar=True, puede_operar=True,
        )
        db.add(admin)
        db.flush()

        # 5. Crear cliente para las salidas
        from src.clientes.models import Cliente
        cliente = Cliente(
            nombre="Cliente Test", email="cliente@test.local",
            telefono="12345678", documento="11111111", domicilio="Calle Falsa 123",
        )
        db.add(cliente)
        db.flush()

        # 6. Crear lote TERMINADO
        from src.lotes.models import LoteProducto
        from src.lotes.constants import ESTADO_TERMINADO
        lote = LoteProducto(
            numero_lote="LP-20260101-001",
            producto_id=prod.id,
            version_receta_id=version.id,
            estado=ESTADO_TERMINADO,
            cantidad_objetivo=Decimal("100"),
            factor_escala=Decimal("1"),
            cantidad_producida=Decimal("100"),
            creado_por_id=admin.id,
        )
        db.add(lote)
        db.flush()

        # 7. Crear 3 salidas: RESERVADO, DESPACHADO, ENTREGADO
        from src.salidas.models import Salida
        from src.salidas.constants import (
            ESTADO_RESERVADO, ESTADO_DESPACHADO, ESTADO_ENTREGADO,
        )
        hoy = date.today()
        salida_reservada = Salida(
            lote_id=lote.id, cliente_id=cliente.id,
            cantidad=Decimal("20"), fecha_reserva=hoy, estado=ESTADO_RESERVADO,
            creado_por_id=admin.id,
        )
        salida_despachada = Salida(
            lote_id=lote.id, cliente_id=cliente.id,
            cantidad=Decimal("30"), fecha_reserva=hoy, estado=ESTADO_DESPACHADO,
            creado_por_id=admin.id,
        )
        salida_entregada = Salida(
            lote_id=lote.id, cliente_id=cliente.id,
            cantidad=Decimal("10"), fecha_reserva=hoy, estado=ESTADO_ENTREGADO,
            creado_por_id=admin.id,
        )
        db.add_all([salida_reservada, salida_despachada, salida_entregada])
        db.commit()

        lote_id = lote.id
        admin_id = admin.id
        salida_ids = {
            salida_reservada.id: ESTADO_RESERVADO,
            salida_despachada.id: ESTADO_DESPACHADO,
            salida_entregada.id: ESTADO_ENTREGADO,
        }

    # --- Ahora probamos los endpoints via HTTP ---

    # 1) GET /lotes/{id}/impacto-retiro -> 200
    resp = client.get(f"/lotes/{lote_id}/impacto-retiro", headers=_headers(admin_id))
    assert resp.status_code == 200, f"Impacto falló: {resp.status_code} {resp.text}"
    data = resp.json()
    assert data["reservas_a_cancelar"] == 1, f"Esperaba 1 reserva, obtuvo {data['reservas_a_cancelar']}"
    assert data["total_afectadas"] == 2, f"Esperaba 2 afectadas, obtuvo {data['total_afectadas']}"
    print(f"  GET /lotes/{lote_id}/impacto-retiro -> 200 OK")
    print(f"    reservas_a_cancelar={data['reservas_a_cancelar']}, total_afectadas={data['total_afectadas']}")

    # 2) POST /retiros -> 201
    resp = client.post(
        "/retiros",
        json={
            "lote_id": lote_id,
            "motivo": "Contaminación o cuerpo extraño",
            "detalle": "Prueba de retiro",
            "fecha_retiro": hoy.isoformat(),
        },
        headers=_headers(admin_id),
    )
    assert resp.status_code == 201, f"Crear retiro falló: {resp.status_code} {resp.text}"
    retiro = resp.json()
    retiro_id = retiro["id"]
    print(f"  POST /retiros -> 201 OK (retiro_id={retiro_id})")

    # Verificar que el lote está marcado como retirado
    resp = client.get(f"/lotes/{lote_id}", headers=_headers(admin_id))
    assert resp.status_code == 200
    lote_data = resp.json()
    assert lote_data["retirado"] is True, "El lote debería estar retirado"
    print(f"    Lote retirado=True verificado")

    # 3) POST /retiros/{id}/afectados/{afectado_id}/notificar -> 200 (x2)
    # Obtener los IDs de afectados del detalle del retiro
    resp = client.get(f"/retiros/{retiro_id}", headers=_headers(admin_id))
    assert resp.status_code == 200
    retiro_detalle = resp.json()
    afectados = retiro_detalle["afectados"]
    print(f"    Afectados encontrados: {len(afectados)}")
    assert len(afectados) == 2, f"Esperaba 2 afectados, obtuvo {len(afectados)}"

    for afectado in afectados:
        afectado_id = afectado["id"]
        resp = client.post(
            f"/retiros/{retiro_id}/afectados/{afectado_id}/notificar",
            json={
                "fecha_notificacion": hoy.isoformat(),
                "medio_contacto": "Teléfono",
                "observacion": "Notificación de prueba",
            },
            headers=_headers(admin_id),
        )
        assert resp.status_code == 200, f"Notificar afectado {afectado_id} falló: {resp.status_code} {resp.text}"
        print(f"  POST /retiros/{retiro_id}/afectados/{afectado_id}/notificar -> 200 OK")

    # 4) POST /retiros/{id}/cerrar -> 200
    resp = client.post(
        f"/retiros/{retiro_id}/cerrar",
        json={"accion_correctiva": "Acción correctiva de prueba"},
        headers=_headers(admin_id),
    )
    assert resp.status_code == 200, f"Cerrar retiro falló: {resp.status_code} {resp.text}"
    print(f"  POST /retiros/{retiro_id}/cerrar -> 200 OK")

    print("\n>>> TODOS LOS ENDPOINTS DEL FLUJO DE RETIRO PASARON CORRECTAMENTE <<<")
