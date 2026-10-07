import { Table, Button, HStack } from "@chakra-ui/react";
import type { Persona } from "../types/personal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../common/context/useAuth";
import { esSuperAdmin as esSuperAdminDe, puedeDarDeBajaA, puedeEditarA } from "../../../common/api/permissions";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  PELIGRO,
  TEAL,
} from "../../../common/theme/tokens";

interface PersonalItemProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onReactivar: (persona: Persona) => void; // Recibimos el método desde la tabla
}

export function PersonalItem({ persona, onEdit, onDelete, onReactivar }: PersonalItemProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Las acciones se ocultan según la jerarquía: un admin no toca a otro admin
  // ni a un super admin, y nadie se da de baja a sí mismo.
  const puedeEditar = puedeEditarA(user, persona);
  const puedeBorrar = puedeDarDeBajaA(user, persona);

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: persona.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{persona.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {persona.nombre} {persona.apellido || ""}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {persona.dni}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px" }}>
        <span style={{ backgroundColor: "#f5f5f5", padding: "4px 8px", borderRadius: "4px", fontSize: "13px" }}>
            {esSuperAdminDe(persona) && "Super admin"}
            {!esSuperAdminDe(persona) && persona.puede_operar && "Operar"}
            {!esSuperAdminDe(persona) && persona.puede_operar && persona.puede_administrar && " | "}
            {!esSuperAdminDe(persona) && persona.puede_administrar && "Administrar"}
            {!esSuperAdminDe(persona) && !persona.puede_operar && !persona.puede_administrar && "Ninguna"}
        </span>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <Button variant="ghost" fontSize="18px" cursor="pointer" onClick={() => navigate(`/personal/detalle/${persona.id}`)} title="Ver Detalle">
          👁️
        </Button>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {persona.activo && puedeEditar && (
            <Button bg={ADVERTENCIA} color="white" fontSize="16px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: ADVERTENCIA_HOVER }} onClick={() => onEdit(persona)}>
              Modificar
            </Button>
          )}

          {persona.activo ? (
            puedeBorrar && (
              <Button bg={PELIGRO} color="white" fontSize="16px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: PELIGRO }} onClick={() => onDelete(persona)}>
                Eliminar
              </Button>
            )
          ) : (
            puedeEditar && (
              <Button bg={EXITO} color="white" fontSize="16px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: EXITO_HOVER }} onClick={() => onReactivar(persona)}>
                Reactivar
              </Button>
            )
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}