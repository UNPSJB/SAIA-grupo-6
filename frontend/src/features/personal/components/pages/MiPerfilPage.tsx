import { useState, type ReactNode } from "react";
import {
  Badge,
  Box,
  Heading,
  SimpleGrid,
  Table,
  Text,
} from "@chakra-ui/react";
import { LuCircleCheck, LuCircleX } from "react-icons/lu";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { hoyISO } from "../../../../common/utils/fechas";
import { useMiPerfil } from "../../hooks/useMiPerfil";
import { modificarPersona } from "../../services/personalService";
import type { PersonaInput } from "../../types/personal";
import { PersonalForm } from "../PersonalForm";
import { useVencimientosPersonal } from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { useAptitudes } from "../../../aptitud/hooks/useAptitudes";
import {
  BannerError,
  BannerExito,
  Celda,
  ColumnaHeader,
  EstadoCargando,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";

/**
 * Ficha de la persona logueada. A diferencia de `PersonalDetailPage` (que
 * mira a cualquiera y exige permiso de administración), esta página se
 * alimenta de `/auth/me` y le sirve a todos los roles.
 *
 * Los datos propios se editan acá (vía `PUT /personal/{id}`, que permite
 * tocarse a uno mismo); los permisos del sistema no: los cambia un
 * administrador desde la gestión de personal.
 */

/**
 * Ítem del listado de permisos: ícono de estado + nombre.
 *
 * Antes iba un emoji (✅/❌): en un sistema sin esa fuente se veían
 * cuadritos. El ícono va envuelto en un `Box` con `color` de Chakra para
 * que resuelva el token semántico (`green.fg`); pasándolo directo al ícono
 * terminaría como color inválido en el CSS.
 */
function Permiso({ concedido, children }: { concedido: boolean; children: ReactNode }) {
  return (
    <Text fontSize="sm" color="fg" display="flex" alignItems="center" gap="2">
      <Box as="span" display="inline-flex" color={concedido ? "green.fg" : "red.fg"} aria-hidden>
        {concedido ? <LuCircleCheck size={16} /> : <LuCircleX size={16} />}
      </Box>
      {children}
    </Text>
  );
}

/**
 * Vencimientos de aptitud de la propia persona.
 *
 * Va en un componente aparte y no directo en la página porque sus hooks
 * piden endpoints de administración (`/vencimientos-personal` y `/aptitudes`
 * exigen admin en el backend): montado condicionalmente, un operador nunca
 * dispara esas requests, que le devolverían 403.
 */
function VencimientosPerfil({ personaId }: { personaId: number }) {
  const { vencimientos, loading: cargandoVencimientos } = useVencimientosPersonal(
    personaId
  );
  const { aptitudes } = useAptitudes(true); // incluir inactivas: si una aptitud
  // vieja se dio de baja, igual queremos poder mostrar su nombre acá.

  const nombrePorAptitud = new Map(aptitudes.map((a) => [a.id, a.nombre]));

  // `hoyISO()` y no `toISOString()`: en UTC-3, entre las 21:00 y las 24:00
  // el `toISOString()` devuelve el día siguiente.
  const hoy = hoyISO();

  return (
    <Box mt="6" pt="6" borderTopWidth="1px" borderColor="border.subtle">
      <Heading as="h4" size="lg" fontWeight="bold" color="fg" mb="3">
        Vencimientos de aptitud
      </Heading>

      {cargandoVencimientos && (
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          Cargando...
        </Text>
      )}

      {!cargandoVencimientos && vencimientos.length === 0 && (
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          No tenés vencimientos cargados.
        </Text>
      )}

      {!cargandoVencimientos && vencimientos.length > 0 && (
        <Table.Root variant="outline" w="100%">
          <Table.Header>
            {/* Es una tabla de detalle embebida en la ficha, no un
                listado: va con el encabezado claro. */}
            <Table.Row>
              <ColumnaHeader>Aptitud</ColumnaHeader>
              <ColumnaHeader>Vence</ColumnaHeader>
              <ColumnaHeader center>Estado</ColumnaHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {vencimientos.map((v) => {
              const vencido = v.fecha_vencimiento < hoy;
              return (
                <Table.Row key={v.id}>
                  <Celda p="3">
                    {nombrePorAptitud.get(v.aptitud_id) || "Aptitud eliminada"}
                  </Celda>
                  <Celda p="3">{v.fecha_vencimiento}</Celda>
                  <Celda p="3" center>
                    <Badge colorPalette={vencido ? "red" : "green"}>
                      {vencido ? "Vencido" : "Vigente"}
                    </Badge>
                  </Celda>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Box>
  );
}

export function MiPerfilPage() {
  const { user, loginUser } = useAuth();
  const { persona, loading, error, recargar } = useMiPerfil();
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  if (loading) {
    return (
      <Box p="5">
        <EstadoCargando>Cargando tu perfil...</EstadoCargando>
      </Box>
    );
  }

  if (error || !persona) {
    return (
      <Box p="5">
        <BannerError mb="0">{error || "No se encontró tu perfil"}</BannerError>
      </Box>
    );
  }

  const handleGuardar = async (values: PersonaInput) => {
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const actualizada = await modificarPersona(persona.id, values);
      await recargar();
      /*
       * La sesión guarda nombre y apellido para el navbar: sin esto
       * seguiría mostrando los anteriores hasta el próximo login.
       * Los permisos van los de la respuesta, que el backend no toca:
       * el form ni los manda.
       */
      loginUser({
        id: actualizada.id,
        nombre: actualizada.nombre,
        // `User.apellido` es string: el contexto no admite null/undefined.
        apellido: actualizada.apellido ?? "",
        dni: actualizada.dni,
        puede_operar: actualizada.puede_operar,
        puede_administrar: actualizada.puede_administrar,
        es_super_admin: actualizada.es_super_admin,
      });
      setExito(true);
    } catch (err) {
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudieron guardar tus datos."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Mi perfil"
        description="Tus datos personales y permisos en el sistema."
      />

      {exito && <BannerExito>Datos actualizados correctamente.</BannerExito>}
      {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

      {/*
       * Datos editables: el `PersonalForm` en modo `esMiPerfil` muestra la
       * sección de cambio de contraseña y no manda los flags de permisos
       * (no se pasan `puedeEditarCapacidades` ni `puedeAsignarSuperAdmin`),
       * así que el backend no les exige permiso de administración.
       */}
      <PersonalForm
        initialValues={{
          nombre: persona.nombre,
          apellido: persona.apellido,
          dni: persona.dni,
          email: persona.email,
          telefono: persona.telefono,
          puede_operar: persona.puede_operar,
          puede_administrar: persona.puede_administrar,
          es_super_admin: persona.es_super_admin,
        }}
        onSubmit={handleGuardar}
        isLoading={guardando}
        title="Mis datos"
        submitLabel="Guardar cambios"
        esMiPerfil
      />

      <Tarjeta p="5">
        <Heading as="h4" size="lg" fontWeight="bold" color="fg" mb="3">
          Permisos en el sistema
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2">
          <Permiso concedido={persona.puede_operar}>Puede Operar</Permiso>
          <Permiso concedido={persona.puede_administrar}>Puede Administrar</Permiso>
          <Permiso concedido={persona.es_super_admin}>Super Admin</Permiso>
        </SimpleGrid>
        <Text fontSize="xs" color="fg.subtle" fontStyle="italic" mt="3">
          Los permisos no se cambian desde acá: los modifica un administrador
          desde la gestión de personal.
        </Text>
      </Tarjeta>

      {/* Sección de administradores: los endpoints de vencimientos y
          aptitudes le devolverían 403 a un operador. */}
      {puedeAdministrar(user) && (
        <Tarjeta p="5" mt="0">
          <VencimientosPerfil personaId={persona.id} />
        </Tarjeta>
      )}
    </Box>
  );
}
