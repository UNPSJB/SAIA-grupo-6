"""Carga de datos de ejemplo generados con Faker.

Es la alternativa generativa a `cargar_datos.py`: aquel tiene un escenario
curado a mano (15 filas por entidad, pensadas para una demo), este produce
volúmenes configurables y reproducibles, útiles para probar paginación,
filtros y listados en general.

    .venv\\Scripts\\python.exe cargar_datos_faker.py
    .venv\\Scripts\\python.exe cargar_datos_faker.py --cantidad 40
    .venv\\Scripts\\python.exe cargar_datos_faker.py --cantidad 200 --dias-checklist 30
    .venv\\Scripts\\python.exe cargar_datos_faker.py --seed 7      # repetible

Faker se usa para lo que le sobra: identidad de las personas (nombre, DNI,
teléfono, email), frases y horas. Para las entidades del dominio (equipos,
productos químicos, tareas, incidentes) se usan vocabularios del rubro
combinados al azar: `fake.word()` devolvería cosas como "Cocina warned" y la
base quedaría inservible para probar la aplicación.

Por defecto reemplaza los datos (igual que `cargar_datos.py`); con `--agregar`
conserva lo que hay y agrega nuevas filas sin chocar con los UNIQUE.
"""

import argparse
import random
import re
import sys
import unicodedata
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from faker import Faker
from sqlalchemy import delete, select

# Permite correr el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

# La consola de Windows arranca en cp1252 y no puede codificar los emojis del
# resumen: sin esto el script revienta al final, con datos ya cargados, y el
# error real queda tapado por un UnicodeEncodeError.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError, OSError):
        pass  # salida redireccionada a un archivo: se deja como está

from src.database import SessionLocal, engine  # noqa: E402
from src.models import ModeloBase  # noqa: E402
import src.all_models  # noqa: F401,E402  (registra los modelos)
from src.auth.services import hashear_password  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.Equipo.models import Equipo  # noqa: E402
from src.aptitud.models import Aptitud  # noqa: E402
from src.vencimientoPersonal.models import VencimientoPersonal  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.insumos.models import Insumo  # noqa: E402
from src.insumoQuimico.models import InsumoQuimico, TipoQuimico  # noqa: E402
from src.elementoLimpieza.models import ElementoLimpieza  # noqa: E402
from src.PlanLimpieza.models import PlanLimpieza  # noqa: E402
from src.tareas.models import Tarea  # noqa: E402
from src.tareas.constants import TipoTarea  # noqa: E402
from src.incidente.models import Incidente, HistorialIncidente  # noqa: E402
from src.incidente.constants import TipoIncidente, EstadoIncidente  # noqa: E402
from src.checklist.models import (  # noqa: E402
    Checklist,
    RegistroTarea,
    HistorialRegistroTarea,
    EstadoChecklist,
)
from src.PlanCalibracionMantenimiento.models import (  # noqa: E402
    PlanCalibracionMantenimiento,
)
from src.documentos.models import Documento, VersionDocumento  # noqa: E402
from src.documentos.constants import TipoDocumento  # noqa: E402
from src.config import CARPETA_UPLOADS  # noqa: E402

# Asegura que las tablas existan antes de insertar (idempotente).
ModeloBase.metadata.create_all(bind=engine)

CONTRASENA_POR_DEFECTO = "12345678"
DOMINIO_EMAIL = "alimentosdelsur.com.ar"
HOY = date.today()

# Incidentes que se le asignan al superadmin como reportante: la vista
# "Mis reportes" pagina de a 10, así que con 12 ya hay segunda página.
CANTIDAD_INCIDENTES_SUPERADMIN = 12


# ============================================================
# HELPERS
# ============================================================

# `nombre` de persona, plan y tarea se validan con RE_NOMBRE_SOLO_LETRAS:
# solo letras (con tildes/ñ) y espacios. Ni dígitos ni guiones.
_RE_NO_LETRAS = re.compile(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]")


def solo_letras(valor: str) -> str:
    """Deja solo letras y espacios, como exige RE_NOMBRE_SOLO_LETRAS."""
    return re.sub(r"\s+", " ", _RE_NO_LETRAS.sub(" ", valor or "")).strip()


def recortar(valor: str, largo: int) -> str:
    """Recorta al largo de la columna y quita espacios sobrantes."""
    return (valor or "")[:largo].strip()


def slug(valor: str) -> str:
    """Pasa a ASCII sin acentos, para armar emails válidos."""
    normal = unicodedata.normalize("NFKD", valor or "")
    return re.sub(r"[^a-zA-Z0-9]+", "", normal).lower()


def email_unico(base: str, indice: int, vistos: set) -> str:
    """Arma un email único que cumpla RE_EMAIL y entre en 60 caracteres.

    No se usa `unico()` a propósito: su fallback agrega letras al final, y en
    un email eso lo deja sin dominio (`nombre@dominio abcd`). Acá la
    desambiguación va antes del `@`, así que el resultado siempre es válido.
    """
    for intento in range(1, 1000):
        sufijo = "" if intento == 1 else f".{intento}"
        # Se reserva el lugar del sufijo, la arroba y el dominio.
        disponible = 60 - len(sufijo) - len(DOMINIO_EMAIL) - 1
        correo = f"{base[:disponible]}{sufijo}@{DOMINIO_EMAIL}"
        if correo not in vistos:
            vistos.add(correo)
            return correo
    raise RuntimeError("No se pudo generar un email único")


def unico(generador, vistos: set, largo: int = 0, intentos: int = 500) -> str:
    """Devuelve un valor nuevo cada vez, reintentando si se repite.

    Faker puede repetir (sobre todo con volúmenes altos), y casi todas las
    tablas del dominio tienen UNIQUE. Si se agota la fuente, se desambigua con
    un sufijo de letras, que sigue siendo válido para RE_NOMBRE_SOLO_LETRAS.

    `largo` es el límite de la columna: el sufijo tiene que entrar dentro, así
    que el nombre se recorta ANTES de agregarlo. Sin esto, los nombres que ya
    rozaban el límite se pasaban 5 caracteres por encima de la columna.
    """
    for _ in range(intentos):
        valor = generador()
        if valor and valor not in vistos:
            vistos.add(valor)
            return valor

    # Reserva: agrega letras aleatorias al final hasta salir del conflicto.
    sufijo = " " + "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(4))
    while True:
        base = generador()
        if largo:
            base = base[: largo - len(sufijo)].rstrip()
        valor = (base + sufijo).strip()
        if valor not in vistos:
            vistos.add(valor)
            return valor


