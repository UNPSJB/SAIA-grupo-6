import { Link } from "react-router-dom";

// SIDEBAR
export default function Navbar() {
  return (
    // La etiqueta <nav> es semántica, se le da el ancho, el color
    // y hace que ocupe todo el alto de la pantalla.
    <nav
      style={{
        width: "250px",
        backgroundColor: "#468189",
        color: "white",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        minHeight: "100vh",
        boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
      }}
    >
      {/* LOGO Y TÍTULO */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Ícono: Escudo con tilde */}
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

        {/* NOMBRE DEL SISTEMA */}
        <h2 style={{ fontSize: "26px", margin: 0, letterSpacing: "1px" }}>
          SAIA
        </h2>
      </div>

      {/* --- SECCIÓN DE ENLACES --- */}

      <Link to="/" style={estiloLink}>
        Inicio
      </Link>

      <Link to="/personal" style={estiloLink}>
        Personal
      </Link>

      <Link to="/insumos" style={estiloLink}>
        Insumos
      </Link>

      <Link to="/equipos" style={estiloLink}>
        Equipos
      </Link>

      <Link to="/elementosLimpieza" style={estiloLink}>
        Elemnentos de Limpieza
      </Link>

      {/* --- SECCIÓN DE MÓDULOS FUTUROS (INACTIVOS) --- */}
      {/* se usa <span> en lugar de <Link> porque son vistas que todavía no están desarrolladas.
          les dejo por ahora un cursor de "no permitido" y un color más apagado para indicar que aun no las hice lol. */}
      <Link to="/planes-limpieza" style={estiloLink}>
        Planes de Limpieza
      </Link>

      <Link to="/checklist" style={estiloLink}>
        Checklist Diario
      </Link>

      <Link to="/insumos-quimicos" style={estiloLink}>
        Insumos Químicos
      </Link>

      {/* --- SECCIÓN DE MÓDULOS FUTUROS --- */}
      <span
        style={{
          color: "#d8e2dc",
          cursor: "not-allowed",
          padding: "10px",
          fontSize: "14px",
        }}
      >
        FUTUROS (Próximamente)
      </span>
    </nav>
  );
}

// --- ESTILOS EXTRAÍDOS ---

const estiloLink = {
  color: "white",
  textDecoration: "none",
  padding: "12px 15px",
  borderRadius: "6px",
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  fontWeight: "bold" as const,
  transition: "background 0.2s",
};