import { useABM } from "../../../common/hooks/useABM";
import {
  crearCliente,
  eliminarCliente,
  modificarCliente,
  reactivarCliente,
} from "../services/clienteService";
import type { Cliente, ClienteFormValues } from "../types/cliente";

type ClienteInput = ClienteFormValues;

export function useClienteABM() {
  return useABM<ClienteInput, Cliente>({
    crear: crearCliente,
    modificar: modificarCliente,
    eliminar: eliminarCliente,
    reactivar: reactivarCliente,
    etiqueta: "el cliente",
  });
}
