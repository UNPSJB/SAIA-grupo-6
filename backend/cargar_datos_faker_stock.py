"""Carga datos Faker, incluidos proveedores y el libro de stock químico.

Este cargador conserva el escenario general de ``cargar_datos_faker.py`` y
agrega datos consistentes para Gestión de stock: saldos, ingresos por lote,
ajustes y los consumos registrados por los checklists.

    .venv\\Scripts\\python.exe cargar_datos_faker_stock.py
    .venv\\Scripts\\python.exe cargar_datos_faker_stock.py --cantidad 40 --seed 7
    .venv\\Scripts\\python.exe cargar_datos_faker_stock.py --agregar
"""

import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from faker import Faker
from sqlalchemy import delete, select, text

import cargar_datos_faker as base
from src.database import SessionLocal
from src.auditoria.models import AuditLog
from src.auth.models import TokenRevocado
from src.Equipo.models import Calibracion
from src.insumoQuimico.models import (
    LoteStock,
    MovimientoStockInsumoQuimico,
    StockInsumoQuimico,
    TipoMovimientoStock,
)
from src.migrations import crear_tablas_y_migrar
from src.proveedores.models import Proveedor
from src.sector.models import Sector


_MIL = Decimal("0.001")


def _decimal(valor: object) -> Decimal:
    return Decimal(str(valor)).quantize(_MIL, rounding=ROUND_HALF_UP)


def _nombre_persona(persona) -> str:
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def borrar_todo(db) -> None:
    """Elimina primero las referencias del libro mayor y luego el catálogo."""
    orden = [
        # Se borra antes de Personal porque conserva una FK opcional a esa tabla.
        # La ejecución explícitamente omite auditoría: es un reinicio técnico,
        # no una operación de negocio, y los INSERT posteriores sí se auditan.
        AuditLog,
        LoteStock,
        MovimientoStockInsumoQuimico,
        StockInsumoQuimico,
        TokenRevocado,
        base.HistorialRegistroTarea,
        base.RegistroTarea,
        base.Checklist,
        base.HistorialIncidente,
        base.Incidente,
        base.VersionDocumento,
        base.Documento,
        base.VencimientoPersonal,
        Calibracion,
        base.PlanCalibracionMantenimiento,
        base.Tarea,
        base.PlanLimpieza,
        base.InsumoQuimico,
        base.Insumo,
        base.ElementoLimpieza,
        base.Aptitud,
        base.UnidadMedida,
        base.Equipo,
        Sector,
        Proveedor,
        base.Personal,
    ]
    for modelo in orden:
        db.execute(delete(modelo).execution_options(auditoria_omitir=True))
    db.flush()


def crear_proveedores(db, cantidad: int, fake: Faker, vistos: set[str]) -> list[Proveedor]:
    total = max(3, min(cantidad, 10))
    print(f"Cargando {total} proveedores...")
    proveedores = []
    for indice in range(total):
        matricula = base.unico(
            lambda: f"PRV-{random.randint(10_000, 99_999)}",
            vistos,
            largo=50,
        )
        nombre = base.recortar(fake.company(), 120) or f"Proveedor {indice + 1}"
        proveedor = Proveedor(nombre=nombre, matricula=matricula, activo=True)
        db.add(proveedor)
        proveedores.append(proveedor)
    db.flush()
    return proveedores


def crear_sectores(db) -> dict[str, Sector]:
    """Crea los sectores usados por el vocabulario de equipos si faltan."""
    nombres = sorted({ubicacion for _, _, ubicacion in base.VOCAB_EQUIPOS})
    existentes = {
        sector.nombre: sector
        for sector in db.scalars(select(Sector).where(Sector.nombre.in_(nombres))).all()
    }

    for nombre in nombres:
        if nombre not in existentes:
            sector = Sector(
                nombre=nombre,
                descripcion="Sector de prueba generado por Faker.",
                activo=True,
            )
            db.add(sector)
            existentes[nombre] = sector

    db.flush()
    return existentes


