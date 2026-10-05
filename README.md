# Sistema de apoyo para la inocuidad alimentaria (SAIA)

Aplicación web para administrar instrumentos de relevamiento de Buenas Prácticas de Manufactura (BPM) y Procedimientos Operativos Estandarizados (POES): planes de limpieza, checklists diarios, consumos, alertas de recambio y control de cumplimiento.

## Integrantes

* Florencia Anahí Argañarás
* Facundo Emiliano Cuell
* Alan Oscar James
* Joaquín Gabriel Lobos Glass
* María Ángeles Magni Taddei
* Lautaro Ezequiel Moraga

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 + Chakra UI + React Router |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic + SQLite |
| Autenticación | JWT (access token 30 min + refresh token 7 días) + bcrypt |

---

## Requisitos previos

Instalá lo siguiente **antes** de empezar:

1. **Python 3.11 o superior** → https://www.python.org/downloads/
   - Marcá la casilla *Add Python to PATH* durante la instalación.
2. **Node.js 20 o superior (LTS)** → https://nodejs.org/
   - Incluye npm automáticamente.

Verificá que todo quedó instalado abriendo una terminal nueva:

```powershell
python --version
node --version
npm --version
```

---

## Puesta en punto (una sola vez)

### 1. Clonar el repositorio

```powershell
git clone <url-del-repositorio>
cd SAIA-grupo-6
```

### 2. Configurar el backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
copy .env.template .env
```

En el `.env` hay que definir una `SECRET_KEY` propia (si no, la aplicación no arranca):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copiá la salida en la línea `SECRET_KEY="..."` del `.env`.

### 3. Configurar el frontend

```powershell
cd ..
cd frontend
npm install
```

> Para volver a configurar el entorno en el futuro, repetí solo los pasos 2 y 3.

### 4. Crear el primer usuario (super administrador)

La base de datos se crea sola en el primer arranque. Como es nueva, en la
pantalla de **registro** te aparece la opción **Super administrador** para que
puedas crear el primer usuario con ese rol:

1. Levantá el backend y el frontend.
2. Entrá a http://localhost:5173 y elegí **"¿No tenés usuario? Registrate acá"**.
3. Completá los datos, tildá **Super administrador** y creá el usuario.

Esa opción **solo aparece mientras el sistema no tenga ningún administrador**.
Apenas existe uno, el registro público se cierra (pasa a exigir sesión) y el rol
de super admin se concede desde **Personal → Nuevo**, únicamente por otro super
admin.

---

## Cómo correr el proyecto

El proyecto necesita **dos consolas abiertas en VS Code** (una para el backend y otra para el frontend).

### Consola 1 — Backend

```powershell
cd backend
.\.venv\Scripts\activate
fastapi dev src/main.py
```

Queda disponible en:
- API: http://localhost:8000
- Documentación interactiva (Swagger): http://localhost:8000/docs

### Consola 2 — Frontend

```powershell
cd frontend
npm run dev
```

Queda disponible en:
- Aplicación: http://localhost:5173

### Para probar la aplicación

1. Abrí http://localhost:5173
2. Iniciá sesión con un usuario de la base
3. Si no tenés ninguno, cargá datos de ejemplo (ver más abajo) o creá el primero desde la pantalla de registro

---

## Cargar datos de ejemplo (opcional)

Con el backend detenido (o en otra terminal con el venv activo):

```powershell
cd backend
.\.venv\Scripts\python.exe cargar_datos.py
```

Genera 15 personas, 15 equipos, unidades de medida y 15 insumos.

---

## Configuración de variables de entorno

El backend lee sus variables del archivo `backend/.env` (copiado de `.env.template`):

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `ENV` | Entorno de ejecución | `DEV` |
| `DB_URL` | Conexión a la base de datos | `sqlite:///db.sqlite3` |
| `SECRET_KEY` | Clave para firmar los JWT | *(definir una propia)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del access token | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Duración del refresh token | `7` |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma | `http://localhost:5173` |
| `LOG_LEVEL` | Nivel de logging | `INFO` |

### Probar desde el celular o tablet

Para levantar la app en un dispositivo móvil en la misma red:

1. Descubrí la IP local de tu PC (`ipconfig` → *Dirección IPv4*, por ejemplo `192.168.0.10`).
2. En `backend/.env` agregá ese origen:
   ```
   CORS_ORIGINS="http://localhost:5173,http://192.168.0.10:5173"
   ```
3. En `frontend/.env.local` creá el archivo con la URL del backend:
   ```
   VITE_API_URL=http://192.168.0.10:8000
   ```
4. Reiniciá ambos servidores y abrí `http://192.168.0.10:5173` desde el celular.

---

## Migración de contraseñas existentes

Las contraseñas cargadas antes de la implementación de JWT estaban en texto plano. **No hace migración automática por comandos**: la primera vez que cada usuario inicia sesión, su contraseña se re-encripta con bcrypt de forma transparente. Los usuarios nuevos ya se guardan hasheados desde el alta.

---

## Comandos útiles

### Backend

