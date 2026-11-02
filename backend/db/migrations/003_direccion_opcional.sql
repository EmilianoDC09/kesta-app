-- CAT-07 / EXT-01: si la geocodificacion inversa de Google falla, el comercio informal se guarda con
-- coordenadas y SIN direccion (NULL) en lugar de inventar un texto o rechazar el alta.
-- Cambio sobre el esquema base documentado (direccion era NOT NULL): el equipo debe aprobarlo.
ALTER TABLE ubicaciones_comercio ALTER COLUMN direccion DROP NOT NULL;