def hora_aleatoria(dias_atras_max: int = 180, hora_min: int = 6, hora_max: int = 22) -> datetime:
    """Un momento de los últimos días, para `fecha_creacion`.

    Sin esto, `fecha_creacion` caería siempre en hoy y con hora aleatoria,
    lo que deja registros "creados en el futuro" a partir de la medianoche.
    """
    dia = HOY - timedelta(days=random.randint(0, dias_atras_max))
    return datetime.combine(dia, datetime.min.time()).replace(
        hour=random.randint(hora_min, hora_max),
        minute=random.randint(0, 59),
    )


def bernoulli(p: float) -> bool:
    return random.random() < p


# ============================================================
# VOCABULARIOS DEL DOMINIO
# ============================================================

# (nombre base, tipo, ubicación)
VOCAB_EQUIPOS = [
    ("Heladera", "Refrigeración", "Cocina"),
    ("Freezer", "Conservación", "Cámara"),
    ("Cámara de frío", "Conservación", "Cámara"),
    ("Horno combinado", "Cocción", "Cocina"),
    ("Freidora", "Cocción", "Cocina"),
    ("Anafe industrial", "Cocción", "Cocina"),
    ("Balanza de precisión", "Medición", "Laboratorio"),
    ("Balanza de plataforma", "Medición", "Zona de elaboración"),
    ("Termómetro digital", "Medición", "Cocina"),
    ("Licuadora industrial", "Procesamiento", "Zona de elaboración"),
    ("Cortadora de fiambres", "Procesamiento", "Zona de elaboración"),
    ("Amasadora", "Procesamiento", "Zona de elaboración"),
    ("Lavavajillas industrial", "Procesamiento", "Lavadero"),
    ("Sobadora", "Procesamiento", "Zona de elaboración"),
    ("Envasadora", "Procesamiento", "Línea deemplace"),
    ("Peladora de papas", "Procesamiento", "Cocina"),
    ("Mesa de acero", "Sanitización", "Zona de elaboración"),
    ("Batea de amasado", "Sanitización", "Zona de elaboración"),
]

VOCAB_APTITUDES = [
    ("Manipulación de Alimentos", "Curso básico de manipulación segura de alimentos."),
    ("Buenas Prácticas de Manufactura", "BPM aplicadas a la elaboración."),
    ("Carnet de Salud", "Carnet sanitario vigente para Manipular alimentos."),
    ("Seguridad e Higiene", "Higiene y seguridad en el puesto de trabajo."),
    ("Manejo de Productos Químicos", "Uso correcto de detergentes y desinfectantes."),
    ("Primeros Auxilios", "Asistencia básica ante accidentes laborales."),
    ("Uso de Matafuegos", "Manejo de extintores ante principio de incendio."),
    ("Cuidado de la Cadena de Frío", "Monitoreo de temperaturas en cámaras y heladeras."),
    ("Frío Industrial", "Operación y mantenimiento de frío industrial."),
    ("Riesgo Eléctrico", "Trabajo seguro con equipos conectados a la red."),
    ("Análisis APPCC", "Puntos críticos de control en el proceso."),
    ("Operación de Equipos de Cocina", "Uso seguro de hornos, freidoras y anafes."),
    ("Higiene Ambiental", "Limpieza y sanidad del ambiente de trabajo."),
    ("Identificación de Plagas", "Detección temprana de roedores e insectos."),
    ("Elaboración de Comidas", "Preparación de comidas en servicio de buffet."),
    ("Trazabilidad de Alimentos", "Registro y seguimiento de lotes elaborated."),
    ("Manejo de Residuos", "Separación y disposición de residuos Hazardosos."),
    ("Prevención de Contaminación Cruzada", "Alérgenos y separación de productos."),
]

# (nombre, tipo químico)
VOCAB_QUIMICOS = [
    ("Lavandina concentrada", TipoQuimico.DESINFECTANTE),
    ("Detergente biodegradable", TipoQuimico.DETERGENTE),
    ("Desengrasante para hornos", TipoQuimico.DESENGRASANTE),
    ("Alcohol 70", TipoQuimico.SANITIZANTE),
    ("Sanitizante para frutas y verduras", TipoQuimico.SANITIZANTE),
    ("Desinfectante de superficies", TipoQuimico.DESINFECTANTE),
    ("Limpiavidrios", TipoQuimico.DETERGENTE),
    ("Quita grasa industrial", TipoQuimico.DESENGRASANTE),
    ("Jabón antibacterial para manos", TipoQuimico.DETERGENTE),
    ("Hipoclorito de sodio", TipoQuimico.DESINFECTANTE),
    ("Desincrustante de acero inoxidable", TipoQuimico.DESENGRASANTE),
    ("Sanitizante de manos alcohólico", TipoQuimico.SANITIZANTE),
    ("Desodorante de ambiente", TipoQuimico.DETERGENTE),
    ("Solución yodada", TipoQuimico.DESINFECTANTE),
    ("Limpiador multiuso", TipoQuimico.DETERGENTE),
    ("Detergente Neutro Concentrado", TipoQuimico.DETERGENTE),
    ("Desinfectante Aniónico", TipoQuimico.DESINFECTANTE),
    ("Enjuague Sanitizante", TipoQuimico.SANITIZANTE),
    ("Removedor de Saratinas", TipoQuimico.DESENGRASANTE),
    ("Cloro Gel", TipoQuimico.DESINFECTANTE),
]

