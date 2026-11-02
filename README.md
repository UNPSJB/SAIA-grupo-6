# Sistema de apoyo para la inocuidad alimentaria

### Descripción
El proyecto se enmarca en el desarrollo de un sistema de apoyo a la inocuidad alimentaria, con el objetivo de permitir la visualización de indicadores de gestión de la misma, a partir de la administración de diferentes instrumentos de relevamiento de Buenas Prácticas de Manufactura (BPM) y Procedimientos Operativos Estandarizados (POES), como protocolos, muestreos, puntos de control, entre otros.

### Instalación y ejecución

#### Backend (FastAPI)
Desde la carpeta `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt        # para desarrollo y tests: requirements-dev.txt
copy .env.template .env                # y completar SECRET_KEY (mínimo 32 caracteres)
fastapi dev src/main.py
```

- Generar una `SECRET_KEY`: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- API interactiva en http://localhost:8000/docs
- Datos de ejemplo (opcional): `python scripts\cargar_datos.py`
- Tests: `python -m pytest`

#### Frontend (React + Vite)
Desde la carpeta `frontend`:

```powershell
npm install
npm run dev
```

Por defecto usa `http://localhost:8000` como API; se cambia con `VITE_API_URL`.
Otros comandos: `npm run build` y `npm run lint`.

### Integrantes:
* Florencia Anahí Argañarás
* Facundo Emiliano Cuell
* Alan Oscar James
* Joaquín Gabriel Lobos Glass
* María Ángeles Magni Taddei
* Lautaro Ezequiel Moraga
