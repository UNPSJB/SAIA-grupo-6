import { useMediaQuery } from "@chakra-ui/react";

/**
 * `true` debajo de 768px: el mismo corte que las tablas en tarjetas
 * (`index.css`). Para cuando en el celular cambia qué se muestra o en qué
 * orden; si solo cambia un tamaño o un margen, alcanza con `{ base, md }`.
 */
export function useEsCelular(): boolean {
  const [esCelular] = useMediaQuery(["(max-width: 767px)"], { ssr: false });
  return esCelular;
}
