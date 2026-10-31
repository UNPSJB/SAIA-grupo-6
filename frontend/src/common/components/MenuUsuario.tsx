import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Box, Menu, Portal, Text } from "@chakra-ui/react";
import { LuLogOut, LuUserRound } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { useAuth } from "../context/useAuth";

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
      <Menu.Trigger
        rounded="full"
        cursor="pointer"
        aria-label="Menú de usuario"
        title={nombreCompleto}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "brand.700",
          outlineOffset: "2px",
        }}
      >
        {/* Muestra las iniciales del nombre solo (ej: "alan james" -> "AJ"). */}
        <Avatar.Root size="sm" bg="brand.700" color="white">
          <Avatar.Fallback name={nombreCompleto} />
        </Avatar.Root>
      </Menu.Trigger>

      {/* Portal: el menú se dibuja fuera de la barra, sin que nada lo recorte. */}
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px">
            <Box px="3" py="2">
              <Text fontSize="sm" fontWeight="bold">
                {nombreCompleto}
              </Text>
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