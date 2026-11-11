-- ============================================
-- 1. VARIANTES DE PRESENTACIONES
-- ============================================

ALTER TABLE presentaciones
ADD COLUMN descripcion TEXT;

-- ============================================
-- 2. REGISTRO DE EJECUCIONES DE INGESTA
-- ============================================

CREATE TABLE ejecuciones_ingesta (
    id SERIAL PRIMARY KEY,

    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN (
            'profeco',
            'scraping',
            'manual'
        )),

    origen TEXT NOT NULL,

    inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fin TIMESTAMPTZ,

    estado VARCHAR(20) NOT NULL DEFAULT 'en_proceso'
        CHECK (estado IN (
            'en_proceso',
            'completada',
            'fallida'
        )),

    leidas INTEGER NOT NULL DEFAULT 0
        CHECK (leidas >= 0),

    cargadas INTEGER NOT NULL DEFAULT 0
        CHECK (cargadas >= 0),

    duplicadas INTEGER NOT NULL DEFAULT 0
    CHECK (duplicadas >= 0),

    sin_vincular INTEGER NOT NULL DEFAULT 0
        CHECK (sin_vincular >= 0),

    descartadas INTEGER NOT NULL DEFAULT 0
        CHECK (descartadas >= 0),

    detalle JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

   CHECK (
    estado <> 'completada'
        OR leidas = cargadas + duplicadas
         + sin_vincular + descartadas
    )
);

-- ============================================
-- 3. IDEMPOTENCIA DE PRECIOS
-- ============================================

ALTER TABLE precios
ADD COLUMN clave_origen TEXT;

ALTER TABLE precios
ADD COLUMN ejecucion_id INTEGER
REFERENCES ejecuciones_ingesta(id);

CREATE UNIQUE INDEX uq_precios_clave_origen
ON precios (clave_origen);

CREATE INDEX idx_precios_ejecucion
ON precios (ejecucion_id);

-- ============================================
-- 4. PRODUCTOS EXTERNOS SIN VINCULAR
-- ============================================

CREATE TABLE productos_externos (
    id SERIAL PRIMARY KEY,

    ejecucion_id INTEGER NOT NULL
        REFERENCES ejecuciones_ingesta(id),

    fuente_id INTEGER NOT NULL
        REFERENCES fuentes(id),

    clave_origen TEXT NOT NULL UNIQUE,

    producto TEXT NOT NULL,
    marca TEXT,
    presentacion TEXT,
    categoria TEXT,

    precio NUMERIC(10,2) NOT NULL
        CHECK (precio > 0),

    fecha_obtencion TIMESTAMP NOT NULL,

    comercio TEXT,
    sucursal TEXT,
    direccion TEXT,

    latitud DOUBLE PRECISION,
    longitud DOUBLE PRECISION,

    motivo TEXT NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN (
            'pendiente',
            'vinculado',
            'rechazado'
        )),

    presentacion_id INTEGER
        REFERENCES presentaciones(id),

    datos_originales JSONB NOT NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    vinculado_en TIMESTAMPTZ,

    vinculado_por INTEGER
        REFERENCES usuarios(id)
);

CREATE INDEX idx_externos_estado
ON productos_externos (estado);

CREATE INDEX idx_externos_ejecucion
ON productos_externos (ejecucion_id);

-- ============================================
-- 5. REGISTRO DE FILAS DESCARTADAS
-- ============================================

CREATE TABLE descartes_ingesta (
    id SERIAL PRIMARY KEY,

    ejecucion_id INTEGER NOT NULL
        REFERENCES ejecuciones_ingesta(id),

    clave_origen TEXT,

    motivo TEXT NOT NULL,

    datos_originales JSONB NOT NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_descartes_ejecucion
ON descartes_ingesta (ejecucion_id);