import { useNavigate } from "react-router-dom";
import { HStack } from "@chakra-ui/react";
import type { Cliente } from "../types/cliente";
import {
  BotonAccion,
  Celda,
  TextoTruncado,
  DatoPrincipal,
  FilaClickeable,
} from "../../../components/ui/patrones";

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
    <FilaClickeable onAbrir={handleVer} borderBottomWidth="1px" borderColor="border.subtle" opacity={cliente.activo ? 1 : 0.65}>
      <Celda>
        <DatoPrincipal titulo={cliente.nombre} />
      </Celda>
      <Celda>
        <TextoTruncado texto={cliente.documento} />
      </Celda>
      <Celda>
        <TextoTruncado texto={cliente.telefono} />
      </Celda>
      <Celda>
        <TextoTruncado texto={cliente.domicilio ?? "-"} />
      </Celda>
      <Celda center>
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
    </FilaClickeable>
  );
}
