from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.aditivos.models import ClaseFuncional
from src.auth.services import crear_access_token
from src.database import get_db
from src.ingredientes.models import Ingrediente
from src.insumos.router import router as insumos_router
from src.alergenos.router import router as alergenos_router
from src.insumos.models import Insumo
from src.lotes.router import router as lotes_router
from src.lotesInsumo.router import router as lotes_insumo_router
from src.lotesInsumo.router import stock_router
from src.lotesInsumo import schemas as lotes_insumo_schemas
from src.lotesInsumo import services as lotes_insumo_services
from src.personal.models import Personal
from src.productos.models import Producto
from src.productos.router import router as productos_router
from src.proveedores.models import Proveedor
from src.proveedores.router import router as proveedores_router
from src.recetas import schemas as recetas_schemas
from src.recetas import services as recetas_services
from src.recetas.router import router as recetas_router
from src.trazabilidad.router import router as trazabilidad_router
from src.unidadMedida.models import UnidadMedida


def receta_datos(escenario, *, harina_total="10", sal_total="2", tareas=None, rendimiento="20"):
    """Receta de 2 tareas: amasar (harina) y condimentar (sal, aditivo).

    La clasificación ya no se manda: sale del tipo del ingrediente en el maestro.
    """
    return recetas_schemas.VersionRecetaIn(
        rendimiento=Decimal(rendimiento),
        unidad_medida_id=escenario.kg.id,
        ingredientes=[
            {
                "ingrediente_id": escenario.harina.id,
                "cantidad": harina_total,
                "unidad_medida_id": escenario.kg.id,
            },
            {
                "ingrediente_id": escenario.sal.id,
                "cantidad": sal_total,
                "unidad_medida_id": escenario.kg.id,
            },
        ],
        tareas=tareas
        or [
            {"descripcion": "Amasar", "ingredientes": [{"ingrediente_id": escenario.harina.id, "cantidad": harina_total}]},
            {"descripcion": "Condimentar", "ingredientes": [{"ingrediente_id": escenario.sal.id, "cantidad": sal_total}]},
        ],
    )


def _usuario(db, **datos):
    persona = Personal(password="x", **datos)
    db.add(persona)
    db.commit()
    token, _, _ = crear_access_token(str(persona.id))
    return persona, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def escenario(db_session):
    """Catálogo mínimo + receta v1 + dos lotes de insumo de proveedores distintos."""
    db = db_session
    kg = UnidadMedida(nombre="Kilogramo", simbolo="kg")
    harina = Ingrediente(nombre="Harina 000", unidad_medida=kg)
    # `sal` es el aditivo del escenario (el nombre del atributo se conserva
    # para no reescribir todos los tests de lotes y stock).
    regulador = ClaseFuncional(nombre="Regulador de acidez")
    sal = Ingrediente(
        nombre="Sal fina", es_aditivo=True, clase_funcional=regulador, numero_ins="331", unidad_medida=kg
    )
    pan = Producto(nombre="Pan casero", unidad_medida=kg)
    molino = Proveedor(nombre="Molino Sur", matricula="PROV-001")
    salinas = Proveedor(nombre="Salinas del Norte", matricula="PROV-002")
    # Un insumo (marca) por ingrediente. La harina se compra a los dos. Nacen
    # aprobados: la homologación se prueba aparte (test_homologacion.py).
    insumo_harina = Insumo(
        ingrediente=harina, marca="Molinera", proveedores=[molino, salinas], estado_homologacion="aprobada"
    )
    insumo_sal = Insumo(ingrediente=sal, marca="Salera", proveedores=[salinas], estado_homologacion="aprobada")
    db.add_all([kg, regulador, harina, sal, pan, molino, salinas, insumo_harina, insumo_sal])
    db.commit()

    admin, h_admin = _usuario(
        db, nombre="Ada", apellido="Admin", dni="10000001", email="ada@test.local",
        puede_administrar=True, puede_operar=True,
    )
    operador, h_operador = _usuario(
        db, nombre="Omar", apellido="Operador", dni="10000002", email="omar@test.local",
        puede_administrar=False, puede_operar=True,
    )
    sin_permisos, h_sin_permisos = _usuario(
        db, nombre="Nadie", apellido="Sinrol", dni="10000003", email="nadie@test.local",
    )

    e = SimpleNamespace(
        db=db, kg=kg, harina=harina, sal=sal, regulador=regulador,
        pan=pan, molino=molino, salinas=salinas,
        insumo_harina=insumo_harina, insumo_sal=insumo_sal,
        admin=admin, operador=operador,
        h_admin=h_admin, h_operador=h_operador, h_sin_permisos=h_sin_permisos,
    )

    receta = recetas_services.crear_receta(
        db, recetas_schemas.RecetaCreate(producto_id=pan.id, version=receta_datos(e)), admin
    )
    e.receta = receta
    e.version1 = recetas_services.version_vigente(db, receta.id)

    def lote_insumo(ingrediente, proveedor, numero, cantidad, vence=None):
        """Recibe un lote del insumo del escenario para ese ingrediente.

        Si el proveedor no vende ese insumo, se lo asocia antes: estos tests
        prueban stock y lotes, no la asociación (ver tests/insumos).
        """
        insumo = insumo_harina if ingrediente is harina else insumo_sal
        if proveedor not in insumo.proveedores:
            insumo.proveedores.append(proveedor)
            db.commit()
        return lotes_insumo_services.crear_lote_insumo(
            db,
            lotes_insumo_schemas.LoteInsumoCreate(
                insumo_id=insumo.id,
                proveedor_id=proveedor.id,
                numero_lote=numero,
                cantidad_recibida=Decimal(cantidad),
                fecha_vencimiento=vence,
            ),
            admin,
        )

    e.nuevo_lote_insumo = lote_insumo
    e.lote_harina = lote_insumo(harina, molino, "H-100", "50", date.today() + timedelta(days=90))
    e.lote_sal = lote_insumo(sal, salinas, "S-200", "5", date.today() + timedelta(days=365))
    return e


@pytest.fixture
def client(db_session):
    app = FastAPI()
    for router in (
        productos_router,
        recetas_router,
        lotes_insumo_router,
        stock_router,
        lotes_router,
        trazabilidad_router,
        insumos_router,
        proveedores_router,
        alergenos_router,
    ):
        app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
