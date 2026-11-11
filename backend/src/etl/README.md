# Kesta — ETL Profeco (Actividad 5.1)

## Descripción

Pipeline ETL desarrollado en TypeScript para extraer,
transformar y cargar precios reales de Profeco en la
base de datos PostgreSQL de Kesta.

La ciudad piloto es Morelia, Michoacán.

## Fuente de información

- Profeco: Quién es Quién en los Precios (QQP).
- https://datos.profeco.gob.mx/index.php#quien-precios
- Archivo: QQP_Morelia_2026.csv.
- Periodo: 02/01/2026 al 31/03/2026.

## Requisitos

- Node.js 20 o superior.
- Docker Desktop.
- PostgreSQL con PostGIS.
- Dependencias instaladas mediante npm ci.
- Archivo .env configurado.
- Migraciones de base de datos aplicadas.

## Estructura principal

| Archivo | Función |
|---|---|
| extraer.ts | Lectura del CSV |
| transformar.ts | Validación y limpieza |
| unidades.ts | Normalización de presentaciones |
| canasta.ts | Selección de productos |
| mapeo-canasta.json | Productos canónicos y alias |
| catalogo-profeco.ts | Generación del catálogo |
| cargar-catalogo.ts | Carga del catálogo |
| mapear.ts | Vinculación y creación de presentaciones |
| cargar-profeco.ts | Ingesta de precios |
| probar-mapeo.ts | Prueba de creación automática |

## Instrucciones de ejecución

Ejecutar desde el directorio Backend.

1. Iniciar PostgreSQL:

   docker compose up -d

2. Instalar dependencias:

   npm ci

3. Aplicar migraciones:

   npm run db:migrate

4. Colocar el archivo QQP_Morelia_2026.csv
   dentro de la carpeta datos/.

5. Generar el catálogo:

   npx tsx src/etl/catalogo-profeco.ts

6. Simular la carga del catálogo:

   npx tsx src/etl/cargar-catalogo.ts

7. Guardar el catálogo:

   npx tsx src/etl/cargar-catalogo.ts --aplicar

8. Simular la ingesta de precios:

   npx tsx src/etl/cargar-profeco.ts

9. Ejecutar la ingesta definitiva:

   npx tsx src/etl/cargar-profeco.ts --aplicar

## Resultados obtenidos

| Indicador | Total |
|---|---:|
| Registros procesados | 68330 |
| Productos canónicos | 34 |
| Categorías | 21 |
| Marcas | 133 |
| Unidades | 4 |
| Presentaciones | 430 |
| Precios cargados | 13189 |
| Comercios | 12 |
| Ubicaciones comerciales | 30 |
| Registros externos | 54060 |
| Duplicados iniciales | 1081 |
| Descartes | 0 |

## Prueba de idempotencia

Se ejecutó dos veces el pipeline con el mismo archivo.

| Indicador | Primera ejecución | Segunda ejecución |
|---|---:|---:|
| Leídas | 68330 | 68330 |
| Cargadas | 13189 | 0 |
| Duplicadas | 1081 | 68330 |
| Sin vincular nuevos | 54060 | 0 |
| Descartadas | 0 | 0 |

La segunda ejecución no generó precios ni registros
externos duplicados.

## Creación automática de presentaciones

El sistema permite crear presentaciones cuando el
producto, la marca asociada y la unidad están
reconocidos en el catálogo.

Prueba:

    npx tsx src/etl/probar-mapeo.ts

Resultados:

- Creación automática: correcta.
- Prevención de duplicados: correcta.
- Reversión de datos de prueba: correcta.

## Trazabilidad

La migración 004_ingesta_comun.sql incorpora las
estructuras necesarias para registrar ejecuciones,
productos externos, descartes y claves de origen.

Se utiliza SHA-256 para identificar observaciones
y evitar registros duplicados.

## Limitaciones y consideraciones

- Los precios importados son históricos.
- Se conservan las fechas originales de Profeco.
- Existen 76 registros con presentaciones ambiguas.
- Los productos fuera del mapeo se conservan en
  productos_externos.
- El catálogo y sus alias requieren revisión del equipo.
- La integridad del archivo original debe verificarse.
- La clasificación de comercios y las decisiones de
  integración requieren validación del equipo.
- Los archivos de datos y las credenciales no se
  incluyen en el repositorio.

## Estado

Pipeline implementado y probado localmente.

Rama de desarrollo: feature/profeco-etl.

Pendiente de revisión e integración con el equipo.