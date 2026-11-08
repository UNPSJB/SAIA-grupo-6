"""Carga de datos de ejemplo generados con Faker.

Es la alternativa generativa a `cargar_datos.py`: aquel tiene un escenario
curado a mano (15 filas por entidad, pensadas para una demo), este produce
volúmenes configurables y reproducibles, útiles para probar paginación,
filtros y listados en general.

    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --cantidad 40
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --cantidad 200 --dias-checklist 30
    .venv\\Scripts\\python.exe scripts\\cargar_datos_faker.py --seed 7      # repetible

Faker se usa para lo que le sobra: identidad de las personas (nombre, DNI,
teléfono, email), frases y horas. Para las entidades del dominio (equipos,
productos químicos, tareas, incidentes) se usan vocabularios del rubro
combinados al azar: `fake.word()` devolvería cosas como "Cocina warned" y la
base quedaría inservible para probar la aplicación.

También carga la trazabilidad de producción (materias primas, productos con
recetas versionadas, lotes de insumo por proveedor y lotes de producción con
checklist, consumos reales y desperdicios en los tres estados), la vista
pública, sesiones de ejemplo (refresh tokens, revocaciones, intentos de
login) y, al final, recalcula la caché de notificaciones.

Por defecto reemplaza los datos (igual que `cargar_datos.py`); con `--agregar`
conserva lo que hay y agrega nuevas filas sin chocar con los UNIQUE.

Después de las altas, `simular_actividad` opera sobre lo cargado como lo haría
la gente en la app (modificar, dar de baja, reactivar, eliminar, cerrar
incidentes, versionar documentos, consumir stock...) para que la bitácora de
auditoría traiga TODAS las acciones sobre TODAS las entidades. `--sin-actividad`
lo saltea.
"""

import argparse
import os
import random
import re
import secrets
import sys
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from itertools import chain
from pathlib import Path
from typing import Optional

from faker import Faker
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

# Permite correr el script desde cualquier directorio.
RAIZ = Path(__file__).resolve().parent.parent
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

from src.config import settings
from src.database import SessionLocal  # noqa: E402
import src.all_models  # noqa: F401,E402  (registra los modelos)
from src.migrations import crear_tablas_y_migrar  # noqa: E402
from src.auth.services import hashear_password  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.auditoria.models import AuditLog  # noqa: E402
from src.sector.models import Sector  # noqa: E402
from src.Equipo.models import Equipo, Calibracion  # noqa: E402
from src.aptitud.models import Aptitud  # noqa: E402
from src.vencimientoPersonal.models import VencimientoPersonal  # noqa: E402
from src.unidadMedida.models import UnidadMedida  # noqa: E402
from src.insumos.models import TIPO_ADITIVO, TIPO_INGREDIENTE, Insumo  # noqa: E402
from src.aditivos.models import Aditivo  # noqa: E402
from src.insumoQuimico.models import (  # noqa: E402
    InsumoQuimico,
    TipoQuimico,
    StockInsumoQuimico,
    LoteStock,
    MovimientoStockInsumoQuimico,
    TipoMovimientoStock,
)
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
from src.documentos.pdf_generator import ContextoDocumento, generar_pdf_documento  # noqa: E402
from src.proveedores.models import Proveedor  # noqa: E402
from src.config import CARPETA_UPLOADS  # noqa: E402
from src.notificaciones.models import ConfiguracionAlerta, NotificacionPersistida  # noqa: E402
from src.notificaciones.invalidacion import (  # noqa: E402
    EstadoNotificaciones,
    asegurar_notificaciones_al_dia,
)
from src.productos.models import Producto  # noqa: E402
from src.recetas.models import (  # noqa: E402
    Receta,
    RecetaInsumo,
    TareaReceta,
    TareaRecetaInsumo,
    VersionReceta,
)
from src.lotesInsumo.models import LoteInsumo  # noqa: E402
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto  # noqa: E402
from src.lotes.constants import (  # noqa: E402
    ESTADO_CANCELADO,
    ESTADO_EN_PROCESO,
    ESTADO_TERMINADO,
    PREFIJO_NUMERO_LOTE,
    TIPO_CONSUMO_DESPERDICIO,
    TIPO_CONSUMO_REAL,
)
from src.vistaPublica.models import (  # noqa: E402
    ConfiguracionVistaPublica,
    IndicadorVistaPublica,
)
from src.vistaPublica.constants import CATALOGO as CATALOGO_VISTA_PUBLICA  # noqa: E402
from src.auth.models import IntentoLogin, RefreshToken, TokenRevocado  # noqa: E402

# Contraseña de TODO el personal. Valor acordado con el grupo de desarrollo.
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


# Cierre de incidentes (se usa al sembrar y al simular el cierre posterior).
OBSERVACIONES_CIERRE = [
    "Se reparó la pieza y se verificó el funcionamiento normal.",
    "Se sanitizó la zona y se reforzó el protocolo.",
    "Se reemplazó el equipo por uno nuevo.",
    "Se capacitó al personal involucrado.",
]

# Observaciones de un supervisor sobre un checklist.
OBSERVACIONES_CHECKLIST = [
    "Se detectó un desvío menor en la ejecución de la tarea.",
    "El supervisor observó falta de evidencia fotográfica.",
    "Se pidió reforzar la sanitización de una superficie.",
]

# Motivos de un egreso de stock de insumos químicos.
MOTIVOS_EGRESO = [
    "Consumo en limpieza de planta",
    "Uso en sanitización de equipos",
    "Reposición en el sector de elaboración",
    "Ajuste por conteo de inventario",
]

# Corrección de un símbolo de unidad de medida ("kg" cargado como "Kg"...).
SIMBOLOS_ALTERNATIVOS = {
    "kg": "Kg", "L": "lt", "u": "un", "g": "gr", "mL": "ml", "t": "tn",
    "mg": "mgr", "cm³": "cc", "m": "mt", "cm": "cms", "h": "hs", "doc": "dz",
}

# ------------------------------------------------------------
# Trazabilidad de producción
# ------------------------------------------------------------

# Materias primas alimentarias (insumos de tipo "insumo"): (nombre, clave de unidad).
# Las de limpieza de `crear_insumos` no sirven para una receta.
VOCAB_INGREDIENTES = [
    ("Harina 000", "kilogramo"),
    ("Azúcar común", "kilogramo"),
    ("Manteca", "kilogramo"),
    ("Huevo fresco", "unidad"),
    ("Leche entera", "litro"),
    ("Sal fina", "kilogramo"),
    ("Levadura fresca", "gramo"),
    ("Pectina cítrica", "gramo"),
    ("Ácido cítrico", "gramo"),
    ("Sorbato de potasio", "gramo"),
    ("Frutilla fresca", "kilogramo"),
    ("Durazno amarillo", "kilogramo"),
    ("Cacao amargo", "kilogramo"),
    ("Esencia de vainilla", "mililitro"),
    ("Aceite de girasol", "litro"),
    ("Dulce de leche repostero", "kilogramo"),
    ("Tomate triturado", "kilogramo"),
    ("Orégano seco", "gramo"),
    ("Almidón de maíz", "kilogramo"),
    ("Polvo de hornear", "gramo"),
    ("Bicarbonato de sodio", "gramo"),
    ("Coco rallado", "gramo"),
]

# Materias primas que son aditivos (E9): nombre del aditivo en la lista de
# referencia que carga la migración (clase funcional, nombre completo, INS).
ADITIVO_DE_INGREDIENTE = {
    "Pectina cítrica": "Pectina",
    "Ácido cítrico": "Ácido cítrico",
    "Sorbato de potasio": "Sorbato de potasio",
    "Esencia de vainilla": "Aroma de vainilla",
    "Polvo de hornear": "Pirofosfato ácido de sodio",
    "Bicarbonato de sodio": "Bicarbonato de sodio",
}

# Porción o unidad de venta por producto: (descripción, cantidad, clave de unidad).
PORCION_POR_PRODUCTO = {
    "Mermelada de frutilla": ("Frasco", "0.454", "kilogramo"),
    "Mermelada de durazno": ("Frasco", "0.454", "kilogramo"),
    "Pan de molde blanco": ("Unidad", "1", "unidad"),
    "Budín de vainilla": ("Unidad", "1", "unidad"),
    "Dulce de leche familiar": ("Pote", "1", "kilogramo"),
    "Salsa de tomate": ("Frasco", "0.34", "kilogramo"),
    "Alfajor de maicena": ("Caja", "12", "unidad"),
    "Galletitas de cacao": ("Paquete", "0.25", "kilogramo"),
}

