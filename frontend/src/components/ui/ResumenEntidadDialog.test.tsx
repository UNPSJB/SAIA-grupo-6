import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InsumoTable } from "../../features/insumos/components/InsumoTable";
import { ProductoTable } from "../../features/productos/components/ProductoTable";
import { evaluarRotulado } from "../../features/rotuladoFrontal/services/rotuladoFrontalService";
import { useOrdenTabla } from "../../common/hooks/useOrdenTabla";
import type { ColumnaOrdenInsumo } from "../../features/insumos/services/insumoService";

vi.mock("../../features/rotuladoFrontal/services/rotuladoFrontalService", () => ({
  evaluarRotulado: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const unidad = { id: 1, nombre: "Kilogramo", simbolo: "kg" };
const accionesTabla = {
  onEdit: vi.fn(), onDelete: vi.fn(), onReactivar: vi.fn(), onNutricion: vi.fn(),
};

it("consulta el rotulado en solo lectura al abrir el resumen y mantiene el listado al cerrar", async () => {
  vi.mocked(evaluarRotulado).mockResolvedValue({
    faltantes: ["Indicá si el producto se comercializa envasado."],
  } as Awaited<ReturnType<typeof evaluarRotulado>>);
  render(
    <ChakraProvider value={defaultSystem}>
      <ProductoTable
        productos={[{ id: 4, nombre: "Galletitas", descripcion: "Con cacao", activo: true, unidad_medida: unidad }]}
        {...accionesTabla}
        onRotulado={vi.fn()}
      />
    </ChakraProvider>,
  );

  expect(evaluarRotulado).not.toHaveBeenCalled();
  const abrir = screen.getByRole("button", { name: "Ver resumen de Galletitas" });
  fireEvent.click(abrir);
  const dialogo = screen.getByRole("dialog", { name: "Galletitas" });
  await within(dialogo).findByText("Indicá si el producto se comercializa envasado.");
  expect(evaluarRotulado).toHaveBeenCalledWith(4, undefined, true);
  fireEvent.click(within(dialogo).getByRole("button", { name: /^Cerrar$/ }));
  expect(await screen.findByRole("button", { name: "Ver resumen de Galletitas" })).toBe(abrir);
});

it("muestra un perfil pendiente y permite consultar un insumo dado de baja", () => {
  function Listado() {
    const orden = useOrdenTabla<ColumnaOrdenInsumo, "nombre_asc">("nombre_asc");
    return <InsumoTable {...accionesTabla} orden={orden} insumos={[{
      id: 2, nombre: "Harina", activo: false, tipo: "ingrediente", unidad_medida_id: unidad.id,
      unidad_medida: unidad, aditivo_id: null, aditivo: null, densidad_g_ml: null,
      peso_unitario_g: null, proveedores: [], perfil_declaracion: null,
    }]} />;
  }

  render(<ChakraProvider value={defaultSystem}><Listado /></ChakraProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Ver resumen de Harina" }));
  const dialogo = screen.getByRole("dialog", { name: "Harina" });
  expect(within(dialogo).getByText("Dado de baja")).toBeTruthy();
  expect(within(dialogo).getByText("Evaluación de alérgenos pendiente")).toBeTruthy();
  expect(within(dialogo).queryByRole("button", { name: "Datos nutricionales" })).toBeNull();
});
