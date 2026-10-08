import { Text, Table } from "@chakra-ui/react";
import { AptitudItem } from "./AptitudItem";
import type { Aptitud } from "../types/aptitud";
import {
  ColumnaHeader,
  Tarjeta,
} from "../../../components/ui/patrones";

interface AptitudTableProps {
  aptitudes: Aptitud[];
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudTable({ aptitudes, onEdit, onDelete, onReactivar }: AptitudTableProps) {
  if (aptitudes.length === 0) {
    return (
      <Tarjeta p={8} textAlign="center">
        <Text color="gray.500">No hay aptitudes registradas.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Table.Root variant="outline" w="100%">
        <Table.Header>
          <Table.Row bg="brand.500" color="white" textAlign="left">
            <ColumnaHeader bg="brand.500" color="white" fontWeight="normal" fontSize="16px" borderColor="transparent" p="3">ID</ColumnaHeader>
            <ColumnaHeader bg="brand.500" color="white" fontWeight="normal" fontSize="16px" borderColor="transparent" p="3">Nombre</ColumnaHeader>
            <ColumnaHeader bg="brand.500" color="white" fontWeight="normal" fontSize="16px" borderColor="transparent" p="3">Descripción</ColumnaHeader>
            <ColumnaHeader bg="brand.500" color="white" fontWeight="normal" fontSize="16px" borderColor="transparent" p="3" center>Acciones</ColumnaHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {aptitudes.map((aptitud) => (
            <AptitudItem key={aptitud.id} aptitud={aptitud} onEdit={onEdit} onDelete={onDelete} onReactivar={onReactivar} />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}