from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from src.auth.dependencies import require_admin
from src.auth.services import crear_access_token
from src.database import get_db
from src.insumos import schemas as insumos_schemas, services as insumos_services
from src.insumos.models import Insumo
from src.personal.models import Personal
from src.productos import schemas as productos_schemas, services as productos_services
from src.recetas.models import VersionReceta, RecetaInsumo
from src.rotulado import declaraciones_services as servicio, schemas, services
from src.rotulado.declaraciones_schemas import EditarDeclaraciones, RegenerarDeclaraciones, RevisionEsperada
from src.rotulado.models import RevisionDeclaracionRotulado
from src.rotulado.router import router
from tests.rotulado.test_rotulado import datos  # noqa: F401


PERFIL = {"evaluacion": "evaluada", "gluten": "ausencia_declarada", "marcas": []}
CONSERVACION = {"instrucciones": "Conservar refrigerado", "temperatura_aplicable": True,
                "temperatura_minima": 2, "temperatura_maxima": 8,
                "duracion_aplicable": True, "duracion": 5, "unidad_duracion": "dias"}


@pytest.fixture
def escenario(datos):
    db, producto, receta, version = datos
    admin = Personal(nombre="Admin", dni="11000111", email="admin@hu106.test", password="hash",
                     puede_administrar=True, activo=True)
    operador = Personal(nombre="Operador", dni="11000112", email="operador@hu106.test", password="hash",
                        puede_operar=True, activo=True)
    version.insumos[0].insumo.perfil_declaracion = deepcopy(PERFIL)
    producto.conservacion = deepcopy(CONSERVACION)
    db.add_all([admin, operador])
    db.commit()
    borrador = services.crear_borrador(db, producto.id, schemas.BorradorRotuladoCreate(
        producto_id=producto.id, version_receta_id=version.id), admin)
    return db, producto, receta, version, borrador, admin, operador


def test_presencia_deduplicacion_y_fuentes(escenario):
    db, producto, receta, version, _, _, _ = escenario
    perfil = {**PERFIL, "marcas": [{"codigo": "leche", "forma": "derivado"}]}
    primero = version.insumos[0].insumo
    primero.perfil_declaracion = perfil
    segundo = Insumo(nombre="Segundo", unidad_medida_id=primero.unidad_medida_id, perfil_declaracion=perfil)
    nueva = VersionReceta(receta=receta, numero=2, rendimiento=10, unidad_medida=version.unidad_medida)
    nueva.insumos = [RecetaInsumo(insumo=i, cantidad=1, unidad_medida=version.unidad_medida,
                                 clasificacion="ingrediente") for i in (primero, segundo)]
    db.add(nueva)
    db.commit()
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, nueva.id)
    assert len(propuesta["detectados"]) == 1
    assert len(propuesta["detectados"][0]["fuentes"]) == 2


def test_sin_marcas_no_certifica_gluten(escenario):
    db, producto, _, version, *_ = escenario
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, version.id)
    assert propuesta["detectados"] == []
    assert propuesta["gluten"] == "sin_presencia_declarada"
    assert not propuesta["pendientes_origen"]


def test_incompleta_bloquea_confirmacion(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    version.insumos[0].insumo.perfil_declaracion = None
    db.commit()
    servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    with pytest.raises(HTTPException) as error:
        servicio.confirmar(db, borrador.id, RevisionEsperada(revision=2), admin)
    assert error.value.status_code == 422


def test_cruzada_alta_edicion_baja_y_preservacion(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    cruzada = {"codigo": "mani", "fundamento": "Equipo compartido", "respaldo": "Autorización 123"}
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, contaminacion_cruzada=[cruzada]), admin)
    assert salida["contenido"]["detectados"] == []
    assert salida["declaracion_cruzada"] == "PUEDE CONTENER MANÍ"
    servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=2), admin)
    cruzada["fundamento"] = "Línea compartida evaluada"
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=2, contaminacion_cruzada=[cruzada]), admin)
    assert salida["contenido"]["contaminacion_cruzada"][0]["fundamento"] == cruzada["fundamento"]
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=3, contaminacion_cruzada=[]), admin)
    assert salida["declaracion_cruzada"] == ""


