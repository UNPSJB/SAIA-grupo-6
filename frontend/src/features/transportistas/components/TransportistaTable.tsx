import { Table, Text } from "@chakra-ui/react";
import type { Transportista } from "../types/transportista";
import { TransportistaItem } from "./TransportistaItem";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface TransportistaTableProps {
  transportistas: Transportista[];
  orden?: {
    columna: string | null;
    direccion: "asc" | "desc";
    orden: string;
    esPorDefecto: boolean;
    ordenar: (columna: string) => void;
    reiniciar: () => void;
  };
  onEdit: (transportista: Transportista) => void;
  onDelete: (transportista: Transportista) => void;
  onReactivar: (transportista: Transportista) => void;
  onVer?: (transportista: Transportista) => void;
  onAgregarCertificacion?: (transportista: Transportista) => void;
}

export function TransportistaTable({
  transportistas,
  orden,
  onEdit,
  onDelete,
  onReactivar,
  onVer,
  onAgregarCertificacion,
}: TransportistaTableProps) {
  if (transportistas.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay transportistas registrados.</Text>
      </Tarjeta>
    );
  }

  const tieneOrden = orden !== undefined;

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="920px">
        <Table.Header>
          <FilaEncabezado>
            {tieneOrden && orden ? (
              <EncabezadoOrdenable columna="razon_social" orden={orden as any} ancho="amplia">
                Razón Social
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="amplia">Razón Social</EncabezadoOscuro>
            )}
            {tieneOrden && orden ? (
              <EncabezadoOrdenable columna="cuit" orden={orden as any} ancho="media">
                CUIT
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="media">CUIT</EncabezadoOscuro>
            )}
            <EncabezadoOscuro ancho="media">Teléfono</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="media">Habilitación</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Observaciones</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {transportistas.map((transportista) => (
            <TransportistaItem
              key={transportista.id}
              transportista={transportista}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
              onVer={onVer}
              onAgregarCertificacion={onAgregarCertificacion}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
