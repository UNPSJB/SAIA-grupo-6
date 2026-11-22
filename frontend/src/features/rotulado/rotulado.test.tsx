import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { RotuladoEditPage } from "./components/pages/RotuladoEditPage";
import { RotuladoForm } from "./components/RotuladoForm";
import { previewAutocompletado } from "./services/rotuladoService";
import type { BorradorRotuladoOut, VistaPreviaAutocompletado } from "./types/rotulado";

vi.mock("./services/rotuladoService", () => ({ previewAutocompletado: vi.fn() }));
vi.mock("../lotes/services/loteService", () => ({ listarLotes: vi.fn().mockResolvedValue([]) }));
const hooks = vi.hoisted(() => ({ crearBorrador: vi.fn(), obtenerBorrador: vi.fn(), actualizarBorrador: vi.fn(), autocompletarBorrador: vi.fn() }));
vi.mock("./hooks/useRotulado", () => ({ useRotulado: () => ({ ...hooks, borrador: null, loading: false, error: null }) }));
vi.mock("../../components/ui/toaster", () => ({ toaster: { create: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function envolver(node: React.ReactNode) { return render(<ChakraProvider value={defaultSystem}>{node}</ChakraProvider>); }
function preview(id: number): VistaPreviaAutocompletado { return { producto_id: id, producto_nombre: `Producto ${id}`, denominacion_venta: `Producto ${id}`, lista_ingredientes: `Frutilla ${id}`, version_receta_id: id, version_receta_numero: 1, receta_encontrada: true, mensaje: null, datos_nutricionales_json: null, sellos_disponibles: false }; }
function Cambiar() { const nav = useNavigate(); return <button onClick={() => nav("/rotulado/nuevo/2")}>Cambiar producto</button>; }
function pagina() { envolver(<MemoryRouter initialEntries={["/rotulado/nuevo/1"]}><Cambiar /><Routes><Route path="/rotulado/nuevo/:producto_id" element={<RotuladoEditPage />} /></Routes></MemoryRouter>); }

describe("Rotulado", () => {
  it("ignora respuestas tard?as del producto anterior", async () => {
    let resolver!: (v: VistaPreviaAutocompletado) => void;
    vi.mocked(previewAutocompletado).mockImplementation(id => id === 1 ? new Promise(r => { resolver = r; }) : Promise.resolve(preview(2)));
    pagina();
    fireEvent.click(screen.getByText("Cambiar producto"));
    await screen.findAllByDisplayValue("Producto 2");
    resolver(preview(1));
    await waitFor(() => expect(screen.queryAllByDisplayValue("Producto 1")).toHaveLength(0));
    expect(screen.getAllByDisplayValue("Ingredientes: Frutilla 2.").length).toBeGreaterThan(0);
  });
  it("permite reintentar un error de preview", async () => {
    vi.mocked(previewAutocompletado).mockRejectedValueOnce(new Error("Preview fall?")).mockResolvedValue(preview(1));
    pagina();
    await screen.findByText("Preview fall?");
    fireEvent.click(screen.getByText("Reintentar"));
    await screen.findAllByDisplayValue("Producto 1");
  });
  it("inicializa los campos y actualiza completitud al editar", () => {
    const guardar = vi.fn();
    const borrador = { ...preview(1), id: 0 } as unknown as BorradorRotuladoOut;
    envolver(<RotuladoForm borrador={borrador} esCreacion onGuardar={guardar} onAutocompletar={vi.fn()} lotes={[]} isLoading={false} hayFaltantes={false} />);
    expect(screen.getAllByDisplayValue("Producto 1").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 completos ·/)).toBeTruthy();
    expect(screen.getByText("Consultar Octogonos en la previsualizacion del borrador")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Ej: 450 g"), { target: { value: "450 g" } });
    expect(screen.getByText(/3 completos ·/)).toBeTruthy();
  });
  it("ambos botones guardan los valores editados con la misma validaci?n", async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const borrador = { ...preview(1), id: 0, contenido_neto: "450 g", rnpa_rppa: "123", razon_social: "SAIA", domicilio: "Calle 1", fecha_duracion: "2027-01-01" } as unknown as BorradorRotuladoOut;
    envolver(<><button type="submit" form="rotulado-form">Guardar superior</button><RotuladoForm borrador={borrador} esCreacion onGuardar={guardar} onAutocompletar={vi.fn()} lotes={[]} isLoading={false} hayFaltantes={false} /></>);
    fireEvent.change(screen.getByPlaceholderText("Ej: Mermelada de frutilla"), { target: { value: "Mi r?tulo" } });
    fireEvent.click(screen.getByText("Guardar superior"));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Guardar borrador"));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(2));
    expect(guardar.mock.calls[0][0].denominacion_venta).toBe("Mi r?tulo");
    expect(guardar.mock.calls[1][0]).toEqual(guardar.mock.calls[0][0]);
  });

});
