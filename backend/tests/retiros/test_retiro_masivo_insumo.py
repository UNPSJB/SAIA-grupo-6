"""Tests para el endpoint transaccional de retiro masivo por lote de insumo.

Prueba:
1. Retiro masivo exitoso de múltiples lotes con desactivación de insumo.
2. Comportamiento transaccional (rollback): si falla un lote (inexistente o ya retirado),
   no se crean retiros y el insumo permanece en su estado original.
"""

import os

os.environ["DB_URL"] = "sqlite://"
os.environ["DB_URL_TEST"] = "sqlite://"
os.environ["SECRET_KEY"] = "clave-solo-para-tests-" + "x" * 32

import pytest  # noqa: E402
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import src.all_models  # noqa: E402,F401
from src.auth.services import crear_access_token  # noqa: E402
from src.database import get_db  # noqa: E402
from src.main import app  # noqa: E402
from src.models import ModeloBase  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.ingredientes.models import Ingrediente  # noqa: E402
from src.insumos.models import Insumo  # noqa: E402
from src.proveedores.models import Proveedor  # noqa: E402
from src.lotesInsumo.models import LoteInsumo  # noqa: E402
from src.productos.models import Producto  # noqa: E402
from src.recetas.models import Receta, VersionReceta  # noqa: E402
from src.lotes.constants import ESTADO_TERMINADO  # noqa: E402
from src.lotes.models import LoteProducto  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.retiros.models import Retiro  # noqa: E402
from src.notificaciones.invalidacion import registrar_invalidacion_automatica  # noqa: E402

registrar_invalidacion_automatica()

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


client = TestClient(app)


@pytest.fixture(autouse=True)
def _usar_esta_base():
    # El override se aplica en cada test y no al importar el módulo: otros
    # módulos de tests registran su propia base en la misma `app` y, si se
    # importan después, la pisaban (401 "Usuario no encontrado").
    anterior = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    yield
    if anterior is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = anterior


