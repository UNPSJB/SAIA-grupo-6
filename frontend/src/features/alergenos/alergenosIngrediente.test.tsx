import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AlergenosDelIngrediente } from "./components/AlergenosDelIngrediente";
import * as api from "./services/alergenoService";
import type { AlergenosDeIngrediente } from "./types/alergeno";

vi.mock("./services/alergenoService", () => ({
  listarAlergenos: vi.fn(),
  obtenerAlergenosDeIngrediente: vi.fn(),
  guardarAlergenosDeIngrediente: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CATALOGO = [
  { id: 1, codigo: "leche", nombre: "Leche", condicionada: false, activo: true },
  { id: 2, codigo: "soja", nombre: "Soja", condicionada: false, activo: true },
  { id: 3, codigo: "mani", nombre: "Maní", condicionada: false, activo: true },
];

function delIngrediente(parcial: Partial<AlergenosDeIngrediente> = {}): AlergenosDeIngrediente {
  return {
    ingrediente_id: 9,
    alergenos: [{ alergeno_id: 1, codigo: "leche", nombre: "Leche", nivel: "contiene", forma: "derivado" }],
    evaluacion: "sin_evaluar",
    gluten: "desconocido",
    respaldo: null,
    observaciones: null,
    actualizado_en: null,
    actualizado_por: null,
    ...parcial,
  };
}

function montar() {
  render(
    <ChakraProvider value={defaultSystem}>
      <AlergenosDelIngrediente ingredienteId={9} />
    </ChakraProvider>
  );
}

describe("Alérgenos del ingrediente", () => {
  it("muestra el derivado guardado y manda forma, evaluación y gluten al guardar", async () => {
    vi.mocked(api.listarAlergenos).mockResolvedValue(CATALOGO);
    vi.mocked(api.obtenerAlergenosDeIngrediente).mockResolvedValue(delIngrediente());
    vi.mocked(api.guardarAlergenosDeIngrediente).mockResolvedValue(delIngrediente());
    montar();

    const leche = await screen.findByLabelText("Alérgeno Leche");
    expect((leche as HTMLSelectElement).value).toBe("derivado");

    fireEvent.change(screen.getByLabelText("Alérgeno Soja"), { target: { value: "puede_contener" } });
    fireEvent.change(screen.getByLabelText("Evaluación de alérgenos"), { target: { value: "evaluada" } });
    fireEvent.change(screen.getByLabelText("Información de gluten"), { target: { value: "ausencia_declarada" } });
    fireEvent.click(screen.getByText("Guardar alérgenos"));

    await waitFor(() => expect(api.guardarAlergenosDeIngrediente).toHaveBeenCalled());
    expect(vi.mocked(api.guardarAlergenosDeIngrediente).mock.calls[0]).toEqual([
      9,
      {
        alergenos: [
          { alergeno_id: 1, nivel: "contiene", forma: "derivado" },
          { alergeno_id: 2, nivel: "puede_contener", forma: "directa" },
        ],
        evaluacion: "evaluada",
        gluten: "ausencia_declarada",
        respaldo: null,
        observaciones: null,
      },
    ]);
  });

  it("una lista vacía no cambia la evaluación: no afirma ausencia de alérgenos", async () => {
    vi.mocked(api.listarAlergenos).mockResolvedValue(CATALOGO);
    vi.mocked(api.obtenerAlergenosDeIngrediente).mockResolvedValue(delIngrediente({ alergenos: [] }));
    vi.mocked(api.guardarAlergenosDeIngrediente).mockResolvedValue(delIngrediente({ alergenos: [] }));
    montar();

    await screen.findByLabelText("Alérgeno Maní");
    fireEvent.change(screen.getByLabelText(/Observaciones/), { target: { value: "Sin datos del proveedor" } });
    fireEvent.click(screen.getByText("Guardar alérgenos"));

    await waitFor(() => expect(api.guardarAlergenosDeIngrediente).toHaveBeenCalled());
    const enviado = vi.mocked(api.guardarAlergenosDeIngrediente).mock.calls[0][1];
    expect(enviado.alergenos).toEqual([]);
    expect(enviado.evaluacion).toBe("sin_evaluar");
    expect(enviado.observaciones).toBe("Sin datos del proveedor");
  });
});
