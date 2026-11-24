"""Tests de la exportación: filtro `activo` y vistas calculadas (CSV y PDF)."""

from datetime import date

import pytest

from src.exportacion.listados import LISTADOS
from src.sector.models import Sector


def _sector(db, nombre, activo):
    db.info["sin_auditoria"] = True
    try:
        db.add(Sector(nombre=nombre, activo=activo))
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def _csv(respuesta) -> str:
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.content.decode("utf-8-sig")


def test_exportar_tabla_filtra_por_activo_false(client_auditoria, db_session):
    _sector(db_session, "Sector vigente", True)
    _sector(db_session, "Sector de baja", False)

    baja = _csv(client_auditoria.get("/exportacion/sectores?formato=csv&activo=false"))
    vigentes = _csv(client_auditoria.get("/exportacion/sectores?formato=csv&activo=true"))

    assert "Sector de baja" in baja and "Sector vigente" not in baja
    assert "Sector vigente" in vigentes and "Sector de baja" not in vigentes


def test_listado_sectores_solo_inactivos(client_auditoria, db_session):
    _sector(db_session, "Sector vigente", True)
    _sector(db_session, "Sector de baja", False)

    resp = client_auditoria.get("/sectores?page=1&solo_inactivos=true")

    assert resp.status_code == 200
    assert [s["nombre"] for s in resp.json()["items"]] == ["Sector de baja"]


@pytest.mark.parametrize(
    "ruta, encabezado",
    [
        ("/exportacion/vistas/vencimientos", "Persona / Equipo"),
        ("/exportacion/vistas/stock-actual", "Stock mínimo"),
        ("/exportacion/vistas/stock-movimientos", "Responsable"),
        ("/exportacion/vistas/stock-lotes", "Cantidad producto"),
        (
            "/exportacion/vistas/stock-consumo?fecha_desde=2026-01-01&fecha_hasta=2026-12-31",
            "Cantidad acumulada",
        ),
        ("/exportacion/vistas/lotes-produccion", "Número de lote"),
        ("/exportacion/vistas/salidas", "Fecha de reserva"),
        ("/exportacion/vistas/retiros", "Notificados"),
        ("/exportacion/vistas/recetas", "Versión vigente"),
        ("/exportacion/vistas/productos", "Descripción"),
        ("/exportacion/vistas/alimentos", "Energía (kcal)"),
        ("/exportacion/vistas/rotulado", "Borradores"),
        ("/exportacion/vistas/clientes", "Documento"),
        ("/exportacion/vistas/transportistas", "Habilitación"),
    ],
)
def test_vistas_exportan_csv_y_pdf(client_auditoria, ruta, encabezado):
    separador = "&" if "?" in ruta else "?"

    csv = client_auditoria.get(f"{ruta}{separador}formato=csv")
    pdf = client_auditoria.get(f"{ruta}{separador}formato=pdf")

    assert encabezado in _csv(csv)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


def _producto(db, nombre, activo=True):
    from src.productos.models import Producto
    from src.unidadMedida.models import UnidadMedida

    db.info["sin_auditoria"] = True
    try:
        unidad = db.query(UnidadMedida).filter_by(simbolo="kg").first()
        if unidad is None:
            unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg")
            db.add(unidad)
            db.flush()
        db.add(Producto(nombre=nombre, unidad_medida_id=unidad.id, activo=activo))
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def test_vista_productos_respeta_busqueda_y_bajas(client_auditoria, db_session):
    _producto(db_session, "Budín de vainilla")
    _producto(db_session, "Pan de molde")
    _producto(db_session, "Mermelada vieja", activo=False)

    buscados = _csv(client_auditoria.get("/exportacion/vistas/productos?formato=csv&buscar=bud"))
    bajas = _csv(client_auditoria.get("/exportacion/vistas/productos?formato=csv&incluir_inactivos=true"))
    rotulado = _csv(client_auditoria.get("/exportacion/vistas/rotulado?formato=csv"))

    assert "Budín de vainilla" in buscados and "Pan de molde" not in buscados
    assert "Mermelada vieja" in bajas and "Pan de molde" not in bajas
    assert "Pan de molde" in rotulado and "Mermelada vieja" not in rotulado