# (nombre, frecuencia de recambio en días o None)
VOCAB_ELEMENTOS = [
    ("Esponja multiuso", 15),
    ("Trapo de microfibra", 20),
    ("Cepillo de cerdas duras", 30),
    ("Escobillón", 45),
    ("Recogedor", None),
    ("Balde de 20 litros", None),
    ("Guantes de látex", 10),
    ("Guantes de nitrilo", 10),
    ("Trapeador de piso", 25),
    ("Pulverizador de un litro", 30),
    ("Paño de algodón", 15),
    ("Cepillo para vajilla", 20),
    ("Rasquete de piso", 60),
    ("Peine limpiador de juntas", 90),
    ("Escobilla sanitaria", 45),
    ("Esponja con fibra abrasiva", 20),
    ("Cubreboca descartable", 7),
    ("Cofia para el pelo", 30),
    ("Cinta de enmascarar", 45),
    ("Bolsa de residuos", None),
]

# Catálogo fijo, no escala con `--cantidad`. Son doce (y no las cinco
# históricas) para que el listado de unidades de medida supere las 10 filas
# de una página y se pueda probar su paginación también.
UNIDADES = [
    ("kilogramo", "kg"),
    ("litro", "L"),
    ("unidad", "u"),
    ("gramo", "g"),
    ("mililitro", "mL"),
    ("tonelada", "t"),
    ("miligramo", "mg"),
    ("centímetro cúbico", "cm³"),
    ("metro", "m"),
    ("centímetro", "cm"),
    ("hora", "h"),
    ("docena", "doc"),
]

# (nombre, clave de unidad, cantidad de tareas que suele tener)
VOCAB_PLANES = [
    ("Limpieza diaria de heladeras", "litro", (2, 4)),
    ("Desinfección de cámara de frío", "litro", (3, 5)),
    ("Mantenimiento de equipos de cocción", "litro", (3, 5)),
    ("Sanitización de zona de elaboración", "mililitro", (3, 6)),
    ("Limpieza de zona deLavadero", "litro", (2, 4)),
    ("Control de cadena de frío", "unidad", (2, 4)),
    ("Limpieza de equipos de medición", "mililitro", (2, 4)),
    ("Higiene de mesas de trabajo", "litro", (2, 4)),
]

VOCAB_TAREAS = [
    "Verificar temperatura interna",
    "Limpiar estantes y bandejas",
    "Sanitizar manijas y burletes",
    "Desinfectar superficies de contacto",
    "Lavar y secar el interior",
    "Revisar el cierre de puertas",
    "Retirar restos y agentes grasosos",
    "Desengrasar componentes internos",
    "Sanitizar filtros y rejillas",
    "Limpiar rodillos y guías",
    "Controlar el estado del cable",
    "Revisar burletes y sellos",
    "Desinfectar piso y desagüe",
    "Limpiar bandejas y rejillas",
    "Verificar el tarado del equipo",
    "Reponer insumos de limpieza",
]

# Palabras clave que definen el producto y el insumo que usa cada tarea.
CONSUMO_POR_PALABRA = [
    (("temperatura", "termostato", "tarado", "verificar"), None),
    (("desengras", "grasa", "horno"), ("Desengrasante para hornos", "Quita grasa industrial")),
    (("sanitiz", "desinfect", "manija"), ("Lavandina concentrada", "Desinfectante de superficies")),
    (("piso", "desagüe", "barrido"), ("Desinfectante de superficies", "Limpiador multiuso")),
    (("lavar", "limpiar", "limpieza"), ("Detergente biodegradable", "Limpiador multiuso")),
]

OBSERVACIONES = [
    "Usar guantes de nitrilo durante toda la operación.",
    "El paño de sanitizado se cambia después de cada uso.",
    "No usar agua hirviendo: daña los sellos.",
    "Prestar atención a las esquinas y debajo de los estantes.",
    "Registrar la operación en la planilla del sector.",
    "Dejar secar completamente antes de reponer los productos.",
    "No mezclar con otros productos químicos.",
    "Verificar la concentración antes de aplicar.",
    "Trabajar con el equipo desenchufado.",
    "El personal debe usar equipo de protección adecuada.",
]


def _descripcion_tarea(equipo_nombre: str) -> str:
    """Arma un procedimiento paso a paso creíble para la tarea."""
    pasos = [
        f"Retirar los productos y las piezas sueltas de {equipo_nombre}.",
        "Aplicar el producto de limpieza diluido según el fabricante.",
        "Frotar con el elemento asignado hasta cubrir toda la superficie.",
        "Enjuagar con agua potable en el caso de superficies de contacto con alimentos.",
        "Sanitizar y dejar secar al aire.",
        "Reponer las piezas en su lugar y registrar la operación.",
    ]
    cantidad = random.randint(3, len(pasos))
    elegidas = random.sample(pasos, cantidad)
    return "\n".join(f"{i}. {p}" for i, p in enumerate(elegidas, start=1))


# (tipo de incidente, título, descripción)
VOCAB_INCIDENTES = [
    (
        TipoIncidente.FALLA_EQUIPO,
        "El equipo no alcanza la temperatura esperada",
        "El termómetro de control marca una diferencia consistente con la lectura del equipo. Se sospecha desgaste del sistema de frío.",
    ),
    (
        TipoIncidente.FALLA_EQUIPO,
        "Goteo de agua en la puerta",
        "Se acumula agua en el piso frente al equipo, con goteo constante por la puerta.",
    ),
    (
        TipoIncidente.HIGIENE_CONTAMINACION,
        "Superficie de contacto sin sanitizar",
        "Se detectó residuo en una superficie que entra en contacto directo con alimentos.",
    ),
    (
        TipoIncidente.HIGIENE_CONTAMINACION,
        "Alimento fuera del rango de temperatura",
        "Se detectó mercadería que conserva fuera del rango de temperatura permitido.",
    ),
    (
        TipoIncidente.PLAGAS,
        "Indicios de actividad de plagas",
        "Se observaron marcas y residuo cerca de la zona de almacenamiento de secos.",
    ),
    (
        TipoIncidente.DEVOLUCION_CLIENTE,
        "Devolución por producto en mal estado",
        "El cliente devolvió el producto por presentación y conservación deficientes.",
    ),
    (
        TipoIncidente.OTRO,
        "Falta de elemento de protección",
        "Se detectó que un elemento de limpieza del plan no está disponible en el sector.",
    ),
    (
        TipoIncidente.OTRO,
        "Desvío de temperatura en cámara",
        "El registro de temperatura de la cámara quedó fuera de rango durante varias horas.",
    ),
]

