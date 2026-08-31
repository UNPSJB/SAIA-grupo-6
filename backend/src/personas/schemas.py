from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List
from src import Mascota

# Los siguientes schemas contienen atributos sin muchas restricciones de tipo.
# Podemos crear atributos con ciertas reglas mediante el uso de un "Field" adecuado.
# https://docs.pydantic.dev/latest/concepts/fields/


class PersonaBase(BaseModel):
    nombre: str
    email: EmailStr


class PersonaCreate(PersonaBase):
    pass


class PersonaUpdate(PersonaBase):
    pass


class Persona(PersonaBase):
    id: int
    mascotas: List[Mascota]

    # from_atributes=True permite que Pydantic trabaje con modelos SQLAlchemy
    # más info.: https://docs.pydantic.dev/latest/api/config/#pydantic.config.ConfigDict.from_attributes
    model_config = ConfigDict(from_attributes= True)
