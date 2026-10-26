"""Verificación de la paginación server-side.

Ejecutar desde `backend/`:

    .venv\\Scripts\\python.exe verificar_paginacion.py

Usa la base real (db.sqlite3) a través de la API con TestClient, sin
pytest. Los grupos de casos que cubre:

  * SQL, no Python: para cada pedido de página se capturan los statements
    (listener de SQLAlchemy, equivalente programático de `echo=True`) y se
    exige que la CONSULTA PRINCIPAL del listado —el SELECT sobre la tabla
    del recurso, descartando el COUNT de `paginar()`, la autenticación y
    los `selectinload` de relaciones— tenga `LIMIT` y que, al re-ejecutarla
    con sus parámetros, devuelva a lo sumo `page_size` filas. Además: el
    COUNT del total debe existir como subconsulta SQL, y cada lista
    `IN (...)` de los `selectinload` posteriores recibe a lo sumo
    `page_size` ids. Si alguien reintroduce el recorte en Python, la
    consulta principal pierde el LIMIT y el caso falla, aunque otras
    consultas de la request estén limitadas.

  * caso inverso mantenido: los consolidados en memoria (notificaciones y
    vencimientos, documentados en sus services) y `incidentes` con
    `buscar` (filtro de texto en Python por las tildes) NO deben tener
    LIMIT en su consulta principal.

  * consistencia entre páginas: recorrer TODAS las páginas de un listado
    no repite ni omite registros (comparado contra la lista completa del
    mismo endpoint sin `page`), cada página trae a lo sumo `page_size`
    filas y `total` coincide con el filtrado completo.

  * agregados independientes de la página: el cumplimiento general del
    historial de checklists es el mismo en cualquier página y con
    cualquier `page_size`, e igual al de la respuesta completa.

Si un listado tiene menos de dos páginas (o ninguna) con `PAGE_SIZE=3`,
se avisa con un warning visible —no falla— porque ese caso no ejercita la
paginación real. El rango del historial de checklists se calcula relativo
a la fecha actual (últimos 365 días) y si está vacío el script FALLA con
instrucciones explícitas: pasar en vacío no verifica nada.
"""

import re
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

import logging  # noqa: E402

logging.disable(logging.CRITICAL)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event, func, select  # noqa: E402

from src.main import app  # noqa: E402
from src.database import SessionLocal, engine  # noqa: E402
from src.personal.models import Personal  # noqa: E402
from src.auth.services import crear_access_token  # noqa: E402
from src.incidente import models as incidente_models  # noqa: E402

fallos = []
avisos = []


def check(desc, cond):
    if cond:
        print(f"  ok  {desc}")
    else:
        fallos.append(desc)
        print(f"  FALLA {desc}")


def warn(desc):
    """Aviso visible que NO falla: el caso corre, pero no ejercita la paginación."""
    avisos.append(desc)
    print(f"  [AVISO] {desc}  (no falla, pero no ejercita la paginación real)")


# ---------------------------------------------------------------
# Captura de SQL: equivalente programático de echo=True, con los
# parámetros de cada statement para poder re-ejecutarlo.
# ---------------------------------------------------------------

consultas: list[tuple[str, object]] = []


@event.listens_for(engine, "before_cursor_execute")
def _capturar(conn, cursor, statement, parameters, context, executemany):
    consultas.append((statement, parameters))


def statements():
    return [s for s, _ in consultas]


def pedir(url, headers):
    """GET a la API; deja el SQL de la request en `consultas`."""
    consultas.clear()
    respuesta = client.get(url, headers=headers)
    if respuesta.status_code != 200:
        raise AssertionError(f"{url} -> {respuesta.status_code}: {respuesta.text[:200]}")
    return respuesta.json()


# ---------------------------------------------------------------
# Análisis del SQL capturado
# ---------------------------------------------------------------


