"""Carga datos de prueba para ver los indicadores de la vista pública.

Es un seed ADITIVO: no borra nada. Sirve para una base casi vacía donde la
vista pública todavía no tiene estadísticas que mostrar. Completa, solo si
faltan:

  * personas activas y sus vencimientos de aptitud (mínimo 5 para publicar);
  * equipos con planes de calibración y mantenimiento (algunos vencidos);
  * documentos con una versión vigente (algunos vencidos);
  * elementos de limpieza con recambio configurado;
  * planes de limpieza con checklists de los últimos 60 días, para que el
    cumplimiento de limpieza tenga período actual y anterior.

Es idempotente: se puede correr varias veces y no duplica filas. No toca la
selección de indicadores ni la configuración del enlace público.

    venv\\Scripts\\python.exe cargar_datos_vista_publica.py
"""

import sys
from datetime import datetime, time, timedelta
from pathlib import Path

from sqlalchemy import select

# Permite correr el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError, OSError):
        pass

from src.auth.services import hashear_password  # noqa: E402
from src.common.fechas import hoy  # noqa: E402
from src.config import CARPETA_UPLOADS, settings  # noqa: E402
from src.database import SessionLocal  # noqa: E402
import src.all_models  # noqa: F401,E402  (registra los modelos)
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.aptitud.models import Aptitud  # noqa: E402
from src.checklist.models import (  # noqa: E402
    Checklist,
    EstadoChecklist,
    RegistroTarea,
)
from src.documentos.models import Documento, VersionDocumento  # noqa: E402
from src.documentos.pdf_generator import ContextoDocumento, generar_pdf_documento  # noqa: E402
from src.elementoLimpieza.models import ElementoLimpieza  # noqa: E402
from src.Equipo.models import Equipo  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.PlanCalibracionMantenimiento.models import (  # noqa: E402
    PlanCalibracionMantenimiento,
)
from src.PlanLimpieza.models import PlanLimpieza  # noqa: E402
from src.sector.models import Sector  # noqa: E402
from src.tareas.models import Tarea  # noqa: E402
from src.vencimientoPersonal.models import VencimientoPersonal  # noqa: E402
from src.vistaPublica import services as vista_publica_services  # noqa: E402
from src.vistaPublica.models import ConfiguracionVistaPublica  # noqa: E402

HOY = hoy()
CONTRASENA_DEMO = "12345678"

# Personas de relleno: solo se crean si no hay suficientes activas. El DNI y
# el email son reconocibles para poder borrarlas si ya no se necesitan.
DEMO_PERSONAS = (
    ("Ana", "Demo", "90000001", "ana.demo@saia.local"),
    ("Bruno", "Demo", "90000002", "bruno.demo@saia.local"),
    ("Carla", "Demo", "90000003", "carla.demo@saia.local"),
    ("Diego", "Demo", "90000004", "diego.demo@saia.local"),
)

DEMO_APTITUDES = (
    ("Manipulación de Alimentos (demo)", "Curso de manipulación segura."),
    ("Carnet de Salud (demo)", "Carnet sanitario vigente."),
    ("Buenas Prácticas de Manufactura (demo)", "BPM aplicadas a la elaboración."),
)

# (nombre, tipo, sector, planes[(tipo, días desde la intervención, periodicidad)])
DEMO_EQUIPOS = (
    (
        "Heladera demo",
        "Refrigeración",
        "Cocina",
        (("calibracion", 20, 90), ("mantenimiento", 30, 180)),
    ),
    (
        "Freezer demo",
        "Conservación",
        "Cámara",
        (("calibracion", 20, 90), ("mantenimiento", 200, 180)),
    ),
    (
        "Horno demo",
        "Cocción",
        "Cocina",
        (("calibracion", 120, 90), ("mantenimiento", 30, 180)),
    ),
    (
        "Balanza demo",
        "Medición",
        "Laboratorio",
        (("mantenimiento", 30, 180),),
    ),
)

# (nombre, tipo, días hasta el vencimiento o None)
DEMO_DOCUMENTOS = (
    ("Manual de BPM (demo)", "manual_bpm", None),
    ("Procedimiento de limpieza (demo)", "procedimiento", 90),
    ("Ficha técnica de heladera (demo)", "ficha_tecnica", -10),
    ("Receta de flan (demo)", "receta", None),
)

