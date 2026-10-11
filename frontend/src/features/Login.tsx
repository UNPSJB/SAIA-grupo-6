import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { login, register, getBootstrapStatus } from '../common/api/authService';
import { useAuth } from '../common/context/useAuth';
import { DialogForm } from '../common/components/DialogForm';
import { Box, Button, Checkbox, Flex, Heading, Input, Text, Link } from '@chakra-ui/react';

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

    return (
        <Flex
            minH="100vh"
            bg="brand.500"
            align="center"
            justify="center"
            p="5"
        >
            <Box
                bg="bg.panel"
                p="10"
                rounded="lg"
                boxShadow="card"
                w="100%"
                maxW="500px"
            >
                <Heading
                    as="h2"
                    size="xl"
                    color="brand.500"
                    textAlign="center"
                    mt={0}
                    mb="6"
                >
                    {isLoginView ? 'Iniciar Sesión en SAIA' : 'Registrar Nuevo Usuario'}
                </Heading>

                {error && (
                    <Box
                        bg="red.100"
                        color="red.800"
                        p="3"
                        rounded="md"
                        textAlign="center"
                        fontWeight="bold"
                        fontSize="sm"
                        mb="4"
                    >
                        ⚠️ {error}
                    </Box>
                )}

                {/* Ya no usamos "required", nuestras alertas de JavaScript hacen el trabajo duro */}
                <DialogForm onSubmit={handleSubmit}>
                    <Box display="flex" flexDirection="column">
                        {!isLoginView && (
                            <>
                                <Flex gap="4" mb="4">
                                    <Input
                                        type="text"
                                        placeholder="Nombre *"
                                        value={nombre}
                                        onChange={e => setNombre(e.target.value)}
                                        mb={0}
                                    />
                                    <Input
                                        type="text"
                                        placeholder="Apellido"
                                        value={apellido}
                                        onChange={e => setApellido(e.target.value)}
                                        mb={0}
                                    />
                                </Flex>
                                <Input
                                    type="email"
                                    placeholder="Correo Electrónico *"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                                <Input
                                    type="tel"
                                    placeholder="Teléfono"
                                    value={telefono}
                                    onChange={e => setTelefono(e.target.value)}
                                />
                            </>
                        )}

                        <Input
                            type="text"
                            placeholder="DNI *"
                            value={dni}
                            onChange={e => setDni(e.target.value)}
                            inputMode="numeric"
                        />
                        <Input
                            type="password"
                            placeholder="Contraseña *"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />

                        {!isLoginView && (
                            <Flex
                                gap="5"
                                mb="5"
                                justify="center"
                                wrap="wrap"
                            >
                                <Checkbox.Root
                                    checked={puedeOperar}
                                    onCheckedChange={(e) => setPuedeOperar(!!e.checked)}
                                    fontWeight="bold"
                                    color="fg.muted"
                                    size="lg"
                                >
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control />
                                    <Checkbox.Label>Operar</Checkbox.Label>
                                </Checkbox.Root>
                                <Checkbox.Root
                                    checked={puedeAdministrar}
                                    onCheckedChange={(e) => setPuedeAdministrar(!!e.checked)}
                                    fontWeight="bold"
                                    color="fg.muted"
                                    size="lg"
                                >
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control />
                                    <Checkbox.Label>Administrar</Checkbox.Label>
                                </Checkbox.Root>

                                {/* Solo mientras el sistema no tenga ningún administrador:
                                    es el arranque de una base nueva. */}
                                {permiteSuperAdmin && (
                                    <Checkbox.Root
                                        checked={esSuperAdmin}
                                        onCheckedChange={(e) => {
                                            setEsSuperAdmin(!!e.checked);
                                            // Un super admin administra todo: activamos también las capacidades.
                                            if (e.checked) {
                                                setPuedeOperar(true);
                                                setPuedeAdministrar(true);
                                            }
                                        }}
                                        title="Porque el sistema todavía no tiene administradores"
                                        fontWeight="bold"
                                        color="yellow.700"
                                        size="lg"
                                        p="1 2"
                                        rounded="md"
                                        border="1px dashed"
                                        borderColor="yellow.400"
                                        bg="yellow.50"
                                    >
                                        <Checkbox.HiddenInput />
                                        <Checkbox.Control />
                                        <Checkbox.Label>Super administrador</Checkbox.Label>
                                    </Checkbox.Root>
                                )}
                            </Flex>
                        )}

                        {!isLoginView && permiteSuperAdmin && (
                            <Text
                                fontSize="xs"
                                color="yellow.fg"
                                textAlign="center"
                                mt="-10px"
                                mb="4"
                            >
                                El sistema todavía no tiene administradores: el primer usuario puede ser
                                super administrador. Cuando exista uno, el registro público ya no podrá
                                asignar ese rol.
                            </Text>
                        )}

                        <Button
                            type="submit"
                            colorPalette="brand"
                            rounded="lg"
                            fontWeight="bold"
                            mt="3"
                            w="100%"
                            p="3"
                        >
                            {isLoginView ? 'Ingresar' : 'Crear Usuario'}
                        </Button>
                    </Box>
                </DialogForm>

                <Box mt="5" textAlign="center">
                    <Link
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsLoginView(!isLoginView);
                            setError('');
                        }}
                        color="brand.500"
                        fontWeight="bold"
                        cursor="pointer"
                    >
                        {isLoginView ? '¿No tenés usuario? Registrate acá' : 'Volver a Iniciar Sesión'}
                    </Link>
                </Box>
            </Box>
        </Flex>
    );
};