def test_conservacion_manual_no_se_pisa_y_se_puede_reponer(escenario):
    db, producto, _, _, borrador, admin, _ = escenario
    servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, conservacion={"instrucciones": "Manual"}), admin)
    producto.conservacion = {"instrucciones": "Nuevo maestro"}
    db.commit()
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=2), admin)
    assert salida["contenido"]["conservacion"]["instrucciones"] == "Manual"
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=3, usar_conservacion_producto=True), admin)
    assert salida["contenido"]["conservacion"]["instrucciones"] == "Nuevo maestro"


def test_guardar_cruzada_no_convierte_conservacion_intacta_en_manual(escenario):
    db, producto, _, _, borrador, admin, _ = escenario
    actual = servicio.consultar(db, borrador.id)["contenido"]["conservacion"]
    servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, conservacion=actual,
        contaminacion_cruzada=[{"codigo": "mani", "fundamento": "Equipo compartido", "respaldo": "Autorización 123"}]), admin)
    producto.conservacion = {"instrucciones": "Conservación actualizada"}
    db.commit()
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=2), admin)
    assert salida["contenido"]["conservacion_origen"] == "producto"
    assert salida["contenido"]["conservacion"]["instrucciones"] == "Conservación actualizada"


def test_confirmar_y_cambio_de_fuentes_conserva_historia(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    assert servicio.consultar(db, borrador.id)["estado"] == "sugerida"
    salida = servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    assert salida["estado"] == "confirmada" and salida["confirmado_por_id"] == admin.id
    assert salida["confirmado_en"]
    version.insumos[0].insumo.perfil_declaracion = {**PERFIL, "gluten": "presente"}
    db.commit()
    assert servicio.consultar(db, borrador.id)["vigencia"] == "desactualizada"
    with pytest.raises(HTTPException) as error:
        servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    assert error.value.status_code == 409
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    assert salida["estado"] == "sugerida"
    assert db.scalar(select(RevisionDeclaracionRotulado).where(RevisionDeclaracionRotulado.numero == 1)).confirmado_por_id == admin.id


def test_guardar_no_confirma_y_editar_confirmada_crea_revision(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(denominacion_venta="Manual"), admin)
    assert servicio.consultar(db, borrador.id)["estado"] == "sugerida"
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, conservacion={"instrucciones": "Cambio"}), admin)
    assert salida["revision"] == 2 and salida["estado"] == "sugerida"


def test_permiso_servicio_y_revision_obsoleta(escenario):
    db, _, _, _, borrador, admin, operador = escenario
    for usuario in (operador, SimpleNamespace(id=999999), None):
        with pytest.raises(HTTPException) as error:
            servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), usuario)
        assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        servicio.editar(db, borrador.id, EditarDeclaraciones(revision=0), admin)
    assert error.value.status_code == 409


def test_cambio_version_explicito(escenario):
    db, _, receta, version, borrador, admin, _ = escenario
    nueva = VersionReceta(receta=receta, numero=2, rendimiento=1, unidad_medida=version.unidad_medida)
    nueva.insumos = [RecetaInsumo(insumo=version.insumos[0].insumo, cantidad=1,
                                unidad_medida=version.unidad_medida, clasificacion="ingrediente")]
    db.add(nueva)
    db.commit()
    assert servicio.consultar(db, borrador.id)["vigencia"] == "vigente"
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1, version_id=nueva.id), admin)
    assert salida["contenido"]["version_receta_id"] == nueva.id
    assert salida["revision"] == 2