def es_count_de_paginar(statement, tabla):
    """El COUNT de `paginar()`: `count(*)` envolviendo una subconsulta del recurso."""
    return (
        "count(*)" in statement
        and "FROM (SELECT" in statement
        and re.search(rf"\bFROM {tabla}\b", statement) is not None
    )


def pares_sobre(tabla, con_limit):
    """Los statements de la CONSULTA PRINCIPAL del listado, como pares (sql, params).

    Se queda solo con los SELECT sobre la tabla del recurso y descarta:
      - el COUNT de `paginar()` (subconsulta envuelta);
      - la autenticación y los `selectinload` de relaciones (van contra
        otras tablas, y el SELECT de sesión no tiene LIMIT).

    `con_limit=True` exige LIMIT en la principal (caso paginado en SQL);
    `con_limit=False` exige que NO lo tenga (casos documentados en Python).
    """
    resultado = []
    for s, params in consultas:
        if "count(*)" in s and "FROM (SELECT" in s:
            continue
        if re.search(rf"\bFROM {tabla}\b", s) is None:
            continue
        if con_limit and "LIMIT" not in s:
            continue
        if not con_limit and "LIMIT" in s:
            continue
        resultado.append((s, params))
    return resultado


def filas_que_devuelve(statement, parameters):
    """Re-ejecuta un statement capturado y cuenta cuántas filas trajo de la base.

    Es la prueba directa de "la consulta principal no trae más filas que
    page_size": se repite con sus mismos parámetros en otra conexión (las
    requests de listado son de solo lectura, así que replay seguro).
    """
    with engine.connect() as conexion:
        if parameters:
            resultado = conexion.exec_driver_sql(statement, parameters)
        else:
            resultado = conexion.exec_driver_sql(statement)
        return len(resultado.fetchall())


def largos_de_listas_in(statement):
    """Cuántos ids recibe cada `IN (?, ?, ...)` de un statement (selectinload)."""
    grupos = re.findall(r"IN \(([^)]*)\)", statement, re.IGNORECASE)
    return [len(grupo.split(",")) for grupo in grupos if "?" in grupo]


# ---------------------------------------------------------------
# Sesión: admin para casi todo, y un usuario con incidentes para /mios
# ---------------------------------------------------------------

db = SessionLocal()
admin = db.scalar(select(Personal).where(Personal.puede_administrar == True).limit(1))  # noqa: E712
token_admin, _, _ = crear_access_token(str(admin.id))

fila_mios = db.execute(
    select(incidente_models.Incidente.usuario_id, func.count(incidente_models.Incidente.id))
    .group_by(incidente_models.Incidente.usuario_id)
    .order_by(func.count(incidente_models.Incidente.id).desc())
    .limit(1)
).first()
usuario_mios_id = fila_mios[0] if fila_mios else admin.id
db.close()

client = TestClient(app)
H_ADMIN = {"Authorization": f"Bearer {token_admin}"}
H_MIOS = {"Authorization": f"Bearer " + crear_access_token(str(usuario_mios_id))[0]}

PAGE_SIZE = 3  # chico a propósito: fuerza varias páginas con pocos datos

# Rango del historial relativo a HOY: en 2027 un rango hardcodeado a 2026 no
# tendría datos y los chequeos pasarían sin verificar nada.
HOY = date.today()
DESDE = HOY - timedelta(days=365)
RANGO = f"?fecha_desde={DESDE.isoformat()}&fecha_hasta={HOY.isoformat()}"


def _unir(url: str, params: str) -> str:
    """Une una URL con query params extra, con el separador que corresponda."""
    params = params.lstrip("&").lstrip("?")
    if not params:
        return url
    return url + ("&" if "?" in url else "?") + params


