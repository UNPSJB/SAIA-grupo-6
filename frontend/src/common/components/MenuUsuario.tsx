import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Box, Menu, Portal, Text } from "@chakra-ui/react";
import { LuLogOut, LuUserRound } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { useAuth } from "../context/useAuth";
import { Tooltip } from "../../components/ui/tooltip";

interface OpcionMenuUsuario {
  valor: string;
  label: string;
  icon: IconType;
  accion: () => void;
  /** Se pinta en rojo (cerrar sesión, etc.). */
  peligro?: boolean;
  /** Dibuja una línea separadora antes de esta opción. */
  separador?: boolean;
}

export function MenuUsuario() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const nombreCompleto = `${user.nombre} ${user.apellido}`;

  // Se muestra bajo el nombre, como el "Signed in as" de GitHub.
  const rol = user.es_super_admin
    ? "Super administrador"
    : user.puede_administrar
      ? "Administrador"
      : user.puede_operar
        ? "Operador"
        : "Usuario";

  // Para agregar una opción nueva, sumá una línea acá.
  const opciones: OpcionMenuUsuario[] = [
    {
      valor: "perfil",
      label: "Mi perfil",
      icon: LuUserRound,
      accion: () => navigate("/mi-perfil"),
    },
    {
      valor: "logout",
      label: "Cerrar sesión",
      icon: LuLogOut,
      accion: logout,
      peligro: true,
      separador: true,
    },
  ];

  return (
    <Menu.Root
      positioning={{ placement: "bottom-end" }}
      onSelect={(detalle) =>
        opciones.find((o) => o.valor === detalle.value)?.accion()
      }
    >
      {/* Tooltip de Chakra en vez de `title`: aparece también con el teclado. */}
      <Tooltip
        content={nombreCompleto}
        showArrow
        openDelay={300}
        positioning={{ placement: "bottom" }}
      >
        <Box as="span" display="inline-flex">
          <Menu.Trigger
            rounded="full"
            cursor="pointer"
            aria-label={`Menú de usuario: ${nombreCompleto}`}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "brand.700",
              outlineOffset: "2px",
            }}
          >
            {/* Iniciales del nombre (ej: "alan james" -> "AJ"). 40px, igual que el resto de la fila. */}
            <Avatar.Root size="md" bg="brand.700" color="white">
              <Avatar.Fallback name={nombreCompleto} />
            </Avatar.Root>
          </Menu.Trigger>
        </Box>
      </Tooltip>

      {/* Portal: el menú se dibuja fuera de la barra, sin que nada lo recorte. */}
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="240px">
            <Box px="3" py="2">
              <Text fontSize="xs" color="fg.muted">
                Sesión iniciada como
              </Text>
              <Text fontSize="sm" fontWeight="bold">
                {nombreCompleto}
              </Text>
              <Badge mt="1" colorPalette="brand" variant="subtle">
                {rol}
              </Badge>
            </Box>
            <Menu.Separator />

            {opciones.map((opcion) => {
              const Icono = opcion.icon;
              return (
                <Fragment key={opcion.valor}>
                  {opcion.separador && <Menu.Separator />}
                  <Menu.Item
                    value={opcion.valor}
                    color={opcion.peligro ? "fg.error" : undefined}
                    _hover={
                      opcion.peligro ? { bg: "bg.error", color: "fg.error" } : undefined
                    }
                  >
                    <Icono size={16} aria-hidden />
                    <Box flex="1">{opcion.label}</Box>
                  </Menu.Item>
                </Fragment>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