def _guardar(db, *entidades):
    db.info["sin_auditoria"] = True
    try:
        db.add_all(entidades)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def test_vista_clientes_respeta_busqueda_orden_y_bajas(client_auditoria, db_session):
    from src.clientes.models import Cliente

    _guardar(
        db_session,
        Cliente(nombre="Almacén Ñandú", documento="20111111112", telefono="1"),
        Cliente(nombre="Kiosco Sur", documento="20222222223", telefono="2"),
        Cliente(nombre="Cliente viejo", documento="20333333334", telefono="3", activo=False),
    )
    ruta = "/exportacion/vistas/clientes?formato=csv"

    todos = _csv(client_auditoria.get(f"{ruta}&solo_inactivos=false"))
    buscados = _csv(client_auditoria.get(f"{ruta}&buscar=almacen"))
    bajas = _csv(client_auditoria.get(f"{ruta}&solo_inactivos=true"))
    descendente = _csv(client_auditoria.get(f"{ruta}&orden=nombre_desc"))

    assert "Cliente viejo" not in todos
    assert todos.index("Almacén Ñandú") < todos.index("Kiosco Sur")
    assert "Almacén Ñandú" in buscados and "Kiosco Sur" not in buscados
    assert "Cliente viejo" in bajas and "Kiosco Sur" not in bajas
    assert descendente.index("Kiosco Sur") < descendente.index("Almacén Ñandú")


def test_vista_transportistas_respeta_busqueda_y_bajas(client_auditoria, db_session):
    from src.transportistas.models import Transportista

    _guardar(
        db_session,
        Transportista(razon_social="Fletes Patagónicos", cuit="30111111118", telefono="1"),
        Transportista(razon_social="Logística Norte", cuit="30222222229", telefono="2"),
        Transportista(razon_social="Expreso viejo", cuit="30333333330", telefono="3", activo=False),
    )
    ruta = "/exportacion/vistas/transportistas?formato=csv"

    buscados = _csv(client_auditoria.get(f"{ruta}&buscar=patagonicos"))
    bajas = _csv(client_auditoria.get(f"{ruta}&solo_inactivos=true"))

    assert "Fletes Patagónicos" in buscados and "Logística Norte" not in buscados
    assert "Sin certificaciones" in buscados
    assert "Expreso viejo" in bajas and "Logística Norte" not in bajas


@pytest.fixture
def datos_exportacion(client_auditoria, db_session):
    """Dos filas ("alfa" y "beta") de cada tabla con listado propio."""
    from src.all_models import (
        Aptitud,
        Checklist,
        ClaseFuncional,
        Documento,
        ElementoLimpieza,
        Equipo,
        Incidente,
        Ingrediente,
        InsumoQuimico,
        Personal,
        PlanCalibracionMantenimiento,
        PlanLimpieza,
        Proveedor,
        UnidadMedida,
        VersionDocumento,
    )
    from src.auth.dependencies import require_operador
    from src.main import app

    def persona(nombre, dni, **roles):
        return Personal(nombre=nombre, dni=dni, email=f"{dni}@example.com", password="x", **roles)

    db = db_session
    clase = ClaseFuncional(nombre="Conservante de prueba")
    sector_alfa, sector_beta = Sector(nombre="Alfa"), Sector(nombre="Beta")
    unidad_alfa = UnidadMedida(nombre="Alfa", simbolo="a")
    unidad_beta = UnidadMedida(nombre="Beta", simbolo="b")
    admin = persona("Alfa", "30000001", puede_operar=True, puede_administrar=True)
    operador = persona("Beta", "30000002", puede_operar=True)
    proveedor_alfa = Proveedor(nombre="Alfa", matricula="1")
    proveedor_baja = Proveedor(nombre="Alfa de baja", matricula="3", activo=False)
    _guardar(
        db, clase, sector_alfa, sector_beta, unidad_alfa, unidad_beta, admin, operador,
        proveedor_alfa, Proveedor(nombre="Beta", matricula="2"), proveedor_baja,
        Aptitud(nombre="Alfa"), Aptitud(nombre="Beta"),
        ElementoLimpieza(nombre="Alfa"), ElementoLimpieza(nombre="Beta"),
    )

    equipo_alfa = Equipo(nombre="Horno alfa", tipo="horno", sector_id=sector_alfa.id)
    equipo_beta = Equipo(nombre="Amasadora", tipo="amasadora", sector_id=sector_beta.id)
    ingrediente_beta = Ingrediente(
        nombre="Beta",
        unidad_medida_id=unidad_beta.id,
        es_aditivo=True,
        clase_funcional_id=clase.id,
    )
    documento = Documento(nombre="Alfa", tipo="receta")
    _guardar(
        db, equipo_alfa, equipo_beta, ingrediente_beta, documento,
        Documento(nombre="Beta", tipo="manual_bpm"),
        Ingrediente(nombre="Harina alfa", unidad_medida_id=unidad_alfa.id),
        InsumoQuimico(nombre="Alfa", tipo="detergente", unidad_medida_id=unidad_alfa.id),
        InsumoQuimico(nombre="Beta", tipo="sanitizante", unidad_medida_id=unidad_beta.id),
        Incidente(titulo="Alfa", descripcion="x", tipo="otro", usuario_id=admin.id),
        Incidente(titulo="Beta", descripcion="x", tipo="otro", usuario_id=operador.id),
    )

    plan = PlanLimpieza(nombre="Plan", equipo_id=equipo_alfa.id, autor_id=admin.id)
    calibracion = {
        "autor_id": admin.id,
        "tipo": "calibracion",
        "fecha_ultima_intervencion": date(2026, 1, 1),
        "periodicidad_dias": 30,
    }
    _guardar(
        db, plan,
        PlanLimpieza(nombre="Otro", equipo_id=equipo_beta.id, autor_id=admin.id),
        PlanCalibracionMantenimiento(equipo_id=equipo_alfa.id, **calibracion),
        PlanCalibracionMantenimiento(equipo_id=equipo_beta.id, **calibracion),
        VersionDocumento(
            documento_id=documento.id, numero_version=1, nombre_archivo="a.pdf",
            archivo_url="uploads/a.pdf", autor_id=admin.id,
            fecha_vencimiento=date(2020, 1, 1),
        ),
    )
    viejo = Checklist(equipo_id=equipo_alfa.id, plan_id=plan.id, fecha=date(2026, 4, 1))
    nuevo = Checklist(equipo_id=equipo_alfa.id, plan_id=plan.id, fecha=date(2026, 6, 1))
    _guardar(db, viejo, nuevo)

    app.dependency_overrides[require_operador] = lambda: admin
    try:
        yield {
            "unidad_beta": unidad_beta,
            "ingrediente_beta": ingrediente_beta,
            "proveedor_alfa": proveedor_alfa,
            "proveedor_baja": proveedor_baja,
            "checklist_viejo": viejo,
            "checklist_nuevo": nuevo,
        }
    finally:
        app.dependency_overrides.pop(require_operador, None)


