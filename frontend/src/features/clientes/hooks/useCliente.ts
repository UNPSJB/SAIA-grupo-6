import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerCliente } from "../services/clienteService";
import type { Cliente } from "../types/cliente";

export function useCliente(id: number | null) {
  const { registro, loading, error } = useRegistro<Cliente>({
    cargar: obtenerCliente,
    id,
    etiqueta: "el cliente",
  });

  return { cliente: registro, loading, error };
}
