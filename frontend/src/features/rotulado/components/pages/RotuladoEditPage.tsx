import { useEnfocarFragmento } from "../../../../common/hooks/useEnfocarFragmento";
import { Box, Button } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PADDING_PAGINA, PaginaDetalle } from "../../../../components/ui/plantillas";
import {
  BannerError,
  BotonVolver,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { useRotulado } from "../../hooks/useRotulado";
import { RotuladoForm, type SeccionId } from "../RotuladoForm";
import { listarLotes } from "../../../lotes/services/loteService";
import { previewAutocompletado, recalcularNutricionBorrador } from "../../services/rotuladoService";
import type {
  BorradorRotuladoOut,
  VistaPreviaAutocompletado,
} from "../../types/rotulado";

interface LoteSimple {
  id: number;
  numero_lote: string;
  producto_id: number;
  version_receta_id: number | null;
  version_numero?: number | null;
  fecha_inicio?: string | null;
  fecha_cierre?: string | null;
  fecha_vencimiento?: string | null;
}

export function RotuladoEditPage() {
  const { id, producto_id } = useParams();
  return <RotuladoEditor key={`${id ?? "nuevo"}-${producto_id ?? ""}`} />;
}

function RotuladoEditor() {
  const navigate = useNavigate();
  // Sección del editor: sobrevive a que el formulario se vuelva a montar.
  const [seccion, setSeccion] = useState<SeccionId | undefined>();
  const { id, producto_id } = useParams<{ id?: string; producto_id?: string }>();
  const borradorId = id ? Number(id) : null;
  const productoId = producto_id ? Number(producto_id) : null;

  const {
    borrador,
    loading,
    error,
    crearBorrador,
    actualizarBorrador,
    obtenerBorrador: obtenerBorradorHook,
    autocompletarBorrador,
  } = useRotulado();

  const activo = useRef(true);
  useEffect(() => { activo.current = true; return () => { activo.current = false; }; }, []);

  const [guardando, setGuardando] = useState(false);
  const [lotes, setLotes] = useState<LoteSimple[]>([]);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaAutocompletado | null>(
    null,
  );
  const [previewCargada, setPreviewCargada] = useState(false);
  const [reintento, setReintento] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (borradorId) {
      obtenerBorradorHook(borradorId);
    }
  }, [borradorId, obtenerBorradorHook]);

  useEffect(() => {
    let montado = true;
    const origenProducto = productoId ?? borrador?.producto_id;
    if (!origenProducto) return;
    listarLotes()
      .then((data: LoteSimple[]) => {
        if (montado) setLotes(data.filter((l) => l.producto_id === origenProducto));
      })
      .catch((err: unknown) => { if (montado) setPreviewError(err instanceof Error ? err.message : "Error al consultar lotes"); });
    return () => {
      montado = false;
    };
  }, [productoId, borrador?.producto_id, reintento]);

  // En modo creación, cargar la vista previa de autocompletado al montar
  useEffect(() => {
    let montado = true;
    if (borradorId || !productoId) return;

    previewAutocompletado(productoId, null)
      .then((vista) => {
        if (montado) {
          setVistaPrevia(vista);
          setPreviewCargada(true);
        }
      })
      .catch((err: unknown) => {
        if (montado) { setPreviewError(err instanceof Error ? err.message : "Error al cargar vista previa"); setPreviewCargada(true); }
      });
    return () => {
      montado = false;
    };
  }, [productoId, borradorId, reintento]);

  const handleGuardar = async (datos: Partial<BorradorRotuladoOut>) => {
    setGuardando(true);
    try {
      if (borradorId) {
        const actualizado = await actualizarBorrador(borradorId, {
          version_receta_id: datos.version_receta_id,
          lote_producto_id: datos.lote_producto_id,
          denominacion_venta: datos.denominacion_venta ?? undefined,
          lista_ingredientes: datos.lista_ingredientes ?? undefined,
          contenido_neto: datos.contenido_neto ?? undefined,
          rnpa_rppa: datos.rnpa_rppa ?? undefined,
          razon_social: datos.razon_social ?? undefined,
          domicilio: datos.domicilio ?? undefined,
          identificacion_lote: datos.identificacion_lote ?? undefined,
          fecha_produccion: datos.fecha_produccion,
          fecha_cierre: datos.fecha_cierre,
          fecha_duracion: datos.fecha_duracion,
          instrucciones_uso: datos.instrucciones_uso ?? undefined,
          es_importado: datos.es_importado ?? undefined,
          importador_razon_social: datos.importador_razon_social ?? undefined,
          importador_domicilio: datos.importador_domicilio ?? undefined,
          estado: datos.estado ?? undefined,
          datos_nutricionales_json: datos.datos_nutricionales_json ?? undefined,
          sellos_disponibles: datos.sellos_disponibles ?? undefined,
        });
        if (!actualizado || !activo.current) return;
        toaster.create({ type: "success", title: "Borrador guardado", duration: 3000 });
      } else if (productoId) {
        const resultado = await crearBorrador({
          producto_id: productoId,
          version_receta_id: datos.version_receta_id ?? null,
          lote_producto_id: datos.lote_producto_id ?? null,
          denominacion_venta: datos.denominacion_venta ?? null,
          lista_ingredientes: datos.lista_ingredientes ?? null,
          contenido_neto: datos.contenido_neto ?? null,
          rnpa_rppa: datos.rnpa_rppa ?? null,
          razon_social: datos.razon_social ?? null,
          domicilio: datos.domicilio ?? null,
          identificacion_lote: datos.identificacion_lote ?? null,
          fecha_produccion: datos.fecha_produccion ?? null,
          fecha_cierre: datos.fecha_cierre ?? null,
          fecha_duracion: datos.fecha_duracion ?? null,
          instrucciones_uso: datos.instrucciones_uso ?? null,
          es_importado: datos.es_importado ?? false,
          importador_razon_social: datos.importador_razon_social ?? null,
          importador_domicilio: datos.importador_domicilio ?? null,
          estado: datos.estado ?? "borrador",
          datos_nutricionales_json: datos.datos_nutricionales_json ?? null,
          sellos_disponibles: datos.sellos_disponibles ?? false,
        });
        if (resultado && activo.current) {
          toaster.create({ type: "success", title: "Borrador creado", duration: 3000 });
          navigate(`/rotulado/borradores/${resultado.id}`);
        }
      }
    } catch {
      toaster.create({ type: "error", title: "Error al guardar borrador", duration: 3000 });
    } finally {
      setGuardando(false);
    }
  };

  const handleRecalcularNutricion = async () => {
    if (!borradorId) return;
    setGuardando(true);
    try {
      await recalcularNutricionBorrador(borradorId);
      if (!activo.current) return;
      await obtenerBorradorHook(borradorId);
      toaster.create({ type: "success", title: "Tabla nutricional actualizada" });
    } catch (error) {
      toaster.create({
        type: "error",
        title: "No se pudo recalcular la tabla",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setGuardando(false);
    }
  };

  useEnfocarFragmento(!!borrador && !loading && !error && !previewError);

  if (loading || (!borradorId && !previewCargada)) {
    return (
      <PaginaDetalle
        titulo="Rotulado"
        acciones={<BotonVolver onClick={() => navigate(-1)} />}
      >
        <EstadoCargando>Cargando borrador...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || previewError) {
    return (
      <PaginaDetalle
        titulo="Rotulado"
        acciones={<BotonVolver onClick={() => navigate(-1)} />}
      >
        <BannerError>{error ?? previewError}</BannerError>
        <Button onClick={() => { setPreviewError(null); setPreviewCargada(false); setReintento(n => n + 1); if (borradorId) void obtenerBorradorHook(borradorId); }}>Reintentar</Button>
      </PaginaDetalle>
    );
  }

  // Valores iniciales del formulario: vista previa si hay, borrador si es edición, vacío si creación
  const esCreacion = !borradorId;
  const productoNombre =
    borrador?.producto_nombre ??
    vistaPrevia?.producto_nombre ??
    (esCreacion ? "Nuevo producto" : "");

  const valoresIniciales: BorradorRotuladoOut | null = esCreacion && vistaPrevia && productoId
    ? {
        declaraciones: vistaPrevia.declaraciones,
        id: 0,
        producto_id: productoId,
        version_receta_id: vistaPrevia.version_receta_id,
        lote_producto_id: null,
        version_receta_numero: vistaPrevia.version_receta_numero,
        lote_numero: null,
        producto_nombre: vistaPrevia.producto_nombre,
        denominacion_venta: vistaPrevia.denominacion_venta ?? "",
        lista_ingredientes: vistaPrevia.lista_ingredientes ?? "",
        contenido_neto: "",
        rnpa_rppa: "",
        // Del establecimiento activo (Establecimientos → razón social y dirección).
        razon_social: vistaPrevia.razon_social ?? "",
        domicilio: vistaPrevia.domicilio ?? "",
        identificacion_lote: "",
        fecha_produccion: null,
        fecha_cierre: null,
        fecha_duracion: null,
        instrucciones_uso: "",
        es_importado: false,
        importador_razon_social: "",
        importador_domicilio: "",
        estado: "borrador",
        datos_nutricionales_json: vistaPrevia.datos_nutricionales_json ?? null,
        sellos_disponibles: vistaPrevia.sellos_disponibles,
        creado_en: null,
        actualizado_en: null,
        creado_por_id: null,
        actualizado_por_id: null,
      }
    : borrador ?? null;

  // El encabezado (título, estado y acciones) lo pinta el formulario, fijo
  // arriba mientras se recorren las secciones.
  const accionesExtra = (
    <>
      {!esCreacion && borrador && (
        <Button asChild variant="outline" size="sm">
          <a href={`/rotulado/borradores/${borrador.id}/previsualizar`} target="_blank" rel="noopener noreferrer">
            Previsualizar versión guardada
          </a>
        </Button>
      )}
      {/* Los octógonos se configuran en el producto. En otra pestaña para
          no perder lo que se esté editando acá. */}
      {borrador?.producto_id && (
        <Button asChild variant="outline" size="sm">
          <a
            href={`/productos/${borrador.producto_id}/rotulado-frontal${borrador.id ? `?solo_lectura=true&borrador_id=${borrador.id}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Rotulado frontal
          </a>
        </Button>
      )}
    </>
  );

  return (
    <Box p={PADDING_PAGINA} pt="0" w="100%" minW="0">
      {vistaPrevia?.mensaje && <BannerError>{vistaPrevia.mensaje}</BannerError>}
      <RotuladoForm
        key={`${productoId}-${borradorId}-${borrador?.actualizado_en ?? "nuevo"}`}
        borrador={valoresIniciales}
        esCreacion={esCreacion}
        productoNombre={esCreacion ? productoNombre : undefined}
        onGuardar={handleGuardar}
        onOrigenChange={() => { if (borradorId) void obtenerBorradorHook(borradorId); }}
        onAutocompletar={
          borradorId
            ? async (versionId, loteId, forzar) => {
                await autocompletarBorrador(borradorId, versionId, loteId, forzar);
              }
            : async () => {}
        }
        onRecalcularNutricion={borradorId ? handleRecalcularNutricion : undefined}
        lotes={lotes}
        isLoading={guardando}
        hayFaltantes={false}
        accionesExtra={accionesExtra}
        onVolver={() => navigate(-1)}
        seccionInicial={seccion}
        onSeccionChange={setSeccion}
      />
    </Box>
  );
}
