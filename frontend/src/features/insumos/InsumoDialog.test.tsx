// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InsumoDialog } from "./components/InsumoDialog";

afterEach(cleanup);

it("permite elegir cualquier proveedor, no solo el primero", async () => {
  const guardar = vi.fn().mockResolvedValue(undefined);
  render(
    <ChakraProvider value={defaultSystem}>
      <InsumoDialog
        ingrediente="Huevo fresco"
        proveedores={[{ id: 1, nombre: "Cabrera" }, { id: 2, nombre: "Castillo" }, { id: 3, nombre: "Fernandez" }]}
        onGuardar={guardar}
        onCancel={vi.fn()}
      />
    </ChakraProvider>,
  );
  fireEvent.change(await screen.findByPlaceholderText("Ej: Don Ramón"), { target: { value: "Marca" } });
  const casilla = (nombre: string) => screen.getByLabelText<HTMLInputElement>(nombre);
  for (const nombre of ["Castillo", "Fernandez"]) {
    fireEvent.click(screen.getByText(nombre));
    await waitFor(() => expect(casilla(nombre).checked).toBe(true));
  }
  expect(casilla("Cabrera").checked).toBe(false);
  fireEvent.submit(screen.getByText("Guardar").closest("form")!);
  await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
  expect(guardar.mock.calls[0][0].proveedor_ids).toEqual([2, 3]);
});