def recorrer_paginas(
    url_base,
    clave_id,
    tabla,
    headers=None,
    extra_params="",
    espera_limit=True,
):
    """Recorre todas las páginas de un listado verificando:

    1. consistencia: sin repetidos/omitidos contra la lista completa (sin
       `page`), cada página con a lo sumo `page_size` filas y `total` estable;
    2. el recorte lo hace la BASE: consulta principal con LIMIT que además
       devuelve <= page_size filas, COUNT de `paginar()` presente e `IN`s de
       los selectinload acotados a page_size. En el caso inverso
       (`espera_limit=False`) la consulta principal NO debe tener LIMIT.
    """
    headers = headers or H_ADMIN
    base_con_extras = _unir(url_base, extra_params)
    url_pagina = _unir(base_con_extras, "page={page}") + f"&page_size={PAGE_SIZE}"

    primera = pedir(url_pagina.format(page=1), headers)
    total = primera["total"]
    total_paginas = primera["total_paginas"]

    if total == 0:
        warn(f"{url_base}: sin datos en la base")
        return 0
    if total_paginas < 2:
        warn(f"{url_base}: {total} fila(s) -> 1 sola página con page_size={PAGE_SIZE}")

    ids_por_pagina = []
    for pagina in range(1, total_paginas + 1):
        respuesta = pedir(url_pagina.format(page=pagina), headers)
        ids = [item[clave_id] for item in respuesta["items"]]
        ids_por_pagina.append(ids)

        check(
            f"{url_base} página {pagina} trae a lo sumo {PAGE_SIZE} filas",
            len(ids) <= PAGE_SIZE,
        )
        check(f"{url_base} total estable en página {pagina}", respuesta["total"] == total)

        if espera_limit:
            # (a) la consulta principal del listado (sobre la tabla del
            # recurso, sin COUNT ni autenticación) tiene que tener LIMIT.
            principales = pares_sobre(tabla, con_limit=True)
            check(
                f"{url_base} página {pagina}: consulta principal sobre `{tabla}` con LIMIT",
                bool(principales),
            )
            # (b) el total sale de un COUNT en SQL (subconsulta de paginar()).
            check(
                f"{url_base} página {pagina}: el COUNT del total es SQL sobre `{tabla}`",
                any(es_count_de_paginar(s, tabla) for s in statements()),
            )
            # (c) la principal no trae más filas que page_size: se re-ejecuta
            # con sus parámetros y se cuentan las filas.
            for statement, params in principales:
                try:
                    filas = filas_que_devuelve(statement, params)
                except Exception as e:  # noqa: BLE001
                    check(f"{url_base} página {pagina}: replay de la consulta principal", False)
                    print(f"        ({type(e).__name__}: {e})")
                    continue
                check(
                    f"{url_base} página {pagina}: la consulta principal trae {filas} filas de la base"
                    f" (<= {PAGE_SIZE})",
                    filas <= PAGE_SIZE,
                )
            # (d) los selectinload posteriores (registros, relaciones)
            # reciben a lo sumo page_size ids en cada IN (...).
            largos_in = [
                largo
                for s, _ in consultas
                for largo in largos_de_listas_in(s)
            ]
            check(
                f"{url_base} página {pagina}: los IN de los selectinload tienen a lo sumo {PAGE_SIZE} ids"
                + (f" (máximo visto: {max(largos_in)})" if largos_in else ""),
                not largos_in or max(largos_in) <= PAGE_SIZE,
            )
        elif tabla is None:
            # Consolidados en memoria (documentados): ninguna consulta limitada.
            check(
                f"{url_base} página {pagina}: paginación en memoria documentada"
                " (ninguna consulta con LIMIT)",
                not any("LIMIT" in s for s in statements()),
            )
        else:
            # Caso inverso con tabla conocida (incidentes con buscar): la
            # consulta principal va SIN LIMIT porque el filtro de texto
            # corre en Python (limitación documentada en el service).
            check(
                f"{url_base} página {pagina}: consulta principal sobre `{tabla}` SIN LIMIT"
                " (filtro de texto en Python, documentado)",
                bool(pares_sobre(tabla, con_limit=False)),
            )

    todos = [id_ for pagina in ids_por_pagina for id_ in pagina]
    check(f"{url_base} no repite registros entre páginas", len(todos) == len(set(todos)))

    # Lista completa del mismo endpoint SIN `page` (los dropdowns y el tablero
    # usan ese camino): la unión de páginas tiene que ser igual. El
    # consolidado de vencimientos vive en la URL base sin "/pagina".
    url_completa = (
        url_base.replace("/pagina", "") if url_base.endswith("/pagina") else base_con_extras
    )
    completa = pedir(url_completa, headers)
    # El historial de checklists responde con un sobre distinto cuando no hay
    # `page` (HistorialChecklistResponse, con la lista en "checklists").
    lista_completa = completa["checklists"] if isinstance(completa, dict) else completa
    esperados = [item[clave_id] for item in lista_completa]
    check(
        f"{url_base} la unión de páginas es la lista completa ({len(esperados)})",
        sorted(set(todos)) == sorted(set(esperados)) and len(todos) == len(esperados),
    )
    return total


