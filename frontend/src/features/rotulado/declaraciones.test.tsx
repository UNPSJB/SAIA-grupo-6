import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { AuthContext, type User } from "../../common/context/auth-context";
import { DeclaracionesSection } from "./components/DeclaracionesSection";
import { ConservacionFields } from "./components/ConservacionFields";
import { PerfilDeclaracionFields } from "./components/PerfilDeclaracionFields";
import type { Conservacion, DeclaracionesOut, PerfilDeclaracion } from "./types/declaraciones";
import * as api from "./services/declaracionesService";

vi.mock("./services/declaracionesService", () => ({
  consultarDeclaraciones: vi.fn(), catalogoAlergenos: vi.fn(), guardarDeclaraciones: vi.fn(),
  confirmarDeclaraciones: vi.fn(), regenerarDeclaraciones: vi.fn(), historialDeclaraciones: vi.fn(),
}));
vi.mock("../recetas/services/recetaService", () => ({
  listarRecetas: vi.fn().mockResolvedValue([]), listarVersiones: vi.fn().mockResolvedValue([]),
}));
const administrador = { id: 7, nombre: "Ana", puede_administrar: true, es_super_admin: false } as User;
function salida(): DeclaracionesOut {
  return { revision: 1, estado: "sugerida", vigencia: "vigente", pendientes: [],
    confirmado_por_id: null, confirmado_por_nombre: null, confirmado_en: null,
    declaracion: "CONTIENE LECHE", declaracion_cruzada: "", contenido: {
      version_receta_id: 1, reglas: "test", fuentes: [], pendientes_origen: [],
      detectados: [{ codigo: "leche", nombre: "Leche", fuentes: [{ insumo_id: 1, nombre: "Leche en polvo", forma: "directa" }] }],
      gluten: "sin_presencia_declarada", conservacion: { instrucciones: "Refrigerar" }, conservacion_origen: "producto",
      contaminacion_cruzada: [], evaluaciones: [],
    } };
}
function envolver(node: React.ReactNode, user: User | null = administrador) {
  return render(<ChakraProvider value={defaultSystem}><AuthContext.Provider value={{ user, loginUser: vi.fn(), logout: vi.fn() }}>
    <MemoryRouter>{node}</MemoryRouter>
  </AuthContext.Provider></ChakraProvider>);
}
beforeEach(() => {
  vi.mocked(api.consultarDeclaraciones).mockResolvedValue(salida());
  vi.mocked(api.catalogoAlergenos).mockResolvedValue([{ codigo: "mani", nombre: "Maní", condicionada: false }]);
  vi.mocked(api.historialDeclaraciones).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("HU106", () => {
  it("muestra propuesta y fuentes, y solo confirma mediante acción explícita", async () => {
    vi.mocked(api.confirmarDeclaraciones).mockResolvedValue({ ...salida(), estado: "confirmada", confirmado_por_id: 7,
      confirmado_por_nombre: "Ana", confirmado_en: "2026-11-16T10:00:00" });
    envolver(<DeclaracionesSection borradorId={1} productoId={1} formularioSucio={false} />);
    await screen.findByText("Leche en polvo: directa");
    expect(screen.getByText("Sugerida por el sistema")).toBeTruthy();
    expect(api.confirmarDeclaraciones).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmar declaraciones"));
    await screen.findByText("Confirmada");
    expect(api.confirmarDeclaraciones).toHaveBeenCalledWith(1, 1);
  });

  it("agrega, edita y elimina contaminación cruzada sin mezclar presencia", async () => {
    vi.mocked(api.guardarDeclaraciones).mockResolvedValue({ ...salida(), revision: 2 });
    envolver(<DeclaracionesSection borradorId={1} productoId={1} formularioSucio={false} />);
    await screen.findByText("Agregar contaminación cruzada");
    fireEvent.click(screen.getByText("Agregar contaminación cruzada"));
    fireEvent.change(screen.getByLabelText("Alérgeno cruzado 1"), { target: { value: "mani" } });
    fireEvent.change(screen.getByLabelText("Fundamento cruzado 1"), { target: { value: "Equipo compartido" } });
    fireEvent.change(screen.getByLabelText("Respaldo cruzado 1"), { target: { value: "Autorización 123" } });
    expect((screen.getByText("Confirmar declaraciones") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("Guardar declaraciones"));
    await waitFor(() => expect(api.guardarDeclaraciones).toHaveBeenCalledWith(1, expect.objectContaining({
      contaminacion_cruzada: [{ codigo: "mani", fundamento: "Equipo compartido", respaldo: "Autorización 123" }],
    })));
    expect(api.confirmarDeclaraciones).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Agregar contaminación cruzada"));
    fireEvent.click(screen.getByText("Eliminar declaración cruzada"));
    expect(screen.queryByLabelText("Alérgeno cruzado 1")).toBeNull();
  });

  it("bloquea confirmación para pendientes, fuentes obsoletas y sin permiso", async () => {
    vi.mocked(api.consultarDeclaraciones).mockResolvedValue({ ...salida(), vigencia: "desactualizada", pendientes: ["Falta evaluar un insumo"] });
    envolver(<DeclaracionesSection borradorId={1} productoId={1} formularioSucio={false} />, { ...administrador, puede_administrar: false });
    await screen.findByText("Pendiente de revisión: origen desactualizado");
    expect((screen.getByText("Confirmar declaraciones") as HTMLButtonElement).disabled).toBe(true);
  });

  it("bloquea regeneración si el formulario principal tiene cambios", async () => {
    envolver(<DeclaracionesSection borradorId={1} productoId={1} formularioSucio />);
    await screen.findByText("Regenerar propuesta");
    expect((screen.getByText("Regenerar propuesta") as HTMLButtonElement).disabled).toBe(true);
  });

  it("conservación permite temperaturas negativas, duración y condiciones de apertura", () => {
    function Formulario() {
      const [value, setValue] = useState<Conservacion | null>({});
      return <><ConservacionFields value={value} onChange={setValue} /><output>{JSON.stringify(value)}</output></>;
    }
    envolver(<Formulario />);
    fireEvent.click(screen.getByLabelText("Temperatura aplicable"));
    fireEvent.change(screen.getByLabelText("Mínima (°C)"), { target: { value: "-20" } });
    fireEvent.click(screen.getByLabelText("Vida útil declarada aplicable"));
    fireEvent.change(screen.getByLabelText("Duración"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Unidad"), { target: { value: "dias" } });
    fireEvent.click(screen.getByLabelText("Condiciones después de abrir aplicables"));
    fireEvent.change(screen.getByLabelText("Después de abrir: Instrucciones de conservación"), { target: { value: "Consumir refrigerado" } });
    const datos = JSON.parse(screen.getByRole("status").textContent ?? "{}");
    expect(datos.temperatura_minima).toBe(-20);
    expect(datos.duracion).toBe(5);
    expect(datos.despues_abrir.instrucciones).toBe("Consumir refrigerado");
  });

  it("el perfil diferencia evaluación pendiente, presencia y gluten", async () => {
    function Formulario() {
      const [value, setValue] = useState<PerfilDeclaracion | null>(null);
      return <><PerfilDeclaracionFields value={value} onChange={setValue} /><output>{JSON.stringify(value)}</output></>;
    }
    envolver(<Formulario />);
    fireEvent.click(screen.getByText("Ver catálogo completo de alérgenos"));
    await screen.findByLabelText("Presencia de Maní");
    fireEvent.change(screen.getByLabelText("Presencia de Maní"), { target: { value: "derivado" } });
    fireEvent.change(screen.getByLabelText("Información de gluten"), { target: { value: "presente" } });
    const datos = JSON.parse(screen.getByRole("status").textContent ?? "{}");
    expect(datos.evaluacion).toBe("sin_evaluar");
    expect(datos.marcas).toEqual([{ codigo: "mani", forma: "derivado" }]);
    expect(datos.gluten).toBe("presente");
  });
});
