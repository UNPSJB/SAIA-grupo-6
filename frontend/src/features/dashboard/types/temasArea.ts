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
 *
 * Los fondos, el borde y las tintas son tokens `area.<categoría>.*` de
 * `theme/index.ts` (con su versión de modo oscuro) y se usan como
 * `var(--chakra-colors-…)` porque también van dentro de degradados. El filete
 * y los arcos intensos son tonos medios y quedan fijos en los dos modos.
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
    fondo: ["var(--chakra-colors-area-produccion-fondo0)", "var(--chakra-colors-area-produccion-fondo1)", "var(--chakra-colors-area-produccion-fondo2)"],
    borde: "var(--chakra-colors-area-produccion-borde)",
    filete: ["#b85a3c", "#c99a3b", "#d98b5f"],
    acento: "var(--chakra-colors-area-produccion-acento)",
    titulo: "var(--chakra-colors-area-produccion-titulo)",
    bajada: "var(--chakra-colors-area-produccion-bajada)",
    arcos: ["#c99a3b", "#d98b5f", "#b85a3c", "var(--chakra-colors-area-produccion-arco3)"],
  },
  /* Miel y arena: el depósito, la materia prima. */
  inventario: {
    fondo: ["var(--chakra-colors-area-inventario-fondo0)", "var(--chakra-colors-area-inventario-fondo1)", "var(--chakra-colors-area-inventario-fondo2)"],
    borde: "var(--chakra-colors-area-inventario-borde)",
    filete: ["#b8860b", "#d4a937", "#a89060"],
    acento: "var(--chakra-colors-area-inventario-acento)",
    titulo: "var(--chakra-colors-area-inventario-titulo)",
    bajada: "var(--chakra-colors-area-inventario-bajada)",
    arcos: ["#a89060", "#d4a937", "#b8860b", "var(--chakra-colors-area-inventario-arco3)"],
  },
  /* Agua y menta: la higiene. */
  limpieza: {
    fondo: ["var(--chakra-colors-area-limpieza-fondo0)", "var(--chakra-colors-area-limpieza-fondo1)", "var(--chakra-colors-area-limpieza-fondo2)"],
    borde: "var(--chakra-colors-area-limpieza-borde)",
    filete: ["#2a8f87", "#5fb3a9", "#4f9bb5"],
    acento: "var(--chakra-colors-area-limpieza-acento)",
    titulo: "var(--chakra-colors-area-limpieza-titulo)",
    bajada: "var(--chakra-colors-area-limpieza-bajada)",
    arcos: ["#4f9bb5", "#5fb3a9", "#2a8f87", "var(--chakra-colors-area-limpieza-arco3)"],
  },
  /* Azul pizarra: los equipos, lo técnico. */
  equipos: {
    fondo: ["var(--chakra-colors-area-equipos-fondo0)", "var(--chakra-colors-area-equipos-fondo1)", "var(--chakra-colors-area-equipos-fondo2)"],
    borde: "var(--chakra-colors-area-equipos-borde)",
    filete: ["#3c6795", "#6d93bf", "#7c86b0"],
    acento: "var(--chakra-colors-area-equipos-acento)",
    titulo: "var(--chakra-colors-area-equipos-titulo)",
    bajada: "var(--chakra-colors-area-equipos-bajada)",
    arcos: ["#7c86b0", "#6d93bf", "#3c6795", "var(--chakra-colors-area-equipos-arco3)"],
  },
  /* Salvia y oliva: la inocuidad, lo que se controla. */
  calidad: {
    fondo: ["var(--chakra-colors-area-calidad-fondo0)", "var(--chakra-colors-area-calidad-fondo1)", "var(--chakra-colors-area-calidad-fondo2)"],
    borde: "var(--chakra-colors-area-calidad-borde)",
    filete: ["#5d7d4a", "#8aa86f", "#a3a35a"],
    acento: "var(--chakra-colors-area-calidad-acento)",
    titulo: "var(--chakra-colors-area-calidad-titulo)",
    bajada: "var(--chakra-colors-area-calidad-bajada)",
    arcos: ["#a3a35a", "#8aa86f", "#5d7d4a", "var(--chakra-colors-area-calidad-arco3)"],
  },
  /* Ciruela y rosa viejo: las personas. */
  personas: {
    fondo: ["var(--chakra-colors-area-personas-fondo0)", "var(--chakra-colors-area-personas-fondo1)", "var(--chakra-colors-area-personas-fondo2)"],
    borde: "var(--chakra-colors-area-personas-borde)",
    filete: ["#8e4566", "#c27a96", "#9a7bb0"],
    acento: "var(--chakra-colors-area-personas-acento)",
    titulo: "var(--chakra-colors-area-personas-titulo)",
    bajada: "var(--chakra-colors-area-personas-bajada)",
    arcos: ["#9a7bb0", "#c27a96", "#8e4566", "var(--chakra-colors-area-personas-arco3)"],
  },
};
