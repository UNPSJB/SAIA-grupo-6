import { Table, Button, HStack } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";

interface EquipoItemProps {
  equipo: Equipo;
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onCalibrar: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void; // <-- Nueva prop
}

const TEAL = "#468189";

export function EquipoItem({ equipo, onEdit, onDelete, onReactivar, onCalibrar, onVerHistorial }: EquipoItemProps) {
  return (
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: equipo.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{equipo.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {equipo.nombre}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {equipo.tipo}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {equipo.ubicacion}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {equipo.activo && (
            <>
              <Button
                bg="#6c757d" color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
                _hover={{ bg: "#5a6268" }} onClick={() => onVerHistorial(equipo)}
              >
                Historial
              </Button>
              <Button
                bg="#17a2b8" color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
                _hover={{ bg: "#138496" }} onClick={() => onCalibrar(equipo)}
              >
                Calibrar
              </Button>
              <Button
                bg="#f0ad4e" color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
                _hover={{ bg: "#ec971f" }} onClick={() => onEdit(equipo)}
              >
                Modificar
              </Button>
            </>
          )}
          {equipo.activo ? (
            <Button
              bg="#d9534f" color="white" fontSize="15px" fontWeight="normal"
              style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
              _hover={{ bg: "#c9302c" }} onClick={() => onDelete(equipo)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg="#28a745" color="white" fontSize="15px" fontWeight="normal"
              style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
              _hover={{ bg: "#218838" }} onClick={() => onReactivar(equipo)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}