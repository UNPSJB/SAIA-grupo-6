import { Table, Button, HStack } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  GRIS_MEDIO,
  PELIGRO,
  TEAL,
  TEAL_OSCURO,
  TEXTO_TENUE,
} from "../../../common/theme/tokens";

interface EquipoItemProps {
  equipo: Equipo;
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onCalibrar: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void;
}

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
                bg={TEAL} color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
                _hover={{ bg: TEAL_OSCURO }} onClick={() => onVerHistorial(equipo)}
              >
                Historial
              </Button>
              <Button
                bg={GRIS_MEDIO} color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 10px", borderRadius: "4px" }}
                _hover={{ bg: TEXTO_TENUE }} onClick={() => onCalibrar(equipo)}
              >
                Calibrar
              </Button>
              <Button
                bg={ADVERTENCIA} color="white" fontSize="16px" fontWeight="normal"
                style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
                _hover={{ bg: ADVERTENCIA_HOVER }} onClick={() => onEdit(equipo)}
              >
                Modificar
              </Button>
            </>
          )}
          {equipo.activo ? (
            <Button
              bg={PELIGRO} color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: PELIGRO }} onClick={() => onDelete(equipo)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg={EXITO} color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: EXITO_HOVER }} onClick={() => onReactivar(equipo)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}