import { useEffect, useState, type FormEvent } from "react";
import { Badge, Box, Button, Checkbox, HStack, Stack, Table, Text, Textarea } from "@chakra-ui/react";
import { LuCheck, LuScale } from "react-icons/lu";
import { DialogContent, DialogRoot, DialogTitle } from "../../../../components/ui/dialog";
import { DialogForm } from "../../../../common/components/DialogForm";
import { Pagina } from "../../../../components/ui/plantillas";
import {
  AccionesFormulario,
  BannerError,
  BotonAgregar,
  BotonCancelar,
  BotonGuardar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  EtiquetaEstado,
  FilaEncabezado,
  FormField,
  FormInput,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { toaster } from "../../../../components/ui/toaster";
import { formatoFecha, hoyISO } from "../../../../common/utils/fechas";
import {
  activarRegla,
  crearRegla,
  guardarAjusteModulo,
  listarReglas,
  obtenerAjusteModulo,
} from "../../services/rotuladoFrontalService";
import {
  FORMULAS_NUTRICIONALES_INICIALES,
  INGREDIENTES_CAFEINA_INICIAL,
  INS_EDULCORANTES_INICIAL,
  MARCAS_ROTULADO,
  REGLAS_APLICABILIDAD_INICIALES,
  UMBRALES_SELLOS_INICIAL,
  type ParametroNormativo,
  type ReglaRotulado,
  type ReglaRotuladoInput,
  type ReglasAplicabilidad,
} from "../../types/rotuladoFrontal";

const NORMATIVA_INICIAL = "Ley 27.642 y Decreto 151/2022";

function reglasObligatorias(regla: ReglaRotulado): string[] {
  return MARCAS_ROTULADO.filter((marca) => {
    switch (marca.clave) {
      case "azucares":
        return regla.obliga_azucares;
      case "grasas":
        return regla.obliga_grasas;
      case "sodio":
        return regla.obliga_sodio;
      case "edulcorantes":
        return regla.obliga_edulcorantes;
      case "cafeina":
        return regla.obliga_cafeina;
    }
  }).map((marca) => marca.nombre);
}

function NuevaVersionDialog({
  reglaBase,
  onCancelar,
  onCreada,
}: {
  reglaBase?: ReglaRotulado;
  onCancelar: () => void;
  onCreada: () => Promise<void>;
}) {
  const [vigencia, setVigencia] = useState(hoyISO());
  const [norma, setNorma] = useState("");
  const [requiereEnvasado, setRequiereEnvasado] = useState(
    reglaBase?.requiere_envasado ?? true,
  );
  const [obligatorias, setObligatorias] = useState<Record<string, boolean>>({
    azucares: reglaBase?.obliga_azucares ?? true,
    grasas: reglaBase?.obliga_grasas ?? true,
    sodio: reglaBase?.obliga_sodio ?? true,
    edulcorantes: reglaBase?.obliga_edulcorantes ?? true,
    cafeina: reglaBase?.obliga_cafeina ?? true,
  });
  const [clases, setClases] = useState(
    (reglaBase?.clases_edulcorante ?? ["Edulcorante"]).join(", "),
  );
  const [validarIns, setValidarIns] = useState(
    reglaBase?.validar_ins_edulcorantes ?? true,
  );
  const [ins, setIns] = useState(
    (reglaBase?.ins_edulcorantes ?? INS_EDULCORANTES_INICIAL).join(", "),
  );
  const [ingredientesCafeina, setIngredientesCafeina] = useState(
    (reglaBase?.ingredientes_cafeina ?? INGREDIENTES_CAFEINA_INICIAL).join(", "),
  );
  const [umbrales, setUmbrales] = useState<ParametroNormativo[]>(() =>
    (reglaBase?.umbrales_sellos ?? UMBRALES_SELLOS_INICIAL).map((parametro) => ({
      ...parametro,
    })),
  );
  const [formulas, setFormulas] = useState<ParametroNormativo[]>(() =>
    (
      reglaBase?.formulas_nutricionales ?? FORMULAS_NUTRICIONALES_INICIALES
    ).map((parametro) => ({ ...parametro })),
  );
  const [aplicabilidad, setAplicabilidad] = useState(() =>
    JSON.stringify(
      reglaBase?.reglas_aplicabilidad ?? REGLAS_APLICABILIDAD_INICIALES,
      null,
      2,
    ),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarValor = (
    clave: string,
    valor: string,
    actualizar: (fn: (previos: ParametroNormativo[]) => ParametroNormativo[]) => void,
  ) => {
    const numero = Number(valor);
    actualizar((previos) =>
      previos.map((parametro) =>
        parametro.clave === clave
          ? { ...parametro, valor: Number.isFinite(numero) ? numero : 0 }
          : parametro,
      ),
    );
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!norma.trim()) {
      setError("Indicá la norma de origen de la versión.");
      return;
    }
    let reglasAplicabilidad: ReglasAplicabilidad;
    try {
      reglasAplicabilidad = JSON.parse(aplicabilidad) as ReglasAplicabilidad;
    } catch {
      setError("Las reglas de aplicabilidad no son un JSON válido.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const datos: ReglaRotuladoInput = {
        vigencia_desde: vigencia,
        norma_origen: norma.trim(),
        requiere_envasado: requiereEnvasado,
        obliga_azucares: obligatorias.azucares,
        obliga_grasas: obligatorias.grasas,
        obliga_sodio: obligatorias.sodio,
        obliga_edulcorantes: obligatorias.edulcorantes,
        obliga_cafeina: obligatorias.cafeina,
        clases_edulcorante: clases
          .split(",")
          .map((clase) => clase.trim())
          .filter(Boolean),
        validar_ins_edulcorantes: validarIns,
        ins_edulcorantes: ins
          .split(",")
          .map((codigo) => codigo.trim())
          .filter(Boolean),
        ingredientes_cafeina: ingredientesCafeina
          .split(",")
          .map((ingrediente) => ingrediente.trim())
          .filter(Boolean),
        umbrales_sellos: umbrales,
        formulas_nutricionales: formulas,
        reglas_aplicabilidad: reglasAplicabilidad,
      };
      await crearRegla(datos);
      await onCreada();
      toaster.create({
        type: "success",
        title: "Versión creada. Activala para que se use en las evaluaciones.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la versión.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      scrollBehavior="inside"
      closeOnEscape={!guardando}
      closeOnInteractOutside={!guardando}
      onOpenChange={(detalle) => {
        if (!detalle.open && !guardando) onCancelar();
      }}
    >
      <DialogContent bg="bg.panel" p="6" rounded="lg" boxShadow="dialog" width="560px" maxW="calc(100vw - 32px)">
        <DialogForm onSubmit={guardar}>
          <DialogTitle as="h3" mt={0} mb="5" fontSize="lg" fontWeight="bold" color="fg">
            Nueva versión de la regla
          </DialogTitle>

          {error && <BannerError mb="4">{error}</BannerError>}

          <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
            <FormField label="Vigencia desde" required mb="0">
              <FormInput type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
            </FormField>
            <FormField label="Norma de origen" required mb="0">
              <FormInput
                value={norma}
                onChange={(e) => setNorma(e.target.value)}
                maxLength={200}
                placeholder={NORMATIVA_INICIAL}
              />
            </FormField>
          </Box>

          <Checkbox.Root
            checked={requiereEnvasado}
            onCheckedChange={(e) => setRequiereEnvasado(e.checked === true)}
            colorPalette="brand"
            mt="5"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="sm">
              Solo aplica a productos envasados en ausencia del cliente
            </Checkbox.Label>
          </Checkbox.Root>

          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mt="5" mb="2">
            Marcas que obligan a rotular
          </Text>
          <Stack gap="2">
            {MARCAS_ROTULADO.map((marca) => (
              <Checkbox.Root
                key={marca.clave}
                checked={obligatorias[marca.clave]}
                onCheckedChange={(e) =>
                  setObligatorias((previas) => ({ ...previas, [marca.clave]: e.checked === true }))
                }
                colorPalette="brand"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label fontSize="sm">{marca.nombre}</Checkbox.Label>
              </Checkbox.Root>
            ))}
          </Stack>

          <Box mt="5">
            <FormField
              label="Clases funcionales que marcan edulcorantes"
              helper="Separadas por coma. Un aditivo de estas clases marca el producto como con edulcorantes."
              mb="4"
            >
              <FormInput value={clases} onChange={(e) => setClases(e.target.value)} placeholder="Edulcorante" />
            </FormField>

            <Checkbox.Root
              checked={validarIns}
              onCheckedChange={(e) => setValidarIns(e.checked === true)}
              colorPalette="brand"
              mb="4"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label fontSize="sm">
                Validar también el código INS del edulcorante
              </Checkbox.Label>
            </Checkbox.Root>

            <FormField
              label="INS de edulcorantes"
              helper="Separados por coma. Si la validación de INS está activa, un aditivo de clase edulcorante solo marca cuando su INS está en esta lista (o no declara INS)."
              mb="4"
            >
              <FormInput value={ins} onChange={(e) => setIns(e.target.value)} placeholder="951, 955, 960" />
            </FormField>

            <FormField
              label="Ingredientes con cafeína intrínseca"
              helper="Separados por coma. Se comparan por palabra completa sobre el nombre del insumo."
              mb="0"
            >
              <FormInput
                value={ingredientesCafeina}
                onChange={(e) => setIngredientesCafeina(e.target.value)}
                placeholder="cafe, te, guarana, yerba mate"
              />
            </FormField>
          </Box>

          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mt="6" mb="1">
            Umbrales de sellos
          </Text>
          <Text fontSize="xs" color="fg.muted" mb="3">
            Se guardan dentro de esta versión. Los cálculos históricos conservan
            los valores con los que fueron evaluados.
          </Text>
          <Stack gap="2">
            {umbrales.map((parametro) => (
              <HStack key={parametro.clave} gap="3">
                <Box flex="1">
                  <Text fontSize="sm">{parametro.etiqueta}</Text>
                  <Text fontSize="xs" color="fg.muted">{parametro.clave}</Text>
                </Box>
                <FormInput
                  type="number"
                  min="0"
                  step="any"
                  width="110px"
                  value={parametro.valor}
                  onChange={(e) =>
                    cambiarValor(parametro.clave, e.target.value, setUmbrales)
                  }
                />
                <Text fontSize="xs" color="fg.muted" minW="82px">
                  {parametro.unidad}
                </Text>
              </HStack>
            ))}
          </Stack>

          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mt="6" mb="1">
            Fórmulas nutricionales
          </Text>
          <Text fontSize="xs" color="fg.muted" mb="3">
            Factores usados para convertir gramos en energía. También quedan
            versionados junto con la regla.
          </Text>
          <Stack gap="2">
            {formulas.map((parametro) => (
              <HStack key={parametro.clave} gap="3">
                <Box flex="1">
                  <Text fontSize="sm">{parametro.etiqueta}</Text>
                  <Text fontSize="xs" color="fg.muted">{parametro.clave}</Text>
                </Box>
                <FormInput
                  type="number"
                  min="0"
                  step="any"
                  width="110px"
                  value={parametro.valor}
                  onChange={(e) =>
                    cambiarValor(parametro.clave, e.target.value, setFormulas)
                  }
                />
                <Text fontSize="xs" color="fg.muted" minW="82px">
                  {parametro.unidad}
                </Text>
              </HStack>
            ))}
          </Stack>

          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mt="6" mb="1">
            Reglas de aplicabilidad
          </Text>
          <Text fontSize="xs" color="fg.muted" mb="3">
            Canales de consumo final, categorías exceptuadas y condiciones del
            motor. Se guardan dentro de esta versión; el servicio solo las
            ejecuta en orden.
          </Text>
          <Textarea
            value={aplicabilidad}
            onChange={(e) => setAplicabilidad(e.target.value)}
            rows={14}
            fontFamily="mono"
            fontSize="xs"
            bg="bg.subtle"
            _invalid={{ borderColor: "red.500" }}
          />

          <AccionesFormulario>
            <BotonGuardar loading={guardando}>Crear versión</BotonGuardar>
            <BotonCancelar onClick={onCancelar} disabled={guardando}>Cancelar</BotonCancelar>
          </AccionesFormulario>
        </DialogForm>
      </DialogContent>
    </DialogRoot>
  );
}

export function ReglasRotuladoFrontalPage() {
  const [reglas, setReglas] = useState<ReglaRotulado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [activando, setActivando] = useState<number | null>(null);
  const [moduloActivo, setModuloActivo] = useState(true);
  const [cargandoModulo, setCargandoModulo] = useState(true);
  const [guardandoModulo, setGuardandoModulo] = useState(false);

  const cargar = async () => {
    try {
      setReglas(await listarReglas());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las reglas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    Promise.all([listarReglas(), obtenerAjusteModulo()])
      .then(([datos, ajuste]) => {
        setReglas(datos);
        setModuloActivo(ajuste.modulo_activo);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setCargando(false);
        setCargandoModulo(false);
      });
  }, []);

  const alternarModulo = async (activo: boolean) => {
    setGuardandoModulo(true);
    setError(null);
    try {
      const ajuste = await guardarAjusteModulo(activo);
      setModuloActivo(ajuste.modulo_activo);
      toaster.create({
        type: "success",
        title: ajuste.modulo_activo
          ? "Módulo de octógonos activado."
          : "Módulo de octógonos desactivado. El resto del sistema sigue funcionando.",
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el módulo.",
      );
    } finally {
      setGuardandoModulo(false);
    }
  };

  const activar = async (regla: ReglaRotulado) => {
    setActivando(regla.id);
    setError(null);
    try {
      await activarRegla(regla.id);
      await cargar();
      toaster.create({ type: "success", title: `Versión ${regla.version} activada.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar la versión.");
    } finally {
      setActivando(null);
    }
  };

  return (
    <Pagina
      titulo="Reglas de rotulado frontal"
      descripcion="Versiones de las reglas que deciden si corresponde el rotulado frontal. Las versiones anteriores no se editan."
      acciones={<BotonAgregar onClick={() => setCreando(true)}>Nueva versión</BotonAgregar>}
    >
      <Tarjeta p="4" mb="4">
        <HStack justify="space-between" align="center" gap="4" flexWrap="wrap">
          <Box>
            <HStack gap="2">
              <Text fontWeight="semibold">Módulo de octógonos</Text>
              <EtiquetaEstado tono={moduloActivo ? "ok" : "alerta"}>
                {moduloActivo ? "Activo" : "Desactivado"}
              </EtiquetaEstado>
            </HStack>
            <Text fontSize="sm" color="fg.muted" mt="1">
              Al desactivarlo se deja de evaluar el rotulado frontal y de
              calcular sellos; el resto del sistema sigue funcionando.
            </Text>
          </Box>
          <Checkbox.Root
            checked={moduloActivo}
            disabled={cargandoModulo || guardandoModulo}
            onCheckedChange={(e) => void alternarModulo(e.checked === true)}
            colorPalette="brand"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="sm">
              {guardandoModulo ? "Guardando..." : "Módulo activo"}
            </Checkbox.Label>
          </Checkbox.Root>
        </HStack>
      </Tarjeta>

      {error && <BannerError>{error}</BannerError>}
      {cargando && <EstadoCargando>Cargando reglas...</EstadoCargando>}

      {!cargando && reglas.length === 0 && (
        <EstadoVacio>No hay reglas de rotulado frontal. Creá la primera versión.</EstadoVacio>
      )}

      {!cargando && reglas.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="760px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Versión</EncabezadoOscuro>
                <EncabezadoOscuro>Norma</EncabezadoOscuro>
                <EncabezadoOscuro>Vigencia</EncabezadoOscuro>
                <EncabezadoOscuro>Marcas obligatorias</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="angosta">Estado</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="media">Acción</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {reglas.map((regla) => {
                const obligatorias = reglasObligatorias(regla);
                return (
                  <Table.Row key={regla.id} borderBottomWidth="1px" borderColor="border.subtle">
                    <Celda py="3" px="4">
                      <HStack gap="2">
                        <Text fontWeight="semibold">v{regla.version}</Text>
                        <LuScale aria-hidden />
                      </HStack>
                    </Celda>
                    <Celda py="3" px="4">
                      <Text>{regla.norma_origen}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {regla.requiere_envasado ? "Requiere envasado" : "No requiere envasado"}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {regla.umbrales_sellos.length} umbrales ·{" "}
                        {regla.formulas_nutricionales.length} fórmulas
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {regla.reglas_aplicabilidad.categorias_exceptuadas.length}{" "}
                        categorías exceptuadas ·{" "}
                        {regla.reglas_aplicabilidad.condiciones.length} condiciones
                      </Text>
                    </Celda>
                    <Celda py="3" px="4">{formatoFecha(regla.vigencia_desde)}</Celda>
                    <Celda py="3" px="4">
                      {obligatorias.length === 0 ? (
                        <Text color="fg.muted">Ninguna</Text>
                      ) : (
                        <HStack gap="1" flexWrap="wrap">
                          {obligatorias.map((nombre) => (
                            <Badge key={nombre} variant="subtle" colorPalette="gray" size="sm">
                              {nombre}
                            </Badge>
                          ))}
                        </HStack>
                      )}
                    </Celda>
                    <Celda py="3" px="4" center>
                      {regla.vigente ? (
                        <EtiquetaEstado tono="ok">Vigente</EtiquetaEstado>
                      ) : (
                        <EtiquetaEstado tono="neutro">Histórica</EtiquetaEstado>
                      )}
                    </Celda>
                    <Celda py="3" px="4" center>
                      {regla.vigente ? (
                        <Text fontSize="sm" color="fg.muted">En uso</Text>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          colorPalette="green"
                          loading={activando === regla.id}
                          onClick={() => void activar(regla)}
                        >
                          <LuCheck aria-hidden /> Activar
                        </Button>
                      )}
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {creando && (
        <NuevaVersionDialog
          reglaBase={reglas.find((regla) => regla.vigente) ?? reglas[0]}
          onCancelar={() => setCreando(false)}
          onCreada={async () => {
            await cargar();
            setCreando(false);
          }}
        />
      )}
    </Pagina>
  );
}
