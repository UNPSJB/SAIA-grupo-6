import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { login, register, getBootstrapStatus } from '../common/api/authService';
import { useAuth } from '../common/context/useAuth';
import { DialogForm } from '../common/components/DialogForm';
import { LogoSaia } from '../common/components/LogoSaia';
import { Box, Button, Checkbox, Flex, Heading, Input, Text, Link } from '@chakra-ui/react';
import { LuTriangleAlert } from 'react-icons/lu';
import { brand } from '../theme';
import './Login.css';

const DEGRADADO_CABECERA_LOGIN = `radial-gradient(ellipse at 100% 0%, rgba(255, 255, 255, 0.24), transparent 50%), linear-gradient(115deg, ${brand[700]} 0%, ${brand[500]} 55%, ${brand[400]} 100%)`;

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
                    puede_operar: puedeOperar || esSuperAdmin,
                    puede_administrar: puedeAdministrar || esSuperAdmin,
                    es_super_admin: permiteSuperAdmin && esSuperAdmin
                });
                // Registramos y logueamos de una para arrancar con tokens vigentes.
                // La contraseña inicial es el DNI: el backend la asigna al crear
                // la cuenta cuando no llega una explícita.
                const loggedUser = await login(dni, dni);
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
            className="saia-login"
            minH="100dvh"
            position="relative"
            overflow="hidden"
            align="center"
            justify="center"
            p="5"
        >
            <Box className="saia-login__aura saia-login__aura--uno" aria-hidden />
            <Box className="saia-login__aura saia-login__aura--dos" aria-hidden />
            <Box className="saia-login__orbits" aria-hidden>
                <Box className="saia-login__orbit saia-login__orbit--uno" />
                <Box className="saia-login__orbit saia-login__orbit--dos" />
            </Box>
            <Box className="saia-login__line saia-login__line--uno" aria-hidden />
            <Box className="saia-login__line saia-login__line--dos" aria-hidden />
            <Box
                className="saia-login__card"
                bg="bg.panel"
                rounded="2xl"
                overflow="hidden"
                boxShadow="0 30px 70px rgba(0, 0, 0, 0.35)"
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                w="100%"
                maxW="560px"
            >
                <Box
                    className="saia-login__header"
                    position="relative"
                    overflow="hidden"
                    px={{ base: '6', md: '8' }}
                    pt={{ base: '7', md: '8' }}
                    pb={{ base: '6', md: '7' }}
                    color="white"
                    backgroundImage={DEGRADADO_CABECERA_LOGIN}
                >
                    <Box className="saia-login__header-glow" aria-hidden />
                    <Flex align="center" gap="3" mb="5">
                        <Flex
                            boxSize="11"
                            rounded="xl"
                            align="center"
                            justify="center"
                            bg="whiteAlpha.200"
                            borderWidth="1px"
                            borderColor="whiteAlpha.300"
                            backdropFilter="blur(6px)"
                            flexShrink={0}
                        >
                            <LogoSaia size={24} soloIcono />
                        </Flex>
                        <Box>
                            <Text
                                fontSize="2xl"
                                fontWeight="extrabold"
                                letterSpacing="0.2em"
                                lineHeight="1"
                            >
                                SAIA
                            </Text>
                            <Text
                                fontSize="xs"
                                letterSpacing="0.14em"
                                textTransform="uppercase"
                                color="whiteAlpha.800"
                                mt="1"
                            >
                                Inocuidad alimentaria
                            </Text>
                        </Box>
                    </Flex>
                    <Heading
                        as="h2"
                        fontSize="xl"
                        fontWeight="bold"
                        color="white"
                        lineHeight="1.2"
                    >
                        {isLoginView ? 'Bienvenido de nuevo' : 'Creá tu cuenta'}
                    </Heading>
                    <Text fontSize="sm" color="whiteAlpha.800" mt="1">
                        {isLoginView
                            ? 'Ingresá con tu DNI y contraseña para continuar.'
                            : 'Completá tus datos para empezar a usar SAIA.'}
                    </Text>
                </Box>

                <Box
                    className="saia-login__form"
                    px={{ base: '6', md: '8' }}
                    py={{ base: '6', md: '7' }}
                >
                {error && (
                    <Box
                        bg="red.muted"
                        color="red.fg"
                        p="3"
                        rounded="md"
                        textAlign="center"
                        fontWeight="bold"
                        fontSize="sm"
                        mb="4"
                    >
                        <Flex align="center" justify="center" gap="2">
                            <LuTriangleAlert size={16} aria-hidden />
                            {error}
                        </Flex>
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
                                    mb="4"
                                />
                                <Input
                                    type="tel"
                                    placeholder="Teléfono"
                                    value={telefono}
                                    onChange={e => setTelefono(e.target.value)}
                                    mb="4"
                                />
                            </>
                        )}

                        <Input
                            type="text"
                            placeholder="DNI *"
                            value={dni}
                            onChange={e => setDni(e.target.value)}
                            inputMode="numeric"
                            mb="4"
                        />

                        {/*
                          Contraseña: solo para iniciar sesión. Al registrarse
                          ya no se elige: la cuenta arranca con el DNI como
                          contraseña y cada quien la cambia desde "Mi perfil".
                        */}
                        {isLoginView && (
                            <Input
                                type="password"
                                placeholder="Contraseña *"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                mb="4"
                            />
                        )}

                        {!isLoginView && (
                            <Text
                                fontSize="xs"
                                color="fg.muted"
                                textAlign="center"
                                mb="4"
                                p="2"
                                bg="brand.50"
                                rounded="md"
                            >
                                La contraseña inicial de tu cuenta es tu DNI. Después podés
                                cambiarla desde "Mi perfil".
                            </Text>
                        )}

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
                                        color="yellow.fg"
                                        size="lg"
                                        p="1 2"
                                        rounded="md"
                                        border="1px dashed"
                                        borderColor="yellow.400"
                                        bg="yellow.subtle"
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

                    <Box
                        mt="5"
                        pt="5"
                        borderTopWidth="1px"
                        borderColor="border"
                        textAlign="center"
                    >
                        <Text as="span" fontSize="sm" color="fg.muted">
                            {isLoginView ? '¿No tenés usuario?' : '¿Ya tenés una cuenta?'}
                        </Text>{' '}
                        <Link
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsLoginView(!isLoginView);
                                setError('');
                            }}
                            color="brand.fg"
                            fontWeight="bold"
                            cursor="pointer"
                        >
                            {isLoginView ? 'Registrate acá' : 'Iniciá sesión'}
                        </Link>
                    </Box>
                </Box>
            </Box>
        </Flex>
    );
};
