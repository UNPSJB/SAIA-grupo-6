import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { VistaPublicaPage } from "./components/pages/VistaPublicaPage";
import { obtenerIndicadoresPublicos } from "./services/vistaPublicaPublicaService";
import type { IndicadorPublico } from "./types/vistaPublica";

vi.mock("./services/vistaPublicaPublicaService", () => ({
  obtenerIndicadoresPublicos: vi.fn(),
  validarVistaPublica: vi.fn().mockResolvedValue(true),
  VistaPublicaNoDisponibleError: class extends Error {},
}));

afterEach(cleanup);

function renderizar(indicadores: IndicadorPublico[]) {
  vi.mocked(obtenerIndicadoresPublicos).mockResolvedValue(indicadores);
  render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={["/publico/prueba"]}>
        <Routes>
          <Route path="/publico/:codigo" element={<VistaPublicaPage />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );
}

const limpieza: IndicadorPublico = {
  clave: "elementos_al_dia", etiqueta: "Elementos de limpieza al día",
  descripcion: "Recambios vigentes.", formato: "porcentaje", valor: 80,
};
const trazabilidad: IndicadorPublico = {
  clave: "lotes_con_receta_trazable", etiqueta: "Lotes con receta trazable",
  descripcion: "Lotes con su versión de receta.", formato: "porcentaje", valor: 0,
};

it("agrupa los indicadores de alimentos y muestra un cero válido", async () => {
  renderizar([limpieza, trazabilidad]);
  const seccion = await screen.findByRole("region", { name: "Control de alimentos" });
  const operativas = screen.getByRole("region", { name: "Buenas prácticas operativas" });
  expect(within(seccion).getByText(trazabilidad.etiqueta)).toBeTruthy();
  expect(within(seccion).getByText("0 %")).toBeTruthy();
  expect(within(seccion).queryByText(limpieza.etiqueta)).toBeNull();
  expect(within(seccion).getByRole("progressbar", { name: trazabilidad.etiqueta }).getAttribute("aria-valuenow")).toBe("0");
  expect(within(operativas).getByRole("progressbar", { name: limpieza.etiqueta }).getAttribute("aria-valuenow")).toBe("80");
  expect(seccion.compareDocumentPosition(operativas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("omite la sección de alimentos cuando no hay una tarjeta publicable", async () => {
  renderizar([limpieza, { ...trazabilidad, valor: null }]);
  await screen.findByText(limpieza.etiqueta);
  expect(screen.queryByRole("region", { name: "Control de alimentos" })).toBeNull();
});
