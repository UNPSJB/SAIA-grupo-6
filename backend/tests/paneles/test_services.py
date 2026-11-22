"""Tests de los indicadores agregados de los paneles de categoría."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from src.checklist.models import Checklist, RegistroTarea
from src.common.fechas import hoy
from src.Equipo.models import Equipo
from src.incidente.models import Incidente
from src.lotes.models import LoteProducto
from src.nutricion.models import InfoNutricionalProducto
from src.notificaciones.services import META_CUMPLIMIENTO_LIMPIEZA_POR_DEFECTO, actualizar_meta_cumplimiento_limpieza
from src.paneles import schemas, services
from src.paneles.exceptions import PeriodoDemasiadoLargo, RangoFechasInvalido
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.PlanLimpieza.models import PlanLimpieza
from src.productos.models import Producto
from src.sector.models import Sector
from src.unidadMedida.models import UnidadMedida


def _periodo(dias: int = 30) -> schemas.Periodo:
    return services.validar_periodo(hoy() - timedelta(days=dias - 1), hoy())


def _a_las(dia: date, hora: int = 10) -> datetime:
    return datetime.combine(dia, datetime.min.time()) + timedelta(hours=hora)


@pytest.fixture
def base(db_session):
    """Dos personas, un sector y dos equipos (uno dado de baja)."""
    db_session.info["sin_auditoria"] = True
    admin = Personal(
        nombre="Ada", apellido="Admin", dni="20000001", email="ada@test.local",
        password="x", puede_administrar=True, puede_operar=True,
    )
    operador = Personal(
        nombre="Omar", apellido="Operador", dni="20000002", email="omar@test.local",
        password="x", puede_operar=True,
    )
    sector = Sector(nombre="Elaboración", activo=True)
    db_session.add_all([admin, operador, sector])
    db_session.flush()
    horno = Equipo(nombre="Horno", tipo="Cocción", sector_id=sector.id, activo=True)
    baja = Equipo(nombre="Amasadora vieja", tipo="Amasado", sector_id=sector.id, activo=False)
    db_session.add_all([horno, baja])
    db_session.commit()
    return {"db": db_session, "admin": admin, "operador": operador, "sector": sector, "horno": horno}


# ───────────────────────────── Período y series ─────────────────────────────


def test_periodo_invalido():
    with pytest.raises(RangoFechasInvalido):
        services.validar_periodo(date(2026, 5, 2), date(2026, 5, 1))
    with pytest.raises(PeriodoDemasiadoLargo):
        services.validar_periodo(date(2020, 1, 1), date(2026, 1, 1))


def test_serie_rellena_los_tramos_sin_datos():
    periodo = services.validar_periodo(date(2026, 5, 1), date(2026, 5, 7))
    serie = services._serie(periodo, ("a", "b"), [("2026-05-03", "a", 2), (date(2026, 5, 3), "b", 1)])

    assert serie.granularidad == "dia"
    assert len(serie.puntos) == 7
    assert serie.puntos[2].valores == {"a": 2.0, "b": 1.0}
    assert serie.puntos[0].valores == {"a": 0.0, "b": 0.0}


def test_serie_agrupa_por_semana_y_por_mes():
    trimestre = services.validar_periodo(date(2026, 3, 1), date(2026, 5, 31))
    semanal = services._serie(trimestre, ("a",), [(date(2026, 3, 4), "a", 1), (date(2026, 3, 6), "a", 2)])
    assert semanal.granularidad == "semana"
    # 4 y 6 de marzo de 2026 caen en la misma semana (lunes 2).
    assert [p.valores["a"] for p in semanal.puntos if p.clave == date(2026, 3, 2)] == [3.0]

    anio = services.validar_periodo(date(2025, 6, 1), date(2026, 5, 31))
    mensual = services._serie(anio, ("a",), [(date(2026, 1, 15), "a", 4)])
    assert mensual.granularidad == "mes"
    assert len(mensual.puntos) == 12
    assert next(p for p in mensual.puntos if p.clave == date(2026, 1, 1)).etiqueta == "ene 26"


# ───────────────────────────────── Equipos ─────────────────────────────────


def test_panel_equipos(base):
    db, hoy_dia = base["db"], hoy()
    db.add_all([
        # Vencido hace rato y otro al día.
        PlanCalibracionMantenimiento(
            equipo_id=base["horno"].id, autor_id=base["admin"].id, tipo="calibracion",
            fecha_ultima_intervencion=hoy_dia - timedelta(days=100), periodicidad_dias=30,
        ),
        PlanCalibracionMantenimiento(
            equipo_id=base["horno"].id, autor_id=base["admin"].id, tipo="mantenimiento",
            fecha_ultima_intervencion=hoy_dia - timedelta(days=1), periodicidad_dias=90,
        ),
        Incidente(
            titulo="No calienta", descripcion="x", tipo="falla_equipo",
            usuario_id=base["operador"].id, equipo_id=base["horno"].id,
            fecha_reporte=_a_las(hoy_dia - timedelta(days=3)),
        ),
        # Sin equipo: no cuenta en este panel.
        Incidente(
            titulo="Plaga", descripcion="x", tipo="plagas", usuario_id=base["operador"].id,
            fecha_reporte=_a_las(hoy_dia - timedelta(days=2)),
        ),
    ])
    db.commit()

    panel = services.panel_equipos(db, _periodo(), None)

    assert (panel.equipos_activos, panel.equipos_inactivos) == (1, 1)
    assert panel.incidentes_abiertos == 1
    assert panel.equipos_con_incidentes_abiertos == 1
    assert panel.incidentes_periodo == 1
    assert (panel.planes_vencidos, panel.planes_proximos) == (1, 0)
    assert panel.equipos_sin_plan == 0
    calibracion = next(g for g in panel.estado_planes if g.clave == "calibracion")
    assert (calibracion.vencidos, calibracion.al_dia) == (1, 0)
    assert panel.equipos_mas_incidentes[0].etiqueta == "Horno"
    assert panel.proximas_intervenciones[0].tono == "peligro"
    assert sum(p.valores["reportados"] for p in panel.serie_incidentes.puntos) == 1


def test_panel_equipos_filtra_por_sector(base):
    db = base["db"]
    otro = Sector(nombre="Depósito", activo=True)
    db.add(otro)
    db.commit()

    panel = services.panel_equipos(db, _periodo(), otro.id)

    assert (panel.equipos_activos, panel.equipos_inactivos) == (0, 0)
    assert panel.equipos_sin_plan == 0


# ───────────────────────────────── Calidad ─────────────────────────────────


def _incidentes(base):
    db, hoy_dia = base["db"], hoy()
    db.add_all([
        Incidente(
            titulo="Abierto viejo", descripcion="x", tipo="plagas", usuario_id=base["admin"].id,
            fecha_reporte=_a_las(hoy_dia - timedelta(days=20)),
        ),
        Incidente(
            titulo="Cerrado en 4 días", descripcion="x", tipo="falla_equipo",
            usuario_id=base["operador"].id, estado="cerrado",
            fecha_reporte=_a_las(hoy_dia - timedelta(days=10)),
            fecha_cierre=_a_las(hoy_dia - timedelta(days=6)),
        ),
        Incidente(
            titulo="Fuera del período", descripcion="x", tipo="otro", usuario_id=base["admin"].id,
            estado="cerrado", fecha_reporte=_a_las(hoy_dia - timedelta(days=200)),
            fecha_cierre=_a_las(hoy_dia - timedelta(days=190)),
        ),
    ])
    db.commit()


def test_panel_calidad_administracion(base):
    _incidentes(base)

    panel = services.panel_calidad(base["db"], _periodo(), None, base["admin"], True)

    assert panel.solo_propios is False
    assert panel.incidentes_abiertos == 1
    assert panel.incidentes_reportados == 2
    assert panel.incidentes_resueltos == 1
    assert panel.porcentaje_resuelto == 50.0
    assert panel.dias_resolucion == 4.0
    assert panel.cerrados_periodo == 1
    assert {c.clave: c.valor for c in panel.incidentes_por_tipo} == {"plagas": 1, "falla_equipo": 1}
    assert {c.clave: c.valor for c in panel.antiguedad_abiertos} == {"semana": 0, "mes": 1, "mas": 0}
    assert panel.abiertos_antiguos[0].titulo == "Abierto viejo"
    # Mapa por tipo y tramo: una fila por tipo con incidentes, ceros reales donde no hubo.
    mapa = panel.mapa_incidentes
    assert [f.clave for f in mapa.filas] == ["plagas", "falla_equipo"]
    assert len(mapa.columnas) == 30 and all(len(f.valores) == 30 for f in mapa.filas)
    assert [sum(f.valores) for f in mapa.filas] == [1.0, 1.0]
    assert mapa.filas[0].valores[30 - 1 - 20] == 1.0
    assert panel.vencimientos_vencidos == 0


def test_panel_calidad_operador_solo_ve_lo_suyo(base):
    _incidentes(base)

    panel = services.panel_calidad(base["db"], _periodo(), None, base["operador"], False)

    assert panel.solo_propios is True
    assert panel.incidentes_abiertos == 0
    assert panel.incidentes_reportados == 1
    assert panel.vencimientos_vencidos is None
    assert panel.vencimientos_por_tipo is None


def test_panel_calidad_sin_datos_no_inventa_indicadores(base):
    panel = services.panel_calidad(base["db"], _periodo(), None, base["admin"], True)

    assert panel.porcentaje_resuelto is None
    assert panel.dias_resolucion is None
    assert panel.incidentes_por_tipo == []


def test_panel_calidad_filtra_por_tipo(base):
    _incidentes(base)

    panel = services.panel_calidad(base["db"], _periodo(), "plagas", base["admin"], True)

    assert panel.incidentes_reportados == 1
    assert panel.cerrados_periodo == 0


# ───────────────────────────────── Limpieza ────────────────────────────────


def _checklist(base, dias_atras: int, completadas: int, total: int):
    db = base["db"]
    plan = db.query(PlanLimpieza).first()
    if plan is None:
        plan = PlanLimpieza(nombre="Limpieza del horno", equipo_id=base["horno"].id, autor_id=base["admin"].id)
        db.add(plan)
        db.flush()
    checklist = Checklist(equipo_id=base["horno"].id, plan_id=plan.id, fecha=hoy() - timedelta(days=dias_atras))
    db.add(checklist)
    db.flush()
    for i in range(total):
        db.add(RegistroTarea(
            checklist_id=checklist.id, nombre_tarea_historico=f"Tarea {i}",
            tipo_tarea_historico="operacional", completado=i < completadas,
            operador_id=base["operador"].id if i == 0 else None,
        ))
    db.commit()


def test_panel_limpieza(base):
    _checklist(base, dias_atras=2, completadas=3, total=4)
    _checklist(base, dias_atras=0, completadas=0, total=2)

    panel = services.panel_limpieza(base["db"], _periodo(), None, base["admin"], True)

    assert (panel.tareas_total, panel.tareas_completadas) == (6, 3)
    assert panel.cumplimiento == 50.0
    assert panel.pendientes_hoy == 2
    # Lo de hoy todavía se puede cumplir: no cuenta como incumplido.
    assert panel.tareas_incumplidas == 1
    assert panel.planes_activos == 1
    assert panel.cumplimiento_por_sector[0].etiqueta == "Elaboración"
    assert panel.cumplimiento_por_momento[0].clave == "operacional"
    # El checklist de hace dos días quedó abierto: se muestra como cerrado.
    estados = {c.clave: c.valor for c in panel.checklists_por_estado}
    assert (estados["cerrado"], estados["abierto"]) == (1, 1)
    assert panel.atencion == []
    dia = next(p for p in panel.serie_cumplimiento.puntos if p.clave == hoy() - timedelta(days=2))
    assert dia.valores["cumplimiento"] == 75.0
    sin_tareas = next(p for p in panel.serie_cumplimiento.puntos if p.clave == hoy() - timedelta(days=5))
    assert sin_tareas.valores["cumplimiento"] is None
    # Mapa por sector y tramo: 75 % hace dos días, 0 % hoy y vacío donde no hubo tareas.
    fila = panel.mapa_cumplimiento.filas[0]
    assert fila.etiqueta == "Elaboración"
    assert (fila.valores[-3], fila.valores[-1], fila.valores[0]) == (75.0, 0.0, None)


def test_panel_limpieza_operador_ve_sus_tareas(base):
    _checklist(base, dias_atras=2, completadas=3, total=4)

    panel = services.panel_limpieza(base["db"], _periodo(), None, base["operador"], False)

    assert panel.solo_propias is True
    assert (panel.tareas_total, panel.tareas_completadas) == (1, 1)
    assert panel.atencion is None
    assert panel.quimicos_bajo_minimo is None


def test_panel_limpieza_sin_tareas(base):
    panel = services.panel_limpieza(base["db"], _periodo(), None, base["admin"], True)

    assert panel.cumplimiento is None
    assert panel.mapa_cumplimiento.filas == []
    assert panel.equipos_menor_cumplimiento == []


# ──────────────────────────────── Producción ───────────────────────────────


def test_panel_produccion(base):
    db, hoy_dia = base["db"], hoy()
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa", factor_a_base=1000)
    db.add(unidad)
    db.flush()
    pan = Producto(nombre="Pan", unidad_medida_id=unidad.id, activo=True)
    db.add(pan)
    db.flush()
    db.add_all([
        LoteProducto(
            numero_lote="LP-1", producto_id=pan.id, cantidad_objetivo=Decimal("10"),
            estado="en_proceso", fecha_inicio=_a_las(hoy_dia - timedelta(days=1)),
        ),
        LoteProducto(
            numero_lote="LP-2", producto_id=pan.id, cantidad_objetivo=Decimal("10"),
            cantidad_producida=Decimal("9.5"), estado="terminado",
            fecha_inicio=_a_las(hoy_dia - timedelta(days=5)),
            fecha_cierre=_a_las(hoy_dia - timedelta(days=4)),
        ),
    ])
    db.commit()

    panel = services.panel_produccion(db, _periodo(), None, True)

    assert panel.lotes_en_proceso == 1
    assert (panel.lotes_iniciados, panel.lotes_terminados, panel.lotes_cancelados) == (2, 1, 0)
    assert panel.elaborado_por_producto[0].valor == 9.5
    # Ya está en kg: no se repite la cantidad en su unidad.
    assert panel.elaborado_por_producto[0].detalle is None
    assert panel.elaborado_sin_peso == []
    por_estado = panel.serie_lotes_por_estado.puntos
    assert sum(p.valores["en_proceso"] for p in por_estado) == 1
    assert sum(p.valores["terminado"] for p in por_estado) == 1
    assert sum(p.valores["cancelado"] for p in por_estado) == 0
    assert panel.en_proceso[0].titulo == "LP-1 · Pan"
    assert panel.catalogo is not None
    assert panel.catalogo.productos_activos == 1
    assert panel.catalogo.rotulado_pendiente == 1
    assert {a.clave: a.cumplen for a in panel.catalogo.avances} == {"receta": 0, "nutricion": 0, "rotulado": 0}
    assert panel.catalogo.pendientes[0].titulo == "Pan"

    # Quien solo opera no recibe el estado del catálogo.
    assert services.panel_produccion(db, _periodo(), None, False).catalogo is None
    # Un producto sin lotes no arrastra los de otro.
    assert services.panel_produccion(db, _periodo(), pan.id + 1, False).lotes_iniciados == 0


def test_elaborado_por_producto_en_kg(base):
    """Todo se compara en kg: las unidades se pesan con el peso por unidad."""
    db, hoy_dia = base["db"], hoy()
    kg = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa", factor_a_base=1000)
    un = UnidadMedida(nombre="Unidad", simbolo="un", tipo="unidad", factor_a_base=1)
    db.add_all([kg, un])
    db.flush()
    mermelada = Producto(nombre="Mermelada", unidad_medida_id=kg.id, activo=True)
    pan = Producto(nombre="Pan", unidad_medida_id=un.id, activo=True)
    alfajor = Producto(nombre="Alfajor", unidad_medida_id=un.id, activo=True)
    db.add_all([mermelada, pan, alfajor])
    db.flush()
    db.add(InfoNutricionalProducto(producto_id=pan.id, peso_unidad_g=Decimal("600")))
    cierre = _a_las(hoy_dia - timedelta(days=2))
    db.add_all([
        LoteProducto(
            numero_lote=f"LP-{i}", producto_id=producto.id, cantidad_objetivo=cantidad,
            cantidad_producida=cantidad, estado="terminado",
            fecha_inicio=_a_las(hoy_dia - timedelta(days=3)), fecha_cierre=cierre,
        )
        for i, (producto, cantidad) in enumerate(
            [(mermelada, Decimal("44")), (pan, Decimal("66")), (alfajor, Decimal("100"))]
        )
    ])
    db.commit()

    panel = services.panel_produccion(db, _periodo(), None, False)

    # 66 panes de 600 g son 39,6 kg: menos que los 44 kg de mermelada.
    assert [(c.etiqueta, c.valor, c.detalle) for c in panel.elaborado_por_producto] == [
        ("Mermelada", 44.0, None),
        ("Pan", 39.6, "66 un"),
    ]
    # Sin peso por unidad no se puede pasar a kg: va aparte, en su unidad.
    assert [(c.etiqueta, c.detalle) for c in panel.elaborado_sin_peso] == [("Alfajor", "100 un")]


def test_produccion_por_dia_por_cierre_unidad_y_producto(base):
    """Lo terminado cada día (de cierre), en la unidad de cada producto."""
    db, hoy_dia = base["db"], hoy()
    kg = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo="masa", factor_a_base=1000)
    un = UnidadMedida(nombre="Unidad", simbolo="un", tipo="unidad", factor_a_base=1)
    db.add_all([kg, un])
    db.flush()
    mermelada = Producto(nombre="Mermelada", unidad_medida_id=kg.id, activo=True)
    salsa = Producto(nombre="Salsa", unidad_medida_id=kg.id, activo=True)
    pan = Producto(nombre="Pan", unidad_medida_id=un.id, activo=True)
    db.add_all([mermelada, salsa, pan])
    db.flush()
    ayer, hace_tres = hoy_dia - timedelta(days=1), hoy_dia - timedelta(days=3)

    def lote(numero, producto, cantidad, cierre, estado="terminado"):
        return LoteProducto(
            numero_lote=numero, producto_id=producto.id, cantidad_objetivo=Decimal(cantidad),
            cantidad_producida=Decimal(cantidad) if estado == "terminado" else None, estado=estado,
            # Empezado antes del período: cuenta el día en que se terminó.
            fecha_inicio=_a_las(hoy_dia - timedelta(days=60)),
            fecha_cierre=_a_las(cierre) if cierre else None,
        )

    db.add_all([
        lote("LP-1", mermelada, "10.5", ayer),
        lote("LP-2", mermelada, "4", ayer),
        lote("LP-3", salsa, "20", ayer),
        lote("LP-4", pan, "66", ayer),
        lote("LP-5", salsa, "3", hace_tres),
        # Ni cancelados, ni en proceso, ni fuera del período.
        lote("LP-6", salsa, "50", ayer, estado="cancelado"),
        lote("LP-7", salsa, "50", None, estado="en_proceso"),
        lote("LP-8", salsa, "50", hoy_dia - timedelta(days=90)),
    ])
    db.commit()

    panel = services.panel_produccion(db, _periodo(), None, False)

    dias = {(d.fecha, d.unidad): d for d in panel.produccion_por_dia}
    assert set(dias) == {(ayer, "kg"), (ayer, "un"), (hace_tres, "kg")}
    kilos_ayer = dias[(ayer, "kg")]
    assert (kilos_ayer.cantidad, kilos_ayer.cantidad_lotes) == (34.5, 3)
    # De mayor a menor: la salsa (20) antes que la mermelada (14,5 en 2 lotes).
    assert [(p.producto, p.cantidad, p.cantidad_lotes) for p in kilos_ayer.productos] == [
        ("Salsa", 20.0, 1),
        ("Mermelada", 14.5, 2),
    ]
    assert dias[(ayer, "un")].cantidad == 66.0
    # Suma lo mismo que el ranking de lo elaborado en kg.
    elaborado_kg = sum(c.valor for c in panel.elaborado_por_producto if c.detalle is None)
    assert sum(d.cantidad for d in panel.produccion_por_dia if d.unidad == "kg") == elaborado_kg

    # El filtro por producto del panel también aplica.
    solo_pan = services.panel_produccion(db, _periodo(), pan.id, False)
    assert [(d.unidad, d.cantidad) for d in solo_pan.produccion_por_dia] == [("un", 66.0)]


# ─────────────────────────────────── Inicio ──────────────────────────────────


def test_panel_inicio_solo_cuenta_lo_de_hoy(base):
    """Las cifras son del día: lo de días anteriores no suma."""
    db, hoy_dia = base["db"], hoy()
    db.add_all([
        Incidente(
            titulo="Hoy", descripcion="x", tipo="plagas", usuario_id=base["admin"].id,
            fecha_reporte=_a_las(hoy_dia),
        ),
        Incidente(
            titulo="Antes", descripcion="x", tipo="plagas", usuario_id=base["admin"].id,
            fecha_reporte=_a_las(hoy_dia - timedelta(days=3)),
        ),
        # Calibración que vence justo hoy (última hace 30 días, cada 30).
        PlanCalibracionMantenimiento(
            equipo_id=base["horno"].id, autor_id=base["admin"].id, tipo="calibracion",
            fecha_ultima_intervencion=hoy_dia - timedelta(days=30), periodicidad_dias=30,
        ),
        # Vencida hace rato: no es "de hoy".
        PlanCalibracionMantenimiento(
            equipo_id=base["horno"].id, autor_id=base["admin"].id, tipo="mantenimiento",
            fecha_ultima_intervencion=hoy_dia - timedelta(days=100), periodicidad_dias=30,
        ),
    ])
    db.commit()

    inicio = services.panel_inicio(db, base["admin"], True)

    assert inicio.fecha == hoy_dia
    assert [g.clave for g in inicio.grupos] == ["produccion", "inventario", "calidad"]
    calidad = next(g for g in inicio.grupos if g.clave == "calidad")
    incidentes = next(c for c in calidad.cifras if c.clave == "incidentes")
    assert (incidentes.valor, incidentes.tono) == (1, "alerta")
    retiros = next(c for c in calidad.cifras if c.clave == "retiros")
    assert (retiros.valor, retiros.tono) == (0, "neutro")
    assert [v.estado for v in inicio.vencen_hoy] == ["Calibraciones"]
    # Sin planes de limpieza no hay tareas hoy: sin porcentaje, con la meta por defecto.
    assert (inicio.checklist.total, inicio.checklist.porcentaje) == (0, None)
    assert inicio.checklist.meta == META_CUMPLIMIENTO_LIMPIEZA_POR_DEFECTO


def test_panel_inicio_checklist_de_hoy(base):
    _checklist(base, dias_atras=2, completadas=0, total=5)
    _checklist(base, dias_atras=0, completadas=1, total=4)
    actualizar_meta_cumplimiento_limpieza(base["db"], 90)

    checklist = services.panel_inicio(base["db"], base["admin"], True).checklist

    # Solo el de hoy: 1 de 4.
    assert (checklist.total, checklist.completadas, checklist.porcentaje) == (4, 1, 25.0)
    assert checklist.meta == 90
    assert [(m.clave, m.cumplen, m.total) for m in checklist.por_momento] == [("operacional", 1, 4)]
    assert checklist.pendientes_total == 3
    assert checklist.pendientes[0].detalle.startswith("Limpieza del horno · ")


def test_panel_inicio_operador(base):
    _checklist(base, dias_atras=0, completadas=0, total=3)

    inicio = services.panel_inicio(base["db"], base["operador"], False)

    # Solo su checklist: las cifras de cada área son del tablero de administración.
    assert inicio.grupos == []
    assert inicio.vencen_hoy is None
    # Ve sus tareas y las sin asignar (la primera es suya, las otras de nadie).
    assert inicio.checklist.total == 3


# ─────────────────────────── Inventario y Personas ─────────────────────────


def test_panel_inventario_sin_datos(base):
    panel = services.panel_inventario(base["db"], _periodo(), None)

    assert panel.ingredientes_activos == 0
    assert panel.lotes_recibidos == 0
    assert panel.vencen_primero == []
    assert all(c.valor == 0 for c in panel.lotes_por_vencimiento)


def test_panel_personas(base):
    _checklist(base, dias_atras=2, completadas=3, total=4)

    panel = services.panel_personas(base["db"], _periodo())

    assert (panel.personal_activo, panel.personal_inactivo) == (2, 0)
    assert {c.clave: c.valor for c in panel.personal_por_rol} == {"admin": 1, "operador": 1}
    # Solo una de las cuatro tareas tiene operador asignado.
    assert (panel.tareas_asignadas, panel.tareas_completadas) == (1, 1)
    assert panel.cumplimiento_tareas == 100.0
    assert panel.cumplimiento_por_operador[0].etiqueta == "Omar Operador"
    assert (panel.clientes_activos, panel.transportistas_activos) == (0, 0)
