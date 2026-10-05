import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";

export default function Navbar() {
  // Traemos al usuario y la función para salir
  const { user, logout } = useAuth();

  // EL CANDADO: Si no hay nadie logueado, lo mandamos al Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
   <nav
      style={{
        width: "250px",
        backgroundColor: "#468189",
        color: "white",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        height: "100vh",
        boxSizing: "border-box", // <-- Esta línea es vital para evitar el scroll hacia abajo
        position: "sticky",
        top: 0,
        boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
      }}
    >
      {/* LOGO, TÍTULO Y BOTÓN DE NOTIFICACIONES */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          padding: "0 10px", // <-- Esto separa sutilmente los íconos de los bordes
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d8e2dc"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="m9 12 2 2 4-4"></path>
          </svg>

          <h2 style={{ fontSize: "26px", margin: 0, letterSpacing: "1px" }}>
            SAIA
          </h2>
        </div>

        {/* ACÁ ESTÁ LA CAMPANA INTELIGENTE */}
        <BotonNotificaciones />
      </div>

      {/* --- ENLACES COMUNES (Los ven todos) --- */}
      <Link to="/" style={estiloLink}>
        Inicio
      </Link>
      <Link to="/personal" style={estiloLink}>
        Personal
      </Link>

      {/* --- ENLACES DEL OPERADOR --- */}
      {user.puede_operar && (
        <>
          <Link to="/checklist" style={estiloLink}>
            Checklist Diario
          </Link>
          <Link to="/elementos-limpieza" style={estiloLink}>
            Elementos de Limpieza
          </Link>
          <Link to="/consulta-documentos" style={estiloLink}>
            Consultar Documentos
          </Link>
        </>
      )}

      {/* --- ENLACES DEL ADMINISTRADOR --- */}
      {user.puede_administrar && (
        <>
          <Link to="/planes-limpieza" style={estiloLink}>
            Planes de Limpieza
          </Link>
          <Link to="/equipos" style={estiloLink}>
            Equipos
          </Link>
          <Link to="/insumos" style={estiloLink}>
            Insumos
          </Link>
          <Link to="/insumos-quimicos" style={estiloLink}>
            Insumos Químicos
          </Link>
          <Link to="/unidades-medida" style={estiloLink}>
            Unidades de Medida
          </Link>
          <Link to="/checklist/historial" style={estiloLink}>
            Historial de Checklists
          </Link>
          <Link to="/documentos" style={estiloLink}>
            Documentos
          </Link>
        </>
      )}

      {/* --- BOTÓN DE CERRAR SESIÓN --- */}
      <button
        onClick={logout}
        style={{
          marginTop: "auto", // Lo empuja hacia el fondo del menú
          backgroundColor: "#d9534f",
          color: "white",
          padding: "12px 15px",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar Sesión ({user.nombre})
      </button>
    </nav>
  );
}

const estiloLink = {
  color: "white",
  textDecoration: "none",
  padding: "12px 15px",
  borderRadius: "6px",
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  fontWeight: "bold" as const,
  transition: "background 0.2s",
};
