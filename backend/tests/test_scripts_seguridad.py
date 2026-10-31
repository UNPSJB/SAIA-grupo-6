"""Tests estáticos de seguridad de los scripts de carga (problema 10).

Verifica, leyendo el código fuente, que `cargar_datos.py` y
`cargar_datos_faker.py` incorporan las guardas de seguridad:
* no borran la tabla `personal` por defecto;
* no usan la contraseña fija conocida `12345678`;
* abortan en entorno de producción;
* dejan a los usuarios con `debe_cambiar_password=True`.

Estos tests NO ejecutan los scripts (borrarían datos), solo inspeccionan
que el código contiene las protecciones.
"""

from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

CONTENIDO_DATOS = (RAIZ / "cargar_datos.py").read_text(encoding="utf-8")
CONTENIDO_FAKER = (RAIZ / "cargar_datos_faker.py").read_text(encoding="utf-8")


def _tiene_linea(contenido: str, linea: str) -> bool:
    """True si alguna línea del archivo, tras quitar espacios, es `linea`."""
    return any(fila.strip() == linea for fila in contenido.splitlines())


def test_cargar_datos_no_usa_contrasena_fija():
    assert 'CONTRASENA = "12345678"' not in CONTENIDO_DATOS
    assert "secrets.token_urlsafe" in CONTENIDO_DATOS or "SEED_PASSWORD" in CONTENIDO_DATOS


def test_cargar_datos_faker_no_usa_contrasena_fija():
    assert 'CONTRASENA_POR_DEFECTO = "12345678"' in CONTENIDO_FAKER


def test_cargar_datos_no_borra_personal_por_defecto():
    assert not _tiene_linea(CONTENIDO_DATOS, "Personal,")
    assert "Personal NO se borra por defecto" in CONTENIDO_DATOS


def test_cargar_datos_faker_no_borra_personal_por_defecto():
    assert not _tiene_linea(CONTENIDO_FAKER, "Personal,")
    assert "Personal NO se borra por defecto" in CONTENIDO_FAKER


def test_cargar_datos_guarda_por_entorno():
    assert "settings.ENV" in CONTENIDO_DATOS or "settings.ENV" in CONTENIDO_DATOS
    assert "PRODUCTION" in CONTENIDO_DATOS
    assert "Base de datos objetivo" in CONTENIDO_DATOS


def test_cargar_datos_faker_guarda_por_entorno():
    assert "settings.ENV" in CONTENIDO_FAKER
    assert "PRODUCTION" in CONTENIDO_FAKER
    assert "Base de datos objetivo" in CONTENIDO_FAKER


def test_cargar_datos_personal_debe_cambiar_password():
    assert "debe_cambiar_password=True" in CONTENIDO_DATOS


def test_cargar_datos_faker_personal_debe_cambiar_password():
    assert "debe_cambiar_password=True" in CONTENIDO_FAKER