# (nombre, frecuencia de recambio en días, días desde el último recambio)
DEMO_ELEMENTOS = (
    ("Trapo demo", 20, 5),
    ("Esponja demo", 15, 20),
    ("Guantes demo", 10, 3),
    ("Cepillo demo", 30, 40),
)

DEMO_PLANES = (
    (
        "Plan demo cocina",
        "Heladera demo",
        (
            ("Verificar temperatura (demo)", "preoperacional"),
            ("Limpiar estantes (demo)", "operacional"),
            ("Sanitizar manijas (demo)", "postoperacional"),
        ),
    ),
    (
        "Plan demo cámara",
        "Freezer demo",
        (
            ("Revisar burletes (demo)", "preoperacional"),
            ("Desinfectar interior (demo)", "operacional"),
            ("Barrer el piso (demo)", "postoperacional"),
        ),
    ),
)

# La ventana pública de limpieza son 30 días; el período anterior es el
# bloque de 30 días inmediatamente previo.
DIAS_VENTANA = 30
DIAS_HISTORIA = DIAS_VENTANA * 2


# ============================================================
# HELPERS
# ============================================================


def obtener_o_crear_sector(db, nombre: str) -> Sector:
    sector = db.scalar(select(Sector).where(Sector.nombre == nombre))
    if sector is None:
        sector = Sector(nombre=nombre, activo=True)
        db.add(sector)
        db.flush()
    return sector


def obtener_o_crear_equipo(db, nombre: str, tipo: str, sector: Sector) -> Equipo:
    equipo = db.scalar(select(Equipo).where(Equipo.nombre == nombre))
    if equipo is None:
        equipo = Equipo(
            nombre=nombre,
            tipo=tipo,
            sector_id=sector.id,
            activo=True,
        )
        db.add(equipo)
        db.flush()
    return equipo


def obtener_o_crear_aptitud(db, nombre: str, descripcion: str) -> Aptitud:
    aptitud = db.scalar(select(Aptitud).where(Aptitud.nombre == nombre))
    if aptitud is None:
        aptitud = Aptitud(nombre=nombre, descripcion=descripcion, activo=True)
        db.add(aptitud)
        db.flush()
    return aptitud


# ============================================================
# SEED
# ============================================================


def asegurar_admin(db) -> Personal:
    """Devuelve un admin activo; si no hay ninguno, crea uno de demo."""
    admin = db.scalar(
        select(Personal).where(
            Personal.puede_administrar.is_(True),
            Personal.activo.is_(True),
        )
    )
    if admin is not None:
        return admin

    admin = db.scalar(select(Personal).where(Personal.dni == "90000000"))
    if admin is None:
        admin = Personal(
            nombre="Admin",
            apellido="Demo",
            dni="90000000",
            email="admin.demo@saia.local",
            password=hashear_password(CONTRASENA_DEMO),
            puede_operar=True,
            puede_administrar=True,
            es_super_admin=True,
            activo=True,
        )
        db.add(admin)
        db.flush()
    return admin


def asegurar_personal(db) -> list[Personal]:
    """Al menos 6 personas activas: el indicador exige 5 para publicarse."""
    personas = list(
        db.scalars(select(Personal).where(Personal.activo.is_(True))).all()
    )
    hash_password = hashear_password(CONTRASENA_DEMO)

    for nombre, apellido, dni, email in DEMO_PERSONAS:
        if len(personas) >= 6:
            break
        if db.scalar(select(Personal).where(Personal.dni == dni)) is not None:
            continue
        persona = Personal(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            email=email,
            password=hash_password,
            puede_operar=True,
            puede_administrar=False,
            es_super_admin=False,
            activo=True,
        )
        db.add(persona)
        db.flush()
        personas.append(persona)

    return personas


def sembrar_vencimientos(db, personas, aptitudes) -> None:
    if not aptitudes:
        return

    existentes = set(
        db.execute(
            select(VencimientoPersonal.persona_id, VencimientoPersonal.aptitud_id)
        ).all()
    )

    for indice, persona in enumerate(personas):
        for offset in range(2):
            aptitud = aptitudes[(indice + offset) % len(aptitudes)]
            clave = (persona.id, aptitud.id)
            if clave in existentes:
                continue

            # Dos de cada tres vencimientos quedan vigentes; el resto vencidos.
            dias = 60 if (indice + offset) % 3 != 0 else -15
            db.add(
                VencimientoPersonal(
                    persona_id=persona.id,
                    aptitud_id=aptitud.id,
                    fecha_vencimiento=HOY + timedelta(days=dias),
                    activo=True,
                )
            )
            existentes.add(clave)

    db.flush()


