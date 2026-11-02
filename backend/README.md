# Kesta API

API REST (Node.js + Express + TypeScript) sobre PostgreSQL + PostGIS. Base URL de desarrollo: `http://localhost:3000/api/v1`.

## Arranque rapido

El backend lee **solo** `DATABASE_URL` (ver `src/config.ts`); no existen variables `DB_HOST`, `DB_PORT`, etc.

```bash
cp .env.example .env          # luego edita DATABASE_URL (usuario, contrasena y puerto) y JWT_SECRET
npm install
npm run db:migrate            # aplica db/migrations/*.sql (necesita las extensiones postgis y unaccent)
npm run db:seed               # SOLO desarrollo: borra todo y carga datos de prueba ficticios
npm run dev
npm test                      # pruebas de integracion; usan la base kesta_test (TEST_DATABASE_URL)
```

### Opcion A: PostgreSQL instalado en Windows (pgAdmin)

1. Instala PostGIS con Stack Builder (Spatial Extensions > PostGIS). `unaccent` ya viene incluida.
2. En pgAdmin crea las bases `kesta_bd` y `kesta_test`. El puerto real se confirma con `SHOW port;` en el Query Tool.
3. Pon ese puerto en `DATABASE_URL`. Para las pruebas, define `TEST_DATABASE_URL` (en PowerShell: `$env:TEST_DATABASE_URL="postgres://postgres:TU_PASSWORD@localhost:PUERTO/kesta_test"`).
4. No ejecutes `BD_KESTA.txt`: el esquema lo crean las migraciones. Si la base ya tiene tablas de ese script, recrea la base vacia antes de migrar.
5. Si el backend corre dentro de WSL y PostgreSQL en Windows, `localhost` no llega a Windows: activa `networkingMode=mirrored` en `.wslconfig`.

### Opcion B: Docker (mismo entorno para todo el equipo)

```bash
docker compose up -d          # PostgreSQL 16 + PostGIS en el puerto 5440, con kesta_bd y kesta_test
```

`DATABASE_URL=postgres://postgres:postgres@localhost:5440/kesta_bd` y `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5440/kesta_test`.

Usuarios de prueba (contrasena `Kesta1234!`): `admin@kesta.test`, `moderador@kesta.test`, `maria@kesta.test`, `carlos@kesta.test`, `ana@kesta.test`.
Centro de pruebas en Morelia: `lat=19.7027&lng=-101.1925`.

## Estructura

```
db/migrations/001_esquema_base.sql    esquema original (BD_KESTA)
db/migrations/002_extensiones_api.sql lo que el catalogo exige y el esquema no tenia
db/seed.sql                           datos de prueba
src/routes/                           un archivo por grupo del catalogo
src/services/precios.ts               consulta central de precios vigentes por zona
src/services/optimizador.ts           optimizacion de canasta (funciones puras)
src/services/alertas.ts, push.ts      evaluacion de alertas y envio FCM
tests/api.test.ts                     42 pruebas de integracion contra PostGIS
```

## Servicios implementados (IDs del catalogo)

| Grupo | Servicios |
|---|---|
| Auth | AUT-01 a AUT-05 |
| Catalogo y comercios | CAT-01 a CAT-07 (+ `GET /marcas`) |
| Precios | PRE-01 a PRE-04 |
| Canasta | CAN-01 a CAN-08 |
| Comunidad | COM-02 a COM-06 |
| Moderacion | MOD-01, MOD-02 |
| Alertas y push | ALE-01 a ALE-08 |

No implementados: COM-01 (foto de evidencia), ING-02/03/05/06 (scraping e ingesta: van en un proceso aparte), PRE-05, MOD-03, GAM-01/02 (Post-MVP), EXT-02 (Google Maps, matriz de distancias), EXT-05. EXT-01 (geocodificacion inversa) esta implementado.

## Decisiones que el equipo debe revisar