def crear_equipos(db, cantidad: int, vistos: dict, sectores: dict[str, Sector]) -> list:
    """Genera equipos vinculados a los sectores del esquema actual."""
    print(f"Cargando {cantidad} equipos...")
    equipos = []
    for _ in range(cantidad):
        nombre_base, tipo, ubicacion = random.choice(base.VOCAB_EQUIPOS)
        nombre = base.unico(
            lambda: f"{nombre_base} {random.randint(1, 30)}",
            vistos["equipo"],
            largo=100,
        )
        frecuencia = (
            random.choice([None, 90, 180, 365])
            if tipo == "Medición"
            else random.choice([None, None, 180, 365])
        )
        equipos.append(
            base.Equipo(
                nombre=base.recortar(nombre, 100),
                tipo=tipo,
                sector_id=sectores[ubicacion].id,
                activo=not base.bernoulli(0.06),
                frecuencia_calibracion_dias=frecuencia,
            )
        )

    db.add_all(equipos)
    db.flush()
    return equipos


def _crear_movimiento(
    *,
    insumo,
    cantidad: Decimal,
    tipo: TipoMovimientoStock,
    fecha: datetime,
    responsable,
    motivo: str | None = None,
    checklist_id: int | None = None,
    registro_tarea_id: int | None = None,
    checklist_fecha=None,
    tarea_nombre: str | None = None,
) -> MovimientoStockInsumoQuimico:
    return MovimientoStockInsumoQuimico(
        insumo_quimico_id=insumo.id,
        cantidad_variacion=cantidad,
        tipo=tipo,
        fecha=fecha,
        motivo=motivo,
        responsable_id=responsable.id,
        responsable_nombre=_nombre_persona(responsable),
        checklist_id=checklist_id,
        registro_tarea_id=registro_tarea_id,
        checklist_fecha=checklist_fecha,
        tarea_nombre=tarea_nombre,
        nombre_producto=insumo.nombre,
        unidad_simbolo=insumo.unidad_medida.simbolo,
    )


def _partir_ingreso(total: Decimal, partes: int) -> list[Decimal]:
    if partes == 1:
        return [total]
    primera = (total / partes).quantize(_MIL, rounding=ROUND_HALF_UP)
    resultado = [primera] * (partes - 1)
    resultado.append(total - sum(resultado))
    return resultado