def sembrar_equipos_y_planes(db, autor: Personal) -> list[Equipo]:
    equipos = []
    for nombre, tipo, sector_nombre, planes in DEMO_EQUIPOS:
        sector = obtener_o_crear_sector(db, sector_nombre)
        equipo = obtener_o_crear_equipo(db, nombre, tipo, sector)
        equipos.append(equipo)

        for tipo_plan, dias_desde, periodicidad in planes:
            existente = db.scalar(
                select(PlanCalibracionMantenimiento).where(
                    PlanCalibracionMantenimiento.equipo_id == equipo.id,
                    PlanCalibracionMantenimiento.tipo == tipo_plan,
                    PlanCalibracionMantenimiento.activo.is_(True),
                )
            )
            if existente is not None:
                continue
            db.add(
                PlanCalibracionMantenimiento(
                    equipo_id=equipo.id,
                    autor_id=autor.id,
                    tipo=tipo_plan,
                    fecha_ultima_intervencion=HOY - timedelta(days=dias_desde),
                    periodicidad_dias=periodicidad,
                    activo=True,
                )
            )

    db.flush()
    return equipos


def sembrar_documentos(db, autor: Personal) -> None:
    carpeta = CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)

    for nombre, tipo, dias_hasta_vencimiento in DEMO_DOCUMENTOS:
        if db.scalar(select(Documento).where(Documento.nombre == nombre)) is not None:
            continue

        documento = Documento(nombre=nombre, tipo=tipo)
        db.add(documento)
        db.flush()

        vencimiento = (
            HOY + timedelta(days=dias_hasta_vencimiento)
            if dias_hasta_vencimiento is not None
            else None
        )
        estado = "vencido" if (vencimiento and vencimiento < HOY) else "vigente"
        pdf_bytes = generar_pdf_documento(
            ContextoDocumento(
                nombre=nombre,
                tipo=tipo,
                numero_version=1,
                identificador=f"SAIA-DOC-{documento.id:04d}",
                fecha_emision=HOY,
                fecha_vencimiento=vencimiento,
                estado=estado,
                autor=f"{autor.nombre} {autor.apellido or ''}".strip(),
                documento_id=documento.id,
            )
        )
        nombre_archivo = f"demo-{documento.id}.pdf"
        (carpeta / nombre_archivo).write_bytes(pdf_bytes)
        db.add(
            VersionDocumento(
                documento_id=documento.id,
                numero_version=1,
                nombre_archivo=f"{nombre}.pdf",
                archivo_url=f"uploads/documentos/{nombre_archivo}",
                vigente=True,
                fecha_vencimiento=(
                    HOY + timedelta(days=dias_hasta_vencimiento)
                    if dias_hasta_vencimiento is not None
                    else None
                ),
                autor_id=autor.id,
            )
        )

    db.flush()


def sembrar_elementos(db) -> None:
    for nombre, frecuencia, dias_desde in DEMO_ELEMENTOS:
        if db.scalar(select(ElementoLimpieza).where(ElementoLimpieza.nombre == nombre)):
            continue
        db.add(
            ElementoLimpieza(
                nombre=nombre,
                frecuencia_recambio_dias=frecuencia,
                fecha_ultimo_recambio=HOY - timedelta(days=dias_desde),
                activo=True,
            )
        )
    db.flush()


def sembrar_planes_limpieza(db, equipos, autor: Personal) -> list[PlanLimpieza]:
    por_nombre = {equipo.nombre: equipo for equipo in equipos}
    planes = []

    for nombre_plan, nombre_equipo, tareas in DEMO_PLANES:
        plan = db.scalar(select(PlanLimpieza).where(PlanLimpieza.nombre == nombre_plan))
        if plan is None:
            plan = PlanLimpieza(
                nombre=nombre_plan,
                equipo_id=por_nombre[nombre_equipo].id,
                autor_id=autor.id,
                activo=True,
            )
            for nombre_tarea, tipo in tareas:
                plan.tareas.append(
                    Tarea(
                        nombre=nombre_tarea,
                        frecuencia=1,
                        tipo=tipo,
                        descripcion=f"Procedimiento de prueba para {nombre_tarea}.",
                    )
                )
            db.add(plan)
            db.flush()
        planes.append(plan)

    return planes


