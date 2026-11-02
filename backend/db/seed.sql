-- DATOS DE PRUEBA FICTICIOS para desarrollo. No usar en produccion.
-- Todos los usuarios tienen la contrasena indicada en `npm run db:seed` (Kesta1234!).

INSERT INTO ciudades (id, nombre, estado, centro) VALUES
  (1, 'Morelia', 'Michoacan', ST_SetSRID(ST_MakePoint(-101.1925, 19.7027), 4326)::geography);

INSERT INTO usuarios (id, nombre, email, password_hash, rol, ciudad_id) VALUES
  (1, 'Admin Kesta', 'admin@kesta.test', '__HASH__', 'admin', 1),
  (2, 'Moderadora Kesta', 'moderador@kesta.test', '__HASH__', 'moderador', 1),
  (3, 'Maria Lopez', 'maria@kesta.test', '__HASH__', 'usuario', 1),
  (4, 'Carlos Perez', 'carlos@kesta.test', '__HASH__', 'usuario', 1),
  (5, 'Ana Lopez', 'ana@kesta.test', '__HASH__', 'usuario', 1);

INSERT INTO categorias (id, nombre) VALUES (1, 'Abarrotes'), (2, 'Frutas y Verduras'), (3, 'Lacteos y huevo');
INSERT INTO marcas (id, nombre) VALUES (1, 'La Costena'), (2, 'Generico / Local'), (3, 'Alpura');
INSERT INTO unidades (id, nombre, abreviatura) VALUES (1, 'Kilogramo', 'kg'), (2, 'Litro', 'L'), (3, 'Pieza', 'pza');

INSERT INTO productos (id, nombre, categoria_id) VALUES
  (1, 'Aceite vegetal', 1), (2, 'Jitomate saladette', 2), (3, 'Leche entera', 3), (4, 'Huevo blanco', 3), (5, 'Frijol negro', 1);

INSERT INTO presentaciones (id, producto_id, marca_id, cantidad, unidad_id) VALUES
  (1, 1, 1, 1.00, 2),   -- Aceite La Costena 1 L
  (2, 2, 2, 1.00, 1),   -- Jitomate 1 kg
  (3, 3, 3, 1.00, 2),   -- Leche Alpura 1 L
  (4, 4, 2, 12.00, 3),  -- Huevo blanco 12 pza
  (5, 5, 2, 1.00, 1);   -- Frijol negro 1 kg

INSERT INTO comercios (id, nombre, tipo, subtipo) VALUES
  (1, 'Chedraui', 'Formal', 'supermercado'),
  (2, 'Tianguis del Pedregal', 'Informal', 'tianguis'),
  (3, 'Walmart', 'Formal', 'supermercado'),
  (4, 'Soriana', 'Formal', 'supermercado'),
  (5, 'Bodega Aurrera', 'Formal', 'bodega'),
  (6, 'Mercado Independencia', 'Informal', 'mercado_publico'),
  (7, 'Tianguis Nuevo (sin verificar)', 'Informal', 'tianguis');

INSERT INTO ubicaciones_comercio (id, comercio_id, direccion, ubicacion, estado_verificacion, fecha_verificacion, creado_por) VALUES
  (1, 1, 'Av. Acueducto #1000, Centro', ST_SetSRID(ST_MakePoint(-101.1925, 19.7027), 4326)::geography, 'Verificada', now(), NULL),
  (2, 2, 'Colonia El Pedregal, Morelia, Mich.', ST_SetSRID(ST_MakePoint(-101.2100, 19.7100), 4326)::geography, 'Verificada', now(), 3),
  (3, 3, 'Ubicacion de prueba Walmart', ST_SetSRID(ST_MakePoint(-101.1780, 19.7150), 4326)::geography, 'Verificada', now(), NULL),
  (4, 4, 'Ubicacion de prueba Soriana', ST_SetSRID(ST_MakePoint(-101.1850, 19.6900), 4326)::geography, 'Verificada', now(), NULL),
  (5, 5, 'Ubicacion de prueba Bodega Aurrera', ST_SetSRID(ST_MakePoint(-101.2000, 19.6950), 4326)::geography, 'Verificada', now(), NULL),
  (6, 6, 'Mercado Independencia, Centro', ST_SetSRID(ST_MakePoint(-101.1887, 19.7013), 4326)::geography, 'Verificada', now(), 4),
  (7, 7, 'Punto sin verificar', ST_SetSRID(ST_MakePoint(-101.1990, 19.7080), 4326)::geography, 'Pendiente', NULL, 5);

