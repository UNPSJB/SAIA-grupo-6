import { Table, Button, HStack } from "@chakra-ui/react";
import type { Persona } from "../types/personal";
import { useNavigate } from "react-router-dom";

interface PersonalItemProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
}

const TEAL = "#468189";

export function PersonalItem({ persona, onEdit, onDelete }: PersonalItemProps) {
  const navigate = useNavigate();

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee" }}>
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
            {persona.puede_operar && "Operar"}
            {persona.puede_operar && persona.puede_administrar && " | "}
            {persona.puede_administrar && "Administrar"}
            {(!persona.puede_operar && !persona.puede_administrar) && "Ninguna"}
        </span>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <Button variant="ghost" fontSize="18px" cursor="pointer" onClick={() => navigate(`/personal/detalle/${persona.id}`)} title="Ver Detalle">
          👁️
        </Button>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          <Button bg="#f0ad4e" color="white" fontSize="16px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: "#f0ad4e" }} onClick={() => onEdit(persona)}>
            Modificar
          </Button>
          <Button bg="#d9534f" color="white" fontSize="16px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: "#d9534f" }} onClick={() => onDelete(persona)}>
            Eliminar
          </Button>
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}