# (base del nombre, tipo de documento)
VOCAB_DOCUMENTOS = [
    ("Manual de Buenas Prácticas de Manufactura", TipoDocumento.MANUAL_BPM),
    ("Manual de Higiene y Seguridad", TipoDocumento.MANUAL_BPM),
    ("Plan de Capacitación Anual", TipoDocumento.MANUAL_BPM),
    ("Procedimiento de Limpieza y Desinfección", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Manipulación de Alimentos", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Control de Plagas", TipoDocumento.PROCEDIMIENTO),
    ("Procedimiento de Trazabilidad de Lotes", TipoDocumento.PROCEDIMIENTO),
    ("Protocolo de Acción ante Incidentes", TipoDocumento.PROCEDIMIENTO),
    ("Ficha técnica de Heladera", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Cámara de frío", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Horno combinado", TipoDocumento.FICHA_TECNICA),
    ("Ficha técnica de Balanza de precisión", TipoDocumento.FICHA_TECNICA),
    ("Receta de Flan casero", TipoDocumento.RECETA),
    ("Receta de Pan de mesa", TipoDocumento.RECETA),
    ("Receta de Mousse de chocolate", TipoDocumento.RECETA),
]


# ============================================================
# GENERADORES
# ============================================================

def borrar_todo(db) -> None:
    """Limpia las tablas que el seed va a rellenar (orden: hijos primero)."""
    orden = [
        HistorialRegistroTarea,
        RegistroTarea,
        Checklist,
        HistorialIncidente,
        Incidente,
        VersionDocumento,
        Documento,
        VencimientoPersonal,
        PlanCalibracionMantenimiento,
        Tarea,
        PlanLimpieza,
        InsumoQuimico,
        Insumo,
        ElementoLimpieza,
        Aptitud,
        UnidadMedida,
        Equipo,
        Personal,
    ]
    for modelo in orden:
        db.execute(delete(modelo))
    db.flush()


def valores_existentes(db, columna) -> set:
    """Valores ya presentes en la columna, para no chocar en modo `--agregar`."""
    return set(db.scalars(select(columna)).all())


def crear_unidades(db, vistos: dict) -> dict:
    """Unidades de medida: catálogo fijo, no escala con `--cantidad`.

    Se crean las doce de `UNIDADES` (menos las que ya existan en modo
    `--agregar`): el resto del seed elige al azar entre ellas para las
    unidades de los insumos.
    """
    print("⏳ Cargando unidades de medida...")
    for nombre, simbolo in UNIDADES:
        if nombre in vistos["unidad"]:
            continue
        db.add(UnidadMedida(nombre=nombre, simbolo=simbolo))
        vistos["unidad"].add(nombre)
    db.flush()
    return {u.nombre: u for u in db.query(UnidadMedida).all()}


def crear_personal(db, cantidad: int, fake: Faker, vistos: dict, hash_password: str) -> list:
    """Personas: 1 super admin, ~15% administradores y el resto operadores."""
    print(f"⏳ Cargando {cantidad} personas...")
    personas = []
    emails, dnis = vistos["email"], vistos["dni"]

    for i in range(cantidad):
        nombre = recortar(solo_letras(fake.first_name()), 40)
        apellido = recortar(solo_letras(fake.last_name()), 40)

        es_super_admin = i == 0
        es_admin = es_super_admin or bernoulli(0.15)
        puede_operar = es_super_admin or bernoulli(0.8)
        # La API exige al menos una capacidad por persona (`validar_capacidades`):
        # alguien sin ninguna no se podría volver a crear ni editar por el endpoint.
        if not es_admin and not puede_operar:
            puede_operar = True

        dni = unico(lambda: str(random.randint(20_000_000, 45_000_000)), dnis, largo=8)
        # Armado a mano para que siempre sea único y entre en 60 caracteres.
        base = slug(f"{nombre}{apellido}") or f"usuario{i}"
        email = email_unico(base, i, emails)
        telefono = unico(
            lambda: f"+549{random.randint(11, 292)}{random.randint(10_000_000, 99_999_999)}",
            vistos["telefono"],
            largo=15,
        )

        persona = Personal(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            telefono=telefono,
            email=email,
            password=hash_password,
            puede_operar=puede_operar,
            puede_administrar=es_admin,
            es_super_admin=es_super_admin,
            # Se mantienen activos los que administran: un admin dado de baja
            # deja la base sin administración para probar.
            activo=bool(es_admin or not bernoulli(0.08)),
            fecha_creacion=hora_aleatoria(hora_max=20),
        )
        db.add(persona)
        personas.append(persona)

    db.flush()
    return personas


def crear_equipos(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} equipos...")
    equipos = []
    for _ in range(cantidad):
        base, tipo, ubicacion = random.choice(VOCAB_EQUIPOS)
        nombre = unico(lambda: f"{base} {random.randint(1, 30)}", vistos["equipo"], largo=100)
        # Los equipos de medición se calibran; los de proceso, no necesariamente.
        frecuencia = random.choice([None, 90, 180, 365]) if tipo == "Medición" else random.choice(
            [None, None, 180, 365]
        )
        equipos.append(
            Equipo(
                nombre=recortar(nombre, 100),
                tipo=tipo,
                ubicacion=ubicacion,
                activo=not bernoulli(0.06),
                frecuencia_calibracion_dias=frecuencia,
            )
        )
    db.add_all(equipos)
    db.flush()
    return equipos


