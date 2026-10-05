import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { login, register, getBootstrapStatus } from '../common/api/authService';
import { useAuth } from '../common/context/useAuth';

export const Login = () => {
    const navigate = useNavigate();
    const { user, loginUser } = useAuth();
    
    const [isLoginView, setIsLoginView] = useState(true);
    const [error, setError] = useState('');

    const [dni, setDni] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [puedeOperar, setPuedeOperar] = useState(false);
    const [puedeAdministrar, setPuedeAdministrar] = useState(false);
    const [esSuperAdmin, setEsSuperAdmin] = useState(false);

    // Mientras el sistema no tenga ningún administrador se permite elegir el
    // rol de super admin en el registro (arranque de una base nueva).
    const [permiteSuperAdmin, setPermiteSuperAdmin] = useState(false);

    useEffect(() => {
        getBootstrapStatus()
            .then((status) => setPermiteSuperAdmin(status.permite_super_admin))
            .catch(() => setPermiteSuperAdmin(false));
    }, []);

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // --- VALIDACIONES FRONTEND ANTES DE ENVIAR AL SERVIDOR ---
        if (!isLoginView) {
            // Validaciones de Registro
            if (!nombre.trim()) {
                return setError('El nombre es obligatorio.');
            }
            if (!dni.trim() || dni.length < 7 || dni.length > 8) {
                return setError('El DNI debe tener entre 7 y 8 números.');
            }
            // Expresión regular básica para validar el formato del correo
            const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!regexEmail.test(email)) {
                return setError('Ingresá un correo electrónico válido (ej: usuario@correo.com).');
            }
            if (!password.trim()) {
                return setError('La contraseña es obligatoria.');
            }
            if (!puedeOperar && !puedeAdministrar && !esSuperAdmin) {
                return setError('Debe elegir al menos un permiso (Operar o Administrar).');
            }
        } else {
            // Validaciones de Login
            if (!dni.trim() || !password.trim()) {
                return setError('Por favor, ingresá tu DNI y tu contraseña.');
            }
        }

        // --- ENVÍO DE DATOS AL BACKEND ---
        try {
            if (isLoginView) {
                const loggedUser = await login(dni, password);
                loginUser(loggedUser.user);
                navigate('/');
            } else {
                await register({
                    nombre, 
                    apellido, 
                    dni, 
                    email, 
                    telefono, 
                    password,
                    puede_operar: puedeOperar || esSuperAdmin,
                    puede_administrar: puedeAdministrar || esSuperAdmin,
                    es_super_admin: permiteSuperAdmin && esSuperAdmin
                });
                // Registramos y logueamos de una para arrancar con tokens vigentes
                const loggedUser = await login(dni, password);
                loginUser(loggedUser.user);
                navigate('/');
            }
        } catch (err: unknown) {
            let mensajeError = 'Error al procesar la solicitud';

            const responseError = err as {
                response?: { data?: { detail?: unknown } };
                message?: unknown;
            };
            const detail = responseError.response?.data?.detail;

            if (detail) {
                if (Array.isArray(detail)) {
                    mensajeError = detail
                        .map((item) => {
                            const validationError = item as {
                                loc?: unknown[];
                                msg?: unknown;
                            };
                            const field = validationError.loc?.at(-1);
                            return `${field}: ${validationError.msg}`;
                        })
                        .join(', ');
                } else if (typeof detail === 'string') {
                    mensajeError = detail;
                }
            } else if (typeof responseError.message === 'string') {
                mensajeError = responseError.message;
            }
            
            setError(mensajeError);
        }
    };

    const estiloInput = {
        backgroundColor: "#fff",
        padding: "12px",
        width: "100%",
        borderRadius: "8px",
        border: "2px solid #90BEBB",
        fontSize: "16px",
        outline: "none",
        color: "#333",
        marginBottom: "15px"
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#468189', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
                <h2 style={{ textAlign: 'center', color: '#468189', marginTop: 0, marginBottom: '25px', fontSize: '24px' }}>
                    {isLoginView ? 'Iniciar Sesión en SAIA' : 'Registrar Nuevo Usuario'}
                </h2>
                
                {error && (
                    <p style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                        ⚠️ {error}
                    </p>
                )}

                {/* Ya no usamos "required", nuestras alertas de JavaScript hacen el trabajo duro */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }} noValidate>
                    {!isLoginView && (
                        <>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                <input type="text" placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} style={{...estiloInput, marginBottom: 0}} />
                                <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} style={{...estiloInput, marginBottom: 0}} />
                            </div>
                            <input type="email" placeholder="Correo Electrónico *" value={email} onChange={e => setEmail(e.target.value)} style={estiloInput} />
                            <input type="text" placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} style={estiloInput} />
                        </>
                    )}
                    
                    <input type="text" placeholder="DNI *" value={dni} onChange={e => setDni(e.target.value)} style={estiloInput} />
                    <input type="password" placeholder="Contraseña *" value={password} onChange={e => setPassword(e.target.value)} style={estiloInput} />

                    {!isLoginView && (
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <label style={{ cursor: 'pointer', color: '#555', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={puedeOperar} onChange={e => setPuedeOperar(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                Operar
                            </label>
                            <label style={{ cursor: 'pointer', color: '#555', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={puedeAdministrar} onChange={e => setPuedeAdministrar(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                Administrar
                            </label>

                            {/* Solo mientras el sistema no tenga ningún administrador:
                                es el arranque de una base nueva. */}
                            {permiteSuperAdmin && (
                                <label
                                    style={{
                                        cursor: 'pointer', color: '#8a6d1a', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '4px 10px', borderRadius: '6px',
                                        backgroundColor: '#fff8e1', border: '1px dashed #e0c36a'
                                    }}
                                    title="Porque el sistema todavía no tiene administradores"
                                >
                                    <input
                                        type="checkbox"
                                        checked={esSuperAdmin}
                                        onChange={e => {
                                            setEsSuperAdmin(e.target.checked);
                                            // Un super admin administra todo: activamos también las capacidades.
                                            if (e.target.checked) {
                                                setPuedeOperar(true);
                                                setPuedeAdministrar(true);
                                            }
                                        }}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    Super administrador
                                </label>
                            )}
                        </div>
                    )}

                    {!isLoginView && permiteSuperAdmin && (
                        <p style={{ fontSize: '12px', color: '#8a6d1a', textAlign: 'center', marginTop: '-10px', marginBottom: '15px' }}>
                            El sistema todavía no tiene administradores: el primer usuario puede ser
                            super administrador. Cuando exista uno, el registro público ya no podrá
                            asignar ese rol.
                        </p>
                    )}

                    <button type="submit" style={{ padding: '12px', backgroundColor: '#468189', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                        {isLoginView ? 'Ingresar' : 'Crear Usuario'}
                    </button>
                </form>

                <p 
                    style={{ marginTop: '20px', textAlign: 'center', cursor: 'pointer', color: '#468189', fontWeight: 'bold' }} 
                    onClick={() => {
                        setIsLoginView(!isLoginView);
                        setError('');
                    }}
                >
                    {isLoginView ? '¿No tenés usuario? Registrate acá' : 'Volver a Iniciar Sesión'}
                </p>
            </div>
        </div>
    );
};
