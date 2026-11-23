import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Badge, Box, Menu, Portal, Text } from "@chakra-ui/react";
import { LuChartColumn, LuLogOut, LuSettings, LuUserRound } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { useAuth } from "../context/useAuth";
import { esGerente, esSuperAdmin, nombreDeRol, puedeAdministrar } from "../api/permissions";
import { RUTA_CONFIGURACION } from "./menuEntradas";
import { Tooltip } from "../../components/ui/tooltip";
import { obtenerEstablecimientoActual } from "../../features/establecimientos/services/establecimientoService";

interface OpcionMenuUsuario {
  valor: string;
  label: string;
  icon: IconType;
  accion: () => void;
  /** Se pinta en rojo (cerrar sesión, etc.). */
  peligro?: boolean;
  /** Dibuja una línea separadora antes de esta opción. */
  separador?: boolean;
  /** Solo se muestra a quien puede administrar. Por defecto la ven todos. */
  soloAdministradores?: boolean;
  /** Solo gerentes y super admin (el tablero comparativo entre sedes). */
  soloGerentes?: boolean;
}

export function MenuUsuario() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sede, setSede] = useState<string | null>(null);

  // Nombre de la sede en la que se trabaja (la propia, o la elegida por el
  // super admin), para que siempre se sepa de quién son los datos en pantalla.
  useEffect(() => {
    if (!user) return;
    let vigente = true;
    obtenerEstablecimientoActual()
      .then((e) => vigente && setSede(e.nombre))
      .catch(() => vigente && setSede(null));
    return () => {
      vigente = false;
    };
  }, [user]);

  if (!user) return null;

  const nombreCompleto = `${user.nombre} ${user.apellido}`;

  // Se muestra bajo el nombre, como el "Signed in as" de GitHub.
  const rol = nombreDeRol(user);

  // Para agregar una opción nueva, sumá una línea acá.
  const todasLasOpciones: OpcionMenuUsuario[] = [
    {
      valor: "perfil",
      label: "Mi perfil",
      icon: LuUserRound,
      accion: () => navigate("/mi-perfil"),
    },
    {
      valor: "comparativo",
      label: "Comparar sedes",
      icon: LuChartColumn,
      accion: () => navigate("/comparativo"),
      soloGerentes: true,
    },
    {
      valor: "configuracion",
      label: "Configuración",
      icon: LuSettings,
      accion: () => navigate(RUTA_CONFIGURACION),
      soloAdministradores: true,
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

  const opciones = todasLasOpciones.filter(
    (opcion) =>
      (!opcion.soloAdministradores || puedeAdministrar(user)) &&
      (!opcion.soloGerentes || esGerente(user) || esSuperAdmin(user)),
  );

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
              outlineColor: "white",
              outlineOffset: "2px",
            }}
          >
            {/* Iniciales del nombre (ej: "alan james" -> "AJ"). 40px, igual que el resto de la fila. */}
            <Avatar.Root size="md" bg="white" color="brandLight.700">
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
              {sede && (
                <Text fontSize="xs" color="fg.muted" mt="1">
                  {user.es_super_admin ? "Trabajando en" : "Establecimiento"}: {sede}
                </Text>
              )}
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
