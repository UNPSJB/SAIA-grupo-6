import { HStack, Text, type BoxProps } from "@chakra-ui/react";
import { LuCircleCheckBig } from "react-icons/lu";
import type { FilaAtencionArea } from "../types/paneles";
import { ListaPanel } from "./piezasPanel";
import { TarjetaPanel } from "./TarjetaPanel";

/**
 * Lo vencido o atrasado de todas las áreas, lo más grave primero: lotes de
 * insumo por vencer, planes de calibración vencidos, incidentes abiertos hace
 * días, químicos sin stock, aptitudes vencidas. Cada fila dice de qué área es
 * y lleva a la pantalla donde se resuelve.
 *
 * Si el backend recortó la lista, se avisa cuántas más hay: el resto está en
 * los paneles de cada área.
 */
export function RequiereAtencion({
  filas,
  total,
  ...rest
}: { filas: FilaAtencionArea[]; total: number } & BoxProps) {
  return (
    <TarjetaPanel
      titulo="Requiere atención"
      tamanoTitulo="lg"
      descripcion="Lo vencido o atrasado de todas las áreas, lo más urgente primero"
      {...rest}
    >
      {filas.length === 0 ? (
        <HStack gap="2" color="fg.muted" my="auto" py="6" justify="center">
          <LuCircleCheckBig size={18} aria-hidden />
          <Text fontSize="sm">Todo al día: no hay nada vencido ni atrasado.</Text>
        </HStack>
      ) : (
        <>
          <ListaPanel
            acento
            holgada
            filas={filas.map((f) => ({
              ...f,
              detalle: f.detalle ? `${f.area_titulo} · ${f.detalle}` : f.area_titulo,
            }))}
          />
          {total > filas.length ? (
            <Text fontSize="xs" color="fg.muted" mt="3">
              {total - filas.length === 1
                ? "Hay 1 más en los paneles de cada área."
                : `Hay ${total - filas.length} más en los paneles de cada área.`}
            </Text>
          ) : null}
        </>
      )}
    </TarjetaPanel>
  );
}
