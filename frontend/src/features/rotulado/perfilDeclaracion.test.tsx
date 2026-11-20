import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { PerfilDeclaracionFields } from "./components/PerfilDeclaracionFields";
import { InsumoForm } from "../insumos/components/InsumoForm";
import { catalogoAlergenos } from "./services/declaracionesService";
import type { PerfilDeclaracion, Sustancia } from "./types/declaraciones";
import type { InsumoFormValues, InsumoInput } from "../insumos/types/insumo";

vi.mock("./services/declaracionesService", () => ({ catalogoAlergenos: vi.fn() }));
vi.mock("../unidadMedida/services/unidadMedidaService", () => ({
  listarUnidadesMedida: vi.fn().mockResolvedValue([{ id: 1, nombre: "Kilogramo", simbolo: "kg", tipo: "masa" }]),
}));
vi.mock("../aditivos/services/aditivoService", () => ({ listarAditivos: vi.fn().mockResolvedValue([]) }));

const catalogo: Sustancia[] = [
  { codigo: "leche", nombre: "Leche", condicionada: false },
  { codigo: "soja", nombre: "Soja", condicionada: false },
  { codigo: "mani", nombre: "Maní", condicionada: false },
  { codigo: "nuez_brasil", nombre: "Nuez de Brasil", condicionada: false },
  { codigo: "sulfitos", nombre: "Dióxido de azufre y sulfitos", condicionada: true },
];
const guardado: PerfilDeclaracion = {
  evaluacion: "evaluada", gluten: "ausencia_declarada", respaldo: "Ficha del proveedor", observaciones: "Revisado",
  marcas: [{ codigo: "leche", forma: "directa" }, { codigo: "soja", forma: "derivado" }],
};
const inicialInsumo: InsumoFormValues = {
  nombre: "Insumo de prueba", unidad_medida_id: 1, tipo: "ingrediente", aditivo_id: null,
  densidad_g_ml: "", peso_unitario_g: "", perfil_declaracion: guardado,
};
function envolver(node: React.ReactNode) {
  return <ChakraProvider value={defaultSystem}>{node}</ChakraProvider>;
}
function montarPerfil(initial: PerfilDeclaracion | null = null) {
  const onChange = vi.fn();
  function Formulario() {
    const [value, setValue] = useState(initial);
    return <><PerfilDeclaracionFields value={value} onChange={v => { onChange(v); setValue(v); }} />
      <output data-testid="perfil-actual">{JSON.stringify(value)}</output></>;
  }
  render(envolver(<Formulario />));
  return { user: userEvent.setup(), onChange };
}
function actual(): PerfilDeclaracion | null {
  return JSON.parse(screen.getByTestId("perfil-actual").textContent ?? "null") as PerfilDeclaracion | null;
}
const registrados = () => within(screen.getByRole("group", { name: "Alérgenos registrados" }));
const desplegable = () => screen.getByText("Ver catálogo completo de alérgenos").closest("details") as HTMLDetailsElement;

