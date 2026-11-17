import type { CategoriaPanel } from "./paneles";

/*
 * Un tema de color por área, para distinguir cada panel de un vistazo. Todos
 * son claros y desaturados (el banner acompaña, no compite con los datos) y
 * con la tinta oscura del mismo tono: título ~11:1 y bajada ~6:1 de contraste
 * sobre el tono más oscuro de su fondo.
 *
 *   fondo   degradado de tres paradas, de claro a apenas más saturado.
 *   filete  franja de arriba, con los tres tonos más intensos del tema.
 *   arcos   colores de la decoración de la derecha (de afuera hacia adentro).
 */
export interface TemaArea {
  fondo: [string, string, string];
  borde: string;
  filete: [string, string, string];
  acento: string;
  titulo: string;
  bajada: string;
  arcos: [string, string, string, string];
}

export const TEMAS_AREA: Record<CategoriaPanel, TemaArea> = {
  /* Terracota y ocre: el horno, la elaboración. */
  produccion: {
    fondo: ["#fbf5ea", "#f6e8cc", "#f3e6dc"],
    borde: "#ead9b8",
    filete: ["#b85a3c", "#c99a3b", "#d98b5f"],
    acento: "#a24e33",
    titulo: "#3a2a1f",
    bajada: "#6b4a32",
    arcos: ["#c99a3b", "#d98b5f", "#b85a3c", "#e4cf9e"],
  },
  /* Miel y arena: el depósito, la materia prima. */
  inventario: {
    fondo: ["#fcf8ec", "#f5e9c2", "#f1ecd9"],
    borde: "#e8dbb0",
    filete: ["#b8860b", "#d4a937", "#a89060"],
    acento: "#8a6410",
    titulo: "#3b2e12",
    bajada: "#6a5526",
    arcos: ["#a89060", "#d4a937", "#b8860b", "#efe0b0"],
  },
  /* Agua y menta: la higiene. */
  limpieza: {
    fondo: ["#f0f9f8", "#d9efec", "#e6f2f6"],
    borde: "#c3e2de",
    filete: ["#2a8f87", "#5fb3a9", "#4f9bb5"],
    acento: "#1f6f69",
    titulo: "#163f3c",
    bajada: "#2f5d5a",
    arcos: ["#4f9bb5", "#5fb3a9", "#2a8f87", "#cdeae6"],
  },
  /* Azul pizarra: los equipos, lo técnico. */
  equipos: {
    fondo: ["#f2f6fb", "#dde7f3", "#eaedf5"],
    borde: "#cbd8ea",
    filete: ["#3c6795", "#6d93bf", "#7c86b0"],
    acento: "#2f5888",
    titulo: "#1d2d43",
    bajada: "#3d5270",
    arcos: ["#7c86b0", "#6d93bf", "#3c6795", "#d6e1f0"],
  },
  /* Salvia y oliva: la inocuidad, lo que se controla. */
  calidad: {
    fondo: ["#f3f7ee", "#e0ebd5", "#eef1e3"],
    borde: "#cfdcc2",
    filete: ["#5d7d4a", "#8aa86f", "#a3a35a"],
    acento: "#4a6639",
    titulo: "#25321d",
    bajada: "#4a5b3d",
    arcos: ["#a3a35a", "#8aa86f", "#5d7d4a", "#dde8cf"],
  },
  /* Ciruela y rosa viejo: las personas. */
  personas: {
    fondo: ["#faf2f5", "#efdde5", "#f1ebf4"],
    borde: "#e3cbd6",
    filete: ["#8e4566", "#c27a96", "#9a7bb0"],
    acento: "#843e5d",
    titulo: "#3a1f2c",
    bajada: "#674453",
    arcos: ["#9a7bb0", "#c27a96", "#8e4566", "#f0dbe4"],
  },
};
