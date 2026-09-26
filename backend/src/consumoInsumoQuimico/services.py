from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.checklist.models import RegistroTarea
from src.insumoQuimico.models import InsumoQuimico

from src.consumoInsumoQuimico import exceptions, schemas
from src.consumoInsumoQuimico.models import ConsumoInsumoQuimico


def registrar_consumo_insumo_quimico(
    db: Session,
    registro_tarea_id: int,
    datos: schemas.ConsumoInsumoQuimicoCreate,
    hacer_commit: bool = True,
) -> ConsumoInsumoQuimico:

    # Buscamos la tarea realizada
    registro_tarea = db.get(
        RegistroTarea,
        registro_tarea_id
    )

    if registro_tarea is None:
        raise exceptions.RegistroTareaNoEncontrado()

    # Buscamos el insumo químico nuevo
    insumo = db.get(
        InsumoQuimico,
        datos.insumo_quimico_id
    )

    if insumo is None:
        raise exceptions.InsumoQuimicoNoEncontrado()

    if not insumo.activo:
        raise exceptions.InsumoQuimicoInactivo()

    # Buscamos si esta tarea ya tenía un consumo registrado
    consumo_existente = db.scalar(
        select(ConsumoInsumoQuimico).where(
            ConsumoInsumoQuimico.registro_tarea_id
            == registro_tarea_id
        )
    )

    # ---------------------------------------------------------
    # CASO 1: LA TAREA TODAVÍA NO TENÍA CONSUMO
    # ---------------------------------------------------------
    if consumo_existente is None:

        if datos.cantidad > insumo.stock:
            raise exceptions.StockInsuficiente()

        consumo = ConsumoInsumoQuimico(
            registro_tarea_id=registro_tarea_id,
            insumo_quimico_id=datos.insumo_quimico_id,
            cantidad=datos.cantidad
        )

        # Descontamos el consumo del stock
        insumo.stock -= datos.cantidad

        db.add(consumo)

    # ---------------------------------------------------------
    # CASO 2: LA TAREA YA TENÍA CONSUMO
    # ---------------------------------------------------------
    else:
        consumo = consumo_existente

        # Si sigue utilizando el mismo producto químico
        if (
            consumo.insumo_quimico_id
            == datos.insumo_quimico_id
        ):
            diferencia = (
                datos.cantidad
                - consumo.cantidad
            )

            # Si aumentó la cantidad consumida,
            # verificamos que haya stock para la diferencia.
            if diferencia > 0:
                if diferencia > insumo.stock:
                    raise exceptions.StockInsuficiente()

                insumo.stock -= diferencia

            # Si redujo la cantidad consumida,
            # devolvemos la diferencia al stock.
            elif diferencia < 0:
                insumo.stock += abs(diferencia)

            consumo.cantidad = datos.cantidad

        # Si cambió el producto químico utilizado
        else:
            insumo_anterior = db.get(
                InsumoQuimico,
                consumo.insumo_quimico_id
            )

            # Primero verificamos que el nuevo producto
            # tenga suficiente stock.
            if datos.cantidad > insumo.stock:
                raise exceptions.StockInsuficiente()

            # Devolvemos al stock del producto anterior
            # la cantidad que había sido registrada.
            if insumo_anterior is not None:
                insumo_anterior.stock += consumo.cantidad

            # Descontamos del producto nuevo.
            insumo.stock -= datos.cantidad

            consumo.insumo_quimico_id = (
                datos.insumo_quimico_id
            )
            consumo.cantidad = datos.cantidad

    # ---------------------------------------------------------
    # GUARDADO
    # ---------------------------------------------------------
    if hacer_commit:
        db.commit()
        db.refresh(consumo)
        db.refresh(insumo)
    else:
        db.flush()

    return consumo


def obtener_consumo_acumulado(
    db: Session
) -> list[dict]:

    resultados = db.execute(
        select(
            InsumoQuimico.id,
            InsumoQuimico.nombre,
            InsumoQuimico.unidad_medida,
            func.sum(
                ConsumoInsumoQuimico.cantidad
            ).label("cantidad_total")
        )
        .join(
            ConsumoInsumoQuimico,
            ConsumoInsumoQuimico.insumo_quimico_id
            == InsumoQuimico.id
        )
        .group_by(
            InsumoQuimico.id,
            InsumoQuimico.nombre,
            InsumoQuimico.unidad_medida
        )
    ).all()

    return [
        {
            "insumo_quimico_id": resultado.id,
            "nombre": resultado.nombre,
            "unidad_medida": resultado.unidad_medida,
            "cantidad_total": resultado.cantidad_total
        }
        for resultado in resultados
    ]