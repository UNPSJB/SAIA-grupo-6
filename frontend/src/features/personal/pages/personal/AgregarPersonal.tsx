//aca es donde reutilizamos el componente FormularioPersonal limpio para hacer el alta:

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { traducirError } from '../../../../common/lib/errores';
import FormularioPersonal from '../../FormularioPersonal';

export default function AgregarPersonal() {
  const navigate = useNavigate();
  // tengo que crear un estado para guardar el mensaje de error
  const [error, setError] = useState<string | null>(null);
 // estado para el mensaje de exito
  const [exito, setExito] = useState(false);

  const manejarGuardar = async (nuevaPersona: any) => {
    setError(null); // limpio los errores anteriores al intentar de nuevo
    try {
      const response = await fetch('http://localhost:8000/personal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaPersona)
      });
      
      // si FastAPI devuelve un error, ej: 400 por duplicado
      //if (!response.ok) {
      //  const errorData = await response.json();
      //  // guardo el mensaje que manda FastAPI ("detail") para mostrarlo en pantalla
      //  setError(errorData.detail || "Ocurrió un error al guardar los datos.");
      //  return; // corto la ejecución acá para que NO vuelva a la lista
      // }
      if (!response.ok) {
        const errorData = await response.json();
        setError(traducirError(errorData));
        return; 
      }

      // si todo ok, recién ahí vuelvo a la lista
      if (response.ok) {
        setExito(true);
        // Espera 2 segundos (2000ms) para que el usuario lea el cartel antes de volver a la lista
        setTimeout(() => {
          navigate('/personal');
        }, 2000);
      }

    } catch (error) {
      console.error("Error al guardar:", error);
      setError("Error de conexión con el servidor.");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Registrar Nuevo Personal</h2>
        <button 
          onClick={() => navigate('/personal')} 
          style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
          Volver a la lista
        </button>
      </div>

      {/* si hay  error, muestro cartelito rojo */}
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
              Personal agregado correctamente.
            </p>
          </div>
        </div>
      )}

      <FormularioPersonal 
        personaEditando={null} 
        alGuardar={manejarGuardar} 
        alCancelar={() => navigate('/personal')} 
      />
    </div>
  );
}