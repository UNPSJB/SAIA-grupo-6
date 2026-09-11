export function traducirError(errorData: any): string {
  const detalle = errorData.detail;

  if (!detalle || !Array.isArray(detalle)) {
    return errorData.detail || 'Ocurrió un error inesperado.';
  }

  const errorValidacion = detalle[0];
  const campo = errorValidacion.loc?.[errorValidacion.loc.length - 1].toUpperCase();;
  const tipo = errorValidacion.type;

  const traducciones: Record<string, string> = {
    'string_too_short': `El dato en el campo "${campo}" es demasiado corto.`,
    'string_too_long': `El dato en el campo "${campo}" supera el límite permitido.`,
    'string_pattern_mismatch': `El formato del campo "${campo}" contiene caracteres no válidos.`,
    'missing': `El campo "${campo}" es obligatorio.`,
    'value_error': `El valor del campo "${campo}" es incorrecto.`
  };

  return traducciones[tipo] || `Hay un error en el campo "${campo}".`;
}