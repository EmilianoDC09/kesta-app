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

## Actividad 5.2 — Sincronización diaria con el buscador QQP

Los CSV de datos abiertos se publican con meses de retraso. El buscador público
https://qqp.profeco.gob.mx/ muestra precios de los últimos días y los obtiene de un endpoint JSON
(`/api/precios?clave_ciudad=1601&busqueda=<término>`) que responde sin credenciales.
La sincronización lo consulta una vez al día y guarda los precios en PostgreSQL; la app solo consulta la base.

**Es temporal:** se usa mientras Profeco responde la solicitud de acceso oficial. El endpoint no está
documentado y puede cambiar o bloquearse sin aviso.

### Comandos

Ejecutar desde la carpeta `Backend`, con las migraciones al día (`npm run db:migrate`, incluye la 005).

```bash
npm run etl:qqp:simular      # consulta, empareja y deshace: muestra qué cargaría
npm run etl:qqp              # carga real (también: npm run etl:profeco)
npx tsx src/etl/qqp-api/sincronizar.ts --desde-respaldo datos/qqp-api/<archivo>.json --aplicar   # reprocesar sin red
npx tsx src/etl/qqp-api/sincronizar.ts --terminos "huevo,arroz"   # solo esos términos
```

Cada extracción deja un respaldo crudo en `datos/qqp-api/` (ignorado por git).

Código de salida: `0` si todo salió bien; `1` si falló o si alguna búsqueda falló (carga parcial).
El programador de tareas debe alertar con ese código.

### Antes de la primera corrida: revertir la carga anterior por API

El extractor anterior (`extraer-profeco-api.ts`, retirado) dejó precios en sucursales duplicadas sin
coordenadas (invisibles en la app) y presentaciones como `1000 ml - entera` que mezclaban variedades.
La sincronización se niega a correr mientras esa ejecución siga vigente:

```bash
npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id 6             # simulación: lista lo que borraría
npx tsx src/etl/qqp-api/revertir-ejecucion.ts --id 6 --aplicar
```

Los precios de esas fechas vuelven a entrar con la siguiente sincronización si siguen en la ventana del buscador.

### Cómo funciona

| Etapa | Archivo | Decisión |
|---|---|---|
| Términos | `qqp-api/terminos.ts` | Nombre canónico de cada producto de `mapeo-canasta.json`. El buscador compara por prefijo del tipo, sin acentos. |
| Consulta | `qqp-api/cliente.ts` | 4 s entre búsquedas (límite del servidor: 60/min). Reintenta 429/5xx respetando `Retry-After`. Se identifica con `User-Agent` y `QQP_CONTACTO`. Valida cada elemento con zod. |
| Evaluación | `qqp-api/extraccion.ts` | No carga si falla más de la mitad de las búsquedas o si una centinela (huevo, leche, tortilla) llega vacía. |
| Producto | `canasta.ts` | `tipo_producto` debe ser un alias exacto del mapeo; el resto es ruido del buscador y no se guarda. |
| Presentación | `qqp-api/emparejar.ts` | Compara el **conjunto de palabras** del texto de la API contra «marca + descripción» del catálogo: `LALA. ENTERA, CAJA 1 LT.` = `Lala` + `Caja 1 Lt. Entera`. Ignora «granel» y las palabras del nombre del producto, que el buscador omite o repite en frutas y verduras (`1 KG. AGRIO CON SEMILLA O LIMON COLIMA` = `1 Kg. Granel. Agrio con Semilla o Colima`). Si no hay coincidencia exacta, solo crea un tamaño nuevo de un par producto-marca conocido; si ya existe esa marca con la misma cantidad escrita distinto, la manda a `productos_externos` para revisión en lugar de adivinar. |
| Sucursal | `qqp-api/emparejar.ts` | La API recorta la dirección y no trae coordenadas. Se liga con la sucursal del CSV cuyas palabras empiezan igual y tienen el mismo CP; prefiere la que tiene coordenadas. Si es nueva, se geocodifica con Google (rechaza resultados aproximados o a más de 30 km). |
| Precio | `qqp-api/sincronizar.ts` | Huella SHA-256 de los campos crudos; fecha = `fecha_observacion` de Profeco. |

Con textos reales del buscador (noviembre 2026), la firma emparejó 107 de 117 presentaciones
contra `catalogo_profeco.json`, sin ambigüedades. Los 10 restantes son marcas que no existen en Kesta
o variedades distintas (`Negro` frente a `Negro. Querétaro`).

### Programación diaria

El servidor que la ejecute debe estar encendido a diario y alcanzar la base de datos.

- **GitHub Actions** (requiere base accesible desde internet): plantilla en `deploy/qqp-diario.yml`.
- **Windows, mientras la base vive en Docker local:**

  ```bat
  schtasks /create /sc daily /st 07:17 /tn KestaQQP /tr "cmd /c cd /d <ruta>\backend && npm run etl:qqp >> datos\qqp-api\sync.log 2>&1"
  ```

  Solo corre si la computadora está encendida a esa hora.

### Consultas de seguimiento

```sql
-- Últimas ejecuciones y sus problemas
SELECT id, origen, estado, cargadas, sin_vincular, detalle->'terminos_fallidos' AS fallidos,
       detalle->'precios_sin_punto' AS sin_punto, error
FROM ejecuciones_ingesta WHERE tipo = 'profeco' ORDER BY id DESC LIMIT 10;

-- Pendientes de revisión que dejó la sincronización
SELECT pe.motivo, count(*)
FROM productos_externos pe JOIN ejecuciones_ingesta e ON e.id = pe.ejecucion_id
WHERE pe.estado = 'pendiente' AND e.origen = 'qqp.profeco.gob.mx/api/precios'
GROUP BY pe.motivo ORDER BY 2 DESC;
```
