//esta es la página que se abre al hacer clic en el ícono de ojo 👁️ del pizarrón, donde se ven los datos completos incluyendo el correo electrónico y el teléfono:

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Persona } from '../../../../types/personal';

export default function DetallePersonal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);

  useEffect(() => {
    // Le pego al backend para traer los datos precisos de este ID
    fetch(`http://localhost:8000/personal/${id}`)
      .then(res => res.json())
      .then(data => setPersona(data))
      .catch(err => console.error("Error al traer detalle:", err));
  }, [id]);

  if (!persona) {
    return <div style={{ padding: '20px' }}>Cargando información del personal...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Ficha de Personal #{persona.id}</h2>
        <button onClick={() => navigate('/personal')} style={estiloBotonVolver}>
          Volver a la lista
        </button>
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <p><strong>Nombre completo:</strong> {persona.nombre} {persona.apellido}</p>
        <p><strong>DNI:</strong> {persona.dni}</p>
        <p><strong>Email:</strong> {persona.email}</p>
        <p><strong>Teléfono:</strong> {persona.telefono || 'No registrado'}</p>
        
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <h4>Permisos en el sistema:</h4>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              {persona.puede_operar ? '✅' : '❌'} Puede Operar
            </li>
            <li>
              {persona.puede_administrar ? '✅' : '❌'} Puede Administrar
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const estiloBotonVolver = {
  backgroundColor: '#6c757d',
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
};