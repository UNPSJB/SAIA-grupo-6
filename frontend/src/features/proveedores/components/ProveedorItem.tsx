import { HStack, Table } from "@chakra-ui/react";
import type { Proveedor } from "../types/proveedor";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface ProveedorItemProps {
  proveedor: Proveedor;
  onEdit: (proveedor: Proveedor) => void;
  onDelete: (proveedor: Proveedor) => void;
  onReactivar: (proveedor: Proveedor) => void;
}

export function ProveedorItem({ proveedor, onEdit, onDelete, onReactivar }: ProveedorItemProps) {
  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={proveedor.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={proveedor.nombre} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={proveedor.matricula} />
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {proveedor.activo ? (
            <>
              <BotonAccion accion="editar" label="Modificar proveedor" onClick={() => onEdit(proveedor)} />
              <BotonAccion accion="eliminar" label="Eliminar proveedor" onClick={() => onDelete(proveedor)} />
            </>
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar proveedor" onClick={() => onReactivar(proveedor)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
