export interface ConfiguracionVistaPublica {
  habilitada: boolean;
  url_publica: string | null;
}

export interface IndicadorVistaPublica {
  clave: string;
  etiqueta: string;
  descripcion: string;
  formato: "porcentaje";
  disponible: boolean;
  habilitado: boolean;
  /**
   * `false` cuando todavía no hay universo suficiente para calcularlo. Si el
   * indicador está visible, el panel avisa que el público aún no lo ve.
   */
  con_datos: boolean;
}

export interface IndicadorPublico {
  clave: string;
  etiqueta: string;
  descripcion: string;
  formato: "porcentaje";
  /** `null` cuando todavía no hay datos suficientes para calcularlo. */
  valor: number | null;
  /**
   * Puntos porcentuales que mejoró respecto del período anterior. El backend
   * solo lo envía cuando es positivo, así que nunca hay que mostrar una baja.
   */
  tendencia?: number | null;
}