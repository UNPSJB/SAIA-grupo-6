import random
from faker import Faker

# Importamos tu configuración y modelos
from src.database import SessionLocal, engine
from src.models import ModeloBase
from src.personal.models import Personal
from src.Equipo.models import Equipo
from src.insumos.models import Insumo, TipoUnidad
#  AGREGUE
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.checklist.models import Checklist, RegistroTarea

# Esto asegura que las tablas existan en la BD antes de insertar
ModeloBase.metadata.create_all(bind=engine)

# Inicializamos Faker con datos de Argentina
fake = Faker('es_AR')

# Abrimos la sesión de la base de datos
db = SessionLocal()

try:
    print("⏳ Cargando 15 personas...")
    for _ in range(15):
        # Esta es la línea que faltaba: crea el DNI y lo guarda en la variable
        dni_generado = str(fake.unique.random_number(digits=8, fix_len=True))
        
        persona = Personal(
            nombre=fake.first_name(),
            apellido=fake.last_name(),
            # Usamos .unique para que no repita DNIs ni correos (tu BD pide que sean únicos)
            dni=str(fake.unique.random_number(digits=8, fix_len=True)),
            email=fake.unique.email(),
            # Generamos un teléfono realista que no supere los 15 caracteres
            telefono=fake.numerify('+5492804######'), 
            password=dni_generado, # Y usamos la MISMA variable como contraseña
            puede_operar=True,
            puede_administrar=True,
            activo=True
        )
        db.add(persona)

    print("⏳ Cargando 15 equipos...")
    for _ in range(15):
        equipo = Equipo(
            # Nombres tipo "Heladera 45" o "Balanza 12"
            nombre=f"{fake.word().capitalize()} {fake.random_int(1, 100)}",
            tipo=random.choice(["Heladera", "Horno", "Balanza", "Freidora", "Termómetro"]),
            ubicacion=f"Sector {fake.random_element(['A', 'B', 'C', 'Laboratorio', 'Cocina'])}",
            activo=True
        )
        db.add(equipo)

    print("⏳ Cargando 15 insumos...")
    for _ in range(15):
        insumo = Insumo(
            # Nombres únicos para que no salte el IntegrityError
            nombre=f"{fake.unique.word().capitalize()} {fake.random_int(1, 1000)}",
            tipo=random.choice(list(TipoUnidad))
        )
        db.add(insumo)

    # Impactamos los cambios en la base de datos
    db.commit()
    print("✅ ¡Datos cargados con éxito!")

except Exception as e:
    # Si algo falla, deshacemos para no romper la base
    db.rollback()
    print(f"❌ Error al cargar datos: {e}")

finally:
    # Siempre cerramos la sesión al terminar
    db.close()