def crear_aptitudes(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} aptitudes...")
    aptitudes = []
    for _ in range(cantidad):
        base, descripcion = random.choice(VOCAB_APTITUDES)
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} {random.choice('ABC')}"), 60),
            vistos["aptitud"],
            largo=60,
        )
        aptitudes.append(
            Aptitud(
                nombre=nombre,
                descripcion=recortar(descripcion, 255),
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(aptitudes)
    db.flush()
    return aptitudes


def crear_vencimientos(db, personas, aptitudes) -> int:
    """Un vencimiento por persona, sobre una aptitud que esa persona no tenga."""
    print(f"⏳ Cargando vencimientos de personal...")
    total = 0
    asignadas: dict = {}

    for persona in personas:
        if not aptitudes or bernoulli(0.15):
            continue
        usadas = asignadas.setdefault(persona.id, set())
        candidatas = [a for a in aptitudes if a.id not in usadas]
        if not candidatas:
            continue
        aptitud = random.choice(candidatas)
        usadas.add(aptitud.id)

        # Mitad vigente, mitad por vencer pronto: da para probar ambos estados.
        dias = random.choice([5, 15, 30, 60, 90, 180, 365, -10, -45])
        db.add(
            VencimientoPersonal(
                persona_id=persona.id,
                aptitud_id=aptitud.id,
                fecha_vencimiento=HOY + timedelta(days=dias),
                activo=not bernoulli(0.05),
            )
        )
        total += 1

    db.flush()
    return total


def crear_quimicos(db, cantidad: int, unidades: dict, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} insumos químicos...")
    quimicos = []
    for _ in range(cantidad):
        base, tipo = random.choice(VOCAB_QUIMICOS)
        nombre = unico(
            lambda: recortar(f"{base} {random.randint(1, 999)}", 100),
            vistos["quimico"],
            largo=100,
        )
        unidad = unidades[random.choice(["litro", "mililitro", "kilogramo"])]
        quimicos.append(
            InsumoQuimico(
                nombre=nombre,
                tipo=tipo,
                unidad_medida_id=unidad.id,
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(quimicos)
    db.flush()
    return quimicos


def crear_elementos(db, cantidad: int, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} elementos de limpieza...")
    elementos = []
    for _ in range(cantidad):
        base, recambio = random.choice(VOCAB_ELEMENTOS)
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} {random.choice('ABC')}"), 40),
            vistos["elemento"],
            largo=40,
        )
        ultimo = HOY - timedelta(days=random.randint(0, 60)) if recambio else None
        elementos.append(
            ElementoLimpieza(
                nombre=nombre,
                frecuencia_recambio_dias=recambio,
                fecha_ultimo_recambio=ultimo,
                activo=not bernoulli(0.06),
            )
        )
    db.add_all(elementos)
    db.flush()
    return elementos


def crear_insumos(db, cantidad: int, unidades: dict, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} insumos generales...")
    base_nombres = [
        "Bolsa de consorcio", "Bolsa negra", "Papel film", "Papel manteca",
        "Rollo de cocina", "Guantes descartables", "Servilletas de papel",
        "Alcohol en gel", "Limpia pisos neutro", "Desinfectante de pisos",
        "Quitamanchas de ropa de trabajo", "Aromatizador de ambientes",
    ]
    insumos = []
    for _ in range(cantidad):
        base = random.choice(base_nombres)
        nombre = unico(
            lambda: recortar(f"{base} {random.choice('ABC')}", 100),
            vistos["insumo"],
            largo=100,
        )
        unidad = unidades[random.choice(["unidad", "litro", "mililitro"])]
        insumos.append(Insumo(nombre=nombre, unidad_medida_id=unidad.id, activo=not bernoulli(0.06)))
    db.add_all(insumos)
    db.flush()
    return insumos


def crear_planes_y_tareas(db, cantidad: int, equipos, admins, vistos: dict) -> list:
    print(f"⏳ Cargando {cantidad} planes de limpieza con sus tareas...")
    planes = []
    autor = random.choice(admins)

    for i in range(cantidad):
        base, _clave, (min_t, max_t) = random.choice(VOCAB_PLANES)
        # Un plan por equipo: la relación tiene sentido 1 a 1 en la demo.
        equipo = equipos[i % len(equipos)]
        nombre = unico(
            lambda: recortar(solo_letras(f"{base} de {equipo.nombre}"), 60),
            vistos["plan"],
            largo=60,
        )

        plan = PlanLimpieza(
            nombre=nombre,
            equipo_id=equipo.id,
            autor_id=autor.id,
            activo=not bernoulli(0.05),
            fecha_creacion=hora_aleatoria(hora_max=18),
        )

        n_tareas = random.randint(min_t, max_t)
        nombres_usados: set = set()
        for _ in range(n_tareas):
            tarea_base = random.choice(VOCAB_TAREAS)
            tarea_nombre = unico(
                lambda: recortar(solo_letras(tarea_base), 100),
                nombres_usados,
                largo=100,
            )
            plan.tareas.append(
                Tarea(
                    nombre=tarea_nombre,
                    # 1 = todos los días; el resto, cada tantos días.
                    frecuencia=random.choice([1, 1, 1, 2, 3, 7, 15, 30]),
                    tipo=random.choice(list(TipoTarea)).value,
                    descripcion=_descripcion_tarea(equipo.nombre),
                    observaciones=random.choice(OBSERVACIONES) if bernoulli(0.6) else None,
                )
            )
        planes.append(plan)

    db.add_all(planes)
    db.flush()
    return planes


def _consumo_para(nombre_tarea: str, quimicos, elementos):
    """Elige el producto y el elemento coherentes con la tarea."""
    minuscula = nombre_tarea.lower()
    claves_quimico, claves_elemento = None, None

    for palabras, claves in CONSUMO_POR_PALABRA:
        if any(p in minuscula for p in palabras):
            claves_quimico = claves
            break

    if claves_quimico:
        candidatos = [q for q in quimicos if any(k in q.nombre for k in claves_quimico)]
        if candidatos:
            quimico = random.choice(candidatos)
            unidad = random.choice([0.1, 0.25, 0.5, 1.0])
            return quimico, unidad, random.choice(elementos)

    # Sin coincidencias: producto y elemento al azar, pero siempre presentes.
    return random.choice(quimicos), random.choice([0.1, 0.2, 0.5]), random.choice(elementos)


def crear_checklists(
    db,
    planes,
    operadores,
    quimicos,
    elementos,
    dias: int,
) -> int:
    """Genera `dias` checklists por plan, con sus registros e historial.

    Se toman dos decisiones para que la app tenga con qué trabajar:
      * el checklist de hoy queda mayormente abierto, para poder completar tareas;
      * los días pasados quedan cerrados, alguno observado, con algún incumplimiento.

    Los registros se insertan en tanda y se hace un solo flush por checklist:
    insertar fila por fila con flush es de orden cuadrático en la práctica y
    con `--cantidad 200 --dias-checklist 30` el seed se vuelve de minutos.
    """
    print(f"⏳ Cargando checklists de los últimos {dias} días...")
    total_registros = 0

    for plan in planes:
        for delta in range(dias - 1, -1, -1):
            fecha = HOY - timedelta(days=delta)
            es_hoy = delta == 0

            if es_hoy:
                estado = EstadoChecklist.ABIERTO
                observacion = None
            elif bernoulli(0.12):
                estado = EstadoChecklist.OBSERVADO
                observacion = random.choice(
                    [
                        "Se detectó un desvío menor en la ejecución de la tarea.",
                        "El supervisor observó falta de evidencia fotográfica.",
                        "Se pidió reforzar la sanitización de una superficie.",
                    ]
                )
            else:
                estado = EstadoChecklist.CERRADO
                observacion = None

            cabecera = Checklist(
                equipo_id=plan.equipo_id,
                plan_id=plan.id,
                fecha=fecha,
                estado=estado,
                observaciones=observacion,
                supervisor_id=random.choice(operadores).id if bernoulli(0.3) else None,
                fecha_creacion=datetime.combine(fecha, datetime.min.time()).replace(hour=7),
            )
            db.add(cabecera)
            db.flush()

            pendientes = 0
            registros = []
            # Se guardan los datos y se arman los objetos recien después del
            # flush: `HistorialRegistroTarea` expone `registro_tarea_id`, y ese
            # id solo existe una vez insertado el registro.
            para_historial = []

            for tarea in plan.tareas:
                if es_hoy:
                    # Hoy: la primera tarea queda hecha, el resto pendiente.
                    completado = tarea is plan.tareas[0]
                else:
                    # Pasado: casi todo hecho, con algún incumplimiento suelto.
                    completado = not bernoulli(0.08)

                if not completado:
                    pendientes += 1
                    insumo = cantidad = elemento = None
                else:
                    insumo, cantidad, elemento = _consumo_para(tarea.nombre, quimicos, elementos)

                registro = RegistroTarea(
                    checklist_id=cabecera.id,
                    tarea_id=tarea.id,
                    nombre_tarea_historico=tarea.nombre,
                    descripcion_tarea_historico=tarea.descripcion,
                    tipo_tarea_historico=tarea.tipo,
                    observaciones_tarea_historico=tarea.observaciones,
                    completado=completado,
                    fecha_completado=(
                        datetime.combine(fecha, datetime.min.time()).replace(
                            hour=random.randint(7, 19), minute=random.randint(0, 59)
                        )
                        if completado
                        else None
                    ),
                    usuario_id=random.choice(operadores).id if completado else None,
                    insumo_quimico_id=insumo.id if insumo else None,
                    cantidad_consumida=cantidad,
                    elemento_limpieza_id=elemento.id if elemento else None,
                )
                registros.append(registro)

                if completado:
                    # Una fila de bitácora por tarea completada.
                    para_historial.append((registro, registro.usuario_id, registro.fecha_completado))

            # Un flush para los registros (hace falta su id) y otro para la
            # bitácora, que los referencia.
            db.add_all(registros)
            db.flush()
            db.add_all(
                HistorialRegistroTarea(
                    registro_tarea_id=registro.id,
                    completado=True,
                    usuario_id=usuario_id,
                    fecha_evento=fecha_evento,
                )
                for registro, usuario_id, fecha_evento in para_historial
            )
            total_registros += len(registros)

            if es_hoy and pendientes == 0:
                cabecera.estado = EstadoChecklist.COMPLETO

            db.flush()

    return total_registros


def crear_incidentes(db, cantidad: int, equipos, personal, admins, operadores, vistos: dict) -> int:
    """Incidentes variados, con la mitad cerrados y con bitácora de cierre.

    Los primeros `CANTIDAD_INCIDENTES_SUPERADMIN` los reporta el superadmin
    (la primera persona creada): la vista "Mis reportes" pagina de a 10 y
    así, al loguearse con él para probar, hay segunda página. Antes el
    reportante salía solo de los operadores y el superadmin quedaba con la
    pestaña vacía.
    """
    print(f"⏳ Cargando {cantidad} incidentes...")
    total = 0

    superadmin = personal[0] if personal else None
    propios = min(CANTIDAD_INCIDENTES_SUPERADMIN, cantidad) if superadmin else 0

    for indice in range(cantidad):
        tipo, titulo_base, descripcion_base = random.choice(VOCAB_INCIDENTES)
        titulo = unico(
            lambda: recortar(solo_letras(f"{titulo_base} {random.randint(1, 99)}"), 60),
            vistos["incidente"],
            largo=60,
        )
        equipo = random.choice(equipos) if bernoulli(0.8) else None
        if indice < propios:
            reportante = superadmin
        else:
            reportante = random.choice(operadores or personal)

        fecha_reporte = datetime.combine(
            HOY - timedelta(days=random.randint(0, 60)),
            datetime.min.time(),
        ).replace(hour=random.randint(6, 20), minute=random.randint(0, 59))

        cerrado = bernoulli(0.6)
        fecha_cierre = (
            fecha_reporte + timedelta(days=random.randint(1, 7))
            if cerrado
            else None
        )
        observacion_cierre = (
            random.choice(
                [
                    "Se reparó la pieza y se verificó el funcionamiento normal.",
                    "Se sanitizó la zona y se reinforced el protocolo.",
                    "Se reemplazó el equipo por uno nuevo.",
                    "Se capacitó al personal involucrado.",
                ]
            )
            if cerrado
            else None
        )
        responsable = random.choice(admins) if cerrado else None

        incidente = Incidente(
            titulo=titulo,
            descripcion=descripcion_base,
            tipo=tipo.value,
            equipo_id=equipo.id if equipo else None,
            usuario_id=reportante.id,
            fecha_reporte=fecha_reporte,
            estado=(EstadoIncidente.CERRADO if cerrado else EstadoIncidente.ABIERTO).value,
            fecha_cierre=fecha_cierre,
            observacion_cierre=observacion_cierre,
            responsable_cierre_id=responsable.id if responsable else None,
        )
        db.add(incidente)
        db.flush()
        total += 1

        if cerrado:
            db.add(
                HistorialIncidente(
                    incidente_id=incidente.id,
                    estado_anterior=EstadoIncidente.ABIERTO.value,
                    estado_nuevo=EstadoIncidente.CERRADO.value,
                    usuario_id=responsable.id,
                    observacion=observacion_cierre,
                    fecha_evento=fecha_cierre,
                )
            )

    db.flush()
    return total


def _pdf_de_prueba(texto: str) -> bytes:
    """Arma un PDF de una página con `texto`, a mano y sin dependencias.

    El seed de documentos escribe filas que apuntan a un archivo real: con
    solo la fila, "Abrir documento" terminaría en un 404. No hay ninguna
    librería de PDF en requirements, así que el archivo se construye byte a
    byte, con su tabla xref correcta para que cualquier visor lo abra.
    """
    # Los paréntesis y la barra se escapan dentro de la cadena de texto del PDF.
    seguro = texto.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    contenido = (
        "BT /F1 16 Tf 60 760 Td (SAIA - documento de prueba) Tj "
        f"0 -24 Td /F1 12 Tf ({seguro}) Tj ET"
    ).encode("latin-1", errors="replace")

    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(contenido)).encode() + b" >>\nstream\n"
        + contenido + b"\nendstream",
    ]

    salida = bytearray(b"%PDF-1.4\n")
    offsets = []
    for numero, objeto in enumerate(objetos, start=1):
        offsets.append(len(salida))
        salida += f"{numero} 0 obj\n".encode() + objeto + b"\nendobj\n"

    inicio_xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n".encode()
    salida += b"0000000000 65535 f \n"
    for offset in offsets:
        salida += f"{offset:010d} 00000 n \n".encode()
    salida += (
        f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\n"
        f"startxref\n{inicio_xref}\n%%EOF"
    ).encode()
    return bytes(salida)