# Recetas base. Cada insumo es (nombre, cantidad para el rendimiento,
# clasificación, índice de la tarea donde se usa). La cantidad está en la
# unidad del insumo, que es la que exige `receta_insumo`.
VOCAB_RECETAS = [
    {
        "producto": "Mermelada de frutilla",
        "unidad": "kilogramo",
        "rendimiento": "10",
        "tareas": [
            "Lavar, despalillar y trozar la fruta",
            "Cocinar la fruta con el azúcar y la pectina",
            "Corregir la acidez, conservar y envasar en caliente",
        ],
        "insumos": [
            ("Frutilla fresca", "7", "ingrediente", 0),
            ("Azúcar común", "4", "ingrediente", 1),
            ("Pectina cítrica", "50", "aditivo", 1),
            ("Ácido cítrico", "20", "aditivo", 2),
            ("Sorbato de potasio", "10", "aditivo", 2),
        ],
    },
    {
        "producto": "Mermelada de durazno",
        "unidad": "kilogramo",
        "rendimiento": "12",
        "tareas": [
            "Pelar, descarozar y trozar los duraznos",
            "Cocinar con el azúcar hasta punto de gelificación",
            "Envasar en caliente y cerrar al vacío",
        ],
        "insumos": [
            ("Durazno amarillo", "8.5", "ingrediente", 0),
            ("Azúcar común", "4.8", "ingrediente", 1),
            ("Pectina cítrica", "60", "aditivo", 1),
            ("Ácido cítrico", "25", "aditivo", 2),
        ],
    },
    {
        "producto": "Pan de molde blanco",
        "unidad": "unidad",
        "rendimiento": "20",
        "tareas": [
            "Amasar la harina con la levadura y la sal",
            "Incorporar la manteca y dejar levar en moldes",
            "Hornear, desmoldar y enfriar",
        ],
        "insumos": [
            ("Harina 000", "10", "ingrediente", 0),
            ("Levadura fresca", "300", "ingrediente", 0),
            ("Sal fina", "0.2", "ingrediente", 0),
            ("Manteca", "0.5", "ingrediente", 1),
            ("Leche entera", "1.5", "ingrediente", 1),
        ],
    },
    {
        "producto": "Budín de vainilla",
        "unidad": "unidad",
        "rendimiento": "12",
        "tareas": [
            "Batir la manteca con el azúcar",
            "Agregar los huevos y la esencia",
            "Incorporar los secos tamizados",
            "Hornear en moldes enmantecados",
        ],
        "insumos": [
            ("Manteca", "1", "ingrediente", 0),
            ("Azúcar común", "1.5", "ingrediente", 0),
            ("Huevo fresco", "24", "ingrediente", 1),
            ("Esencia de vainilla", "30", "aditivo", 1),
            ("Harina 000", "2", "ingrediente", 2),
            ("Polvo de hornear", "60", "aditivo", 2),
        ],
    },
    {
        "producto": "Dulce de leche familiar",
        "unidad": "kilogramo",
        "rendimiento": "8",
        "tareas": [
            "Calentar la leche con el bicarbonato",
            "Agregar el azúcar y reducir revolviendo",
            "Aromatizar, enfriar y envasar",
        ],
        "insumos": [
            ("Leche entera", "20", "ingrediente", 0),
            ("Bicarbonato de sodio", "10", "aditivo", 0),
            ("Azúcar común", "4", "ingrediente", 1),
            ("Esencia de vainilla", "20", "aditivo", 2),
        ],
    },
    {
        "producto": "Salsa de tomate",
        "unidad": "kilogramo",
        "rendimiento": "15",
        "tareas": [
            "Calentar el aceite y sofreír los condimentos",
            "Cocinar el tomate a fuego lento",
            "Ajustar la acidez y envasar",
        ],
        "insumos": [
            ("Aceite de girasol", "0.5", "ingrediente", 0),
            ("Orégano seco", "50", "ingrediente", 0),
            ("Tomate triturado", "14", "ingrediente", 1),
            ("Sal fina", "0.15", "ingrediente", 1),
            ("Ácido cítrico", "15", "aditivo", 2),
        ],
    },
    {
        "producto": "Alfajor de maicena",
        "unidad": "unidad",
        "rendimiento": "60",
        "tareas": [
            "Preparar la masa y dejar reposar en frío",
            "Estirar, cortar y hornear las tapas",
            "Rellenar con dulce de leche y pasar por coco",
        ],
        "insumos": [
            ("Almidón de maíz", "2", "ingrediente", 0),
            ("Harina 000", "1", "ingrediente", 0),
            ("Manteca", "1", "ingrediente", 0),
            ("Azúcar común", "0.8", "ingrediente", 0),
            ("Huevo fresco", "12", "ingrediente", 0),
            ("Polvo de hornear", "30", "aditivo", 1),
            ("Dulce de leche repostero", "2", "ingrediente", 2),
            ("Coco rallado", "200", "ingrediente", 2),
        ],
    },
    {
        "producto": "Galletitas de cacao",
        "unidad": "kilogramo",
        "rendimiento": "6",
        "tareas": [
            "Cremar la manteca con el azúcar",
            "Incorporar huevos, cacao y harina",
            "Formar, hornear y enfriar",
        ],
        "insumos": [
            ("Manteca", "1.2", "ingrediente", 0),
            ("Azúcar común", "1.5", "ingrediente", 0),
            ("Huevo fresco", "10", "ingrediente", 1),
            ("Cacao amargo", "0.5", "ingrediente", 1),
            ("Harina 000", "3", "ingrediente", 1),
            ("Polvo de hornear", "40", "aditivo", 2),
        ],
    },
]

# Sufijos para tener más productos que recetas base con nombres únicos.
VARIANTES_PRODUCTO = [
    "Clásica", "Familiar", "Artesanal", "Premium", "Reducida en azúcar",
    "Sin TACC", "Casera", "Especial", "Línea escolar", "Gastronómica",
]

MOTIVOS_DESPERDICIO = [
    "Derrame durante el pesaje",
    "Producto quemado en la cocción",
    "Envase dañado al abrir",
    "Contaminación por contacto con el piso",
    "Error de dosificación descartado",
]

MOTIVOS_CANCELACION_LOTE = [
    "Corte de energía durante la cocción",
    "Falla del horno: temperatura fuera de rango",
    "Materia prima no conforme detectada en proceso",
    "Pedido cancelado por el cliente",
    "Contaminación cruzada sospechada",
]

MOTIVOS_BAJA_LOTE_INSUMO = [
    "Vencido sin consumir",
    "Descarte por rotura de envase",
    "Descarte por cadena de frío interrumpida",
    "Ajuste de inventario",
]

# IPs de documentación (RFC 5737): nunca coinciden con quien prueba en local,
# así los intentos de login sembrados no bloquean a nadie de verdad.
IPS_INTENTOS_LOGIN = ["203.0.113.10", "203.0.113.25", "198.51.100.7", "198.51.100.42"]


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
        # La bitácora describe filas que se van a borrar y cuyos ids se
        # reutilizan: dejarla mezclaría historias de datos distintos.
        AuditLog,
        # Caché derivada: se recalcula al final con lo recién cargado.
        NotificacionPersistida,
        EstadoNotificaciones,
        # Trazabilidad (hijos primero). El borrado masivo no dispara los
        # eventos del ORM que protegen versiones de receta y lotes cerrados.
        ConsumoInsumo,
        ChecklistProduccion,
        LoteProducto,
        LoteInsumo,
        TareaRecetaInsumo,
        RecetaInsumo,
        TareaReceta,
        VersionReceta,
        Receta,
        Producto,
        HistorialRegistroTarea,
        HistorialIncidente,
        # Los movimientos pueden referenciar registros y checklists. Los lotes
        # a su vez referencian su movimiento de ingreso, por eso van primero.
        LoteStock,
        MovimientoStockInsumoQuimico,
        RegistroTarea,
        Checklist,
        Incidente,
        VersionDocumento,
        Documento,
        VencimientoPersonal,
        Calibracion,
        StockInsumoQuimico,
        PlanCalibracionMantenimiento,
        Tarea,
        PlanLimpieza,
        InsumoQuimico,
        Insumo,
        ElementoLimpieza,
        Aptitud,
        UnidadMedida,
        Equipo,
        Sector,
        Proveedor,
        # Personal NO se borra por defecto (script peligroso en producción).
    ]
    for modelo in orden:
        # Borrado masivo a propósito: este seed SÍ audita lo que carga, pero el
        # vaciado previo no es una operación de negocio que deba registrarse.
        db.execute(delete(modelo).execution_options(auditoria_omitir=True))
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


def crear_configuracion_alertas(db):
    """Carga valores por defecto de configuración de alertas si no existen."""
    print("⏳ Cargando configuración de alertas...")
    defaults = {
        "vencimiento_proximo_dias": 7,
        "alerta_calibracion_dias": 30,
        "alerta_insumo_bajo_stock": 10,
    }
    for clave, valor in defaults.items():
        existente = db.get(ConfiguracionAlerta, clave)
        if existente is None:
            db.add(ConfiguracionAlerta(clave=clave, valor=valor))
    db.flush()


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
            # Es data de prueba con contraseña conocida: no se fuerza el cambio
            # en el primer login.
            debe_cambiar_password=False,
            fecha_creacion=hora_aleatoria(hora_max=20),
        )
        db.add(persona)
        personas.append(persona)

    db.flush()
    return personas


def obtener_o_crear_sector(db, nombre: str) -> Sector:
    """Devuelve el sector con ese nombre, creándolo si no existe.

    La ubicación del equipo pasó a ser su propia entidad (FK
    `equipos.sector_id`, ver src/sector/models.py). En modo `--agregar` los
    sectores ya existentes se reutilizan en vez de chocar con el UNIQUE.
    """
    sector = db.scalar(select(Sector).where(Sector.nombre == nombre))
    if sector is None:
        sector = Sector(nombre=nombre, activo=True)
        db.add(sector)
        db.flush()
    return sector


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
                sector_id=obtener_o_crear_sector(db, ubicacion).id,
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