def test_guardar_cambio_version_crea_propuesta_sin_confirmar(escenario):
    db, _, receta, version, borrador, admin, _ = escenario
    nueva = VersionReceta(receta=receta, numero=2, rendimiento=1, unidad_medida=version.unidad_medida)
    nueva.insumos = [RecetaInsumo(insumo=version.insumos[0].insumo, cantidad=1,
                                unidad_medida=version.unidad_medida, clasificacion="ingrediente")]
    db.add(nueva)
    db.commit()
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(version_receta_id=nueva.id), admin)
    salida = servicio.consultar(db, borrador.id)
    assert salida["contenido"]["version_receta_id"] == nueva.id
    assert salida["revision"] == 2 and salida["estado"] == "sugerida"


def test_maestros_persisten_y_se_limpian(escenario):
    db, producto, _, version, *_ = escenario
    insumo = version.insumos[0].insumo
    perfil = insumos_schemas.InsumoUpdate(perfil_declaracion=PERFIL)
    insumos_services.modificar_insumo(db, insumo.id, perfil)
    assert insumos_schemas.Insumo.model_validate(insumo).perfil_declaracion.evaluacion == "evaluada"
    productos_services.actualizar_producto(db, producto.id, productos_schemas.ProductoUpdate(conservacion=None))
    db.expire_all()
    assert producto.conservacion is None
    insumos_services.modificar_insumo(db, insumo.id, insumos_schemas.InsumoUpdate(perfil_declaracion=None))
    assert insumo.perfil_declaracion is None


def test_http_permisos_y_flujo(escenario):
    db, _, _, _, borrador, admin, operador = escenario
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    url = f"/rotulado/borradores/{borrador.id}/declaraciones"
    assert client.post(url + "/confirmar", json={"revision": 1}).status_code == 401
    token, _, _ = crear_access_token(str(operador.id))
    assert client.post(url + "/confirmar", json={"revision": 1}, headers={"Authorization": f"Bearer {token}"}).status_code == 403
    app.dependency_overrides[require_admin] = lambda: admin
    assert client.post(url + "/confirmar", json={"revision": 1}).json()["estado"] == "confirmada"
    assert client.post(url + "/confirmar", json={"revision": 1, "confirmado_por_id": operador.id}).status_code == 422
    assert len(client.get(url + "/historial").json()) == 1


def test_migracion_aditiva_idempotente():
    from src.migrations.declaraciones_rotulado import migrar_declaraciones_rotulado
    motor = create_engine("sqlite://")
    with motor.begin() as conn:
        conn.execute(text("CREATE TABLE insumos (id INTEGER PRIMARY KEY, nombre TEXT)"))
        conn.execute(text("CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT)"))
        conn.execute(text("INSERT INTO insumos VALUES (1, 'Anterior')"))
    migrar_declaraciones_rotulado(motor)
    migrar_declaraciones_rotulado(motor)
    assert "perfil_declaracion" in {c["name"] for c in inspect(motor).get_columns("insumos")}
    with motor.connect() as conn:
        assert conn.execute(text("SELECT nombre, perfil_declaracion FROM insumos")).one() == ("Anterior", None)
        assert conn.scalar(text("SELECT count(*) FROM schema_migrations")) == 1
    motor.dispose()


def test_aditivo_incluido_sin_conversion_de_masa(escenario):
    from src.aditivos.models import Aditivo, ClaseFuncional
    db, producto, receta, version, *_ = escenario
    clase = ClaseFuncional(nombre="Emulsionante HU106")
    referencia = Aditivo(nombre="Lecitina HU106", clase_funcional=clase, numero_ins="322")
    insumo = Insumo(nombre="Lecitina comercial", tipo="aditivo", aditivo=referencia,
                    unidad_medida=version.unidad_medida,
                    perfil_declaracion={**PERFIL, "marcas": [{"codigo": "soja", "forma": "derivado"}]})
    nueva = VersionReceta(receta=receta, numero=2, rendimiento=1, unidad_medida=version.unidad_medida)
    nueva.insumos = [RecetaInsumo(insumo=insumo, cantidad=1, unidad_medida=version.unidad_medida, clasificacion="aditivo")]
    # Falta densidad para esta unidad de volumen: E10 no puede calcular porcentajes.
    version.unidad_medida.tipo = "volumen"
    db.add(nueva)
    db.commit()
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, nueva.id)
    assert propuesta["detectados"][0]["codigo"] == "soja"
    assert propuesta["fuentes"][0]["clasificacion"] == "aditivo"