def crear_documentos(db, cantidad: int, admins, vistos: dict) -> int:
    """Documentos con su versión vigente (y alguna archivada).

    Sin esto, las vistas "Documentos" y "Consultar documentos" quedaban
    vacías al sembrar con Faker. Además:

      * a la mitad se le pone fecha de vencimiento, que alimenta la vista
        "Vencimientos" (tipo DOCUMENTO) y la columna "Vence" del listado;
      * a un tercio se le agrega una versión archivada, para que la columna
        "Archivadas" no salga siempre en cero.

    Los archivos se escriben de verdad en `uploads/documentos/` con el mismo
    criterio de nombres que usa el backend al subir por la API (uuid), así
    que "Abrir documento" funciona en la demo.
    """
    print(f"⏳ Cargando {cantidad} documentos con su versión vigente...")
    carpeta = CARPETA_UPLOADS / "documentos"
    carpeta.mkdir(parents=True, exist_ok=True)
    total = 0

    for i in range(cantidad):
        base, tipo = random.choice(VOCAB_DOCUMENTOS)
        nombre = unico(
            lambda: recortar(f"{base} {random.randint(1, 99)}", 100),
            vistos["documento"],
            largo=100,
        )
        documento = Documento(
            nombre=nombre,
            tipo=tipo.value,
            fecha_creacion=hora_aleatoria(hora_max=18),
        )
        db.add(documento)
        db.flush()

        # Momento de subida de la versión vigente; la archivada (si la hay)
        # es anterior.
        subida = hora_aleatoria(hora_max=18)
        con_archivada = bernoulli(0.33)

        if con_archivada:
            subida_archivada = subida - timedelta(days=random.randint(30, 200))
            _guardar_version(
                db,
                carpeta,
                documento,
                numero_version=1,
                nombre_documento=nombre,
                autor=random.choice(admins),
                vigente=False,
                subida=subida_archivada,
                vencimiento=None,
                # La archivada dejó de regir cuando se subió la vigente.
                vigente_hasta=subida,
            )

        # La mitad vence en plazos variados (algunos ya vencidos, para que
        # el listado muestre el badge rojo y "Vencimientos" tenga variedad).
        vencimiento = (
            HOY + timedelta(days=random.choice([15, 30, 90, 180, 365, -20]))
            if bernoulli(0.5)
            else None
        )
        _guardar_version(
            db,
            carpeta,
            documento,
            numero_version=2 if con_archivada else 1,
            nombre_documento=nombre,
            autor=random.choice(admins),
            vigente=True,
            subida=subida,
            vencimiento=vencimiento,
            vigente_hasta=None,
        )
        total += 1

    db.flush()
    return total