def crear_planes_y_tareas(
    db, cantidad: int, equipos, admins, vistos: dict, operadores: list
) -> list:
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
            # Cada tarea se asigna a un operador responsable por defecto.
            operador_default = random.choice(operadores) if operadores else None
            plan.tareas.append(
                Tarea(
                    nombre=tarea_nombre,
                    # 1 = todos los días; el resto, cada tantos días.
                    frecuencia=random.choice([1, 1, 1, 2, 3, 7, 15, 30]),
                    tipo=random.choice(list(TipoTarea)).value,
                    descripcion=_descripcion_tarea(equipo.nombre),
                    observaciones=random.choice(OBSERVACIONES) if bernoulli(0.6) else None,
                    operador_id=operador_default.id if operador_default else None,
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
                observacion = random.choice(OBSERVACIONES_CHECKLIST)
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

                # Operador asignado: hereda el de la plantilla de la tarea;
                # si la tarea no tiene operador asignado, elige uno al azar.
                operador_id_tarea = tarea.operador_id
                if operador_id_tarea is not None:
                    operador = next(
                        (o for o in operadores if o.id == operador_id_tarea),
                        random.choice(operadores),
                    )
                else:
                    operador = random.choice(operadores)

                # Con baja probabilidad, el operador asignado se ausentó y otro
                # lo cubrió: se registra reemplazado_por_id (estrategia C de
                # cobertura). Si hay cobertura, quien realmente completó la
                # tarea fue quien la cubrió.
                reemplazado_por = None
                if bernoulli(0.10) and len(operadores) > 1:
                    candidatos = [o for o in operadores if o.id != operador.id]
                    if candidatos:
                        reemplazado_por = random.choice(candidatos)

                quien_hizo = (
                    reemplazado_por.id
                    if (completado and reemplazado_por)
                    else (operador.id if completado else None)
                )

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
                    operador_id=operador.id,
                    reemplazado_por_id=reemplazado_por.id if reemplazado_por else None,
                    usuario_id=quien_hizo,
                    insumo_quimico_id=insumo.id if insumo else None,
                    cantidad_consumida=cantidad,
                    elemento_limpieza_id=elemento.id if elemento else None,
                )
                registros.append(registro)

            # Un flush para los registros (hace falta su id). El historial
            # de cada registro completado se crea después en
            # crear_historial_registro_tarea, para no duplicar filas.
            db.add_all(registros)
            db.flush()
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
        observacion_cierre = random.choice(OBSERVACIONES_CIERRE) if cerrado else None
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

    db.flush()
    return total


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
    """Escribe el archivo físico (PDF propio de SAIA) y la fila de `VersionDocumento`."""
    nombre_archivo = f"{uuid.uuid4().hex}.pdf"
    if vencimiento and vencimiento < HOY:
        estado = "vencido"
    elif not vigente:
        estado = "archivado"
    else:
        estado = "vigente"
    pdf_bytes = generar_pdf_documento(
        ContextoDocumento(
            nombre=nombre_documento,
            tipo=documento.tipo,
            numero_version=numero_version,
            identificador=f"SAIA-DOC-{documento.id:04d}",
            fecha_emision=subida.date(),
            fecha_vencimiento=vencimiento,
            estado=estado,
            autor=f"{autor.nombre} {autor.apellido or ''}".strip(),
            documento_id=documento.id,
            fecha_subida=subida,
        )
    )
    (carpeta / nombre_archivo).write_bytes(pdf_bytes)

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


def crear_planes_cal_mantenimiento(db, cantidad: int, equipos, admins) -> list:
    """Planes de calibración/mantenimiento: a lo sumo UNO por equipo y tipo.

    El backend lo exige al crear por la API (`_verificar_plan_activo_duplicado`):
    un equipo no puede tener dos planes activos del mismo tipo. La versión
    anterior elegía el equipo al azar en cada iteración y sembraba pares
    repetidos, es decir, datos que la aplicación no habría dejado crear.

    Se arman todos los pares (equipo, tipo) posibles y se toman `cantidad`
    sin repetir ninguno. Como los equipos también son `--cantidad`, siempre
    hay pares de sobra (2 × cantidad). Devuelve los planes creados.
    """
    print(f"⏳ Cargando {cantidad} planes de calibración/mantenimiento...")
    planes = []

    pares = [
        (equipo, tipo)
        for equipo in equipos
        for tipo in ("calibracion", "mantenimiento")
    ]
    random.shuffle(pares)

    for equipo, tipo in pares[:cantidad]:
        plan = PlanCalibracionMantenimiento(
            equipo_id=equipo.id,
            autor_id=random.choice(admins).id,
            tipo=tipo,
            fecha_ultima_intervencion=HOY - timedelta(days=random.randint(1, 200)),
            periodicidad_dias=random.choice([5, 15, 30, 60, 90, 180, 365]),
            activo=not bernoulli(0.05),
            fecha_creacion=hora_aleatoria(hora_max=18),
        )
        db.add(plan)
        planes.append(plan)

    db.flush()
    return planes


def crear_proveedores(db, cantidad: int, fake: Faker, vistos: dict) -> list:
    """Proveedores: catálogo de proveedores de insumos y servicios."""
    print(f"⏳ Cargando {cantidad} proveedores...")
    proveedores = []
    matriculas = vistos.setdefault("matricula", set())
    for _ in range(cantidad):
        nombre = unico(
            lambda: recortar(solo_letras(fake.company()), 120),
            vistos.setdefault("proveedor", set()),
            largo=120,
        )
        matricula = unico(
            lambda: f"MAT-{random.randint(1000, 99999)}",
            matriculas,
            largo=50,
        )
        matriculas.add(matricula)
        proveedores.append(
            Proveedor(
                nombre=nombre,
                matricula=matricula,
                activo=not bernoulli(0.05),
            )
        )
    db.add_all(proveedores)
    db.flush()
    return proveedores


def crear_stock_insumos(db, quimicos: list) -> list:
    """Stock inicial: un saldo por insumo químico."""
    print("⏳ Cargando stock de insumos químicos...")
    stocks = []
    for q in quimicos:
        if not q.activo:
            continue
        stocks.append(
            StockInsumoQuimico(
                insumo_quimico_id=q.id,
                cantidad_actual=round(random.uniform(0, 500), 3),
                stock_minimo=round(random.uniform(5, 50), 3)
                if random.random() < 0.7
                else None,
                actualizado_en=hora_aleatoria(hora_max=12),
            )
        )
    db.add_all(stocks)
    db.flush()
    return stocks


def crear_lotes_stock(
    db, cantidad: int, proveedores: list, quimicos: list, vistos: dict
) -> list:
    """Lotes de stock: cada lote necesita un movimiento de ingreso asociado.

    Devuelve los lotes creados. El lote y su movimiento de ingreso comparten la
    cantidad: antes cada uno sorteaba la suya y el ingreso no coincidía con el
    lote que lo originó.
    """
    print(f"⏳ Cargando {cantidad} lotes de stock...")
    lotes = []
    numeros_lote = vistos.setdefault("lote", set())
    quimicos_activos = [q for q in quimicos if q.activo]
    if not proveedores or not quimicos_activos:
        print("   ⚠️  No hay proveedores o químicos activos para crear lotes.")
        return lotes
    for _ in range(min(cantidad, len(proveedores) * len(quimicos_activos))):
        proveedor = random.choice(proveedores)
        quimico = random.choice(quimicos_activos)
        numero_lote = unico(
            lambda: f"LOTE-{random.randint(10000, 999999)}",
            numeros_lote,
            largo=100,
        )
        cantidad_lote = round(random.uniform(10, 200), 3)
        # Cada lote requiere un MovimientoStockInsumoQuimico (FK NOT NULL + UNIQUE).
        movimiento = MovimientoStockInsumoQuimico(
            insumo_quimico_id=quimico.id,
            cantidad_variacion=cantidad_lote,
            tipo=TipoMovimientoStock.INGRESO,
            fecha=hora_aleatoria(hora_max=10),
            motivo="Ingreso de lote de proveedor",
            nombre_producto=quimico.nombre,
            unidad_simbolo=quimico.unidad_medida.simbolo
            if quimico.unidad_medida
            else None,
        )
        db.add(movimiento)
        db.flush()
        lote = LoteStock(
            proveedor_id=proveedor.id,
            insumo_quimico_id=quimico.id,
            numero_lote=numero_lote,
            cantidad_producto=cantidad_lote,
            fecha_ingreso=hora_aleatoria(hora_max=10),
            creado_en=hora_aleatoria(hora_max=10),
            movimiento_ingreso_id=movimiento.id,
        )
        db.add(lote)
        lotes.append(lote)
    db.flush()
    return lotes


def crear_calibraciones(db, equipos: list) -> list:
    """Calibraciones: una por equipo de medición, con su certificado."""
    print("⏳ Cargando calibraciones de equipos...")
    calibraciones = []
    equipos_medicion = [e for e in equipos if e.tipo == "Medición" and e.activo]
    for equipo in equipos_medicion:
        fecha_real = HOY - timedelta(days=random.randint(1, 180))
        calibracion = Calibracion(
            equipo_id=equipo.id,
            fecha_realizacion=fecha_real,
            proximo_vencimiento=fecha_real
            + timedelta(days=equipo.frecuencia_calibracion_dias or 365),
            certificado_url=f"uploads/certificados/cal_{equipo.id}_{uuid.uuid4().hex[:8]}.pdf",
            tipo="calibracion",
            activo=not bernoulli(0.05),
        )
        db.add(calibracion)
        calibraciones.append(calibracion)
    db.flush()
    return calibraciones


def _tipo_movimiento_salida():
    """Un tipo de movimiento de stock que NO sea ingreso (consumo, egreso, ajuste).

    Se busca por nombre y, si ninguno coincide, se toma el primero que no sea
    INGRESO: así el seed no se rompe si el enum usa otro vocabulario. Devuelve
    None si el enum solo tiene INGRESO (en ese caso no se simulan consumos).
    """
    miembros = list(TipoMovimientoStock)
    for nombre in ("EGRESO", "CONSUMO", "SALIDA", "AJUSTE"):
        for miembro in miembros:
            if miembro.name == nombre:
                return miembro
    otros = [m for m in miembros if m is not TipoMovimientoStock.INGRESO]
    return otros[0] if otros else None


def crear_historial_registro_tarea(db) -> int:
    """Historial de registros de tarea: uno por cada registro completado."""
    print("⏳ Cargando historial de registros de tarea...")
    total = 0
    registros = db.scalars(
        select(RegistroTarea).where(RegistroTarea.completado == True)
    ).all()
    for r in registros:
        db.add(
            HistorialRegistroTarea(
                registro_tarea_id=r.id,
                completado=True,
                usuario_id=r.usuario_id,
                evidencia_url=r.evidencia_url,
                fecha_evento=r.fecha_completado or hora_aleatoria(hora_max=12),
            )
        )
        total += 1
    db.flush()
    return total


def crear_historial_incidente(db, admins: list) -> int:
    """Historial de incidentes: uno por cada incidente cerrado."""
    print("⏳ Cargando historial de incidentes...")
    total = 0
    incidentes_cerrados = db.scalars(
        select(Incidente).where(Incidente.estado == EstadoIncidente.CERRADO.value)
    ).all()
    for i in incidentes_cerrados:
        db.add(
            HistorialIncidente(
                incidente_id=i.id,
                estado_anterior=EstadoIncidente.ABIERTO.value,
                estado_nuevo=EstadoIncidente.CERRADO.value,
                usuario_id=i.responsable_cierre_id or random.choice(admins).id,
                observacion=i.observacion_cierre,
                fecha_evento=i.fecha_cierre or hora_aleatoria(hora_max=17),
            )
        )
        total += 1
    db.flush()
    return total


# ============================================================
# MAIN
# ============================================================

# ============================================================
# TRAZABILIDAD DE PRODUCCIÓN
# ============================================================

_MILESIMA = Decimal("0.001")


def _q(valor) -> Decimal:
    """Cantidad con tres decimales, como `Numeric(14, 3)`."""
    return Decimal(valor).quantize(_MILESIMA)


def _variar(valor: Decimal, minimo: float, maximo: float) -> Decimal:
    """Multiplica por un factor al azar en [minimo, maximo]."""
    return _q(Decimal(valor) * Decimal(str(round(random.uniform(minimo, maximo), 4))))


def _momento(dias_atras: int, hora_min: int = 6, hora_max: int = 18) -> datetime:
    """Fecha y hora de jornada laboral `dias_atras` días antes de hoy."""
    base = datetime.combine(HOY - timedelta(days=dias_atras), datetime.min.time())
    return base + timedelta(hours=random.randint(hora_min, hora_max), minutes=random.randint(0, 59))


def crear_ingredientes(db, unidades: dict, vistos: dict) -> dict:
    """Materias primas alimentarias que usan las recetas.

    En modo `--agregar` reutiliza las que ya existen con el mismo nombre.
    Devuelve {nombre: Insumo}.
    """
    print("⏳ Cargando materias primas para recetas...")
    existentes = {
        i.nombre: i
        for i in db.scalars(
            select(Insumo).where(Insumo.nombre.in_([n for n, _ in VOCAB_INGREDIENTES]))
        ).all()
    }
    aditivos = {a.nombre: a for a in db.scalars(select(Aditivo)).all()}
    for nombre, clave_unidad in VOCAB_INGREDIENTES:
        if nombre in existentes:
            continue
        referencia = aditivos.get(ADITIVO_DE_INGREDIENTE.get(nombre, ""))
        insumo = Insumo(
            nombre=nombre,
            unidad_medida_id=unidades[clave_unidad].id,
            # Sin la referencia cargada (base sin migrar) queda como ingrediente.
            tipo=TIPO_ADITIVO if referencia else TIPO_INGREDIENTE,
            aditivo=referencia,
        )
        db.add(insumo)
        existentes[nombre] = insumo
        vistos["insumo"].add(nombre)
    db.flush()
    return existentes


def _agregar_version(
    db, receta: Receta, numero: int, plantilla: dict, ingredientes: dict,
    unidades: dict, autor: Personal, creada_en: datetime, ajuste: Optional[tuple] = None,
) -> VersionReceta:
    """Crea una versión completa (insumos, tareas y reparto) a partir de la plantilla.

    `ajuste` = (mínimo, máximo) varía las cantidades: así la versión 2 difiere
    de la 1 como pasaría al corregir una receta.
    """
    porcion = PORCION_POR_PRODUCTO.get(plantilla["producto"])
    version = VersionReceta(
        receta=receta,
        numero=numero,
        rendimiento=_q(plantilla["rendimiento"]),
        unidad_medida_id=unidades[plantilla["unidad"]].id,
        porcion_descripcion=porcion[0] if porcion else None,
        porcion_cantidad=_q(porcion[1]) if porcion else None,
        porcion_unidad_medida_id=unidades[porcion[2]].id if porcion else None,
        creado_por_id=autor.id,
        creado_en=creada_en,
    )
    tareas = [
        TareaReceta(version=version, orden=i, descripcion=descripcion)
        for i, descripcion in enumerate(plantilla["tareas"], start=1)
    ]
    for nombre, cantidad, _clasificacion, indice_tarea in plantilla["insumos"]:
        insumo = ingredientes[nombre]
        total = _q(cantidad) if ajuste is None else _variar(Decimal(cantidad), *ajuste)
        receta_insumo = RecetaInsumo(
            version=version,
            insumo=insumo,
            cantidad=total,
            unidad_medida_id=insumo.unidad_medida_id,
            # Como el service: la clasificación sale del maestro de insumos.
            clasificacion=insumo.tipo,
        )
        # Todo el insumo va a la tarea indicada: el reparto suma el total,
        # que es lo que valida el service al crear la versión.
        TareaRecetaInsumo(tarea=tareas[indice_tarea], receta_insumo=receta_insumo, cantidad=total)
    db.add(version)
    return version


def crear_productos_y_recetas(
    db, cantidad: int, ingredientes: dict, unidades: dict, admins: list, vistos: dict
) -> tuple[list, dict]:
    """Productos con su receta: v1 para todos, v2 para ~40% (la v1 queda de solo lectura).

    Devuelve (productos, {producto_id: [versiones ordenadas]}).
    """
    print(f"⏳ Cargando {cantidad} productos con sus recetas versionadas...")
    productos = []
    versiones: dict = {}
    for i in range(cantidad):
        plantilla = VOCAB_RECETAS[i % len(VOCAB_RECETAS)]
        base = plantilla["producto"]
        nombre = (
            base
            if base not in vistos["producto"]
            else unico(lambda: f"{base} {random.choice(VARIANTES_PRODUCTO)}", vistos["producto"], largo=120)
        )
        vistos["producto"].add(nombre)
        producto = Producto(
            nombre=nombre,
            descripcion=f"Elaborado según la receta de {base.lower()}.",
            unidad_medida_id=unidades[plantilla["unidad"]].id,
            activo=not bernoulli(0.07),
        )
        receta = Receta(producto=producto, activo=True, creado_en=_momento(random.randint(200, 240)))
        lista = [
            _agregar_version(
                db, receta, 1, plantilla, ingredientes, unidades,
                random.choice(admins), receta.creado_en,
            )
        ]
        if bernoulli(0.4):
            lista.append(
                _agregar_version(
                    db, receta, 2, plantilla, ingredientes, unidades,
                    random.choice(admins), _momento(random.randint(30, 90)), ajuste=(0.85, 1.15),
                )
            )
        db.add_all([producto, receta])
        productos.append(producto)
        versiones[producto] = lista
    db.flush()
    return productos, {p.id: versiones[p] for p in productos}


def crear_lotes_insumo(db, ingredientes: dict, proveedores: list, admins: list, vistos: dict) -> list:
    """Entre 2 y 4 lotes recibidos por materia prima, de proveedores activos.

    Las cantidades son holgadas; si la producción simulada agota un lote, se
    registra una reposición (ver `_lote_para_consumir`).
    """
    print("⏳ Cargando lotes de insumo recibidos...")
    activos = [p for p in proveedores if p.activo] or proveedores
    lotes = []
    for nombre, insumo in ingredientes.items():
        clave_unidad = next(c for n, c in VOCAB_INGREDIENTES if n == nombre)
        # Cantidad recibida típica según la unidad (g y mL vienen en bolsas grandes).
        escala = {"gramo": (2000, 10000), "mililitro": (500, 3000), "unidad": (180, 720)}.get(
            clave_unidad, (25, 120)
        )
        for _ in range(random.randint(2, 4)):
            ingreso = HOY - timedelta(days=random.randint(5, 230))
            lotes.append(
                _nuevo_lote_insumo(
                    insumo, random.choice(activos), ingreso,
                    _q(random.randint(*escala)), random.choice(admins), vistos,
                )
            )
    db.add_all(lotes)
    db.flush()
    return lotes


def _nuevo_lote_insumo(insumo, proveedor, ingreso: date, cantidad: Decimal, autor, vistos: dict) -> LoteInsumo:
    numero = unico(
        lambda: f"{slug(proveedor.nombre)[:3].upper()}-{ingreso:%y%m}-{random.randint(100, 9999)}",
        vistos["lote_insumo"],
        largo=100,
    )
    return LoteInsumo(
        insumo=insumo,
        proveedor=proveedor,
        numero_lote=numero,
        cantidad_recibida=cantidad,
        fecha_ingreso=ingreso,
        # Unos pocos sin vencimiento (insumos no perecederos).
        fecha_vencimiento=None if bernoulli(0.1) else ingreso + timedelta(days=random.randint(45, 365)),
        creado_por_id=autor.id,
        creado_en=datetime.combine(ingreso, datetime.min.time()) + timedelta(hours=9),
    )


def _lote_para_consumir(
    db, insumo, cuando: date, necesario: Decimal, saldos: dict, lotes: list,
    proveedores: list, admins: list, vistos: dict,
) -> list[tuple]:
    """Elige de qué lotes sale `necesario`, por FEFO (primero el que vence antes).

    Solo considera lotes ya recibidos en esa fecha y no vencidos. Si el saldo
    no alcanza, el resto sale de una reposición recibida días antes, como
    pasaría en la planta. Devuelve [(lote, cantidad)].
    """
    candidatos = sorted(
        (
            l for l in lotes
            if l.insumo is insumo
            and l.fecha_ingreso <= cuando
            and (l.fecha_vencimiento is None or l.fecha_vencimiento >= cuando)
            and saldos[l] > 0
        ),
        key=lambda l: (l.fecha_vencimiento or date.max, l.fecha_ingreso),
    )
    partes = []
    pendiente = necesario
    for lote in candidatos:
        if pendiente <= 0:
            break
        toma = min(pendiente, saldos[lote])
        partes.append((lote, toma))
        saldos[lote] -= toma
        pendiente -= toma
    if pendiente > 0:
        activos = [p for p in proveedores if p.activo] or proveedores
        reposicion = _nuevo_lote_insumo(
            insumo, random.choice(activos), cuando - timedelta(days=random.randint(1, 6)),
            _q(pendiente * random.randint(4, 10)), random.choice(admins), vistos,
        )
        db.add(reposicion)
        lotes.append(reposicion)
        saldos[reposicion] = reposicion.cantidad_recibida - pendiente
        partes.append((reposicion, pendiente))
    return partes


def crear_lotes_produccion(
    db, cantidad: int, productos: list, versiones: dict, lotes_insumo: list,
    proveedores: list, admins: list, operadores: list, vistos: dict,
) -> dict:
    """Lotes de producto con checklist y consumos, en los tres estados.

    Sigue las reglas del service: el lote fija la versión vigente a su fecha,
    el checklist tiene una fila por tarea, los consumos salen de lotes de
    insumo por FEFO y los lotes terminados/cancelados quedan de solo lectura.
    Se inserta `en_proceso` y se cierra después, porque los eventos del ORM
    rechazan checklist o consumos sobre un lote ya cerrado.
    """
    print(f"⏳ Cargando {cantidad} lotes de producción con checklist y consumos...")
    cuenta = {"lotes": 0, "items": 0, "consumos": 0, "desperdicios": 0}
    saldos: dict = {}
    for lote in lotes_insumo:
        consumido = db.scalar(
            select(func.coalesce(func.sum(ConsumoInsumo.cantidad), 0)).where(
                ConsumoInsumo.lote_insumo_id == lote.id
            )
        )
        saldos[lote] = _q(lote.cantidad_recibida) - _q(consumido)

    con_receta = [p for p in productos if versiones.get(p.id)]
    if not con_receta:
        return cuenta

    # Fechas de más vieja a más nueva, así el FEFO consume en orden.
    # Los más recientes (últimos 3 días) quedan en proceso: siempre hay
    # algunos para probar el checklist y el registro de consumos.
    recientes = min(cantidad, max(2, cantidad // 8))
    dias = sorted(
        [random.randint(4, 180) for _ in range(cantidad - recientes)]
        + [random.randint(0, 3) for _ in range(recientes)],
        reverse=True,
    )
    for dias_atras in dias:
        producto = random.choice(con_receta)
        inicio = _momento(dias_atras, 6, 12)
        vigentes = [v for v in versiones[producto.id] if v.creado_en <= inicio]
        version = (vigentes or versiones[producto.id][:1])[-1]

        if dias_atras <= 3:
            estado = ESTADO_EN_PROCESO
        else:
            estado = ESTADO_CANCELADO if bernoulli(0.1) else ESTADO_TERMINADO

        objetivo = _q(Decimal(version.rendimiento) * Decimal(random.choice(["0.5", "1", "1.5", "2", "3"])))
        factor = (objetivo / Decimal(version.rendimiento)).quantize(Decimal("0.000001"))
        # `LP-AAAAMMDD-NNN` con contador diario, como `generar_numero_lote`.
        correlativo = 1
        while (numero := f"{PREFIJO_NUMERO_LOTE}-{inicio:%Y%m%d}-{correlativo:03d}") in vistos["lote_producto"]:
            correlativo += 1
        vistos["lote_producto"].add(numero)
        lote = LoteProducto(
            numero_lote=numero,
            producto=producto,
            version_receta=version,
            estado=ESTADO_EN_PROCESO,
            cantidad_objetivo=objetivo,
            factor_escala=factor,
            creado_por_id=random.choice(admins).id,
            fecha_inicio=inicio,
        )
        db.add(lote)

        tareas = sorted(version.tareas, key=lambda t: t.orden)
        if estado == ESTADO_TERMINADO:
            hechas = len(tareas)
        elif estado == ESTADO_CANCELADO:
            hechas = random.randint(0, max(0, len(tareas) - 1))
        else:
            hechas = random.randint(0, len(tareas))

        momento = inicio
        for indice, tarea in enumerate(tareas):
            # `db.add` explícito: en SQLAlchemy 2.0 asignar `lote=` no mete el
            # objeto en la sesión (el lote ya estaba agregado).
            item = ChecklistProduccion(lote=lote, tarea=tarea)
            db.add(item)
            cuenta["items"] += 1
            if indice >= hechas:
                continue
            momento += timedelta(minutes=random.randint(25, 150))
            operador = random.choice(operadores)
            item.completado_por_id = operador.id
            item.completado_en = momento
            for reparto in tarea.insumos:
                insumo = reparto.receta_insumo.insumo
                planificado = _q(Decimal(reparto.cantidad) * factor)
                real = _variar(planificado, 0.95, 1.08)
                for lote_insumo, parte in _lote_para_consumir(
                    db, insumo, momento.date(), real, saldos, lotes_insumo,
                    proveedores, admins, vistos,
                ):
                    db.add(ConsumoInsumo(
                        checklist=item, lote_insumo=lote_insumo, cantidad=parte,
                        tipo=TIPO_CONSUMO_REAL, registrado_por_id=operador.id,
                        registrado_en=momento,
                    ))
                    cuenta["consumos"] += 1
                if bernoulli(0.12):
                    perdida = max(_variar(planificado, 0.02, 0.05), _MILESIMA)
                    for lote_insumo, parte in _lote_para_consumir(
                        db, insumo, momento.date(), perdida, saldos, lotes_insumo,
                        proveedores, admins, vistos,
                    ):
                        db.add(ConsumoInsumo(
                            checklist=item, lote_insumo=lote_insumo, cantidad=parte,
                            tipo=TIPO_CONSUMO_DESPERDICIO, motivo=random.choice(MOTIVOS_DESPERDICIO),
                            registrado_por_id=operador.id, registrado_en=momento,
                        ))
                        cuenta["desperdicios"] += 1
        db.flush()

        # Cierre: recién ahora, con el checklist y los consumos ya en la base.
        if estado == ESTADO_TERMINADO:
            lote.estado = ESTADO_TERMINADO
            lote.cantidad_producida = _variar(objetivo, 0.9, 1.02)
            lote.fecha_cierre = momento + timedelta(minutes=random.randint(10, 60))
        elif estado == ESTADO_CANCELADO:
            lote.estado = ESTADO_CANCELADO
            lote.motivo_cancelacion = random.choice(MOTIVOS_CANCELACION_LOTE)
            lote.fecha_cierre = momento + timedelta(minutes=random.randint(10, 60))
        db.flush()
        cuenta["lotes"] += 1

    # Ajustes de stock: algunos lotes viejos se dan de baja (vencidos o
    # descartados). La baja es lógica: los consumos ya registrados se conservan.
    for lote in lotes_insumo:
        vencido = lote.fecha_vencimiento is not None and lote.fecha_vencimiento < HOY
        if (vencido and bernoulli(0.6)) or bernoulli(0.04):
            lote.activo = False
            lote.motivo_baja = "Vencido sin consumir" if vencido else random.choice(MOTIVOS_BAJA_LOTE_INSUMO)
            lote.fecha_baja = datetime.combine(
                max(lote.fecha_vencimiento or lote.fecha_ingreso, lote.fecha_ingreso), datetime.min.time()
            ) + timedelta(days=1, hours=10)
    db.flush()
    cuenta["lotes_insumo"] = len(lotes_insumo)
    return cuenta


def simular_actividad_trazabilidad(db, admins: list, productos: list, lotes_insumo: list) -> dict:
    """Historia en la bitácora para productos y lotes de insumo.

    Las versiones de receta y los lotes cerrados son inmutables, así que su
    "modificación" ya quedó registrada como alta de una versión nueva o como
    cierre/cancelación. Acá se cubre lo editable: producto (modificar, baja y
    reactivación) y la baja lógica de lotes de insumo.
    """
    cuenta = {"modificados": 0, "bajas": 0, "reactivados": 0}

    def commit(clave: str) -> None:
        db.info["usuario_id"] = random.choice(admins).id
        db.commit()
        cuenta[clave] += 1

    for producto in random.sample(productos, min(3, len(productos))):
        db.refresh(producto)
        producto.descripcion = recortar(f"{producto.descripcion or ''} Presentación revisada.", 500)
        commit("modificados")
    activos = [p for p in productos if p.activo]
    for producto in random.sample(activos, min(2, len(activos))):
        db.refresh(producto)
        producto.activo = False
        commit("bajas")
        db.refresh(producto)
        producto.activo = True
        commit("reactivados")
    disponibles = [l for l in lotes_insumo if l.activo]
    for lote in random.sample(disponibles, min(2, len(disponibles))):
        db.refresh(lote)
        lote.activo = False
        lote.motivo_baja = random.choice(MOTIVOS_BAJA_LOTE_INSUMO)
        lote.fecha_baja = datetime.now().replace(microsecond=0)
        commit("bajas")
    return cuenta


# ============================================================
# VISTA PÚBLICA, NOTIFICACIONES Y SESIONES
# ============================================================

def crear_vista_publica(db) -> int:
    """Habilita la vista pública con un código y elige qué indicadores publicar.

    Respeta lo que ya exista (no pisa un código vigente ni preferencias).
    Devuelve la cantidad de indicadores agregados.
    """
    print("⏳ Cargando configuración de la vista pública...")
    if db.get(ConfiguracionVistaPublica, 1) is None:
        db.add(
            ConfiguracionVistaPublica(
                id=1, habilitada=True, codigo_publico=secrets.token_urlsafe(32)
            )
        )
    agregados = 0
    for definicion in CATALOGO_VISTA_PUBLICA:
        if db.get(IndicadorVistaPublica, definicion.clave) is not None:
            continue
        db.add(IndicadorVistaPublica(clave=definicion.clave, habilitado=bernoulli(0.75)))
        agregados += 1
    db.flush()
    return agregados


def crear_sesiones_auth(db, personal: list) -> dict:
    """Refresh tokens, tokens revocados e intentos de login de ejemplo.

    Son filas de bookkeeping: los `jti` son aleatorios y no corresponden a
    ningún JWT firmado, así que no abren sesión. Los intentos de login usan IPs
    de documentación para no bloquear a nadie que pruebe en local.
    """
    print("⏳ Cargando sesiones, revocaciones e intentos de login...")
    ahora_utc = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    cuenta = {"refresh": 0, "revocados": 0, "intentos": 0}
    activos = [p for p in personal if p.activo] or personal
    for persona in random.sample(activos, max(1, len(activos) // 3)):
        familia = uuid.uuid4().hex
        # Una familia rotada: tokens viejos usados y el último vigente.
        for paso in range(random.randint(1, 3)):
            creado = ahora_utc - timedelta(days=random.randint(0, 6), hours=paso)
            db.add(
                RefreshToken(
                    jti=uuid.uuid4().hex,
                    usuario_id=persona.id,
                    familia=familia,
                    usado=paso > 0,
                    expira=creado + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                    creado_en=creado,
                )
            )
            cuenta["refresh"] += 1
        if bernoulli(0.5):
            db.add(
                TokenRevocado(
                    jti=uuid.uuid4().hex,
                    usuario_id=persona.id,
                    tipo=random.choice(["access", "refresh"]),
                    expira=ahora_utc + timedelta(minutes=random.randint(5, 30)),
                    revocado_en=ahora_utc - timedelta(minutes=random.randint(1, 120)),
                )
            )
            cuenta["revocados"] += 1
    for persona in random.sample(activos, min(4, len(activos))):
        ip = random.choice(IPS_INTENTOS_LOGIN)
        contador = random.randint(1, settings.LOGIN_MAX_INTENTOS)
        db.merge(
            IntentoLogin(
                ip=ip,
                dni=persona.dni,
                ultimo_intento=ahora_utc - timedelta(minutes=random.randint(1, 30)),
                contador=contador,
                bloqueado_hasta=(
                    ahora_utc + timedelta(minutes=settings.LOGIN_VENTANA_MINUTOS)
                    if contador >= settings.LOGIN_MAX_INTENTOS
                    else None
                ),
            )
        )
        cuenta["intentos"] += 1
    db.flush()
    return cuenta


def simular_actividad(
    db,
    fake: Faker,
    vistos: dict,
    password: str,
    admins: list,
    personal: list,
    equipos: list,
    aptitudes: list,
    quimicos: list,
    elementos: list,
    insumos: list,
    proveedores: Optional[list] = None,
    stocks: Optional[list] = None,
    lotes: Optional[list] = None,
    calibraciones: Optional[list] = None,
    planes: Optional[list] = None,
    planes_cal: Optional[list] = None,
    unidades: Optional[dict] = None,
) -> dict:
    """Genera historia en la bitácora: modificaciones, bajas, reactivaciones y bajas físicas.

    Las altas ya quedaron registradas al cargar los datos. Acá se opera sobre
    lo recién creado como lo haría la gente en la app: cada cambio es un
    commit propio, hecho por un administrador al azar (`session.info`), así la
    bitácora trae acciones MODIFICAR / BAJA / REACTIVAR / ELIMINAR con actores
    distintos. Se hace por el ORM (nunca con UPDATE/DELETE masivos) porque son
    los eventos del ORM los que alimentan la auditoría.

    Cubre todas las entidades auditadas con operaciones propias de cada una:

      * catálogos (equipos, aptitudes, insumos, elementos, químicos, sectores,
        unidades de medida, proveedores, configuración de alertas);
      * stock: consumos que bajan el saldo y dejan su movimiento de egreso,
        cambios del stock mínimo, corrección y borrado de lotes;
      * personal y vencimientos (renovación, baja, reactivación, borrado);
      * calibraciones y planes de calibración/mantenimiento;
      * planes de limpieza y sus tareas;
      * incidentes (reclasificación, cierre con su historial, borrado de
        cargas erróneas);
      * documentos (renombrar, renovar vencimiento, nueva versión que archiva
        la vigente, borrado de versiones archivadas y de documentos);
      * checklists (observación del supervisor, cierre).

    Solo se BORRA lo que nadie referencia: el resto se da de baja. Si aun así
    una FK lo impide, el borrado se deshace y se cuenta como `omitidos`.
    """
    print("⏳ Simulando actividad (modificaciones, bajas, reactivaciones y eliminaciones)...")
    cuenta = {"modificados": 0, "bajas": 0, "reactivados": 0, "eliminados": 0, "omitidos": 0}
    proveedores = list(proveedores or [])
    stocks = list(stocks or [])
    lotes = list(lotes or [])
    calibraciones = list(calibraciones or [])
    planes = list(planes or [])
    planes_cal = list(planes_cal or [])
    unidades = unidades or {}
    por_tipo = max(1, len(equipos) // 3)
    tipo_salida = _tipo_movimiento_salida()

    def como_admin_commit(clave: str, actor=None) -> None:
        """Un evento de negocio = un commit hecho por un administrador (al azar o el dado)."""
        db.info["usuario_id"] = (actor or random.choice(admins)).id
        db.commit()
        cuenta[clave] += 1

    def eliminar(*objetos) -> bool:
        """Borra los objetos en orden (hijos primero) y commitea como un solo evento.

        Si una FK lo impide se deshace y se sigue: no es un error del seed, solo
        una fila que la aplicación tampoco dejaría borrar.
        """
        db.info["usuario_id"] = random.choice(admins).id
        try:
            for objeto in objetos:
                db.delete(objeto)
                db.flush()
            db.commit()
        except IntegrityError:
            db.rollback()
            cuenta["omitidos"] += 1
            return False
        cuenta["eliminados"] += 1
        return True

    def muestra(lista: list, n: int = por_tipo):
        """Elige `n` objetos y los entrega de a uno, recargados.

        Cada commit expira todos los objetos de la sesión. Sobre un objeto
        expirado, asignar un campo no conoce el valor anterior y el diff de la
        bitácora saldría como [null, nuevo]. Recargarlo justo antes de
        tocarlo deja el "antes" correcto (en la app pasa igual: se lee y luego
        se modifica).
        """
        for objeto in random.sample(lista, min(n, len(lista))):
            db.refresh(objeto)
            yield objeto

    def muestra_por_id(modelo, condicion=None, n: int = por_tipo):
        """Como `muestra`, pero para tablas grandes: se sortean ids y se cargan de a uno.

        Sirve para checklists, incidentes o documentos, donde traer todas las
        filas solo para elegir unas pocas sería caro (`--cantidad 200` x días).
        """
        consulta = select(modelo.id)
        if condicion is not None:
            consulta = consulta.where(condicion)
        ids = list(db.scalars(consulta).all())
        for id_ in random.sample(ids, min(n, len(ids))):
            objeto = db.get(modelo, id_)
            if objeto is not None:
                db.refresh(objeto)
                yield objeto

    quimico_por_id = {q.id: q for q in quimicos}

    try:
        # ---------------- MODIFICAR ----------------
        for equipo in muestra(equipos):
            equipo.frecuencia_calibracion_dias = random.choice(
                [d for d in (90, 180, 365) if d != equipo.frecuencia_calibracion_dias]
            )
            _, _, ubicacion = random.choice(VOCAB_EQUIPOS)
            equipo.sector_id = obtener_o_crear_sector(db, ubicacion).id
            como_admin_commit("modificados")

        # Sectores: se renombran DESPUÉS de reasignar equipos, que busca el
        # sector por su nombre original.
        for sector in muestra_por_id(Sector):
            base = sector.nombre
            sector.nombre = unico(
                lambda: f"{base} {random.choice(['Norte', 'Sur', 'Principal', 'Auxiliar'])}",
                vistos["sector"],
                largo=40,
            )
            como_admin_commit("modificados")

        for insumo in muestra(insumos):
            base = insumo.nombre
            insumo.nombre = unico(
                lambda: recortar(f"{base} {random.choice(['Pro', 'Plus', 'XL', 'Eco'])}", 100),
                vistos["insumo"],
                largo=100,
            )
            como_admin_commit("modificados")

        for elemento in muestra(elementos):
            elemento.frecuencia_recambio_dias = random.choice([15, 30, 60, 90])
            elemento.fecha_ultimo_recambio = HOY - timedelta(days=random.randint(0, 20))
            como_admin_commit("modificados")

        for aptitud in muestra(aptitudes):
            aptitud.descripcion = recortar(fake.sentence(nb_words=8), 255)
            como_admin_commit("modificados")

        for persona in muestra(personal):
            persona.telefono = unico(
                lambda: f"+549{random.randint(11, 292)}{random.randint(10_000_000, 99_999_999)}",
                vistos["telefono"],
                largo=15,
            )
            como_admin_commit("modificados")

        ids_personal = [p.id for p in personal]
        vencimientos = list(
            db.scalars(
                select(VencimientoPersonal).where(VencimientoPersonal.persona_id.in_(ids_personal))
            ).all()
        )
        for vencimiento in muestra(vencimientos):
            # Renovación: se corre la fecha de vencimiento hacia adelante.
            vencimiento.fecha_vencimiento = vencimiento.fecha_vencimiento + timedelta(
                days=random.choice([90, 180, 365])
            )
            como_admin_commit("modificados")

        # Cambio de contraseña: se audita que cambió, pero redactado ("***").
        # Un hash nuevo (otra sal) para que haya un cambio neto de verdad.
        hash_nuevo = hashear_password(password)
        for persona in muestra([p for p in personal if not p.es_super_admin], 2):
            persona.password = hash_nuevo
            como_admin_commit("modificados")

        # Proveedores: cambia la razón social o se corrige la matrícula.
        for proveedor in muestra(proveedores):
            if bernoulli(0.5):
                base = proveedor.nombre
                proveedor.nombre = unico(
                    lambda: recortar(
                        solo_letras(f"{base} {random.choice(['SA', 'SRL', 'Hnos', 'y Cía'])}"), 120
                    ),
                    vistos["proveedor"],
                    largo=120,
                )
            else:
                proveedor.matricula = unico(
                    lambda: f"MAT-{random.randint(1000, 99999)}", vistos["matricula"], largo=50
                )
            como_admin_commit("modificados")

        # Stock de insumos químicos: la mayoría de las veces es un consumo, que
        # baja el saldo y deja el movimiento de egreso que lo explica; el resto
        # son ajustes del stock mínimo.
        for stock in muestra(stocks):
            actor = random.choice(admins)
            actual = float(stock.cantidad_actual or 0)
            quimico = quimico_por_id.get(stock.insumo_quimico_id)
            if tipo_salida is not None and quimico is not None and actual > 0 and bernoulli(0.7):
                consumo = round(min(actual, random.uniform(1, 30)), 3)
                stock.cantidad_actual = round(actual - consumo, 3)
                movimiento = MovimientoStockInsumoQuimico(
                    insumo_quimico_id=quimico.id,
                    cantidad_variacion=-consumo,
                    tipo=tipo_salida,
                    fecha=datetime.now(),
                    motivo=random.choice(MOTIVOS_EGRESO),
                    nombre_producto=quimico.nombre,
                    unidad_simbolo=quimico.unidad_medida.simbolo
                    if quimico.unidad_medida
                    else None,
                )
                if hasattr(MovimientoStockInsumoQuimico, "responsable_id"):
                    movimiento.responsable_id = actor.id
                db.add(movimiento)
            else:
                stock.stock_minimo = round(random.uniform(5, 50), 3)
            stock.actualizado_en = datetime.now()
            como_admin_commit("modificados", actor)

        # Lotes: se corrige un número de lote cargado a mano.
        for lote in muestra(lotes):
            lote.numero_lote = unico(
                lambda: f"LOTE-{random.randint(10000, 999999)}", vistos["lote"], largo=100
            )
            como_admin_commit("modificados")

        # Calibraciones: se corrige la fecha del próximo vencimiento.
        for calibracion in muestra(calibraciones):
            calibracion.proximo_vencimiento = calibracion.proximo_vencimiento + timedelta(
                days=random.choice([30, 90, 180])
            )
            como_admin_commit("modificados")

        # Planes de calibración/mantenimiento: se registra una intervención reciente.
        for plan_cal in muestra(planes_cal):
            plan_cal.fecha_ultima_intervencion = HOY - timedelta(days=random.randint(0, 30))
            if bernoulli(0.4):
                plan_cal.periodicidad_dias = random.choice(
                    [d for d in (30, 60, 90, 180, 365) if d != plan_cal.periodicidad_dias]
                )
            como_admin_commit("modificados")

        # Planes de limpieza: se renombran (solo letras, como exige el schema).
        for plan in muestra(planes):
            base = plan.nombre[:48].rstrip()
            plan.nombre = unico(
                lambda: recortar(
                    solo_letras(f"{base} {random.choice(['revisado', 'ajustado', 'vigente'])}"), 60
                ),
                vistos["plan"],
                largo=60,
            )
            como_admin_commit("modificados")

        # Tareas de esos planes: cambia la frecuencia y la observación.
        tareas = [t for p in planes for t in p.tareas]
        for tarea in muestra(tareas):
            tarea.frecuencia = random.choice([d for d in (1, 2, 3, 7, 15, 30) if d != tarea.frecuencia])
            tarea.observaciones = random.choice(OBSERVACIONES)
            como_admin_commit("modificados")

        # Unidades de medida: se corrige el símbolo de alguna.
        for unidad in muestra(list(unidades.values())):
            nuevo = SIMBOLOS_ALTERNATIVOS.get(unidad.simbolo)
            if nuevo and nuevo != unidad.simbolo:
                unidad.simbolo = nuevo
                como_admin_commit("modificados")

        # Configuración de alertas: un administrador ajusta los umbrales.
        for clave, opciones in (
            ("vencimiento_proximo_dias", (3, 5, 10, 15)),
            ("alerta_calibracion_dias", (15, 45, 60)),
            ("alerta_insumo_bajo_stock", (5, 15, 20)),
        ):
            config = db.get(ConfiguracionAlerta, clave)
            if config is not None:
                db.refresh(config)
                config.valor = random.choice([v for v in opciones if v != config.valor])
                como_admin_commit("modificados")

        # Documentos: se renombran y se renueva el vencimiento de la versión vigente.
        for documento in muestra_por_id(Documento):
            base = documento.nombre[:85].rstrip()
            documento.nombre = unico(
                lambda: recortar(f"{base} rev {random.randint(2, 9)}", 100),
                vistos["documento"],
                largo=100,
            )
            como_admin_commit("modificados")

        for version in muestra_por_id(
            VersionDocumento,
            VersionDocumento.vigente.is_(True) & VersionDocumento.fecha_vencimiento.is_not(None),
        ):
            version.fecha_vencimiento = HOY + timedelta(days=random.choice([90, 180, 365]))
            como_admin_commit("modificados")

        # Nueva versión: la vigente pasa a archivada y se sube otra. Es un
        # MODIFICAR (la archivada) más un CREAR (la nueva) en el mismo evento.
        carpeta_docs = CARPETA_UPLOADS / "documentos"
        carpeta_docs.mkdir(parents=True, exist_ok=True)
        for documento in muestra_por_id(Documento):
            vigente = db.scalar(
                select(VersionDocumento).where(
                    VersionDocumento.documento_id == documento.id,
                    VersionDocumento.vigente.is_(True),
                )
            )
            if vigente is None:
                continue
            ultimo = db.scalar(
                select(func.max(VersionDocumento.numero_version)).where(
                    VersionDocumento.documento_id == documento.id
                )
            )
            actor = random.choice(admins)
            ahora = datetime.now()
            # El actor tiene que estar en la sesión antes del flush que audita el UPDATE.
            db.info["usuario_id"] = actor.id
            vigente.vigente = False
            vigente.vigente_hasta = ahora
            vigente.fecha_vencimiento = None  # una archivada ya no rige
            db.flush()  # archivar antes de insertar la nueva (una sola vigente)
            _guardar_version(
                db,
                carpeta_docs,
                documento,
                numero_version=(ultimo or 0) + 1,
                nombre_documento=documento.nombre,
                autor=actor,
                vigente=True,
                subida=ahora,
                vencimiento=(
                    HOY + timedelta(days=random.choice([90, 180, 365])) if bernoulli(0.6) else None
                ),
                vigente_hasta=None,
            )
            como_admin_commit("modificados", actor)

        # Incidentes abiertos: se reclasifican y se cierran (con su historial).
        for incidente in muestra_por_id(
            Incidente, Incidente.estado == EstadoIncidente.ABIERTO.value
        ):
            opciones = [v for v in VOCAB_INCIDENTES if v[2] != incidente.descripcion]
            tipo, _, descripcion = random.choice(opciones)
            incidente.tipo = tipo.value
            incidente.descripcion = descripcion
            como_admin_commit("modificados")

        for incidente in muestra_por_id(
            Incidente, Incidente.estado == EstadoIncidente.ABIERTO.value
        ):
            responsable = random.choice(admins)
            ahora = datetime.now()
            observacion = random.choice(OBSERVACIONES_CIERRE)
            incidente.estado = EstadoIncidente.CERRADO.value
            incidente.fecha_cierre = ahora
            incidente.observacion_cierre = observacion
            incidente.responsable_cierre_id = responsable.id
            db.add(
                HistorialIncidente(
                    incidente_id=incidente.id,
                    estado_anterior=EstadoIncidente.ABIERTO.value,
                    estado_nuevo=EstadoIncidente.CERRADO.value,
                    usuario_id=responsable.id,
                    observacion=observacion,
                    fecha_evento=ahora,
                )
            )
            como_admin_commit("modificados", responsable)

        # Checklists: el supervisor observa uno cerrado, cierra uno observado
        # y cierra uno completo.
        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.CERRADO):
            checklist.estado = EstadoChecklist.OBSERVADO
            checklist.observaciones = random.choice(OBSERVACIONES_CHECKLIST)
            checklist.supervisor_id = random.choice(admins).id
            como_admin_commit("modificados")

        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.OBSERVADO):
            checklist.estado = EstadoChecklist.CERRADO
            como_admin_commit("modificados")

        for checklist in muestra_por_id(Checklist, Checklist.estado == EstadoChecklist.COMPLETO):
            checklist.estado = EstadoChecklist.CERRADO
            checklist.supervisor_id = random.choice(admins).id
            como_admin_commit("modificados")

        # ---------------- BAJA ----------------
        # A los administradores no se los da de baja: son los actores del resto.
        candidatos_baja = [
            p for p in personal if not p.puede_administrar and not p.es_super_admin
        ]
        grupos = [
            equipos, insumos, quimicos, elementos, aptitudes, vencimientos, candidatos_baja,
            proveedores, calibraciones, planes, planes_cal,
        ]
        for grupo in grupos:
            for objeto in muestra([o for o in grupo if o.activo]):
                objeto.activo = False
                como_admin_commit("bajas")

        # ---------------- REACTIVAR ----------------
        # Mezcla de lo que se acaba de dar de baja y de lo que ya nació inactivo.
        for grupo in grupos:
            inactivos = [o for o in grupo if not o.activo]
            for objeto in muestra(inactivos, max(1, len(inactivos) // 2)):
                objeto.activo = True
                como_admin_commit("reactivados")

        # ---------------- ELIMINAR ----------------
        # Solo se borra lo que nadie referencia: el resto se da de baja. Un
        # insumo general y un vencimiento no los referencia nadie.
        for objeto in chain(muestra(insumos), muestra(vencimientos)):
            db.delete(objeto)
            como_admin_commit("eliminados")

        # Lotes cargados por error (el movimiento de ingreso queda como historia).
        for lote in muestra(lotes, max(1, len(lotes) // 6)):
            eliminar(lote)

        # Proveedores que no tienen ningún lote (ni de químicos ni de insumos).
        con_lotes = set(db.scalars(select(LoteStock.proveedor_id)).all()) | set(
            db.scalars(select(LoteInsumo.proveedor_id)).all()
        )
        sin_lotes = [p for p in proveedores if p.id not in con_lotes]
        for proveedor in random.sample(sin_lotes, min(por_tipo, len(sin_lotes))):
            eliminar(proveedor)

        # Se borra a lo sumo la mitad: con pocas calibraciones (una por equipo
        # de medición) borrar `por_tipo` dejaba la tabla vacía.
        for objeto in chain(
            muestra(calibraciones, len(calibraciones) // 2), muestra(planes_cal)
        ):
            eliminar(objeto)

        # Incidentes abiertos cargados por error. Los del superadmin se conservan:
        # son los que dan segunda página a "Mis reportes".
        superadmin_id = personal[0].id if personal else None
        for incidente in muestra_por_id(
            Incidente,
            (Incidente.estado == EstadoIncidente.ABIERTO.value)
            & (Incidente.usuario_id != superadmin_id),
        ):
            eliminar(incidente)

        # Versiones archivadas, y algún documento entero (sus versiones primero).
        for version in muestra_por_id(VersionDocumento, VersionDocumento.vigente.is_(False)):
            eliminar(version)
        for documento in muestra_por_id(Documento, n=max(1, por_tipo // 3)):
            versiones = list(
                db.scalars(
                    select(VersionDocumento).where(VersionDocumento.documento_id == documento.id)
                ).all()
            )
            eliminar(*versiones, documento)

        # Unidades sin uso. El catálogo tiene que seguir por encima de las 10
        # filas de una página (ver `UNIDADES`), así que solo se borra el excedente.
        usadas = set(db.scalars(select(Insumo.unidad_medida_id)).all()) | set(
            db.scalars(select(InsumoQuimico.unidad_medida_id)).all()
        )
        sin_uso = [u for u in unidades.values() if u.id not in usadas]
        total_unidades = db.scalar(select(func.count()).select_from(UnidadMedida)) or 0
        borrables = min(por_tipo, len(sin_uso), max(0, total_unidades - 11))
        for unidad in random.sample(sin_uso, borrables):
            eliminar(unidad)
    finally:
        db.info.pop("usuario_id", None)

    return cuenta


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
        "--sin-actividad",
        action="store_true",
        help=(
            "Solo altas: no simula modificaciones, bajas, reactivaciones ni "
            "eliminaciones (por defecto la bitácora trae todas las acciones)."
        ),
    )
    p.add_argument(
        "--agregar",
        action="store_true",
        help="No borra lo existente: agrega filas nuevas evitando duplicados.",
    )
    return p.parse_args()


def main(preparar_esquema: bool = True) -> int:
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
    # Auditar el seed para que la vista de auditoría muestre todas las entidades.
    # db.info["sin_auditoria"] = True
    try:
        # Guarda por entorno: abortar en producción y mostrar la base objetivo.
        entorno = settings.ENV.upper()
        print(f"📦 Base de datos objetivo: {settings.DB_URL}")
        print(f"   Entorno: {entorno}")
        if entorno == "PRODUCTION":
            print("❌ Abortando: no se puede cargar datos en entorno PRODUCTION.")
            return 1
        if entorno not in ("DEVELOPMENT", "TEST"):
            print(f"❌ Abortando: entorno no soportado para carga de datos: {entorno}.")
            return 1

        if preparar_esquema:
            crear_tablas_y_migrar()

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
            "proveedor": set(db.scalars(select(Proveedor.nombre)).all()),
            "matricula": set(db.scalars(select(Proveedor.matricula)).all()),
            "lote": set(db.scalars(select(LoteStock.numero_lote)).all()),
            "sector": set(db.scalars(select(Sector.nombre)).all()),
            "producto": set(db.scalars(select(Producto.nombre)).all()),
            "lote_insumo": set(db.scalars(select(LoteInsumo.numero_lote)).all()),
            "lote_producto": set(db.scalars(select(LoteProducto.numero_lote)).all()),
        }

        # Un solo hash para todo el personal: bcrypt es lento (~0,3 s por
        # hash) y con --cantidad 500 la diferencia es de varios minutos.
        print("🔐 Hasheando la contraseña...")
        hash_password = hashear_password(args.password)

        unidades = crear_unidades(db, vistos)
        crear_configuracion_alertas(db)
        personal = crear_personal(db, args.cantidad, fake, vistos, hash_password)
        proveedores = crear_proveedores(db, args.cantidad, fake, vistos)
        equipos = crear_equipos(db, args.cantidad, vistos)
        calibraciones = crear_calibraciones(db, equipos)
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
        stocks = crear_stock_insumos(db, quimicos)
        lotes = crear_lotes_stock(db, args.cantidad, proveedores, quimicos, vistos)
        elementos = crear_elementos(db, args.cantidad, vistos)
        insumos = crear_insumos(db, args.cantidad, unidades, vistos)
        planes = crear_planes_y_tareas(db, args.cantidad, equipos, admins, vistos, operadores)
        registros = crear_checklists(db, planes, operadores, quimicos, elementos, args.dias_checklist)
        historial_registros = crear_historial_registro_tarea(db)
        incidentes = crear_incidentes(db, args.cantidad, equipos, personal, admins, operadores, vistos)
        historial_incidentes = crear_historial_incidente(db, admins)
        documentos = crear_documentos(db, args.cantidad, admins, vistos)
        cal_mantenimiento = crear_planes_cal_mantenimiento(db, args.cantidad, equipos, admins)

        # Trazabilidad: productos -> recetas versionadas -> lotes de insumo ->
        # lotes de producción con checklist y consumos.
        ingredientes = crear_ingredientes(db, unidades, vistos)
        productos, versiones = crear_productos_y_recetas(
            db, args.cantidad, ingredientes, unidades, admins, vistos
        )
        lotes_insumo = crear_lotes_insumo(db, ingredientes, proveedores, admins, vistos)
        produccion = crear_lotes_produccion(
            db, args.cantidad * 2, productos, versiones, lotes_insumo,
            proveedores, admins, operadores, vistos,
        )
        indicadores_vp = crear_vista_publica(db)

        db.commit()

        # Las altas ya están commiteadas (como "sistema"). Sobre ellas se simula
        # lo que haría la gente en la app, para que la bitácora tenga historia.
        actividad: dict = {}
        if not args.sin_actividad:
            actividad = simular_actividad(
                db, fake, vistos, args.password, admins, personal, equipos,
                aptitudes, quimicos, elementos, insumos,
                proveedores=proveedores, stocks=stocks, lotes=lotes,
                calibraciones=calibraciones, planes=planes,
                planes_cal=cal_mantenimiento, unidades=unidades,
            )
            for clave, n in simular_actividad_trazabilidad(
                db, admins, productos, lotes_insumo
            ).items():
                actividad[clave] += n

        # Sesiones de ejemplo, después de la actividad (que puede borrar personas).
        sesiones = crear_sesiones_auth(db, list(db.scalars(select(Personal)).all()))
        db.commit()

        # La caché de notificaciones se recalcula sobre los datos finales, igual
        # que en la primera lectura de la app.
        print("⏳ Calculando notificaciones...")
        asegurar_notificaciones_al_dia(db)
        notificaciones = db.scalar(select(func.count()).select_from(NotificacionPersistida))

        # --------------------------------------------------------------
        # Resumen
        # --------------------------------------------------------------
        print()
        print("✅ ¡Datos cargados con éxito!")
        print(f"   Semilla: {args.seed or 'aleatoria'} · Locale: {args.locale}")
        print(f"   Personal: {len(personal)} · Equipos: {len(equipos)} · Aptitudes: {len(aptitudes)}")
        print(f"   Proveedores: {len(proveedores)} · Vencimientos: {vencimientos} · Planes de limpieza: {len(planes)}")
        print(f"   Stock insumos: {len(stocks)} · Lotes stock: {len(lotes)} · Calibraciones: {len(calibraciones)}")
        print(f"   Registros de tarea: {registros} · Historial registros: {historial_registros} · Incidentes: {incidentes}")
        print(f"   Historial incidentes: {historial_incidentes} · Documentos: {documentos}")
        print(f"   Planes calibración/mantenimiento: {len(cal_mantenimiento)}")
        print(
            f"   Productos: {len(productos)} · Versiones de receta: "
            f"{sum(len(v) for v in versiones.values())} · Materias primas: {len(ingredientes)}"
        )
        print(
            f"   Lotes de insumo: {produccion.get('lotes_insumo', len(lotes_insumo))} · "
            f"Lotes de producción: {produccion['lotes']} · Ítems de checklist: {produccion['items']}"
        )
        print(
            f"   Consumos reales: {produccion['consumos']} · Desperdicios: {produccion['desperdicios']}"
        )
        print(
            f"   Vista pública: {indicadores_vp} indicadores · Notificaciones: {notificaciones}"
        )
        print(
            f"   Sesiones: {sesiones['refresh']} refresh tokens · {sesiones['revocados']} revocados · "
            f"{sesiones['intentos']} intentos de login"
        )
        if actividad:
            print(
                "   Actividad simulada: "
                f"{actividad['modificados']} modificaciones · {actividad['bajas']} bajas · "
                f"{actividad['reactivados']} reactivaciones · {actividad['eliminados']} eliminaciones"
            )
            if actividad["omitidos"]:
                print(
                    f"   (se omitieron {actividad['omitidos']} borrados que una FK impedía)"
                )
        por_accion = dict(
            db.execute(select(AuditLog.accion, func.count()).group_by(AuditLog.accion)).all()
        )
        print(
            "   Bitácora: "
            + " · ".join(f"{accion} {n}" for accion, n in sorted(por_accion.items()))
        )
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
