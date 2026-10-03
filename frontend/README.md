# Frontend — SAIA

Aplicación web (React 19 + TypeScript + Vite + Chakra UI) del Sistema de apoyo para la inocuidad alimentaria.

## Requisitos

- **Node.js 20 o superior** (LTS). Verificá con `node --version`.

## Instalación

Desde la carpeta `frontend`:

```powershell
npm install
```

## Ejecución

```powershell
npm run dev
```

La aplicación queda disponible en http://localhost:5173

El frontend consume la API del backend, que debe estar corriendo en http://localhost:8000.

## Otros comandos

```powershell
npm run build     # Compila para producción (genera la carpeta dist/)
npm run preview   # Sirve localmente el build de producción
npm run lint      # Analiza el código con ESLint
npx tsc -b        # Verifica los tipos sin emitir archivos
```

## Configuración

### Apuntar a otro backend

Por defecto el frontend usa `http://localhost:8000`. Para cambiarlo (por ejemplo, al probar desde un celular), creá un archivo `frontend/.env.local`:

```
VITE_API_URL=http://192.168.0.10:8000
```

Además, agregá ese mismo origen a `CORS_ORIGINS` en `backend/.env`.

### Autenticación

El login vive en `src/features/Login.tsx` y llama a `POST /auth/login`, que devuelve un **access token** (30 min) y un **refresh token** (7 días).

- `src/common/api/apiClient.ts` expone `apiFetch`, que agrega el header `Authorization: Bearer <token>` a cada request y, ante un `401`, intenta renovar la sesión con el refresh token y reintenta la petición.
- Los tokens se guardan en `localStorage` (`saia_access_token`, `saia_refresh_token`) y se limpian al cerrar sesión.
- `src/common/context/AuthContext.tsx` expone `useAuth()` con el usuario logueado.
- `src/common/components/RequireAuth.tsx` define `RequireAuth` (exige sesión) y `RequireRole` (exige un permiso concreto). Las rutas están agrupadas por permiso en `src/router.tsx`.

## Estructura

```
src/
├── common/
│   ├── api/          # Cliente HTTP con JWT, authService y errores
│   ├── components/   # Navbar, RequireAuth, diálogos comunes
│   ├── context/      # AuthContext
│   └── hooks/        # Hooks compartidos
├── components/ui/    # Componentes base de Chakra UI
├── features/         # Un módulo por historia de usuario
│   ├── checklist/    # Checklist del día, historial y consumo
│   ├── personal/     # Usuarios y capacidades
│   ├── planLimpieza/ # Planes y tareas
│   └── ...
└── router.tsx        # Rutas agrupadas por permiso
```

Cada módulo de `features/` sigue la misma estructura: `components/pages`, `components`, `hooks`, `services` y `types`.