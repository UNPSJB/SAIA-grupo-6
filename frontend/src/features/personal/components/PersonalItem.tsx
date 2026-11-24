import { HStack } from "@chakra-ui/react";
import type { Persona } from "../types/personal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../common/context/useAuth";
import { esSuperAdmin as esSuperAdminDe, puedeDarDeBajaA, puedeEditarA } from "../../../common/api/permissions";
import {
  BotonAccion,
  Celda,
  FilaClickeable,
  DatoPrincipal,
  PildoraNeutra,
} from "../../../components/ui/patrones";

interface PersonalItemProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onReactivar: (persona: Persona) => void; // Recibimos el método desde la tabla
}

/** Resumen de capacidades en texto: "Operar | Administrar", "Ninguna", etc. */
function resumenPermisos(persona: Persona) {
  if (esSuperAdminDe(persona)) return "Super admin";
  if (persona.es_gerente) return "Gerente";

  const partes: string[] = [];
  if (persona.puede_operar) partes.push("Operar");
  if (persona.puede_administrar) partes.push("Administrar");

  return partes.length > 0 ? partes.join(" | ") : "Ninguna";
}

export function PersonalItem({ persona, onEdit, onDelete, onReactivar }: PersonalItemProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Las acciones se ocultan según la jerarquía: un admin no toca a otro admin
  // ni a un super admin, y nadie se da de baja a sí mismo.
  const puedeEditar = puedeEditarA(user, persona);
  const puedeBorrar = puedeDarDeBajaA(user, persona);

  return (
    <FilaClickeable onAbrir={() => navigate(`/personal/detalle/${persona.id}`)} borderBottomWidth="1px" borderColor="border.subtle" opacity={persona.activo ? 1 : 0.65}>
      <Celda>
        <DatoPrincipal titulo={`${persona.nombre} ${persona.apellido || ""}`.trim()} />
      </Celda>
      <Celda fontVariantNumeric="tabular-nums">{persona.dni}</Celda>
      <Celda>
        <PildoraNeutra>{resumenPermisos(persona)}</PildoraNeutra>
      </Celda>
      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          <BotonAccion
            accion="ver"
            label="Ver detalle"
            onClick={() => navigate(`/personal/detalle/${persona.id}`)}
          />

          {persona.activo && puedeEditar && (
            <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(persona)} />
          )}

          {persona.activo ? (
            puedeBorrar && (
              <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(persona)} />
            )
          ) : (
            puedeEditar && (
              <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(persona)} />
            )
          )}
        </HStack>
      </Celda>
    </FilaClickeable>
  );
}