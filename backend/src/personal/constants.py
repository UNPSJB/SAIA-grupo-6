class ErrorCode:
    PERSONA_NO_ENCONTRADA = "El Personal solicitado no existe o fue dado de baja."
    DATO_DUPLICADO = "El DNI o Email ingresado ya se encuentra registrado en el sistema."
    DNI_DUPLICADO = "El DNI ingresado ya se encuentra registrado para otra persona activa."
    EMAIL_DUPLICADO = "El correo electrónico ingresado ya está en uso por otra persona activa."
    NOMBRE_INVALIDO = "El nombre no puede estar vacío y debe contener solo letras."
    DNI_INVALIDO = "El DNI debe contener entre 7 y 8 dígitos numéricos."
    EMAIL_INVALIDO = "El correo electrónico no tiene un formato válido."