def _ids(respuesta) -> list[str]:
    filas = _csv(respuesta).splitlines()[1:]
    return [fila.split(";")[0] for fila in filas]


@pytest.mark.parametrize("tabla", sorted(LISTADOS))
def test_exportar_con_busqueda_sin_resultados_queda_vacio(client_auditoria, datos_exportacion, tabla):
    ruta = f"/exportacion/{tabla}?formato=csv"

    assert _ids(client_auditoria.get(ruta)), "el test necesita filas para que la búsqueda las saque"
    assert _ids(client_auditoria.get(f"{ruta}&buscar=zzz-no-existe")) == []

    pdf = client_auditoria.get(f"/exportacion/{tabla}?formato=pdf&buscar=zzz-no-existe")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


@pytest.mark.parametrize(
    "tabla, ruta, filtros_export, filtros_lista",
    [
        ("aptituds", "/aptitudes", "buscar=alfa", "buscar=alfa"),
        ("sectores", "/sectores", "activo=true&orden=nombre_desc", "orden=nombre_desc"),
        ("unidades_medida", "/unidades-medida", "activo=true&buscar=alfa", "buscar=alfa"),
        ("elementos_limpieza", "/elementos-limpieza", "activo=true&buscar=alfa", "buscar=alfa"),
        # Busca por el nombre del sector, que es de otra tabla.
        ("equipos", "/equipos", "activo=true&buscar=beta", "buscar=beta"),
        ("ingredientes", "/ingredientes", "activo=true&buscar=alfa", "buscar=alfa"),
        ("ingredientes", "/ingredientes", "activo=true&es_aditivo=true", "es_aditivo=true"),
        ("insumos_quimicos", "/insumos-quimicos", "activo=true&tipo=sanitizante", "tipo=sanitizante"),
        ("personal", "/personal", "activo=true&rol=operador", "rol=operador"),
        (
            "planes_calibracion_mantenimiento",
            "/planes-calibracion-mantenimiento",
            "activo=true&buscar=alfa",
            "buscar=alfa",
        ),
        ("planes_limpieza", "/planes-limpieza", "activo=true&buscar=alfa", "buscar=alfa"),
        ("documentos", "/documentos", "buscar=alfa", "buscar=alfa"),
        ("documentos", "/documentos", "estado=vencido", "estado=vencido"),
        ("incidentes", "/incidentes", "estado=abierto&buscar=alfa", "estado=abierto&buscar=alfa"),
    ],
)
def test_exportar_trae_lo_mismo_que_el_listado(
    client_auditoria, datos_exportacion, tabla, ruta, filtros_export, filtros_lista
):
    exportados = _ids(client_auditoria.get(f"/exportacion/{tabla}?formato=csv&{filtros_export}"))
    respuesta = client_auditoria.get(f"{ruta}?page=1&page_size=100&{filtros_lista}")

    assert respuesta.status_code == 200, respuesta.text
    assert exportados, "el filtro tiene que dejar alguna fila"
    assert exportados == [str(item["id"]) for item in respuesta.json()["items"]]


