from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from src.alergenos import schemas as alergenos_schemas, services as alergenos_services
from src.alergenos.models import Alergeno, IngredienteAlergeno
from src.auth.dependencies import require_admin
from src.auth.services import crear_access_token
from src.database import get_db
from src.ingredientes.models import Ingrediente
from src.personal.models import Personal
from src.productos import schemas as productos_schemas, services as productos_services
from src.recetas.models import VersionReceta, RecetaIngrediente
from src.rotulado import declaraciones_services as servicio, schemas, services
from src.rotulado.declaraciones_schemas import EditarDeclaraciones, RegenerarDeclaraciones, RevisionEsperada
from src.rotulado.models import RevisionDeclaracionRotulado
from src.rotulado.router import router
from tests.rotulado.test_rotulado import datos  # noqa: F401


CONSERVACION = {"instrucciones": "Conservar refrigerado", "temperatura_aplicable": True,
                "temperatura_minima": 2, "temperatura_maxima": 8,
                "duracion_aplicable": True, "duracion": 5, "unidad_duracion": "dias"}


def _evaluar(ingrediente, evaluacion="evaluada", gluten="ausencia_declarada"):
    """Lo que antes era el perfil del insumo: la evaluación de alérgenos del ingrediente."""
    ingrediente.evaluacion_alergenos = evaluacion
    ingrediente.gluten = gluten


def _marcar(db, ingrediente, codigo, nivel="contiene", forma="directa"):
    """Alérgeno del ingrediente, en `ingredientes_alergenos`."""
    alergeno = db.scalar(select(Alergeno).where(Alergeno.codigo == codigo))
    db.add(ingrediente)
    db.flush()
    db.add(IngredienteAlergeno(ingrediente_id=ingrediente.id, alergeno_id=alergeno.id, nivel=nivel, forma=forma))


def _nueva_version(receta, version, ingredientes, es_aditivo=False):
    nueva = VersionReceta(receta=receta, numero=2, rendimiento=10, unidad_medida=version.unidad_medida)
    nueva.ingredientes = [RecetaIngrediente(ingrediente=i, cantidad=1, unidad_medida=version.unidad_medida,
                                            es_aditivo=es_aditivo) for i in ingredientes]
    return nueva


@pytest.fixture
def escenario(datos):
    db, producto, receta, version = datos
    alergenos_services.cargar_alergenos_iniciales(db)
    admin = Personal(nombre="Admin", dni="11000111", email="admin@hu106.test", password="hash",
                     puede_administrar=True, activo=True)
    operador = Personal(nombre="Operador", dni="11000112", email="operador@hu106.test", password="hash",
                        puede_operar=True, activo=True)
    _evaluar(version.ingredientes[0].ingrediente)
    producto.conservacion = dict(CONSERVACION)
    db.add_all([admin, operador])
    db.commit()
    borrador = services.crear_borrador(db, producto.id, schemas.BorradorRotuladoCreate(
        producto_id=producto.id, version_receta_id=version.id), admin)
    return db, producto, receta, version, borrador, admin, operador


def test_presencia_deduplicacion_y_fuentes(escenario):
    db, producto, receta, version, _, _, _ = escenario
    primero = version.ingredientes[0].ingrediente
    segundo = Ingrediente(nombre="Segundo", unidad_medida_id=primero.unidad_medida_id)
    _evaluar(segundo)
    for ingrediente in (primero, segundo):
        _marcar(db, ingrediente, "leche", forma="derivado")
    nueva = _nueva_version(receta, version, [primero, segundo])
    db.add(nueva)
    db.commit()
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, nueva.id)
    assert len(propuesta["detectados"]) == 1
    assert len(propuesta["detectados"][0]["fuentes"]) == 2
    assert {f["forma"] for f in propuesta["detectados"][0]["fuentes"]} == {"derivado"}


def test_sin_marcas_no_certifica_gluten(escenario):
    db, producto, _, version, *_ = escenario
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, version.id)
    assert propuesta["detectados"] == []
    assert propuesta["gluten"] == "sin_presencia_declarada"
    assert not propuesta["pendientes_origen"]


