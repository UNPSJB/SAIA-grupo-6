import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEnfocarFragmento } from "../../common/hooks/useEnfocarFragmento";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GrupoOctogonos } from "../rotuladoFrontal/components/GrupoOctogonos";
import { OctogonoAdvertencia } from "../rotuladoFrontal/components/OctogonoAdvertencia";
import type { ResultadoSello } from "../rotuladoFrontal/types/rotuladoFrontal";
import type { BorradorRotuladoOut, FrontalPrevisualizacion } from "./types/rotulado";
import { RotuladoPreviewPage } from "./components/pages/RotuladoPreviewPage";
import { exportarBorradorPdf, previsualizarBorrador } from "./services/rotuladoService";

vi.mock("./services/rotuladoService", () => ({ previsualizarBorrador: vi.fn(), exportarBorradorPdf: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function mostrar(elemento: React.ReactNode) {
  return render(<ChakraProvider value={defaultSystem}>{elemento}</ChakraProvider>);
}

const frontal: FrontalPrevisualizacion = {
  estado: "aplica", mensaje: "", faltantes: [], advertencias: [],
  version_id: 1, regla_version: 1, evaluado_en: null,
  sellos: {
    evaluado: true, completo: false, excesos: [], motivo: "Evaluacion parcial",
    regla_version: 1, vigencia_desde: "2024-01-01", norma_origen: "E12",
    resultados: [
      { clave: "sodio", exceso: true, evaluado: true },
      { clave: "azucares", exceso: false, evaluado: true },
      { clave: "calorias", exceso: true, evaluado: true },
      { clave: "grasas_totales", exceso: null, evaluado: false, motivo: "Faltan grasas" },
    ] as ResultadoSello[],
  },
};

describe("Previsualizacion de rotulado", () => {
  it.each([
    ["sodio", "SODIO"], ["azucares", "AZÚCARES"], ["calorias", "CALORÍAS"],
    ["grasas_totales", "GRASAS TOTALES"], ["grasas_saturadas", "GRASAS SATURADAS"],
  ] as const)("representa el sello %s en un SVG cuadrado", (clave, texto) => {
    mostrar(<OctogonoAdvertencia clave={clave} />);
    const sello = screen.getByRole("img", { name: `EXCESO EN ${texto}` });
    expect(sello.getAttribute("src")).toMatch(new RegExp(`(?:${clave}\\.svg|data:image/svg\\+xml)`));
  });

  it("dibuja solo positivos y presenta los pendientes", () => {
    mostrar(<GrupoOctogonos frontal={frontal} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Faltan grasas")).toBeTruthy();
    expect(screen.queryByText("No corresponden octógonos.")).toBeNull();
  });

  it.each([1, 5])("muestra %s sellos confirmados en la cara principal", cantidad => {
    if (!frontal.sellos) throw new Error("Falta el resultado de prueba");
    const claves = ["azucares", "grasas_totales", "grasas_saturadas", "sodio", "calorias"];
    mostrar(<GrupoOctogonos frontal={{ ...frontal, sellos: {
      ...frontal.sellos, completo: true,
      resultados: claves.slice(0, cantidad).map(clave => ({
        ...frontal.sellos!.resultados[0], clave, evaluado: true, exceso: true,
      })),
    } }} soloSellos alineacion="start" />);
    expect(screen.getAllByRole("img")).toHaveLength(cantidad);
  });

  it("distingue ausencia de excesos de una evaluacion no disponible", () => {
    if (!frontal.sellos) throw new Error("Falta el resultado de prueba");
    mostrar(<>
      <GrupoOctogonos frontal={{ ...frontal, sellos: { ...frontal.sellos, completo: true, resultados: [] } }} />
      <GrupoOctogonos frontal={{ ...frontal, estado: "no_disponible", mensaje: "Sin regla", sellos: null }} />
    </>);
    expect(screen.getAllByText("No corresponden octógonos.")).toHaveLength(1);
    expect(screen.getByText("Sin regla")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("ofrece recalcular en edición si la tabla pertenece a otra receta", async () => {
    vi.mocked(previsualizarBorrador).mockResolvedValueOnce({
      borrador: { id: 11, denominacion_venta: "Producto de prueba" } as BorradorRotuladoOut,
      origen: { estado: "verificado", version_id: 8, version_numero: 1, lote_id: 2, motivo: null },
      completitud: { borrador_id: 11, estado_global: "pendiente", campos: [] },
      nutricion: {
        estado: "version_distinta", version_id: 9, tabla: null, difiere_de_e12: false,
        problemas: ["La tabla guardada pertenece a la versión de receta (ID 9); el borrador usa ID 8."],
      },
      declaraciones: null,
      rotulado_frontal: frontal,
    });

    mostrar(<MemoryRouter initialEntries={["/rotulado/borradores/11/previsualizar"]}>
      <Routes><Route path="/rotulado/borradores/:id/previsualizar" element={<RotuladoPreviewPage />} /></Routes>
    </MemoryRouter>);
    const enlace = await screen.findByRole("link", { name: "Ir a edición para recalcular la tabla" });
    expect(enlace.getAttribute("href")).toBe("/rotulado/borradores/11#datos_nutricionales_json");
    expect(screen.getByText(/ID 9.*ID 8/)).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);

    vi.mocked(exportarBorradorPdf).mockRejectedValueOnce(new Error("No se pudo generar el PDF"));
    await userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    expect(exportarBorradorPdf).toHaveBeenCalledWith(11);
    expect(await screen.findByText("No se pudo generar el PDF")).toBeTruthy();
  });

  it.each([
    ["Información nutricional", "datos_nutricionales_json"],
    ["Alérgenos, gluten y conservación", "declaraciones"],
    ["rotulado frontal", "envasado"],
  ])("lleva con teclado al pendiente de %s en el borrador #11", async (etiqueta, id) => {
    vi.mocked(previsualizarBorrador).mockResolvedValueOnce({
      borrador: { id: 11, producto_id: 2, denominacion_venta: "Alfajor de maicena" } as BorradorRotuladoOut,
      origen: { estado: "verificado", version_id: 8, version_numero: 1, lote_id: 2, motivo: null },
      completitud: { borrador_id: 11, estado_global: "pendiente", campos: [
        { nombre: "datos_nutricionales_json", etiqueta: "Información nutricional", estado: "pendiente" },
        { nombre: "declaraciones", etiqueta: "Alérgenos, gluten y conservación", estado: "pendiente" },
      ] },
      nutricion: { estado: "incompleta", version_id: 8, tabla: {}, difiere_de_e12: false, problemas: [] },
      declaraciones: null,
      rotulado_frontal: { ...frontal, estado: "sin_definir", sellos: null, mensaje: "Falta definir envasado",
        faltantes: ["si se comercializa envasado en ausencia del cliente"] },
    });
    function Destino() {
      useEnfocarFragmento(true);
      return <button id={id}>Destino</button>;
    }
    mostrar(<MemoryRouter initialEntries={["/rotulado/borradores/11/previsualizar"]}>
      <Routes>
        <Route path="/rotulado/borradores/:id/previsualizar" element={<RotuladoPreviewPage />} />
        <Route path="/rotulado/borradores/:id" element={<Destino />} />
        <Route path="/productos/:id/rotulado-frontal" element={<Destino />} />
      </Routes>
    </MemoryRouter>);
    if (id !== "envasado") {
      await userEvent.click(await screen.findByText("Ver campos pendientes (2)"));
    }
    const enlace = await screen.findByRole("link", { name: `Completar ${etiqueta}` });
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    if (id === "envasado") {
      expect(enlace.getAttribute("href")).toBe("/productos/2/rotulado-frontal?solo_lectura=true&borrador_id=11#envasado");
    }
    enlace.focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(await screen.findByRole("button", { name: "Destino" }));
  });

  it("mantiene la advertencia durante la carga y ante un error", async () => {
    vi.mocked(previsualizarBorrador).mockRejectedValueOnce(new Error("Error de prueba"));
    mostrar(<MemoryRouter initialEntries={["/rotulado/borradores/1/previsualizar"]}>
      <Routes><Route path="/rotulado/borradores/:id/previsualizar" element={<RotuladoPreviewPage />} /></Routes>
    </MemoryRouter>);
    const advertencia = "BORRADOR: debe ser revisado por un/a profesional y por la autoridad sanitaria competente antes de su uso";
    expect(screen.getByText(advertencia)).toBeTruthy();
    await screen.findByText("Error de prueba");
    expect(screen.getByText(advertencia)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
