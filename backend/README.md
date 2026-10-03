#### Descripción

Este proyecto contiene un ejemplo de la estructura recomendada para nuevos proyectos que utilicen FastAPI en el backend. 

Se sugiere mantener la estructura de archivos (basada en [fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices)), adaptándola al dominio que corresponda. Esto es, creando nuevos módulos que contengan mínimamente los siguientes elementos:

*  `constants.py`
*  `exceptions.py`
*  `models.py`
*  `router.py`
*  `schemas.py`
*  `services.py`

Si se lo desea, añadir tests para dichos módulos debiera seguir la misma estructura que los disponibles en la carpeta `tests`, con las adaptaciones que se consideren necesarias.

#### ¿Cómo lo ejecuto?

La guía completa de instalación y ejecución (backend + frontend, con comandos para VS Code) está en el **[README del repositorio](../README.md)**.

Resumen rápido:

1. Crear el entorno virtual e instalar dependencias:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Crear una copia del archivo `.env.template` con el nombre `.env` y revisar los valores.
3. Iniciar el proyecto desde la carpeta `backend`:
   ```powershell
   fastapi dev src/main.py
   ```
4. Abrir http://localhost:8000/docs para probar la API de manera interactiva.

Opcionalmente, cargar datos de ejemplo: `.\.venv\Scripts\python.exe cargar_datos.py`

**Importante**:
* Este proyecto sigue la estructura por módulos: `constants.py`, `exceptions.py`, `models.py`, `router.py`, `schemas.py` y `services.py`. Al crear un módulo nuevo, se recomienda mantener ese patrón.
* El módulo `src/auth/` maneja la autenticación (JWT) y las dependencias de permisos (`get_current_user`, `require_operador`, `require_admin`). Los routers que requieren sesión la incluyen con `dependencies=[...]`.
* Por defecto el proyecto utiliza el motor de base de datos `sqlite`, por lo que los datos de la app viven en el archivo definido en `.env` (`db.sqlite3`) salvo que se decida utilizar otro motor.