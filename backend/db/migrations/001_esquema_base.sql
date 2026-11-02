-- Esquema base de Kesta (15 tablas). Tomado de BD_KESTA.txt sin CREATE DATABASE ni datos de prueba.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rol VARCHAR(20) NOT NULL
);

CREATE TABLE reputacion_usuarios (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    puntuacion DECIMAL(5,2) DEFAULT 0.00,
    verificaciones_realizadas INT DEFAULT 0
);

CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE marcas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE unidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    abreviatura VARCHAR(10) NOT NULL
);

CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    categoria_id INT REFERENCES categorias(id)
);

CREATE TABLE presentaciones (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES productos(id),
    marca_id INT REFERENCES marcas(id),
    cantidad DECIMAL(10,2) NOT NULL,
    unidad_id INT REFERENCES unidades(id)
);

CREATE TABLE comercios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(150) NOT NULL
);

CREATE TABLE ubicaciones_comercio (
    id SERIAL PRIMARY KEY,
    comercio_id INT REFERENCES comercios(id),
    direccion TEXT NOT NULL,
    ubicacion GEOGRAPHY(Point, 4326),
    estado_verificacion VARCHAR(20) DEFAULT 'Pendiente',
    fecha_verificacion TIMESTAMP
);

CREATE TABLE fuentes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL
);

CREATE TABLE precios (
    id SERIAL PRIMARY KEY,
    presentacion_id INT REFERENCES presentaciones(id),
    comercio_id INT REFERENCES comercios(id),
    fuente_id INT REFERENCES fuentes(id),
    usuario_id INT REFERENCES usuarios(id),
    precio DECIMAL(10,2) NOT NULL,
    fecha_obtencion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_verificacion VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE verificaciones_precio (
    id SERIAL PRIMARY KEY,
    precio_id INT REFERENCES precios(id),
    usuario_id INT REFERENCES usuarios(id),
    resultado VARCHAR(20) NOT NULL,
    fecha_verificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verificaciones_ubicacion (
    id SERIAL PRIMARY KEY,
    ubicacion_comercio_id INT REFERENCES ubicaciones_comercio(id),
    usuario_id INT REFERENCES usuarios(id),
    resultado VARCHAR(20) NOT NULL,
    fecha_verificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE canastas (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    nombre VARCHAR(100) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE canasta_productos (
    id SERIAL PRIMARY KEY,
    canasta_id INT REFERENCES canastas(id) ON DELETE CASCADE,
    presentacion_id INT REFERENCES presentaciones(id),
    cantidad DECIMAL(10,2) NOT NULL
);