def crear_stock_y_movimientos(db, quimicos, proveedores, admins, dias_checklist: int) -> tuple[int, int, int]:
    """Genera ingresos y refleja cada consumo de checklist en el libro mayor."""
    print("Cargando saldos, ingresos, lotes y movimientos de stock...")
    if not quimicos:
        return 0, 0, 0

    for quimico in quimicos:
        # Los productos que participan de los checklists deben figurar en stock.
        quimico.activo = True

    ids_quimicos = [quimico.id for quimico in quimicos]
    registros = db.scalars(
        select(base.RegistroTarea)
        .where(
            base.RegistroTarea.completado.is_(True),
            base.RegistroTarea.insumo_quimico_id.in_(ids_quimicos),
            base.RegistroTarea.cantidad_consumida.isnot(None),
        )
        .order_by(base.RegistroTarea.fecha_completado, base.RegistroTarea.id)
    ).all()

    consumos_por_insumo: dict[int, Decimal] = {insumo_id: Decimal("0") for insumo_id in ids_quimicos}
    for registro in registros:
        consumos_por_insumo[registro.insumo_quimico_id] += _decimal(registro.cantidad_consumida)

    stock_por_insumo = {}
    movimientos = 0
    lotes = 0
    responsable_ingreso = admins[0]

    for indice, quimico in enumerate(quimicos):
        consumo = consumos_por_insumo[quimico.id]
        reserva = _decimal(random.uniform(3, 10))
        cantidad_ingresada = consumo + reserva
        stock = StockInsumoQuimico(
            insumo_quimico_id=quimico.id,
            cantidad_actual=Decimal("0"),
        )
        db.add(stock)
        stock_por_insumo[quimico.id] = stock

        ingresos = _partir_ingreso(cantidad_ingresada, random.choice([1, 2]))
        for numero, cantidad in enumerate(ingresos, start=1):
            fecha = datetime.combine(
                base.HOY - timedelta(days=dias_checklist + random.randint(2, 45)),
                datetime.min.time(),
            ).replace(hour=random.randint(8, 17), minute=random.randint(0, 59))
            movimiento = _crear_movimiento(
                insumo=quimico,
                cantidad=cantidad,
                tipo=TipoMovimientoStock.INGRESO,
                fecha=fecha,
                responsable=responsable_ingreso,
            )
            db.add(movimiento)
            db.flush()
            db.add(
                LoteStock(
                    proveedor_id=random.choice(proveedores).id,
                    insumo_quimico_id=quimico.id,
                    numero_lote=f"FK-{quimico.id:04d}-{numero:02d}",
                    cantidad_producto=cantidad,
                    fecha_ingreso=fecha,
                    movimiento_ingreso_id=movimiento.id,
                )
            )
            stock.cantidad_actual += cantidad
            movimientos += 1
            lotes += 1

        # Muestra ambos tipos de ajuste sin llevar nunca el saldo a negativo.
        if indice % 5 == 0:
            ajuste = Decimal("1.000")
            db.add(
                _crear_movimiento(
                    insumo=quimico,
                    cantidad=ajuste,
                    tipo=TipoMovimientoStock.AJUSTE_POSITIVO,
                    fecha=datetime.now() - timedelta(days=1),
                    responsable=random.choice(admins),
                    motivo="Ajuste inicial por conteo fisico.",
                )
            )
            stock.cantidad_actual += ajuste
            movimientos += 1
        elif indice % 5 == 1:
            ajuste = Decimal("0.500")
            db.add(
                _crear_movimiento(
                    insumo=quimico,
                    cantidad=-ajuste,
                    tipo=TipoMovimientoStock.AJUSTE_NEGATIVO,
                    fecha=datetime.now() - timedelta(days=1),
                    responsable=random.choice(admins),
                    motivo="Ajuste inicial por conteo fisico.",
                )
            )
            stock.cantidad_actual -= ajuste
            movimientos += 1

    for registro in registros:
        cantidad = _decimal(registro.cantidad_consumida)
        insumo = next(quimico for quimico in quimicos if quimico.id == registro.insumo_quimico_id)
        responsable = db.get(base.Personal, registro.usuario_id) or responsable_ingreso
        fecha = registro.fecha_completado or datetime.now()
        checklist = db.get(base.Checklist, registro.checklist_id)
        db.add(
            _crear_movimiento(
                insumo=insumo,
                cantidad=-cantidad,
                tipo=TipoMovimientoStock.CONSUMO_AUTOMATICO,
                fecha=fecha,
                responsable=responsable,
                motivo="Consumo informado en checklist.",
                checklist_id=registro.checklist_id,
                registro_tarea_id=registro.id,
                checklist_fecha=checklist.fecha if checklist else None,
                tarea_nombre=registro.nombre_tarea_historico,
            )
        )
        stock_por_insumo[insumo.id].cantidad_actual -= cantidad
        movimientos += 1

    for indice, quimico in enumerate(quimicos):
        stock = stock_por_insumo[quimico.id]
        # Algunos productos quedan debajo del minimo para ejercitar alertas.
        if indice % 5 == 0:
            stock.stock_minimo = stock.cantidad_actual + Decimal("1.000")
        elif indice % 4 == 0:
            stock.stock_minimo = None
        else:
            stock.stock_minimo = max(Decimal("0.500"), stock.cantidad_actual / 2).quantize(
                _MIL, rounding=ROUND_HALF_UP
            )

    db.flush()
    return len(quimicos), lotes, movimientos


