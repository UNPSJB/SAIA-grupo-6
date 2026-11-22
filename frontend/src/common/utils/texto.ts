/**
 * Minúsculas y sin tildes, para que las búsquedas no dependan de cómo se
 * escriba: "budin" encuentra "Budín" y "azucar" encuentra "Azúcar".
 */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
