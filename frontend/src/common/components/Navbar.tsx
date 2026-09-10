import { Link } from 'react-router-dom';

// SIDEBAR 
export default function Navbar() {
  return (
    // la etiqueta <nav> es semántica, se le da el ancho, el color 
    // y hao que ocupe todo el alto de la pantalla (minHeight: '100vh')
    <nav style={{ width: '250px', backgroundColor: '#468189', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', minHeight: '100vh', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}>
      
      {/* LOGO Y TÍTULO}
      {/* esta eñ contenedor flexible para alinear el ícono y el texto horizontalmente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        
        {/* Ícono: Escudo con tilde. 
            Chamuyo: se eligió para representar gráficamente la seguridad e inocuidad del sistema SAIA. 
            yo lo dejo porq va directo en pantalla sin necesidad de cargar foto externa. */}
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
        
        {/* NOMBRE DEL SIST */}
        <h2 style={{ fontSize: '26px', margin: 0, letterSpacing: '1px' }}>SAIA</h2>
      </div>
      {/* --------------------------------- */}

      {/* --- SECCIÓN DE ENLACES (RUTAS ACTIVAS) --- */}
      {/* se usa el <Link> de React Router para navegar sin que la página se recargue entera de una*/}
      <Link to="/" style={estiloLink}>Inicio</Link>
      <Link to="/personal" style={estiloLink}>Personal</Link>
      
      {/* --- SECCIÓN DE MÓDULOS FUTUROS (INACTIVOS) --- */}
      {/* se usa <span> en lugar de <Link> porque son vistas que todavía no están desarrolladas.
          les dejo por ahora un cursor de "no permitido" y un color más apagado para indicar que aun no las hice lol. */}
      <span style={{ color: '#d8e2dc', cursor: 'not-allowed', padding: '10px', fontSize: '14px' }}>Insumos (Próximamente)</span>
      <span style={{ color: '#d8e2dc', cursor: 'not-allowed', padding: '10px', fontSize: '14px' }}>Equipo (Próximamente)</span>
    </nav>
  );
}

// --- ESTILOS EXTRAÍDOS ---
// se separan los estilos de los links activos en una constante para no repetir código.
// mantiene el HTML más limpio y fácil de leer.
const estiloLink = {
  color: 'white',
  textDecoration: 'none',
  padding: '12px 15px',
  borderRadius: '6px',
  backgroundColor: 'rgba(255, 255, 255, 0.15)', // le meto un blanco transparente para resaltar el botón
  fontWeight: 'bold' as const, // 'as const' es necesario para que TypeScript no se queje con los pesos de fuente
  transition: 'background 0.2s', // lo hace mas suave para si mas adelante le agregamos mas cosas
};