print("== pre-checks: la base tiene datos para ejercitar la paginación ==")
completa_historial = pedir(f"/checklist/historial{RANGO}", H_ADMIN)
if not completa_historial["checklists"]:
    print(f"  FALLA la base no tiene checklists entre {DESDE} y {HOY}.")
    print("        El rango es relativo a la fecha actual; esta base no tiene")
    print("        datos ahí, así que el resto de los chequeos de checklist")
    print("        pasaría sin verificar nada útil.")
    print("        Corré cargar_datos_faker.py (o cargá checklists recientes)")
    print("        antes de verificar la paginación.")
    sys.exit(1)
check(
    f"la base tiene checklists en el rango {DESDE} -> {HOY} "
    f"({len(completa_historial['checklists'])})",
    True,
)

print("== catálogos: LIMIT en SQL, sin repetidos, total correcto ==")
recorrer_paginas("/insumos", "id", tabla="insumos")
recorrer_paginas("/aptitudes", "id", tabla="aptitudes", extra_params="&incluir_inactivos=true")
recorrer_paginas("/unidades-medida", "id", tabla="unidades_medida")
recorrer_paginas("/personal", "id", tabla="personal")
recorrer_paginas("/equipos", "id", tabla="equipos")
recorrer_paginas("/elementos-limpieza", "id", tabla="elementos_limpieza")
recorrer_paginas("/insumos-quimicos", "id", tabla="insumos_quimicos")
recorrer_paginas("/planes-limpieza", "id", tabla="plan_limpieza")
recorrer_paginas("/planes-calibracion-mantenimiento", "id", tabla="planes_calibracion_mantenimiento")
recorrer_paginas("/documentos", "id", tabla="documentos")

print("== documentos vigentes: EXISTS en SQL + filtros ==")
recorrer_paginas("/documentos/vigentes", "id", tabla="documentos")
recorrer_paginas("/documentos/vigentes", "id", tabla="documentos", extra_params="&tipo=procedimiento")

print("== incidentes: filtros y orden en SQL ==")
recorrer_paginas("/incidentes", "id", tabla="incidentes")
recorrer_paginas("/incidentes", "id", tabla="incidentes", extra_params="&estado=abierto")
recorrer_paginas("/incidentes", "id", tabla="incidentes", extra_params="&orden=antiguos")
recorrer_paginas("/incidentes/mios", "id", tabla="incidentes", headers=H_MIOS)

print("== incidentes con búsqueda: filtro de texto en Python (limitación documentada) ==")


def _normalizar(texto):
    import unicodedata

    return "".join(
        c for c in unicodedata.normalize("NFD", (texto or "").lower())
        if unicodedata.category(c) != "Mn"
    )