def test_incompleta_bloquea_confirmacion(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    _evaluar(version.ingredientes[0].ingrediente, evaluacion="sin_evaluar", gluten="desconocido")
    db.commit()
    servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    with pytest.raises(HTTPException) as error:
        servicio.confirmar(db, borrador.id, RevisionEsperada(revision=2), admin)
    assert error.value.status_code == 422


def test_puede_contener_del_ingrediente_va_al_rotulo_y_gana_contiene(escenario):
    db, producto, receta, version, _, _, _ = escenario
    primero = version.ingredientes[0].ingrediente
    segundo = Ingrediente(nombre="Cacao", unidad_medida_id=primero.unidad_medida_id)
    _evaluar(segundo)
    _marcar(db, primero, "leche")
    _marcar(db, segundo, "leche", nivel="puede_contener")
    _marcar(db, segundo, "avellana", nivel="puede_contener")
    nueva = _nueva_version(receta, version, [primero, segundo])
    db.add(nueva)
    db.commit()
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, nueva.id)
    # La leche la contiene la frutilla: no se declara como "puede contener".
    assert [d["codigo"] for d in propuesta["detectados"]] == ["leche"]
    assert [p["codigo"] for p in propuesta["puede_contener"]] == ["avellana"]
    nombres = {a.codigo: a.nombre for a in db.scalars(select(Alergeno))}
    assert servicio._texto_cruzado(propuesta, nombres) == "PUEDE CONTENER AVELLANA"


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


def test_cruzada_con_sustancia_fuera_del_catalogo(escenario):
    db, _, _, _, borrador, admin, _ = escenario
    with pytest.raises(HTTPException) as error:
        servicio.editar(db, borrador.id, EditarDeclaraciones(revision=1, contaminacion_cruzada=[{
            "codigo": "inventado", "fundamento": "Equipo compartido", "respaldo": "Autorización 123",
        }]), admin)
    assert error.value.status_code == 422


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
    _evaluar(version.ingredientes[0].ingrediente, gluten="presente")
    db.commit()
    assert servicio.consultar(db, borrador.id)["vigencia"] == "desactualizada"
    with pytest.raises(HTTPException) as error:
        servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    assert error.value.status_code == 409
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    assert salida["estado"] == "sugerida"
    assert db.scalar(select(RevisionDeclaracionRotulado).where(RevisionDeclaracionRotulado.numero == 1)).confirmado_por_id == admin.id


def test_un_alergeno_nuevo_en_el_ingrediente_desactualiza_la_confirmacion(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    _marcar(db, version.ingredientes[0].ingrediente, "huevo")
    db.commit()
    assert servicio.consultar(db, borrador.id)["vigencia"] == "desactualizada"


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
    nueva = _nueva_version(receta, version, [version.ingredientes[0].ingrediente])
    db.add(nueva)
    db.commit()
    assert servicio.consultar(db, borrador.id)["vigencia"] == "vigente"
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1, version_id=nueva.id), admin)
    assert salida["contenido"]["version_receta_id"] == nueva.id
    assert salida["revision"] == 2


def test_guardar_cambio_version_crea_propuesta_sin_confirmar(escenario):
    db, _, receta, version, borrador, admin, _ = escenario
    nueva = _nueva_version(receta, version, [version.ingredientes[0].ingrediente])
    db.add(nueva)
    db.commit()
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=1), admin)
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(version_receta_id=nueva.id), admin)
    salida = servicio.consultar(db, borrador.id)
    assert salida["contenido"]["version_receta_id"] == nueva.id
    assert salida["revision"] == 2 and salida["estado"] == "sugerida"


def test_maestros_persisten_y_se_limpian(escenario):
    db, producto, _, version, _, admin, _ = escenario
    ingrediente = version.ingredientes[0].ingrediente
    alergenos_services.guardar_alergenos_de_ingrediente(db, ingrediente.id, alergenos_schemas.AlergenosDeIngredienteIn(
        evaluacion="incompleta", gluten="presente", respaldo="Ficha técnica 12"), admin.id)
    guardado = alergenos_services.alergenos_de_ingrediente(db, ingrediente.id)
    assert (guardado.evaluacion, guardado.gluten, guardado.respaldo) == ("incompleta", "presente", "Ficha técnica 12")
    assert guardado.actualizado_por == "Admin"
    productos_services.actualizar_producto(db, producto.id, productos_schemas.ProductoUpdate(conservacion=None))
    db.expire_all()
    assert producto.conservacion is None
    # El respaldo se borra mandándolo en null; lo que no viene queda como estaba.
    alergenos_services.guardar_alergenos_de_ingrediente(
        db, ingrediente.id, alergenos_schemas.AlergenosDeIngredienteIn(respaldo=None))
    guardado = alergenos_services.alergenos_de_ingrediente(db, ingrediente.id)
    assert guardado.respaldo is None and guardado.evaluacion == "incompleta"


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
    catalogo = client.get("/rotulado/catalogo-alergenos").json()["sustancias"]
    assert {"codigo": "sulfitos", "nombre": "Dióxido de azufre y sulfitos", "condicionada": True} in catalogo


def test_migracion_aditiva_idempotente():
    from src.migrations.declaraciones_rotulado import migrar_declaraciones_rotulado
    motor = create_engine("sqlite://")
    with motor.begin() as conn:
        conn.execute(text("CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT)"))
        conn.execute(text("INSERT INTO productos VALUES (1, 'Anterior')"))
    migrar_declaraciones_rotulado(motor)
    migrar_declaraciones_rotulado(motor)
    assert "conservacion" in {c["name"] for c in inspect(motor).get_columns("productos")}
    with motor.connect() as conn:
        assert conn.execute(text("SELECT nombre, conservacion FROM productos")).one() == ("Anterior", None)
        assert conn.scalar(text("SELECT count(*) FROM schema_migrations")) == 1
    motor.dispose()