def _headers(personal_id: int) -> dict:
    token, _, _ = crear_access_token(str(personal_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_datos():
    with _Fabrica() as db:
        # Unidad de medida
        um = db.query(UnidadMedida).filter_by(nombre="Kilogramo").first()
        if not um:
            um = UnidadMedida(simbolo="kg", nombre="Kilogramo")
            db.add(um)
            db.flush()

        # Insumo y Proveedor
        prov = db.query(Proveedor).filter_by(matricula="MP-001").first()
        if not prov:
            prov = Proveedor(nombre="Molinos SRL", matricula="MP-001", cuit="30-11111111-9", activo=True)
            db.add(prov)
            db.flush()

        # Ingrediente (la especificación) e insumo (la marca que se compra).
        ingrediente = db.query(Ingrediente).filter_by(nombre="Harina de Trigo").first()
        if not ingrediente:
            ingrediente = Ingrediente(nombre="Harina de Trigo", unidad_medida_id=um.id, activo=True)
            db.add(ingrediente)
            db.flush()
        insumo = db.query(Insumo).filter_by(ingrediente_id=ingrediente.id).first()
        if not insumo:
            insumo = Insumo(ingrediente_id=ingrediente.id, marca="Molinos", activo=True,
                            estado_homologacion="aprobada", proveedores=[prov])
            db.add(insumo)
            db.flush()

        lote_insumo = LoteInsumo(
            insumo_id=insumo.id,
            ingrediente_id=ingrediente.id,
            proveedor_id=prov.id,
            numero_lote=f"LOT-INS-001-{os.urandom(4).hex()}",
            cantidad_recibida=Decimal("100"),
            fecha_vencimiento=date(2027, 1, 1),
            activo=True,
        )
        db.add(lote_insumo)
        db.flush()

        # Producto y Versión Receta
        prod = db.query(Producto).filter_by(nombre="Pan Lactal").first()
        if not prod:
            prod = Producto(nombre="Pan Lactal", unidad_medida_id=um.id, activo=True)
            db.add(prod)
            db.flush()

        receta = db.query(Receta).filter_by(producto_id=prod.id).first()
        if not receta:
            receta = Receta(producto_id=prod.id, activo=True)
            db.add(receta)
            db.flush()

        version = db.query(VersionReceta).filter_by(receta_id=receta.id, numero=1).first()
        if not version:
            version = VersionReceta(
                receta_id=receta.id,
                numero=1,
                rendimiento=Decimal("10"),
                unidad_medida_id=um.id,
            )
            db.add(version)
            db.flush()

        # Personal admin y operador
        admin = db.query(Personal).filter_by(dni="99990001").first()
        if not admin:
            admin = Personal(
                nombre="Admin",
                apellido="Seguridad",
                dni="99990001",
                email="admin.seg@test.local",
                password="pass",
                puede_administrar=True,
                puede_operar=True,
            )
            db.add(admin)
            db.flush()

        # Lotes de producto
        lp1 = LoteProducto(
            producto_id=prod.id,
            version_receta_id=version.id,
            numero_lote=f"PROD-LOT-101-{os.urandom(4).hex()}",
            cantidad_objetivo=Decimal("50"),
            factor_escala=Decimal("1"),
            cantidad_producida=Decimal("50"),
            estado=ESTADO_TERMINADO,
            retirado=False,
            creado_por_id=admin.id,
        )
        lp2 = LoteProducto(
            producto_id=prod.id,
            version_receta_id=version.id,
            numero_lote=f"PROD-LOT-102-{os.urandom(4).hex()}",
            cantidad_objetivo=Decimal("50"),
            factor_escala=Decimal("1"),
            cantidad_producida=Decimal("50"),
            estado=ESTADO_TERMINADO,
            retirado=False,
            creado_por_id=admin.id,
        )
        db.add_all([lp1, lp2])
        db.commit()

        return {
            "lote_insumo_id": lote_insumo.id,
            "prov_id": prov.id,
            "lp1_id": lp1.id,
            "lp2_id": lp2.id,
            "admin_id": admin.id,
        }


def test_retiro_masivo_insumo_exitoso(setup_datos):
    datos = setup_datos
    payload = {
        "lote_insumo_id": datos["lote_insumo_id"],
        "lotes_producto_ids": [datos["lp1_id"], datos["lp2_id"]],
        "motivo": "Insumo defectuoso",
        "detalle": "Pruebas de laboratorio confirmaron presencia de aflatoxinas en el insumo",
        "desactivar_insumo": True,
    }

    res = client.post(
        "/retiros/masivo-insumo",
        json=payload,
        headers=_headers(datos["admin_id"]),
    )

    print(f"\nDETALLE DEL ERROR 400: {res.json()}\n")
    assert res.status_code == 201
    data = res.json()
    assert data["lote_insumo_id"] == datos["lote_insumo_id"]
    assert data["insumo_desactivado"] is True
    assert len(data["retiros_creados"]) == 2

    # Verificar en BD que los lotes quedaron en estado retirado=True y el insumo activo=False
    with _Fabrica() as db:
        li = db.get(LoteInsumo, datos["lote_insumo_id"])
        assert li.activo is False

        lp1 = db.get(LoteProducto, datos["lp1_id"])
        assert lp1.retirado is True

        lp2 = db.get(LoteProducto, datos["lp2_id"])
        assert lp2.retirado is True

        # Verificar registros de retiros creados
        retiros = db.query(Retiro).filter(Retiro.lote_id.in_([datos["lp1_id"], datos["lp2_id"]])).all()
        assert len(retiros) == 2
        for r in retiros:
            assert r.origen == "INSUMO"
            assert r.motivo == "Insumo defectuoso"


def test_retiro_masivo_insumo_rollback_por_lote_ya_retirado(setup_datos):
    """Si uno de los lotes ya está retirado o falla, se debe revertir toda la transacción."""
    datos = setup_datos

    # Crear un nuevo lote insumo activo y marcar lp_retirado como retirado
    with _Fabrica() as db:
        insumo = db.query(Insumo).first()
        li = LoteInsumo(
            insumo_id=insumo.id,
            ingrediente_id=insumo.ingrediente_id,
            proveedor_id=datos["prov_id"],
            numero_lote=f"LOT-INS-ROLLBACK-{os.urandom(4).hex()}",
            cantidad_recibida=Decimal("50"),
            fecha_vencimiento=date(2027, 1, 1),
            activo=True,
        )
        prod = db.query(Producto).first()
        version = db.query(VersionReceta).first()
        lp_ok = LoteProducto(
            producto_id=prod.id,
            version_receta_id=version.id,
            numero_lote=f"PROD-ROLLBACK-OK-{os.urandom(4).hex()}",
            cantidad_objetivo=Decimal("10"),
            factor_escala=Decimal("1"),
            cantidad_producida=Decimal("10"),
            estado=ESTADO_TERMINADO,
            retirado=False,
            creado_por_id=datos["admin_id"],
        )
        lp_retirado = LoteProducto(
            producto_id=prod.id,
            version_receta_id=version.id,
            numero_lote=f"PROD-YA-RETIRADO-{os.urandom(4).hex()}",
            cantidad_objetivo=Decimal("10"),
            factor_escala=Decimal("1"),
            cantidad_producida=Decimal("10"),
            estado=ESTADO_TERMINADO,
            retirado=True,
            creado_por_id=datos["admin_id"],
        )
        db.add_all([li, lp_ok, lp_retirado])
        db.commit()
        li_id = li.id
        lp_ok_id = lp_ok.id
        lp_retirado_id = lp_retirado.id

    payload = {
        "lote_insumo_id": li_id,
        "lotes_producto_ids": [lp_ok_id, lp_retirado_id],  # lp_retirado ya está retirado
        "motivo": "Insumo defectuoso",
        "desactivar_insumo": True,
    }

    res = client.post(
        "/retiros/masivo-insumo",
        json=payload,
        headers=_headers(datos["admin_id"]),
    )

    assert res.status_code == 400
    assert "retirado del mercado" in res.json()["detail"]

    # Verificar que li sigue activo y lp_ok NO fue retirado (rollback efectivo)
    with _Fabrica() as db:
        li_bd = db.get(LoteInsumo, li_id)
        assert li_bd.activo is True

        lp_ok_bd = db.get(LoteProducto, lp_ok_id)
        assert lp_ok_bd.retirado is False

        retiro_ok = db.query(Retiro).filter(Retiro.lote_id == lp_ok_id).first()
        assert retiro_ok is None
