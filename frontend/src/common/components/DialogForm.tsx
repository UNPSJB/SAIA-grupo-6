import type { FormHTMLAttributes } from "react";

/**
 * `<form>` dentro de un `DialogContent`.
 *
 * Existe porque los tipos de `Box` de Chakra v3 (`HTMLChakraProps<"div">`) no
 * aceptan `noValidate`, y `DialogContent` fuerza `asChild={false}`, así que
 * tampoco se podía resolver con `<Box as="form">`. No hay equivalente en el
 * barrel de Chakra v3 (`Form` no se exporta), por eso es un componente propio.
 *
 * `noValidate` importa: sin él el navegador bloquea el submit cuando un
 * `<Input type="date">` o `type="number"` queda vacío, y las validaciones de la
 * app —con mensajes en español— nunca llegan a mostrarse.
 *
 *   <DialogContent>
 *     <DialogForm onSubmit={handleSubmit}>…</DialogForm>
 *   </DialogContent>
 */
export function DialogForm({
  children,
  ...rest
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form noValidate {...rest}>
      {children}
    </form>
  );
}