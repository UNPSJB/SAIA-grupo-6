import { useNavigate } from "react-router-dom";
import { HStack, Table } from "@chakra-ui/react";
import type { Transportista } from "../types/transportista";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface TransportistaItemProps {
  transportista: Transportista;
  onEdit: (transportista: Transportista) => void;
  onDelete: (transportista: Transportista) => void;
  onReactivar: (transportista: Transportista) => void;
  onVer?: (transportista: Transportista) => void;
}

export function TransportistaItem({
  transportista,
  onEdit,
  onDelete,
  onReactivar,
  onVer,
}: TransportistaItemProps) {
  const navigate = useNavigate();

  const handleVer = () => {
    if (onVer) {
      onVer(transportista);
    } else {
      navigate(`/transportistas/${transportista.id}/detalle`);
    }
  };

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={transportista.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={transportista.razon_social} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={transportista.cuit} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={transportista.telefono} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={transportista.observaciones ?? "-"} />
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {transportista.activo ? (
            <>
              <BotonAccion accion="ver" label="Ver detalle" onClick={handleVer} />
              <BotonAccion accion="editar" label="Modificar transportista" onClick={() => onEdit(transportista)} />
              <BotonAccion accion="eliminar" label="Eliminar transportista" onClick={() => onDelete(transportista)} />
            </>
          ) : (
            <>
              <BotonAccion accion="ver" label="Ver detalle" onClick={handleVer} />
              <BotonAccion accion="reactivar" label="Reactivar transportista" onClick={() => onReactivar(transportista)} />
            </>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