beforeEach(() => { vi.mocked(catalogoAlergenos).mockResolvedValue(catalogo); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Presentación compacta del perfil de insumo", () => {
  it("inicia con el catálogo cerrado y mantiene todas las categorías y valores de selección", async () => {
    const { user, onChange } = montarPerfil();
    await screen.findByLabelText("Presencia de Leche");
    expect(desplegable().open).toBe(false);
    await user.click(screen.getByText("Ver catálogo completo de alérgenos"));
    expect(desplegable().open).toBe(true);
    expect(within(desplegable()).getAllByRole("combobox")).toHaveLength(catalogo.length);
    for (const sustancia of catalogo) {
      const control = within(desplegable()).getByRole("combobox", { name: `Presencia de ${sustancia.nombre}` });
      expect(within(control).getAllByRole("option").map(o => (o as HTMLOptionElement).value))
        .toEqual(["", "directa", "derivado"]);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("filtra por nombre sin distinguir mayúsculas ni acentos y buscar no modifica el perfil", async () => {
    const { user, onChange } = montarPerfil(guardado);
    await screen.findByRole("button", { name: "Editar marca de Leche" });
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "  MANI ");
    const resultados = screen.getByRole("region", { name: "Resultados de búsqueda de alérgenos" });
    expect(within(resultados).getAllByRole("combobox")).toHaveLength(1);
    expect(within(resultados).getByLabelText("Presencia de Maní (búsqueda)")).toBeTruthy();
    expect(registrados().getByText("Leche · Presencia directa")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(actual()).toEqual(guardado);
    await user.clear(screen.getByPlaceholderText("Buscar alérgeno..."));
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "LÉCHE");
    expect(within(screen.getByRole("region", { name: "Resultados de búsqueda de alérgenos" })).getByLabelText("Presencia de Leche (búsqueda)")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("informa búsquedas sin coincidencias sin alterar las marcas", async () => {
    const { user, onChange } = montarPerfil(guardado);
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "no existe");
    expect(screen.getByText("No se encontraron alérgenos para esa búsqueda.")).toBeTruthy();
    expect(actual()).toEqual(guardado);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("agrega desde búsqueda, edita desde la etiqueta y elimina sin cambiar los demás datos", async () => {
    const { user } = montarPerfil(guardado);
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "mani");
    await user.selectOptions(await screen.findByLabelText("Presencia de Maní (búsqueda)"), "directa");
    expect(registrados().getByText("Maní · Presencia directa")).toBeTruthy();
    await user.click(registrados().getByRole("button", { name: "Editar marca de Maní" }));
    await user.selectOptions(screen.getByLabelText("Tipo de marca de Maní"), "derivado");
    expect(registrados().getByText("Maní · Derivado")).toBeTruthy();
    expect((screen.getByLabelText("Presencia de Maní (búsqueda)") as HTMLSelectElement).value).toBe("derivado");
    await user.click(registrados().getByRole("button", { name: "Quitar marca de Maní" }));
    expect(registrados().queryByRole("button", { name: "Editar marca de Maní" })).toBeNull();
    expect(actual()).toEqual(guardado);
  });

  it("sincroniza el catálogo con las etiquetas y no pierde datos al plegar o buscar", async () => {
    const { user } = montarPerfil(guardado);
    await screen.findByLabelText("Presencia de Leche");
    await user.click(screen.getByText("Ver catálogo completo de alérgenos"));
    await user.selectOptions(within(desplegable()).getByLabelText("Presencia de Leche"), "derivado");
    expect(registrados().getByText("Leche · Derivado")).toBeTruthy();
    await user.click(screen.getByText("Ver catálogo completo de alérgenos"));
    expect(desplegable().open).toBe(false);
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "leche");
    expect((screen.getByLabelText("Presencia de Leche (búsqueda)") as HTMLSelectElement).value).toBe("derivado");
    await user.click(screen.getByText("Ver catálogo completo de alérgenos"));
    expect((within(desplegable()).getByLabelText("Presencia de Leche") as HTMLSelectElement).value).toBe("derivado");
    await user.selectOptions(within(desplegable()).getByLabelText("Presencia de Soja"), "");
    expect(registrados().queryByRole("button", { name: "Editar marca de Soja" })).toBeNull();
    expect(actual()?.marcas).toEqual([{ codigo: "leche", forma: "derivado" }]);
  });

  it("muestra las marcas guardadas y conserva evaluación, gluten, respaldo y observaciones", async () => {
    montarPerfil(guardado);
    await screen.findByRole("button", { name: "Editar marca de Leche" });
    expect(registrados().getByText("Soja · Derivado")).toBeTruthy();
    expect((screen.getByLabelText("Evaluación de alérgenos") as HTMLSelectElement).value).toBe("evaluada");
    expect((screen.getByLabelText("Información de gluten") as HTMLSelectElement).value).toBe("ausencia_declarada");
    expect((screen.getByLabelText("Respaldo del perfil") as HTMLTextAreaElement).value).toBe(guardado.respaldo);
    expect((screen.getByLabelText("Observaciones del perfil") as HTMLTextAreaElement).value).toBe(guardado.observaciones);
    expect(desplegable().open).toBe(false);
  });

  it("una lista vacía no cambia automáticamente la evaluación ni afirma ausencia de alérgenos", async () => {
    const { user } = montarPerfil();
    expect(screen.getByText("Sin marcas de alérgenos registradas.")).toBeTruthy();
    expect((screen.getByLabelText("Evaluación de alérgenos") as HTMLSelectElement).value).toBe("sin_evaluar");
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "leche");
    await user.selectOptions(await screen.findByLabelText("Presencia de Leche (búsqueda)"), "directa");
    await user.click(registrados().getByRole("button", { name: "Quitar marca de Leche" }));
    expect(actual()).toEqual({ evaluacion: "sin_evaluar", gluten: "desconocido", marcas: [] });
    expect(screen.queryByText(/^(Libre de alérgenos|Sin alérgenos)[.!]?$/i)).toBeNull();
  });

  it("mantiene los campos auxiliares editables", async () => {
    const { user } = montarPerfil(guardado);
    await user.selectOptions(screen.getByLabelText("Evaluación de alérgenos"), "incompleta");
    await user.selectOptions(screen.getByLabelText("Información de gluten"), "presente");
    await user.clear(screen.getByLabelText("Respaldo del perfil"));
    await user.paste("Ficha nueva");
    await user.clear(screen.getByLabelText("Observaciones del perfil"));
    await user.paste("Pendiente de revisar");
    expect(actual()).toEqual({ ...guardado, evaluacion: "incompleta", gluten: "presente", respaldo: "Ficha nueva", observaciones: "Pendiente de revisar" });
  });

  it.each(["alta", "edición"])("guarda el mismo contrato en %s y recupera las marcas al reabrir", async modo => {
    const user = userEvent.setup();
    const guardar = vi.fn<(values: InsumoInput) => void>();
    const initialValues = { ...inicialInsumo, perfil_declaracion: modo === "alta" ? null : guardado };
    const vista = render(envolver(<InsumoForm initialValues={initialValues} onSubmit={guardar} />));
    await screen.findByRole("option", { name: "Kilogramo (kg)" });
    await user.type(screen.getByPlaceholderText("Buscar alérgeno..."), "mani");
    await user.keyboard("{Enter}");
    expect(guardar).not.toHaveBeenCalled();
    await user.selectOptions(await screen.findByLabelText("Presencia de Maní (búsqueda)"), "derivado");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const datos = guardar.mock.calls[0][0];
    expect(datos.perfil_declaracion?.marcas).toContainEqual({ codigo: "mani", forma: "derivado" });
    const { perfil_declaracion, ...resto } = datos;
    expect(resto).toEqual({ nombre: inicialInsumo.nombre, unidad_medida_id: 1, tipo: "ingrediente", aditivo_id: null, densidad_g_ml: null, peso_unitario_g: null });
    vista.rerender(envolver(<InsumoForm key="reabierto" initialValues={{ ...inicialInsumo, perfil_declaracion }} onSubmit={guardar} />));
    await screen.findByRole("button", { name: "Editar marca de Maní" });
    expect(registrados().getByText("Maní · Derivado")).toBeTruthy();
    expect(desplegable().open).toBe(false);
  });

  it("permite consultar y editar con un viewport pequeño sin reiniciar el perfil", async () => {
    const anchoAnterior = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 320, configurable: true });
    try {
      const { user } = montarPerfil(guardado);
      await screen.findByRole("button", { name: "Editar marca de Leche" });
      await user.click(registrados().getByRole("button", { name: "Editar marca de Leche" }));
      await user.selectOptions(screen.getByLabelText("Tipo de marca de Leche"), "derivado");
      window.dispatchEvent(new Event("resize"));
      expect(registrados().getByText("Leche · Derivado")).toBeTruthy();
      expect(screen.getByPlaceholderText("Buscar alérgeno...")).toBeTruthy();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: anchoAnterior, configurable: true });
    }
  });

  it("muestra el error de catálogo sin borrar las marcas y permite reintentar", async () => {
    vi.mocked(catalogoAlergenos).mockRejectedValueOnce(new Error("Catálogo no disponible"));
    const { user, onChange } = montarPerfil(guardado);
    await screen.findByRole("alert");
    expect(desplegable().open).toBe(true);
    expect(actual()).toEqual(guardado);
    await user.click(screen.getByRole("button", { name: "Reintentar catálogo" }));
    await screen.findByRole("button", { name: "Editar marca de Leche" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