def test_sulfitos_requieren_evaluacion_documentada(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    version.insumos[0].insumo.perfil_declaracion = {
        **PERFIL, "marcas": [{"codigo": "sulfitos", "forma": "directa"}],
    }
    db.commit()
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    assert any("Sulfitos" in p for p in salida["pendientes"])
    assert not salida["declaracion"]
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=2, evaluaciones=[{
        "codigo": "sulfitos", "declarar": True,
        "fundamento": "Concentración en producto final evaluada", "respaldo": "Ensayo 123",
    }]), admin)
    assert salida["declaracion"]
    assert servicio.confirmar(db, borrador.id, RevisionEsperada(revision=3), admin)["estado"] == "confirmada"


def test_cruzada_sin_respaldo_no_confirma(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    salida = servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, contaminacion_cruzada=[{
        "codigo": "mani", "fundamento": "Equipo compartido",
    }]), admin)
    assert any("autorización" in p for p in salida["pendientes"])
    with pytest.raises(HTTPException) as error:
        servicio.confirmar(db, borrador.id, RevisionEsperada(revision=2), admin)
    assert error.value.status_code == 422


def test_cambio_lista_manual_desactualiza_confirmacion(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(lista_ingredientes="Lista revisada"), admin)
    assert servicio.consultar(db, borrador.id)["vigencia"] == "desactualizada"


def test_superadmin_confirma_sin_flag_administrar(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    admin.puede_administrar = False
    admin.es_super_admin = True
    db.commit()
    assert servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)["estado"] == "confirmada"


def test_completitud_y_completado_exigen_confirmacion(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    campo = next(c for c in services.calcular_completitud(db, borrador.id).campos if c.nombre == "declaraciones")
    assert campo.estado == "pendiente"
    with pytest.raises(HTTPException):
        services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(estado="completado"), admin)
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    campo = next(c for c in services.calcular_completitud(db, borrador.id).campos if c.nombre == "declaraciones")
    assert campo.estado == "completo"


def test_revisiones_inmutables_y_archivado_conserva_historia(escenario):
    db, producto, _, _, borrador, admin, _ = escenario
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    revision = servicio.ultima_revision(db, borrador.id)
    revision.contenido = {**revision.contenido, "gluten": "presente"}
    with pytest.raises(ValueError):
        db.flush()
    db.rollback()
    services.eliminar_borrador(db, borrador.id)
    assert services.obtener_borradores_por_producto(db, producto.id) == []
    assert servicio.ultima_revision(db, borrador.id).confirmado_en
    with pytest.raises(HTTPException) as error:
        servicio.consultar(db, borrador.id)
    assert error.value.status_code == 404


def test_confirmacion_auditada_en_misma_transaccion(escenario):
    from src.auditoria.models import AuditLog
    db, _, _, _, borrador, admin, _ = escenario
    db.info.pop("sin_auditoria", None)
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    filas = list(db.scalars(select(AuditLog)))
    assert filas and all(f.usuario_id == admin.id for f in filas)


def test_migracion_base_nueva_y_segunda_ejecucion():
    from src.models import ModeloBase
    from src.migrations.declaraciones_rotulado import migrar_declaraciones_rotulado
    motor = create_engine("sqlite://")
    ModeloBase.metadata.create_all(motor)
    migrar_declaraciones_rotulado(motor)
    migrar_declaraciones_rotulado(motor)
    assert "archivado" in {c["name"] for c in inspect(motor).get_columns("borradores_rotulado")}
    motor.dispose()
