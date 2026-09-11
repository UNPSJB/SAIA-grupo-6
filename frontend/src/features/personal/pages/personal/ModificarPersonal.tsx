//esta vista busca a la persona que se quiere editar y le pasa sus datos precargados al FormularioPersonal que ya tenia hecho:

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { traducirError } from '../../../../common/lib/errores';
import FormularioPersonal from '../../FormularioPersonal';import type { Persona } from '../../../../types/personal';

export default function ModificarPersonal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  
  // estado para el mensaje de error
  const [error, setError] = useState<string | null>(null);
  // estado para el mensaje de exito
  const [exito, setExito] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:8000/personal/${id}`)
      .then(res => res.json())
      .then(data => setPersona(data))
      .catch(err => console.error("Error al traer los datos:", err));
  }, [id]);

  const manejarGuardar = async (personaModificada: any) => {
    setError(null); // limpio errores
    try {
      const response = await fetch(`http://localhost:8000/personal/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personaModificada)
      });
      
      // si FastAPI detecta que ese DNI ya es de otra persona
      //if (!response.ok) {
      // const errorData = await response.json();
      //  setError(errorData.detail || "Error al modificar los datos.");
      //  return; 
      //}

      if (!response.ok) {
        const errorData = await response.json();
        // Pasamos el errorData al traductor y guardamos el string resultante en el estado
        setError(traducirError(errorData));
        return; 
      }

      if (response.ok) {
        setExito(true);
        // Espera 2 segundos (2000ms) para que el usuario lea el cartel antes de volver a la lista
        setTimeout(() => {
          navigate('/personal');
        }, 2000);
      }

    } catch (error) {
      console.error("Error al modificar:", error);
      setError("Error de conexión con el servidor.");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Modificar Personal</h2>
        <button 
          onClick={() => navigate('/personal')} 
          style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          Volver a la lista
        </button>
      </div>

      {/* Cartelito rojo de error */}
      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #f5c6cb', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Cartelito verde de éxito */}
      {exito && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.4)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 1000,
          animation: 'fadeInOverlay 0.3s ease-out'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px 50px', 
            borderRadius: '12px', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', 
            textAlign: 'center',
            animation: 'popInModal 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ fontSize: '50px', marginBottom: '10px' }}>✅</div>
            <h3 style={{ margin: '0', color: '#28a745', fontSize: '24px' }}>Éxito</h3>
            <p style={{ color: '#555', marginTop: '10px', fontSize: '16px', fontWeight: '500' }}>
              Personal modificado correctamente.
            </p>
          </div>
        </div>
      )}

      {persona ? (
        <FormularioPersonal 
          personaEditando={persona} 
          alGuardar={manejarGuardar} 
          alCancelar={() => navigate('/personal')} 
        />
      ) : (
        <p style={{ fontStyle: 'italic', color: '#666' }}>Cargando datos del personal...</p>
      )}
    </div>
  );
}