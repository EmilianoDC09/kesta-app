-- Cambios que el catalogo de servicios exige y el esquema base no cubre.
-- Migracion aparte para que el diff contra el esquema base sea revisable por el equipo.

-- Ciudades piloto (CAT-01) y datos de perfil (AUT-05)
CREATE TABLE ciudades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    estado VARCHAR(100),
    centro GEOGRAPHY(Point, 4326) NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE usuarios
    ADD COLUMN ciudad_id INT REFERENCES ciudades(id),
    ADD COLUMN radio_busqueda_km DECIMAL(5,2) NOT NULL DEFAULT 3,
    ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    ADD CONSTRAINT usuarios_rol_chk CHECK (rol IN ('usuario', 'moderador', 'admin')),
    ADD CONSTRAINT usuarios_estado_chk CHECK (estado IN ('activo', 'suspendido'));

-- Sesiones (AUT-02..04): el refresh token se guarda como hash, nunca en claro
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    revocado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comercios y ubicaciones: datos que pide CAT-07
ALTER TABLE comercios
    ADD COLUMN subtipo VARCHAR(50),
    ADD CONSTRAINT comercios_tipo_chk CHECK (tipo IN ('Formal', 'Informal'));

-- No se agrega la columna "verificado" que pedia la carta: estado_verificacion ya la cubre.
ALTER TABLE ubicaciones_comercio
    ADD COLUMN mercado VARCHAR(150),
    ADD COLUMN referencia TEXT,
    ADD COLUMN creado_por INT REFERENCES usuarios(id),
    ADD CONSTRAINT ubicaciones_estado_chk CHECK (estado_verificacion IN ('Pendiente', 'Verificada', 'Rechazada'));
CREATE INDEX idx_ubicaciones_geo ON ubicaciones_comercio USING GIST (ubicacion);
CREATE INDEX idx_ubicaciones_comercio ON ubicaciones_comercio (comercio_id);

-- Precios: un reporte comunitario es una fila 'Pendiente' que se publica ('Activo') al verificarse.
-- ubicacion_id NULL = precio de cadena (scraping/Profeco); con valor = observado en una ubicacion concreta.
ALTER TABLE precios
    ADD COLUMN ubicacion_id INT REFERENCES ubicaciones_comercio(id),
    ADD CONSTRAINT precios_estado_chk CHECK (estado_verificacion IN ('Pendiente', 'Activo', 'Rechazado')),
    ADD CONSTRAINT precios_precio_chk CHECK (precio > 0);
CREATE INDEX idx_precios_vigente ON precios (presentacion_id, comercio_id, fecha_obtencion DESC);
CREATE INDEX idx_precios_estado ON precios (estado_verificacion);
CREATE INDEX idx_precios_usuario ON precios (usuario_id);

-- Verificaciones comunitarias (COM-05): un voto por usuario por precio
ALTER TABLE verificaciones_precio
    ADD COLUMN precio_observado DECIMAL(10,2),
    ADD COLUMN comentario TEXT,
    ADD CONSTRAINT verif_precio_resultado_chk CHECK (resultado IN ('confirma', 'refuta')),
    ADD CONSTRAINT verif_precio_unica UNIQUE (precio_id, usuario_id);

ALTER TABLE canasta_productos
    ADD CONSTRAINT canasta_producto_unico UNIQUE (canasta_id, presentacion_id),
    ADD CONSTRAINT canasta_cantidad_chk CHECK (cantidad > 0);

-- Cola de moderacion (COM-06, MOD-01, MOD-02, CAT-07)
CREATE TABLE cola_moderacion (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('reporte_precio', 'comercio', 'reporte_error')),
    precio_id INT REFERENCES precios(id) ON DELETE CASCADE,
    ubicacion_comercio_id INT REFERENCES ubicaciones_comercio(id) ON DELETE CASCADE,
    reportado_por INT REFERENCES usuarios(id),
    motivo VARCHAR(50),
    comentario TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resuelto_por INT REFERENCES usuarios(id),
    resuelto_en TIMESTAMP,
    motivo_resolucion TEXT
);
CREATE INDEX idx_cola_estado ON cola_moderacion (estado, creado_en);
CREATE UNIQUE INDEX uq_cola_reporte_precio ON cola_moderacion (precio_id) WHERE tipo = 'reporte_precio' AND estado = 'pendiente';
CREATE UNIQUE INDEX uq_cola_error_usuario ON cola_moderacion (precio_id, reportado_por) WHERE tipo = 'reporte_error' AND estado = 'pendiente';

-- Alertas y push (ALE-01..08)
CREATE TABLE dispositivos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plataforma VARCHAR(10) NOT NULL CHECK (plataforma IN ('android', 'ios')),
    fcm_token TEXT NOT NULL UNIQUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alertas_precio (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    presentacion_id INT NOT NULL REFERENCES presentaciones(id),
    precio_objetivo DECIMAL(10,2) NOT NULL CHECK (precio_objetivo > 0),
    centro GEOGRAPHY(Point, 4326) NOT NULL,
    radio_km DECIMAL(5,2) NOT NULL DEFAULT 5 CHECK (radio_km > 0),
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_precio_notificado DECIMAL(10,2),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alertas_activas ON alertas_precio (presentacion_id) WHERE activa;

CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    alerta_id INT REFERENCES alertas_precio(id) ON DELETE SET NULL,
    titulo VARCHAR(150) NOT NULL,
    cuerpo TEXT NOT NULL,
    fecha_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notificaciones_usuario ON notificaciones (usuario_id, fecha_envio DESC);
