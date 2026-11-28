-- ============================================
-- Trazabilidad de lo que crea cada ingesta
-- ============================================
-- La sincronizacion con el buscador QQP puede crear presentaciones y ubicaciones. Guardar que ejecucion las creo
-- permite revertir una carga sin adivinar (src/etl/qqp-api/revertir-ejecucion.ts).

ALTER TABLE presentaciones
    ADD COLUMN creada_por_ejecucion INTEGER REFERENCES ejecuciones_ingesta(id);

ALTER TABLE ubicaciones_comercio
    ADD COLUMN creada_por_ejecucion INTEGER REFERENCES ejecuciones_ingesta(id);

-- ============================================
-- Estado 'revertida' para ejecuciones deshechas
-- ============================================
-- Se busca el CHECK por su definicion porque 004 lo creo sin nombre explicito.
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'ejecuciones_ingesta'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%en_proceso%'
    LOOP
        EXECUTE format('ALTER TABLE ejecuciones_ingesta DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE ejecuciones_ingesta
    ADD CONSTRAINT ejecuciones_ingesta_estado_chk
    CHECK (estado IN ('en_proceso', 'completada', 'fallida', 'revertida'));