1. **Modelo de precios.** Un precio es un snapshot (nunca se actualiza el importe). El vigente es el mas reciente por presentacion, comercio y ubicacion. `precios.ubicacion_id` NULL = precio de cadena (scraping/Profeco, aplica a todas sus sucursales); con valor = observado en una ubicacion concreta.
2. **Reporte comunitario = fila de `precios` con estado `Pendiente`.** Se publica (`Activo`) con `VERIFICACION_CONFIRMACIONES` confirmaciones de usuarios distintos al autor (por defecto 2) o por aprobacion de un moderador. Con `VERIFICACION_REFUTACIONES` refutaciones pasa a la cola de moderacion. Los precios atipicos (<40% o >250% de la mediana de 30 dias) van directo a la cola.
3. **Visibilidad.** En CAT-05 (comercios cercanos) solo aparecen ubicaciones `Verificada`, formales o informales. En CAT-06, precios (PRE-*), canastas y COM-04 se mantiene la regla anterior: informal solo si esta `Verificada`; formal si no esta `Rechazada`. Esa diferencia es deliberada y debe revisarse (ver pendientes).
4. **Desactualizado.** Cada respuesta de precio trae `desactualizado` segun la antiguedad por tipo de fuente (`VIGENCIA_DIAS_*`). No se ocultan: se marcan.
5. **Comparacion formal vs informal** usa medianas, no promedios, y avisa cuando falta uno de los canales.
6. **Roles**: `usuario`, `moderador`, `admin` (el seed original usaba `Consumidor`/`Verificador`).
7. **Refresh tokens** opacos, guardados como hash y rotados; reusar uno revocado invalida todas las sesiones del usuario.
8. **No se agrego la columna `verificado`** que pedia la carta: `ubicaciones_comercio.estado_verificacion` ya la cubre.
9. **Direccion de comercios informales (CAT-07 + EXT-01).** La obtiene el servidor con geocodificacion inversa de Google; la app ya no la envia. Si Google no responde (timeout `GEOCODING_TIMEOUT_MS`, error, sin resultados o sin `GOOGLE_MAPS_API_KEY`), el comercio se guarda con coordenadas y `direccion = NULL`. Para permitirlo, la migracion `003` quita el `NOT NULL` de `ubicaciones_comercio.direccion` (cambio al esquema base). El cliente debe tratar `direccion` como opcional en CAT-05, CAT-06, PRE-01, CAN-08, COM-04 y MOD-01.
10. **Coordenadas de CAT-07** deben caer dentro de una caja que contiene a Mexico (lat 14 a 33, lng -119 a -86); fuera de ella responde 422. Evita altas con 0,0 y llamadas inutiles a Google.

## Pendiente antes de produccion

- Probar `push.ts` contra un proyecto Firebase real (no esta probado) y cargar la clave APNs para iOS.
- Clave de Google: crear una clave de servidor solo con "Geocoding API" habilitada y restringida por IP (la API de geocodificacion no admite restriccion por app ni referrer), distinta de la clave del SDK de mapas de la app. Fijar cuota y alerta de gasto en Google Cloud.
- Direcciones en `NULL`: no hay proceso que las complete despues. Un job que reintente la geocodificacion de las ubicaciones sin direccion es trabajo pendiente.
- Unificar la regla de visibilidad de ubicaciones formales (CAT-05 exige `Verificada`; el resto acepta `Pendiente`). El pipeline de scraping debe crear las sucursales formales como `Verificada`, o no saldran en CAT-05.
- Duplicados: dos usuarios pueden dar de alta el mismo tianguis; hoy lo resuelve el moderador a mano.
- Subida de fotos (COM-01): requiere definir almacenamiento.
- Contrato OpenAPI para generar los modelos del cliente Ktor y el catalogo `formato_servicios`.
- Normalizacion de productos entre fuentes: el API compara por `presentacion_id`; vincular el catalogo de cada retailer a una presentacion es trabajo del pipeline.
- Paginacion/limites ajustados con datos reales; indices revisados con `EXPLAIN` cuando haya volumen.