def _guardar_version(
    db,
    carpeta: Path,
    documento: Documento,
    numero_version: int,
    nombre_documento: str,
    autor,
    vigente: bool,
    subida: datetime,
    vencimiento: Optional[date],
    vigente_hasta: Optional[datetime],
) -> None:
    """Escribe el archivo físico y la fila de `VersionDocumento`."""
    nombre_archivo = f"{uuid.uuid4().hex}.pdf"
    (carpeta / nombre_archivo).write_bytes(_pdf_de_prueba(nombre_documento))

    db.add(
        VersionDocumento(
            documento_id=documento.id,
            numero_version=numero_version,
            nombre_archivo=f"{nombre_documento}.pdf",
            archivo_url=f"uploads/documentos/{nombre_archivo}",
            vigente=vigente,
            vigente_desde=subida,
            vigente_hasta=vigente_hasta,
            # Solo la versión vigente puede estar vencida: una archivada ya
            # no rige, su fecha límite no dice nada.
            fecha_vencimiento=vencimiento if vigente else None,
            autor_id=autor.id,
            fecha_subida=subida,
        )
    )


def crear_planes_cal_mantenimiento(db, cantidad: int, equipos, admins) -> int:
    """Planes de calibración/mantenimiento: a lo sumo UNO por equipo y tipo.

    El backend lo exige al crear por la API (`_verificar_plan_activo_duplicado`):
    un equipo no puede tener dos planes activos del mismo tipo. La versión
    anterior elegía el equipo al azar en cada iteración y sembraba pares
    repetidos, es decir, datos que la aplicación no habría dejado crear.

    Se arman todos los pares (equipo, tipo) posibles y se toman `cantidad`
    sin repetir ninguno. Como los equipos también son `--cantidad`, siempre
    hay pares de sobra (2 × cantidad).
    """
    print(f"⏳ Cargando {cantidad} planes de calibración/mantenimiento...")
    total = 0

    pares = [
        (equipo, tipo)
        for equipo in equipos
        for tipo in ("calibracion", "mantenimiento")
    ]
    random.shuffle(pares)

    for equipo, tipo in pares[:cantidad]:
        db.add(
            PlanCalibracionMantenimiento(
                equipo_id=equipo.id,
                autor_id=random.choice(admins).id,
                tipo=tipo,
                fecha_ultima_intervencion=HOY - timedelta(days=random.randint(1, 200)),
                periodicidad_dias=random.choice([5, 15, 30, 60, 90, 180, 365]),
                activo=not bernoulli(0.05),
                fecha_creacion=hora_aleatoria(hora_max=18),
            )
        )
        total += 1

    db.flush()
    return total