TERMINO = "de"
completa = pedir("/incidentes", H_ADMIN)
esperados_buscar = sorted(
    inc["id"]
    for inc in completa
    if TERMINO in _normalizar(inc["titulo"])
    or TERMINO in _normalizar(inc["descripcion"])
    or TERMINO in _normalizar(inc.get("usuario_nombre") or "")
)
primera = pedir(f"/incidentes?page=1&page_size={PAGE_SIZE}&buscar={TERMINO}&orden=antiguos", H_ADMIN)
ids_buscar = [i["id"] for i in primera["items"]]
for pagina in range(2, primera["total_paginas"] + 1):
    respuesta = pedir(
        f"/incidentes?page={pagina}&page_size={PAGE_SIZE}&buscar={TERMINO}&orden=antiguos", H_ADMIN
    )
    ids_buscar.extend(i["id"] for i in respuesta["items"])
check(
    f"incidentes buscar='{TERMINO}': unión de páginas == filtrado en Python ({len(esperados_buscar)})",
    sorted(ids_buscar) == esperados_buscar,
)
check(
    "incidentes buscar: total == cantidad que cumple el filtro",
    primera["total"] == len(esperados_buscar),
)
# Documentado en el service: con `buscar` el recorte NO puede salir de SQL
# porque la normalización de tildes no existe en SQLite. Se verifica que ese
# es exactamente el comportamiento vigente: la consulta principal va sin
# LIMIT y no hay COUNT de paginar() (el total se cuenta en Python).
check(
    "incidentes buscar: la consulta principal va SIN LIMIT (filtro de texto en Python, documentado)",
    bool(pares_sobre("incidentes", con_limit=False)),
)
check(
    "incidentes buscar: sin COUNT de paginar() (el total se cuenta en Python)",
    not any(es_count_de_paginar(s, "incidentes") for s in statements()),
)

print("== checklist historial: páginas en SQL + % general del período ==")
recorrer_paginas(f"/checklist/historial{RANGO}", "checklist_id", tabla="checklists")
recorrer_paginas(
    f"/checklist/historial{RANGO}", "checklist_id", tabla="checklists", extra_params="&equipo_id=1"
)

pagina_1 = pedir(f"/checklist/historial{RANGO}&page=1&page_size=5", H_ADMIN)
pagina_2 = pedir(f"/checklist/historial{RANGO}&page=2&page_size=5", H_ADMIN)
pagina_otro_tamano = pedir(f"/checklist/historial{RANGO}&page=1&page_size=50", H_ADMIN)
pct_completa = completa_historial["porcentaje_cumplimiento_general"]
check(
    "checklist: % general igual en página 1 y 2 (page_size=5)",
    abs(pagina_1["porcentaje_cumplimiento_general"] - pagina_2["porcentaje_cumplimiento_general"]) < 1e-9,
)
check(
    "checklist: % general no depende del page_size",
    abs(pagina_otro_tamano["porcentaje_cumplimiento_general"] - pct_completa) < 1e-9,
)
check(
    "checklist: % general de la página == % de la respuesta completa",
    abs(pagina_1["porcentaje_cumplimiento_general"] - pct_completa) < 1e-9,
)
check(
    "checklist: total de la página == checklists del rango completo",
    pagina_1["total"] == len(completa_historial["checklists"]),
)

print("== consolidados documentados: paginación en memoria por diseño ==")
recorrer_paginas("/notificaciones", "id_notificacion", tabla=None, espera_limit=False)
recorrer_paginas("/vencimientos/pagina", "id_vencimiento", tabla=None, espera_limit=False)

print("== página fuera de rango: contrato que corrige el frontend ==")
fuera = pedir(f"/insumos?page=999999&page_size={PAGE_SIZE}", H_ADMIN)
check(
    "page fuera de rango: items vacíos y total intacto (el frontend vuelve a total_paginas)",
    fuera["items"] == [] and fuera["total"] > 0,
)

print()
if avisos:
    print(f"AVISOS ({len(avisos)}): casos que corrieron sin ejercitar la paginación real")
    for a in avisos:
        print(f"  - {a}")

if fallos:
    print(f"\nFALLOS: {len(fallos)}")
    for f in fallos:
        print(f"  - {f}")
    sys.exit(1)
print("Todo OK")