def sembrar_checklists(db, planes, autor: Personal) -> None:
    """60 días de checklists: 30 actuales (mejor) y 30 anteriores (peor).

    Así el indicador de limpieza tiene con qué comparar y muestra una mejora,
    que es lo único que la vista pública publica como tendencia.
    """
    for plan in planes:
        fechas_existentes = set(
            db.scalars(
                select(Checklist.fecha).where(Checklist.plan_id == plan.id)
            ).all()
        )

        for delta in range(DIAS_HISTORIA + 1):
            # El día 30 no pertenece a ninguna de las dos ventanas.
            if delta == DIAS_VENTANA:
                continue
            fecha = HOY - timedelta(days=delta)
            if fecha in fechas_existentes:
                continue

            es_actual = delta < DIAS_VENTANA
            completadas = 3 if (es_actual and delta % 5 != 0) else 2

            checklist = Checklist(
                equipo_id=plan.equipo_id,
                plan_id=plan.id,
                fecha=fecha,
                estado=(
                    EstadoChecklist.ABIERTO if delta == 0 else EstadoChecklist.CERRADO
                ),
            )
            db.add(checklist)
            db.flush()

            for indice, tarea in enumerate(plan.tareas):
                completado = indice < completadas
                db.add(
                    RegistroTarea(
                        checklist_id=checklist.id,
                        tarea_id=tarea.id,
                        nombre_tarea_historico=tarea.nombre,
                        descripcion_tarea_historico=tarea.descripcion,
                        tipo_tarea_historico=tarea.tipo,
                        completado=completado,
                        fecha_completado=(
                            datetime.combine(fecha, time(11, 0)) if completado else None
                        ),
                        usuario_id=autor.id if completado else None,
                    )
                )

        db.flush()


# ============================================================
# MAIN
# ============================================================


def main(preparar_esquema: bool = True) -> None:
    db = SessionLocal()
    # El seed no audita: la bitácora registra operaciones de negocio, no la
    # construcción del escenario de prueba.
    db.info["sin_auditoria"] = True

    try:
        if preparar_esquema:
            crear_tablas_y_migrar()
        print("⏳ Preparando datos de prueba de la vista pública...")

        autor = asegurar_admin(db)
        personas = asegurar_personal(db)

        aptitudes = [
            obtener_o_crear_aptitud(db, nombre, descripcion)
            for nombre, descripcion in DEMO_APTITUDES
        ]
        sembrar_vencimientos(db, personas, aptitudes)

        equipos = sembrar_equipos_y_planes(db, autor)
        sembrar_documentos(db, autor)
        sembrar_elementos(db)

        planes = sembrar_planes_limpieza(db, equipos, autor)
        sembrar_checklists(db, planes, autor)

        db.commit()
        print("✅ Datos de prueba cargados.")

        configuracion = db.get(ConfiguracionVistaPublica, 1)
        if configuracion is not None and configuracion.habilitada and configuracion.codigo_publico:
            base = (settings.PUBLIC_APP_URL or "http://localhost:5173").rstrip("/")
            print(f"🔗 Vista pública: {base}/publico/{configuracion.codigo_publico}")
        else:
            print("ℹ️  La vista pública está desactivada; activala desde /vista-publica.")

        print("\n📊 Indicadores que verá el público:")
        indicadores = vista_publica_services.indicadores_publicos(db)
        if not indicadores:
            print("   (todavía ninguno; revisá que estén habilitados en el panel)")
        for indicador in indicadores:
            tendencia = (
                f" (mejora +{indicador['tendencia']} pts)"
                if indicador.get("tendencia")
                else ""
            )
            print(
                f"   • {indicador['etiqueta']}: {indicador['valor']} %{tendencia}"
            )

        print(f"\n🔑 Personas demo: contraseña {CONTRASENA_DEMO}")
        for persona in personas:
            if persona.dni.startswith("9000000"):
                print(f"   • {persona.nombre} {persona.apellido} — DNI {persona.dni}")

    except Exception as error:
        db.rollback()
        print(f"❌ Error al cargar los datos de prueba: {error}")
        import traceback

        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