INSERT INTO fuentes (id, nombre, tipo) VALUES
  (1, 'Profeco QQP', 'profeco'),
  (2, 'Scraper Walmart', 'scraping'),
  (3, 'Scraper Soriana', 'scraping'),
  (4, 'Reporte comunitario', 'comunidad'),
  (5, 'Scraper Chedraui', 'scraping');

-- Precios de cadena (scraping): ubicacion_id NULL, aplican a todas las ubicaciones del comercio
INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion) VALUES
  (1, 1, NULL, 5, NULL, 45.50, now() - interval '1 day', 'Activo'),
  (1, 3, NULL, 2, NULL, 43.90, now() - interval '1 day', 'Activo'),
  (1, 4, NULL, 3, NULL, 46.20, now() - interval '2 days', 'Activo'),
  (2, 1, NULL, 5, NULL, 32.90, now() - interval '1 day', 'Activo'),
  (2, 3, NULL, 2, NULL, 29.90, now() - interval '1 day', 'Activo'),
  (2, 4, NULL, 3, NULL, 31.50, now() - interval '2 days', 'Activo'),
  (3, 1, NULL, 5, NULL, 28.50, now() - interval '1 day', 'Activo'),
  (3, 3, NULL, 2, NULL, 26.90, now() - interval '1 day', 'Activo'),
  (3, 4, NULL, 3, NULL, 27.80, now() - interval '2 days', 'Activo'),
  (3, 5, NULL, 2, NULL, 25.90, now() - interval '1 day', 'Activo'),
  (4, 1, NULL, 5, NULL, 62.00, now() - interval '1 day', 'Activo'),
  (4, 3, NULL, 2, NULL, 58.90, now() - interval '1 day', 'Activo'),
  (4, 4, NULL, 3, NULL, 61.00, now() - interval '2 days', 'Activo'),
  (5, 1, NULL, 5, NULL, 34.00, now() - interval '1 day', 'Activo'),
  (5, 3, NULL, 2, NULL, 31.50, now() - interval '1 day', 'Activo'),
  (5, 4, NULL, 3, NULL, 33.90, now() - interval '2 days', 'Activo');

-- Referencia Profeco vieja (queda marcada como desactualizada): el caso "QQP vs precio real en anaquel"
INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion) VALUES
  (4, 5, NULL, 1, NULL, 49.50, now() - interval '120 days', 'Activo');

-- Precios informales ya verificados por la comunidad
INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion) VALUES
  (1, 2, 2, 4, 3, 40.00, now() - interval '3 days', 'Activo'),
  (1, 6, 6, 4, 4, 41.50, now() - interval '4 days', 'Activo'),
  (2, 2, 2, 4, 3, 25.00, now() - interval '3 days', 'Activo'),
  (2, 6, 6, 4, 4, 26.50, now() - interval '4 days', 'Activo'),
  (4, 2, 2, 4, 3, 52.00, now() - interval '3 days', 'Activo'),
  (4, 6, 6, 4, 4, 54.00, now() - interval '4 days', 'Activo'),
  (5, 2, 2, 4, 3, 28.00, now() - interval '3 days', 'Activo'),
  (5, 6, 6, 4, 4, 29.00, now() - interval '4 days', 'Activo');

-- Historial de leche en Walmart
INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion) VALUES
  (3, 3, NULL, 2, NULL, 27.50, now() - interval '28 days', 'Activo'),
  (3, 3, NULL, 2, NULL, 27.90, now() - interval '21 days', 'Activo'),
  (3, 3, NULL, 2, NULL, 28.20, now() - interval '14 days', 'Activo'),
  (3, 3, NULL, 2, NULL, 27.10, now() - interval '7 days', 'Activo');

-- Un reporte comunitario pendiente de verificar (de Carlos, en el tianguis del Pedregal)
INSERT INTO precios (presentacion_id, comercio_id, ubicacion_id, fuente_id, usuario_id, precio, fecha_obtencion, estado_verificacion) VALUES
  (2, 2, 2, 4, 4, 24.00, now() - interval '2 hours', 'Pendiente');

-- Un alta de comercio pendiente de moderacion
INSERT INTO cola_moderacion (tipo, ubicacion_comercio_id, reportado_por) VALUES ('comercio', 7, 5);

-- Alinear secuencias con los ids explicitos
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id' AND column_default LIKE 'nextval%' LOOP
    EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, ''id''), COALESCE((SELECT max(id) FROM %I), 1))', r.table_name, r.table_name);
  END LOOP;
END $$;