```powershell
# Arrancar en modo desarrollo (con recarga automática)
fastapi dev src/main.py

# Arrancar en modo producción
uvicorn src.main:app --host 0.0.0.0 --port 8000

# Cargar datos de ejemplo
.\.venv\Scripts\python.exe cargar_datos.py
```

### Frontend

```powershell
# Servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Analizar código (ESLint)
npm run lint

# Verificar tipos (TypeScript)
npx tsc -b
```

---

## Uso en VS Code

### Extensiones recomendadas

- **Python** (Microsoft)
- **Pylance** (Microsoft) — autocompletado y navegación en el backend
- **ESLint** (Microsoft)
- **TypeScript Nightly** o la de TypeScript (Microsoft) — autocompletado del frontend

### Abrir el proyecto

```powershell
code .
```

VS Code detecta el entorno virtual de `backend/.venv` automáticamente y podés seleccionarlo con `Ctrl+Shift+P` → **Python: Select Interpreter**.

### Terminales separadas

`Ctrl+Ñ` abre una terminal integrada; `` Ctrl+Shift+Ñ `` abre una segunda. Usá una para el backend y otra para el frontend, así ves ambos logs al mismo tiempo.

---

## Permisos de usuario

Cada persona tiene **un rol**, que se compone de las capacidades:

| Rol | Puede hacer |
|---|---|
| **Operador** | Ver el checklist del día y marcar tareas como realizadas (con evidencia, consumo y autoría) |
| **Administrador** | Todo lo del operador + maestros (equipos, insumos, químicos, elementos, unidades de medida), planes de limpieza, personal, historial de checklists, consumos y notificaciones |
| **Super administrador** | Todo lo del administrador + puede editar a cualquier persona y asignar el rol de super admin |

### Quién puede editar a quién

| Actor | Puede editar a |
|---|---|
| Operador | Solo a sí mismo (y sin tocar sus capacidades) |
| Administrador | A los operadores y a sí mismo |
| Super administrador | A cualquiera, incluidos otros administradores y super administradores |

Nadie puede modificar sus propias capacidades ni darse de baja a sí mismo. El rol de super admin solo lo asigna o quita otro super admin.

Los permisos se validan **en el backend**: la interfaz oculta los botones según el rol, pero la restricción real la aplica la API (respuesta `403` si no alcanza el permiso).

## Seguridad implementada

- **Contraseñas con bcrypt** (nunca en texto plano). Las contraseñas antiguas se re-encriptan solas en el primer login.
- **JWT con dos tokens**: access token (30 min) y refresh token (7 días), ambos firmados con `SECRET_KEY` del `.env`. Si falta esa variable, la app no arranca.
- **Logout real**: los tokens se revocan en el backend, así que un access token robado deja de servir de inmediato.
- **Límite de intentos de login**: 5 fallos por combinación IP + DNI bloquean el acceso unos minutos (configurable con `LOGIN_MAX_INTENTOS` y `LOGIN_VENTANA_MINUTOS`).
- **Evidencias protegidas**: las fotos de las tareas requieren sesión para descargarse y se validan por extensión y tamaño.
- **Roles verificados en la API**: cada endpoint declara el permiso que exige (ver `src/auth/dependencies.py`).

> Los tokens se guardan en el `localStorage` del navegador. Es lo habitual en SPAs, pero ante un ataque de XSS un atacante podría leerlos; para deployments de mayor sensibilidad conviene migrar a cookies `httpOnly`.

---

## Estructura del proyecto

```
SAIA-grupo-6/
├── backend/
│   ├── src/
│   │   ├── auth/          # JWT, hashing de contraseñas y dependencias de permisos
│   │   ├── checklist/     # Checklists del día, historial y consumos
│   │   ├── personal/      # Usuarios y sus capacidades
│   │   ├── Equipo/        # Equipos e instrumentos
│   │   ├── PlanLimpieza/  # Planes de limpieza y sus tareas
│   │   ├── insumos/       # Insumos e ingredientes
│   │   ├── insumoQuimico/ # Productos de limpieza
│   │   ├── elementoLimpieza/ # Elementos de recambio
│   │   ├── notificaciones/# Alertas de vencimientos y recambios
│   │   └── ...
│   ├── cargar_datos.py    # Script de datos de ejemplo
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── common/        # Contexto de autenticación, API client y componentes comunes
│       ├── components/    # Componentes base de la UI
│       └── features/      # Un módulo por historia (checklist, personal, equipos, ...)
└── README.md
```

---

## Solución de problemas

**`No se encontró el comando fastapi`**
El venv no está activado. Corré `.\.venv\Scripts\activate` dentro de `backend`.

**`Address already in use` en el puerto 8000**
Otro proceso está usando el puerto. Buscalo y cerralo con:
```powershell
netstat -ano | findstr :8000
taskkill /PID <número> /F
```

**El frontend no conecta con el backend**
Verificá que el backend esté corriendo en el puerto 8000 y que el CORS de `backend/.env` incluya el origen del frontend.

**Cambié el `.env` y no toma efecto**
Los servidores leen el `.env` al arrancar: reiniciá ambos.

**`npm run build` falla con errores de tipos**
Ejecutá `npx tsc -b` para ver el detalle de los errores.