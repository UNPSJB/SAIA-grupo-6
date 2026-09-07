import { useState } from 'react';
import type { Persona } from '../../types/personal';

interface Props {
  personaEditando: Persona | null;
  alGuardar: (persona: any) => void;
  alCancelar: () => void;
}

export default function FormularioPersonal({ personaEditando, alGuardar, alCancelar }: Props) {
  const [nombre, setNombre] = useState(personaEditando ? personaEditando.nombre : '');
  const [apellido, setApellido] = useState(personaEditando?.apellido || '');
  const [dni, setDni] = useState(personaEditando?.dni || '');
  const [email, setEmail] = useState(personaEditando?.email || '');
  const [telefono, setTelefono] = useState(personaEditando?.telefono || '');
  const [puedeOperar, setPuedeOperar] = useState(personaEditando ? personaEditando.puede_operar : false);
  const [puedeAdministrar, setPuedeAdministrar] = useState(personaEditando ? personaEditando.puede_administrar : false);

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !dni.trim() || !email.trim()) return;

    alGuardar({
      ...(personaEditando ? { id: personaEditando.id } : {}),
      nombre,
      apellido: apellido || null,
      dni,
      email,
      telefono: telefono || null,
      puede_operar: puedeOperar,
      puede_administrar: puedeAdministrar
    });

    if (!personaEditando) {
      setNombre('');
      setApellido('');
      setDni('');
      setEmail('');
      setTelefono('');
      setPuedeOperar(false);
      setPuedeAdministrar(false);
    }
  };

  const estiloInput = {
    backgroundColor: '#fff',
    padding: '12px',
    width: '100%',
    maxWidth: '500px',
    borderRadius: '8px',
    border: '2px solid #90BEBB',
    fontSize: '16px',
    outline: 'none',
    color: '#333'
  };

  const estiloLabel = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
    color: '#555'
  };

  return (
    <form onSubmit={manejarSubmit} style={{ 
      backgroundColor: '#ffffff', 
      padding: '30px', 
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      marginBottom: '30px'
    }}>
      <h3 style={{ marginTop: '0', fontSize: '22px', color: '#468189' }}>
        {personaEditando ? 'Modificar Personal' : 'Alta de Personal'}
      </h3>
      
      {/* Nombre */}
      <div style={{ marginBottom: '20px' }}>
        <label style={estiloLabel}>NOMBRE *</label>
        <input 
          type="text" 
          value={nombre} 
          onChange={(e) => setNombre(e.target.value)} 
          placeholder="Ej: Ana"
          style={estiloInput}
          required 
        />
      </div>

      {/* Apellido */}
      <div style={{ marginBottom: '20px' }}>
        <label style={estiloLabel}>APELLIDO</label>
        <input 
          type="text" 
          value={apellido} 
          onChange={(e) => setApellido(e.target.value)} 
          placeholder="Ej: Lopez"
          style={estiloInput}
        />
      </div>

      {/* DNI */}
      <div style={{ marginBottom: '20px' }}>
        <label style={estiloLabel}>DNI (7 u 8 dígitos) *</label>
        <input 
          type="text" 
          value={dni} 
          onChange={(e) => setDni(e.target.value)} 
          placeholder="Ej: 38123456"
          maxLength={8}
          style={estiloInput}
          required 
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: '20px' }}>
        <label style={estiloLabel}>CORREO ELECTRÓNICO *</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="Ej: correo@unpsjb.edu.ar"
          style={estiloInput}
          required 
        />
      </div>

      {/* Teléfono */}
      <div style={{ marginBottom: '20px' }}>
        <label style={estiloLabel}>TELÉFONO</label>
        <input 
          type="text" 
          value={telefono} 
          onChange={(e) => setTelefono(e.target.value)} 
          placeholder="Ej: 2980445566"
          style={estiloInput}
        />
      </div>

      {/* Capacidades */}
      <div style={{ marginBottom: '25px', display: 'flex', gap: '25px' }}>
        <label style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={puedeOperar} 
            onChange={(e) => setPuedeOperar(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          /> Operar
        </label>
        <label style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={puedeAdministrar} 
            onChange={(e) => setPuedeAdministrar(e.target.checked)} 
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          /> Administrar
        </label>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: '15px' }}>
        <button type="submit" style={{ 
          backgroundColor: '#468189', 
          color: 'white', 
          padding: '12px 24px', 
          borderRadius: '8px', 
          border: 'none',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: 'bold'
        }}>
          {personaEditando ? 'Guardar Cambios' : 'Registrar Personal'}
        </button>
        
        {personaEditando && (
          <button type="button" onClick={alCancelar} style={{ 
            backgroundColor: '#e0e0e0', 
            color: '#333',
            padding: '12px 24px', 
            borderRadius: '8px', 
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold'
          }}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}