def test_aditivo_incluido_sin_conversion_de_masa(escenario):
    from src.aditivos.models import ClaseFuncional
    db, producto, receta, version, *_ = escenario
    clase = ClaseFuncional(nombre="Emulsionante HU106")
    lecitina = Ingrediente(nombre="Lecitina comercial", es_aditivo=True, clase_funcional=clase,
                           numero_ins="322", unidad_medida=version.unidad_medida)
    _evaluar(lecitina)
    _marcar(db, lecitina, "soja", forma="derivado")
    nueva = _nueva_version(receta, version, [lecitina], es_aditivo=True)
    # Falta densidad para esta unidad de volumen: E10 no puede calcular porcentajes.
    version.unidad_medida.tipo = "volumen"
    db.add(nueva)
    db.commit()
    propuesta = servicio.generar_propuesta_declaraciones(db, producto.id, nueva.id)
    assert propuesta["detectados"][0]["codigo"] == "soja"
    assert propuesta["fuentes"][0]["es_aditivo"] is True


def test_sulfitos_requieren_evaluacion_documentada(escenario):
    db, _, _, version, borrador, admin, _ = escenario
    _marcar(db, version.ingredientes[0].ingrediente, "sulfitos")
    db.commit()
    salida = servicio.regenerar(db, borrador.id, RegenerarDeclaraciones(revision=1), admin)
    assert any("sulfitos" in p.lower() and "evaluá" in p for p in salida["pendientes"])
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


def test_listado_calcula_si_el_rotulo_esta_completo(escenario, monkeypatch):
    from datetime import date
    from src.common.fechas import ahora
    from src.lotes.models import LoteProducto
    from tests.produccion_helpers import tabla_nutricional
    db, producto, _, version, borrador, admin, _ = escenario
    lote = LoteProducto(producto=producto, version_receta=version, numero_lote="L-1", cantidad_objetivo=10,
                        estado="terminado", fecha_inicio=ahora(), fecha_cierre=ahora())
    db.add(lote)
    db.commit()
    hoy = date.today()
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(
        version_receta_id=version.id, lote_producto_id=lote.id, denominacion_venta="Mermelada",
        lista_ingredientes="Frutilla", contenido_neto="454 g", rnpa_rppa="RNPA 07-123456", razon_social="SAIA",
        domicilio="Calle 1", identificacion_lote="L-1", fecha_produccion=hoy, fecha_cierre=hoy,
        fecha_duracion=hoy, instrucciones_uso="Lista para consumir",
        datos_nutricionales_json=tabla_nutricional(version.id)), admin)
    frontal = ["no_aplica", None, []]
    monkeypatch.setattr(services, "_estado_frontal", lambda *_: tuple(frontal))

    def completo():
        # El listado de todos los productos no lo calcula.
        assert services.listar_borradores(db, producto.id)[0].completo is None
        fila, = services.listar_borradores(db, producto.id, con_completitud=True)
        # Coincide con la completitud del editor.
        assert fila.completo == (services.calcular_completitud(db, borrador.id).estado_global == "completo")
        assert services.productos_con_rotulo_completo(db, [producto.id]) == ({producto.id} if fila.completo else set())
        return fila.completo

    assert not completo()
    numero = servicio.regenerar(
        db, borrador.id, RegenerarDeclaraciones(revision=servicio.consultar(db, borrador.id)["revision"]), admin,
    )["revision"]
    servicio.confirmar(db, borrador.id, RevisionEsperada(revision=numero), admin)
    # No hace falta que nadie guarde el estado "completado".
    assert borrador.estado == "borrador" and completo()
    frontal[0] = "sin_definir"
    assert not completo()
    frontal[0] = "no_aplica"
    # Una tabla con datos faltantes no cuenta como completa, y dice por qué.
    for tabla, esperado in ((tabla_nutricional(version.id, faltan_datos=True), False), (tabla_nutricional(version.id), True)):
        services.actualizar_borrador(
            db, borrador.id, schemas.BorradorRotuladoUpdate(datos_nutricionales_json=tabla), admin)
        campo = next(c for c in services.calcular_completitud(db, borrador.id).campos
                     if c.nombre == "datos_nutricionales_json")
        assert completo() is esperado and (campo.estado == "completo") is esperado and bool(campo.motivo) is not esperado
    services.actualizar_borrador(db, borrador.id, schemas.BorradorRotuladoUpdate(contenido_neto=""), admin)
    assert not completo()


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