def main() -> int:
    args = base.parse_args()
    if args.cantidad < 1:
        print("--cantidad tiene que ser mayor a cero.")
        return 1
    if args.dias_checklist < 1:
        print("--dias-checklist tiene que ser mayor a cero.")
        return 1

    random.seed(args.seed or None)
    Faker.seed(args.seed or None)
    fake = Faker(args.locale)

    # create_all no altera instalaciones existentes; esta funcion tambien
    # aplica las migraciones requeridas por las tablas de stock.
    crear_tablas_y_migrar()
    db = SessionLocal()
    try:
        if db.bind and db.bind.dialect.name == "sqlite":
            # Fuerza las mismas restricciones que usan los endpoints.
            db.execute(text("PRAGMA foreign_keys = ON"))
        if args.agregar:
            print("Modo agregar: se conservan los datos existentes.")
        else:
            borrar_todo(db)

        vistos = {
            "dni": base.valores_existentes(db, base.Personal.dni),
            "email": base.valores_existentes(db, base.Personal.email),
            "telefono": base.valores_existentes(db, base.Personal.telefono),
            "incidente": set(db.scalars(select(base.Incidente.titulo)).all()),
            "equipo": set(db.scalars(select(base.Equipo.nombre)).all()),
            "aptitud": set(db.scalars(select(base.Aptitud.nombre)).all()),
            "plan": set(db.scalars(select(base.PlanLimpieza.nombre)).all()),
            "quimico": set(db.scalars(select(base.InsumoQuimico.nombre)).all()),
            "elemento": set(db.scalars(select(base.ElementoLimpieza.nombre)).all()),
            "insumo": set(db.scalars(select(base.Insumo.nombre)).all()),
            "unidad": set(db.scalars(select(base.UnidadMedida.nombre)).all()),
            "documento": set(db.scalars(select(base.Documento.nombre)).all()),
            "proveedor_matricula": set(db.scalars(select(Proveedor.matricula)).all()),
        }

        print("Hasheando la contrasena...")
        hash_password = base.hashear_password(args.password)
        unidades = base.crear_unidades(db, vistos)
        base.crear_configuracion_alertas(db)
        personal = base.crear_personal(db, args.cantidad, fake, vistos, hash_password)
        sectores = crear_sectores(db)
        equipos = crear_equipos(db, args.cantidad, vistos, sectores)
        aptitudes = base.crear_aptitudes(db, args.cantidad, vistos)
        admins = [persona for persona in personal if persona.puede_administrar]
        operadores = [persona for persona in personal if not persona.puede_administrar and persona.puede_operar]
        if not admins:
            admins = personal[:1]
        if not operadores:
            operadores = admins

        vencimientos = base.crear_vencimientos(db, personal, aptitudes)
        proveedores = crear_proveedores(db, args.cantidad, fake, vistos["proveedor_matricula"])
        quimicos = base.crear_quimicos(db, args.cantidad, unidades, vistos)
        elementos = base.crear_elementos(db, args.cantidad, vistos)
        base.crear_insumos(db, args.cantidad, unidades, vistos)
        planes = base.crear_planes_y_tareas(db, args.cantidad, equipos, admins, vistos)
        registros = base.crear_checklists(
            db, planes, operadores, quimicos, elementos, args.dias_checklist
        )
        saldos, lotes, movimientos = crear_stock_y_movimientos(
            db, quimicos, proveedores, admins, args.dias_checklist
        )
        incidentes = base.crear_incidentes(db, args.cantidad, equipos, personal, admins, operadores, vistos)
        documentos = base.crear_documentos(db, args.cantidad, admins, vistos)
        cal_mantenimiento = base.crear_planes_cal_mantenimiento(db, args.cantidad, equipos, admins)
        db.commit()

        print()
        print("Datos cargados con exito.")
        print(
            f"Personal: {len(personal)} | Sectores: {len(sectores)} | "
            f"Equipos: {len(equipos)} | Proveedores: {len(proveedores)}"
        )
        print(f"Productos quimicos con saldo: {saldos} | Lotes: {lotes} | Movimientos: {movimientos}")
        print(f"Vencimientos: {vencimientos} | Planes: {len(planes)} | Registros: {registros}")
        print(f"Incidentes: {incidentes} | Documentos: {documentos} | Calibracion/mantenimiento: {cal_mantenimiento}")
        print(f"Contrasena de todo el personal: {args.password}")
        return 0
    except Exception:
        db.rollback()
        print("Error al cargar datos:")
        import traceback

        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
