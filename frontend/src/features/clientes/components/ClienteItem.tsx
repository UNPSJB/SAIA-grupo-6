import { useNavigate } from "react-router-dom";
import { HStack, Table } from "@chakra-ui/react";
import type { Cliente } from "../types/cliente";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface ClienteItemProps {
  cliente: Cliente;
  onEdit: (cliente: Cliente) => void;
  onDelete: (cliente: Cliente) => void;
  onReactivar: (cliente: Cliente) => void;
  onVer?: (cliente: Cliente) => void;
}

export function ClienteItem({
  cliente,
  onEdit,
  onDelete,
  onReactivar,
  onVer,
}: ClienteItemProps) {
  const navigate = useNavigate();

  const handleVer = () => {
    if (onVer) {
      onVer(cliente);
    } else {
      navigate(`/clientes/${cliente.id}/detalle`);
    }
  };

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={cliente.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={cliente.nombre} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={cliente.documento} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={cliente.telefono} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={cliente.domicilio ?? "-"} />
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {cliente.activo ? (
            <>
              <BotonAccion accion="ver" label="Ver detalle" onClick={handleVer} />
              <BotonAccion accion="editar" label="Modificar cliente" onClick={() => onEdit(cliente)} />
              <BotonAccion accion="eliminar" label="Eliminar cliente" onClick={() => onDelete(cliente)} />
            </>
          ) : (
            <>
              <BotonAccion accion="ver" label="Ver detalle" onClick={handleVer} />
              <BotonAccion accion="reactivar" label="Reactivar cliente" onClick={() => onReactivar(cliente)} />
            </>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
