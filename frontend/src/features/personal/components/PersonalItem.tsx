import { Button, HStack, Table, Text } from "@chakra-ui/react";
import type { Persona } from "../types/personal";
import { useNavigate } from "react-router-dom";
import { LuEye } from "react-icons/lu";
import { useAuth } from "../../../common/context/useAuth";
import { esSuperAdmin as esSuperAdminDe, puedeDarDeBajaA, puedeEditarA } from "../../../common/api/permissions";
import { BotonTabla, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface PersonalItemProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onReactivar: (persona: Persona) => void; // Recibimos el método desde la tabla
}

/** Resumen de capacidades en texto: "Operar | Administrar", "Ninguna", etc. */
function resumenPermisos(persona: Persona) {
  if (esSuperAdminDe(persona)) return "Super admin";

  const partes: string[] = [];
  if (persona.puede_operar) partes.push("Operar");
  if (persona.puede_administrar) partes.push("Administrar");

  return partes.length > 0 ? partes.join(" | ") : "Ninguna";
}

export function PersonalItem({ persona, onEdit, onDelete, onReactivar }: PersonalItemProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Las acciones se ocultan según la jerarquía: un admin no toca a otro admin
  // ni a un super admin, y nadie se da de baja a sí mismo.
  const puedeEditar = puedeEditarA(user, persona);
  const puedeBorrar = puedeDarDeBajaA(user, persona);

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={persona.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={`${persona.nombre} ${persona.apellido || ""}`.trim()} />
      </Celda>
      <Celda p="3">{persona.dni}</Celda>
      <Celda p="3">
        <Text as="span" bg="bg.muted" px="2" py="1" rounded="sm" fontSize="xs">
          {resumenPermisos(persona)}
        </Text>
      </Celda>
      <Celda p="3" center>
        <Button
          variant="ghost"
          fontSize="lg"
          /*
           * Alto ajustado al contenido: el alto por defecto del botón (~40px)
           * hacía que las filas de esta tabla midieran más que las del resto
           * (los BotonTabla de las acciones miden ~28px). Con `h="auto"` y el
           * padding mínimo, la fila queda a la par de Equipos, Insumos, etc.
           */
          h="auto"
          px="2"
          py="1"
          onClick={() => navigate(`/personal/detalle/${persona.id}`)}
          title="Ver Detalle"
          aria-label={`Ver detalle de ${persona.nombre}`}
        >
          <LuEye aria-hidden />
        </Button>
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {persona.activo && puedeEditar && (
            <BotonTabla accion="editar" onClick={() => onEdit(persona)}>
              Modificar
            </BotonTabla>
          )}

          {persona.activo ? (
            puedeBorrar && (
              <BotonTabla accion="eliminar" onClick={() => onDelete(persona)}>
                Eliminar
              </BotonTabla>
            )
          ) : (
            puedeEditar && (
              <BotonTabla accion="reactivar" onClick={() => onReactivar(persona)}>
                Reactivar
              </BotonTabla>
            )
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}