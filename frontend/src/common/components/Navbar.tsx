import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar, puedeOperar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import { PELIGRO, TEAL } from "../theme/tokens";

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
        backgroundColor: TEAL,
        color: "white",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        height: "100vh",
        boxSizing: "border-box",
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
          padding: "0 10px",
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

        {/* La campana de alertas es parte de la gestión del administrador */}
        {puedeAdministrar(user) && <BotonNotificaciones />}
      </div>

      {/* --- ENLACES COMUNES --- */}
      <Link to="/" style={estiloLink}>
        Inicio
      </Link>

      {/* --- ENLACES DEL OPERADOR --- */}
      {puedeOperar(user) && (
        <>
          <Link to="/checklist" style={estiloLink}>
            Checklist Diario
          </Link>

          <Link to="/incidentes/reportar" style={estiloLink}>
            Reportar Incidente
          </Link>
          <Link to="/consulta-documentos" style={estiloLink}>
            Consultar Documentos
          </Link>
        </>
      )}

      {/* --- ENLACES DEL ADMINISTRADOR --- */}
      {puedeAdministrar(user) && (
        <>
          <Link to="/personal" style={estiloLink}>
            Personal
          </Link>

          <Link to="/planes-limpieza" style={estiloLink}>
            Planes de Limpieza
          </Link>

          <Link
            to="/planes-calibracion-mantenimiento"
            style={estiloLink}
          >
            Calibración/Mantenimiento
          </Link>

          <Link to="/elementos-limpieza" style={estiloLink}>
            Elementos de Limpieza
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

          <Link to="/aptitudes" style={estiloLink}>
           Aptitudes 
          </Link>


          <Link to="/checklist/historial" style={estiloLink}>
            Historial de Checklists
          </Link>
          <Link to="/consumo-productos" style={estiloLink}>
            Consumo de Productos
          </Link>

          <Link to="/incidentes" style={estiloLink}>
            Gestión de Incidentes
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
          marginTop: "auto",
          backgroundColor: PELIGRO,
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