def test_exportar_ingredientes_filtra_por_unidad(client_auditoria, datos_exportacion):
    ruta = "/exportacion/ingredientes?formato=csv&activo=true"
    unidad = datos_exportacion["unidad_beta"].id

    assert _ids(client_auditoria.get(f"{ruta}&unidad_medida_id={unidad}")) == [
        str(datos_exportacion["ingrediente_beta"].id)
    ]


def test_exportar_proveedores_separa_bajas_y_busca(client_auditoria, datos_exportacion):
    ruta = "/exportacion/proveedores?formato=csv"
    alfa, baja = datos_exportacion["proveedor_alfa"], datos_exportacion["proveedor_baja"]

    assert _ids(client_auditoria.get(f"{ruta}&activo=true&buscar=alfa")) == [str(alfa.id)]
    assert _ids(client_auditoria.get(f"{ruta}&activo=false")) == [str(baja.id)]


def test_exportar_checklists_acota_por_fechas_y_equipo(client_auditoria, datos_exportacion):
    ruta = "/exportacion/checklists?formato=csv"
    viejo, nuevo = datos_exportacion["checklist_viejo"], datos_exportacion["checklist_nuevo"]

    assert _ids(client_auditoria.get(f"{ruta}&fecha_desde=2026-05-01")) == [str(nuevo.id)]
    assert _ids(client_auditoria.get(f"{ruta}&fecha_hasta=2026-05-01")) == [str(viejo.id)]
    assert _ids(client_auditoria.get(f"{ruta}&buscar=alfa&orden=fecha_asc")) == [
        str(viejo.id),
        str(nuevo.id),
    ]


@pytest.mark.parametrize(
    "ruta",
    [
        "/exportacion/ingredientes?unidad_medida_id=abc",
        "/exportacion/checklists?fecha_desde=ayer",
        "/exportacion/documentos?tipo=inventado",
        "/exportacion/documentos?estado=inventado",
        "/exportacion/incidentes?estado=inventado",
        "/exportacion/insumos_quimicos?tipo=inventado",
        "/exportacion/sectores?buscar=" + "x" * 101,
    ],
)
def test_exportar_rechaza_filtros_invalidos(client_auditoria, ruta):
    assert client_auditoria.get(ruta).status_code == 422


def test_exportar_filas_del_frontend(client_auditoria):
    datos = {
        "titulo": "Reclamos de clientes",
        "nombre": "reclamos",
        "encabezados": ["Cliente", "Estado"],
        "filas": [["Almacén Ñandú", "Abierto"], ["Kiosco Sur", "Cerrado"]],
    }

    csv = client_auditoria.post("/exportacion/filas?formato=csv", json=datos)
    pdf = client_auditoria.post("/exportacion/filas?formato=pdf", json=datos)

    texto_csv = _csv(csv)
    assert "Cliente" in texto_csv and "Almacén Ñandú" in texto_csv
    assert 'filename="reclamos_' in csv.headers["content-disposition"]
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_exportar_filas_rechaza_filas_desparejas(client_auditoria):
    datos = {"titulo": "X", "nombre": "x", "encabezados": ["A", "B"], "filas": [["solo una"]]}

    assert client_auditoria.post("/exportacion/filas", json=datos).status_code == 422


def test_numero_en_formato_argentino():
    from src.exportacion.vistas import _cantidad, _numero

    assert _numero("1632.851") == "1.632,851"
    assert _numero("4.000") == "4"
    assert _cantidad("16.5", "kg") == "16,5 kg"
    assert _numero(None) == "-"
