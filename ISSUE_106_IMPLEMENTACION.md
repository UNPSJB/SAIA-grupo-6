# Issue #106 — Alérgenos, gluten y conservación

## Comportamiento implementado

| Criterio | Implementación | Verificación |
| --- | --- | --- |
| CA1 | Perfil para cada insumo, tanto ingrediente como aditivo; propuesta backend desde una versión específica; consolidación por sustancia y fuentes identificadas; gluten separado y faltantes explícitos | Casos de ingrediente, aditivo, duplicados, evaluaciones vacías/incompletas y cambio de versión |
| CA2 | Contaminación cruzada exclusivamente manual, con fundamento y respaldo, editable y eliminable; separada de presencia en ingredientes | Alta, modificación, eliminación y preservación durante regeneración; pruebas frontend |
| CA3 | Condiciones declaradas en producto, copia al borrador, edición local, temperatura, duración/unidad e instrucciones, también después de abrir | Persistencia, limpieza, reapertura, temperaturas negativas y validaciones de rangos/unidades |
| CA4 | Acción de confirmación independiente del guardado, administrador/superadministrador activo, revisión esperada, usuario, fecha, auditoría y comprobación de vigencia | Guardar no confirma; permisos HTTP/servicio; bloqueo por faltantes y cambios de origen; revisión histórica inmutable |

No se generan certificaciones ni leyendas de producto libre de gluten. Una lista evaluada vacía no produce una declaración de ausencia de alérgenos.

## Persistencia y decisiones de integración

- `Insumo.perfil_declaracion` guarda un objeto JSON validado por los contratos existentes, ampliados. Incluye evaluación, marcas directas/derivadas, información de gluten y respaldo. Se registra fecha y usuario de modificación en columnas independientes.
- El mismo maestro representa ingredientes y aditivos usados en recetas. No se duplica el perfil en el catálogo `Aditivo` ni se infiere presencia por número INS.
- `Producto.conservacion` guarda un objeto JSON validado. Se permite eliminarlo explícitamente con `null`.
- `RevisionDeclaracionRotulado` guarda instantáneas JSON, número de revisión, huella de origen, autor, fecha y confirmación. Se usa JSON para los perfiles y condiciones en lugar de multiplicar tablas auxiliares; las revisiones sí tienen entidad propia e índice único por borrador/número.
- El catálogo es una referencia versionada en código, obtenida del artículo 235 séptimo y la orientación oficial de ANMAT. La API lo expone para los formularios.
- Se conservan `fecha_duracion` e `instrucciones_uso`: no se reemplazan ni se calcula automáticamente una fecha a partir de la vida útil.
- La propuesta recorre los insumos de la versión, sin depender de las conversiones de E10. Una receta sin densidad suficiente para calcular porcentajes puede seguir proponiendo sustancias presentes.
- Los GET y la vista previa no escriben ni confirman. La creación y el autocompletado utilizan el mismo generador del backend.
- Regenerar preserva contaminación cruzada y conservación manual. Reponer conservación del producto es una acción explícita. Las evaluaciones normativas dependientes del origen se revisan de nuevo si cambia la fuente.
- Una nueva versión de receta no sustituye automáticamente la versión fijada. La selección explícita y el lote deben ser compatibles.
- Cambios en las marcas, respaldo, conservación de producto, versión seleccionada o lista de ingredientes declarada cambian la huella. Una confirmación histórica se conserva, pero queda desactualizada y requiere regeneración/revisión.
- Las mutaciones del bloque comprueban la revisión esperada y reservan la escritura en SQLite; una revisión obsoleta devuelve 409. Los datos de confirmación nunca se toman del cliente.
- El borrado visible de un borrador pasa a archivado lógico para conservar sus revisiones. Los borradores archivados desaparecen de las consultas funcionales.

## API

Se amplían los contratos existentes de insumos y productos y la vista previa de rotulado. El PATCH de borrador admite selección validada de versión y lote.

Nuevas operaciones, todas protegidas por `require_admin`:

- `GET /rotulado/catalogo-alergenos`
- `GET /rotulado/borradores/{id}/declaraciones`
- `PATCH /rotulado/borradores/{id}/declaraciones`
- `POST /rotulado/borradores/{id}/declaraciones/regenerar`
- `POST /rotulado/borradores/{id}/declaraciones/confirmar`
- `GET /rotulado/borradores/{id}/declaraciones/historial`

Las escrituras reciben `revision`. Guardar crea otra revisión cuando cambia el contenido; no confirma. Confirmar exige contenido suficiente y origen vigente. Las respuestas separan estado (`sugerida`/`confirmada`) y vigencia (`vigente`/`desactualizada`).

## Migración pendiente de aplicar

Archivo: `backend/src/migrations/declaraciones_rotulado.py`.

Clave: `rotulado_hu106_declaraciones`. Registrada en `run_migrations()`.

- Crea `revisiones_declaracion_rotulado`.
- Agrega `insumos.perfil_declaracion`, `perfil_actualizado_en` y `perfil_actualizado_por_id`.
- Agrega `productos.conservacion`.
- Agrega `borradores_rotulado.archivado`, con valor inicial falso.
- Es aditiva e idempotente. No infiere perfiles ni confirmaciones de registros anteriores.