# ============================================================
# MAIN
# ============================================================

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Carga datos de ejemplo generados con Faker.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("-c", "--cantidad", type=int, default=15, help="Filas por entidad.")
    p.add_argument(
        "-s",
        "--seed",
        type=int,
        default=0,
        help="Semilla de Faker. 0 = aleatoria; un número fijo hace el resultado reproducible.",
    )
    p.add_argument("--password", default=CONTRASENA_POR_DEFECTO, help="Contraseña de todo el personal.")
    p.add_argument(
        "--dias-checklist",
        type=int,
        default=7,
        help="Días hacia atrás que se generan para cada plan de limpieza.",
    )
    p.add_argument("--locale", default="es_AR", help="Locale de Faker.")
    p.add_argument(
        "--agregar",
        action="store_true",
        help="No borra lo existente: agrega filas nuevas evitando duplicados.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if args.cantidad < 1:
        print("❌ --cantidad tiene que ser mayor a cero.")
        return 1
    if args.dias_checklist < 1:
        print("❌ --dias-checklist tiene que ser mayor a cero.")
        return 1

    random.seed(args.seed or None)
    Faker.seed(args.seed or None)
    fake = Faker(args.locale)

    db = SessionLocal()
    try:
        if not args.agregar:
            borrar_todo(db)
        else:
            print("➕ Modo agregar: se conserva lo que ya estaba cargado.")

        # Valores ya usados, para no violar ningún UNIQUE en modo agregar.
        vistos = {
            "dni": valores_existentes(db, Personal.dni),
            "email": valores_existentes(db, Personal.email),
            "telefono": set(),
            "incidente": set(db.scalars(select(Incidente.titulo)).all()),
            "equipo": set(db.scalars(select(Equipo.nombre)).all()),
            "aptitud": set(db.scalars(select(Aptitud.nombre)).all()),
            "plan": set(db.scalars(select(PlanLimpieza.nombre)).all()),
            "quimico": set(db.scalars(select(InsumoQuimico.nombre)).all()),
            "elemento": set(db.scalars(select(ElementoLimpieza.nombre)).all()),
            "insumo": set(db.scalars(select(Insumo.nombre)).all()),
            "unidad": set(db.scalars(select(UnidadMedida.nombre)).all()),
            "documento": set(db.scalars(select(Documento.nombre)).all()),
        }

        # Un solo hash para todo el personal: bcrypt es lento (~0,3 s por
        # hash) y con --cantidad 500 la diferencia es de varios minutos.
        print("🔐 Hasheando la contraseña...")
        hash_password = hashear_password(args.password)

        unidades = crear_unidades(db, vistos)
        personal = crear_personal(db, args.cantidad, fake, vistos, hash_password)
        equipos = crear_equipos(db, args.cantidad, vistos)
        aptitudes = crear_aptitudes(db, args.cantidad, vistos)

        admins = [p for p in personal if p.puede_administrar]
        operadores = [p for p in personal if not p.puede_administrar and p.puede_operar]
        # Sin admins no se puede crear nada: el plan necesita un autor.
        if not admins:
            admins = personal[:1]
        if not operadores:
            operadores = admins

        vencimientos = crear_vencimientos(db, personal, aptitudes)
        quimicos = crear_quimicos(db, args.cantidad, unidades, vistos)
        elementos = crear_elementos(db, args.cantidad, vistos)
        crear_insumos(db, args.cantidad, unidades, vistos)
        planes = crear_planes_y_tareas(db, args.cantidad, equipos, admins, vistos)
        registros = crear_checklists(db, planes, operadores, quimicos, elementos, args.dias_checklist)
        incidentes = crear_incidentes(db, args.cantidad, equipos, personal, admins, operadores, vistos)
        documentos = crear_documentos(db, args.cantidad, admins, vistos)
        cal_mantenimiento = crear_planes_cal_mantenimiento(db, args.cantidad, equipos, admins)

        db.commit()

        # --------------------------------------------------------------
        # Resumen
        # --------------------------------------------------------------
        print()
        print("✅ ¡Datos cargados con éxito!")
        print(f"   Semilla: {args.seed or 'aleatoria'} · Locale: {args.locale}")
        print(f"   Personal: {len(personal)} · Equipos: {len(equipos)} · Aptitudes: {len(aptitudes)}")
        print(f"   Vencimientos: {vencimientos} · Planes de limpieza: {len(planes)}")
        print(f"   Registros de tarea: {registros} · Incidentes: {incidentes}")
        print(f"   Planes calibración/mantenimiento: {cal_mantenimiento}")
        print(f"   Documentos (con su versión vigente): {documentos}")
        print()
        print(f"🔑 Contraseña de todo el personal: {args.password}")
        print("👤 Usuarios administradores (el login es con DNI):")
        for a in admins[:5]:
            print(f"   • {a.nombre} {a.apellido} — DNI {a.dni}")
        if len(admins) > 5:
            print(f"   … y {len(admins) - 5} más")

        return 0

    except Exception:
        db.rollback()
        print("❌ Error al cargar datos:")
        import traceback

        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
