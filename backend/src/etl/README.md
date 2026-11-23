# Kesta — ETL Profeco (Actividad 5.1)

## Descripción

Se implementó un pipeline ETL en TypeScript para extraer, transformar y cargar precios de Profeco (QQP) en PostgreSQL, utilizando Morelia, Michoacán, como ciudad piloto.

Se incorporaron dos periodos de información:

| Archivo | Periodo | Registros |
|---|---|---:|
| `QQP_Morelia_2026.csv` | Enero–marzo 2026 | 68,330 |
| `QQP_Morelia_2026_2.csv` | Julio 2026 | 33,578 |

**Fuente:** https://datos.profeco.gob.mx/index.php#quien-precios

## Cambios realizados

- Procesamiento independiente de ambos archivos CSV.
- Selección del archivo mediante el parámetro `--archivo`.
- Normalización y vinculación de productos con el catálogo de Kesta.
- Prevención de duplicados mediante SHA-256.
- Conservación de fechas originales y trazabilidad de registros.
- Integración de 5,949 precios adicionales de julio de 2026.
- Verificación de datos en PostgreSQL y mediante la API REST.

## Ejecución para el equipo

Después de clonar el repositorio, ingresar a la carpeta `Backend`.

**1. Preparar el entorno**

```bash
npm ci
docker compose up -d
npm run db:migrate
```

Configurar el archivo `.env` y colocar los dos CSV dentro de `Backend/datos/`. Los archivos de datos no están incluidos en el repositorio.

**2. Cargar el catálogo inicial**

```bash
npx tsx src/etl/catalogo-profeco.ts
npx tsx src/etl/cargar-catalogo.ts --aplicar
```

**3. Cargar los precios**

```bash
npx tsx src/etl/cargar-profeco.ts --archivo QQP_Morelia_2026.csv --aplicar
npx tsx src/etl/cargar-profeco.ts --archivo QQP_Morelia_2026_2.csv --aplicar
```

**4. Iniciar el backend**

```bash
npm run dev
```

Verificar en `http://localhost:3000/health`.

## Resultados

| Indicador | Enero–marzo | Julio |
|---|---:|---:|
| Registros procesados | 68,330 | 33,578 |
| Precios cargados | 13,189 | 5,949 |
| Registros sin vincular | 54,060 | 27,141 |
| Descartados | 0 | 0 |

La prueba de idempotencia confirmó que volver a procesar los archivos no genera nuevos precios duplicados.

## Actividad 5.2 — Ingesta mediante API de Profeco

Se implementó la consulta directa a la API de Profeco para obtener y cargar precios de la canasta básica en Morelia, Michoacán, sin depender de archivos CSV.

### Comandos de ejecución

Ejecutar desde la carpeta `Backend`.

**1. Simulación (sin guardar cambios):**

```bash
npx tsx src/etl/cargar-profeco.ts --api
```

**2. Ejecución real (guarda registros nuevos en PostgreSQL):**

```bash
npm run etl:profeco
```

También puede ejecutarse directamente mediante:

```bash
npx tsx src/etl/cargar-profeco.ts --api --aplicar
```
La simulación confirmó que la extracción funciona y que el ETL identifica registros previamente almacenados, evitando duplicados.

### Consideraciones

El proceso conserva las fechas originales de Profeco y cancela la carga si falla alguna consulta. Las observaciones idénticas no se insertan nuevamente.