Se probó en SQLite temporal y en memoria, con esquema anterior y esquema nuevo. **No se aplicó a la base real**. El arranque habitual del backend ejecutará el runner registrado; sigue pendiente esa aplicación en el entorno del usuario.

## Referencias normativas y límites

- Catálogo y excepciones: https://www.argentina.gob.ar/anmat/regulados/alimentos/alergenos-alimentarios/elaboradores-de-alimentos
- Distinción entre presencia, contaminación accidental y autorización de “PUEDE CONTENER”: https://www.argentina.gob.ar/anmat/regulados/alimentos/alergenos-alimentarios/alergenos-alimentarios/rotulado
- Las condiciones de conservación son declaradas por el elaborador, sin estimación automática de vida útil.
- Los sulfitos requieren evaluación documentada de concentración en el producto final antes de confirmar. Las excepciones no se infieren por nombre o clase funcional.
- La confirmación administrativa de SAIA no sustituye una autorización sanitaria. La declaración cruzada requiere fundamento y referencia de respaldo para confirmarse.
- No se implementa emisión de certificados, consulta de autorizaciones oficiales ni exportación de etiquetas en esta historia.

## Archivos

### Creados o retomados de la etapa anterior

- `backend/src/rotulado/declaraciones_schemas.py` — retomado y ampliado.
- `backend/tests/rotulado/test_declaraciones_schemas.py` — conservado; sus 10 pruebas siguen incluidas.
- `backend/src/rotulado/alergenos.py`
- `backend/src/rotulado/declaraciones_services.py`
- `backend/src/migrations/declaraciones_rotulado.py`
- `backend/tests/rotulado/test_declaraciones.py`
- `frontend/src/features/rotulado/types/declaraciones.ts`
- `frontend/src/features/rotulado/services/declaracionesService.ts`
- `frontend/src/features/rotulado/components/ConservacionFields.tsx`
- `frontend/src/features/rotulado/components/PerfilDeclaracionFields.tsx`
- `frontend/src/features/rotulado/components/DeclaracionesSection.tsx`
- `frontend/src/features/rotulado/declaraciones.test.tsx`
- `ISSUE_106_IMPLEMENTACION.md`

### Modificados

- `backend/src/all_models.py`
- `backend/src/insumos/models.py`, `schemas.py`, `services.py`
- `backend/src/productos/models.py`, `schemas.py`, `services.py`
- `backend/src/rotulado/models.py`, `schemas.py`, `services.py`, `router.py`
- `backend/src/migrations/__init__.py`
- `backend/tests/rotulado/test_rotulado.py`
- `frontend/src/features/insumos/types/insumo.ts`
- `frontend/src/features/insumos/components/InsumoForm.tsx`
- `frontend/src/features/insumos/components/pages/InsumoEditPage.tsx`
- `frontend/src/features/productos/types/producto.ts`
- `frontend/src/features/productos/components/ProductoForm.tsx`
- `frontend/src/features/productos/components/pages/ProductoCreatePage.tsx`
- `frontend/src/features/productos/components/pages/ProductoEditPage.tsx`
- `frontend/src/features/rotulado/types/rotulado.ts`
- `frontend/src/features/rotulado/components/RotuladoForm.tsx`
- `frontend/src/features/rotulado/components/pages/RotuladoEditPage.tsx`

El cambio previo en `backend/cargar_datos_ultimo.py` ya existía al retomar esta tarea y no forma parte de esta implementación. No se ejecutaron scripts de carga, ni se hizo commit, push o merge.

## Resultados de verificación

- Backend, regresión general: **831 aprobadas, 3 fallidas**. Las tres son de proveedores (`test_proveedor_create_nombre_vacio_lanza_nombre_vacio`, `test_proveedor_create_matricula_vacia_lanza_matricula_vacia`, `test_actualizar_proveedor_parcial`). Se reprodujeron las mismas tres fallas en una copia temporal de `git archive HEAD backend`, sin cambios de HU106: 16 aprobadas y 3 fallidas en esa comparación.
- Backend, verificación dirigida de rotulado/insumos/aditivos/trazabilidad: **175 aprobadas**. La suite de documentos también pasó utilizando un directorio temporal dentro del workspace.
- Backend, suite final de rotulado con los casos adicionales: **46 aprobadas**, incluidas las 10 pruebas de contratos de la etapa anterior.
- Frontend, `npm run test`: **10 aprobadas**, en dos archivos de prueba.
- Frontend, `npm run build`: aprobado. Permanecen avisos de Vite por configuración existente y tamaño de chunks.
- Lint dirigido a todos los archivos frontend de esta historia: aprobado.
- `npm run lint` global: **11 errores y 4 avisos** en clientes, incidentes, salidas, transportistas, dashboard y exportación, fuera de los archivos modificados de esta historia. No se corrigieron para evitar ampliar el alcance.
- `git diff --check`: aprobado.

Los cuatro criterios están implementados. Sigue pendiente aplicar la migración en el entorno real y cargar/evaluar allí los perfiles y condiciones del elaborador. La verificación global del repositorio no queda completamente verde por los problemas ajenos indicados.
