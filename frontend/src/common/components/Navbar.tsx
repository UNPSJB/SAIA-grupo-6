import { Navigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar, puedeOperar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import {
  Box,
  Flex,
  Heading,
  Button,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuShieldCheck } from "react-icons/lu";

/**
 * Cada entrada del menú. La visibilidad por rol se declara acá, en el
 * dato: el mismo elemento es la fuente de verdad del render y puede servir
 * de base para tests de cobertura de rutas. Antes había 15 <Link> copiados
 * a mano: agregar una sección implicaba tocar el render del Navbar y el
 * router por separado, y se desincronizaban.
 */
type RolMenu = "todos" | "operar" | "administrar";

interface EntradaMenu {
  to: string;
  label: string;
  rol: RolMenu;
}

const MENU: EntradaMenu[] = [
  { to: "/", label: "Inicio", rol: "todos" },
  { to: "/checklist", label: "Checklist Diario", rol: "operar" },
  { to: "/incidentes/reportar", label: "Reportar Incidente", rol: "operar" },
  { to: "/consulta-documentos", label: "Consultar Documentos", rol: "operar" },
  { to: "/personal", label: "Personal", rol: "administrar" },
  { to: "/planes-limpieza", label: "Planes de Limpieza", rol: "administrar" },
  {
    to: "/planes-calibracion-mantenimiento",
    label: "Calibración/Mantenimiento",
    rol: "administrar",
  },
  { to: "/elementos-limpieza", label: "Elementos de Limpieza", rol: "administrar" },
  { to: "/equipos", label: "Equipos", rol: "administrar" },
  { to: "/insumos", label: "Insumos", rol: "administrar" },
  { to: "/insumos-quimicos", label: "Insumos Químicos", rol: "administrar" },
  { to: "/unidades-medida", label: "Unidades de Medida", rol: "administrar" },
  { to: "/aptitudes", label: "Aptitudes", rol: "administrar" },
  { to: "/checklist/historial", label: "Historial de Checklists", rol: "administrar" },
  { to: "/consumo-productos", label: "Consumo de Productos", rol: "administrar" },
  { to: "/incidentes", label: "Gestión de Incidentes", rol: "administrar" },
  { to: "/documentos", label: "Documentos", rol: "administrar" },
];

function esVisibleEntrada(
  entrada: EntradaMenu,
  user: Parameters<typeof puedeOperar>[0]
): boolean {
  if (entrada.rol === "todos") return true;
  if (entrada.rol === "operar") return puedeOperar(user);
  return puedeAdministrar(user);
}

export default function Navbar() {
  const { user, logout } = useAuth();

  // EL CANDADO: Si no hay nadie logueado, lo mandamos al Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const entradas = MENU.filter((e) => esVisibleEntrada(e, user));

  return (
    <Box
      as="nav"
      w="250px"
      h="100vh"
      position="sticky"
      top={0}
      bg="brand.500"
      color="white"
      p="20px"
      display="flex"
      flexDirection="column"
      gap="15px"
      boxShadow="2px 0 5px rgba(0,0,0,0.1)"
      flexShrink={0}
    >
      {/* LOGO, TÍTULO Y BOTÓN DE NOTIFICACIONES */}
      <Flex
        align="center"
        justify="space-between"
        mb="20px"
        px="10px"
      >
        <Flex align="center" gap="12px">
          <LuShieldCheck size={32} color="brand.100" aria-hidden />
          <Heading as="h2" size="2xl" letterSpacing="1px">
            SAIA
          </Heading>
        </Flex>
        {puedeAdministrar(user) && <BotonNotificaciones />}
      </Flex>

      {/* --- ENLACES --- */}
      <Stack as="ul" gap="8px" listStyleType="none" p={0} m={0}>
        {entradas.map((entrada) => (
          <Box as="li" key={entrada.to}>
            <NavLink
              to={entrada.to}
              style={({ isActive }) => ({
                display: "block",
                padding: "12px 15px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                color: "white",
                background: isActive
                  ? "rgba(0, 0, 0, 0.2)"
                  : "rgba(255, 255, 255, 0.15)",
              })}
            >
              {entrada.label}
            </NavLink>
          </Box>
        ))}
      </Stack>

      {/* --- BOTÓN DE CERRAR SESIÓN --- */}
      <Button
        mt="auto"
        size="sm"
        height="auto"
        py="12px"
        colorPalette="red"
        fontWeight="bold"
        onClick={logout}
      >
        <Text as="span">Cerrar sesión ({user.nombre})</Text>
      </Button>
    </Box>
  );
}
