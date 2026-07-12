CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.reportes_ciudadanos (
    id SERIAL PRIMARY KEY,
    tipo_problema TEXT NOT NULL,
    comentario TEXT,
    nombre TEXT,
    telefono TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT now(),
    estado TEXT DEFAULT 'pendiente',
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_reportes_geom ON public.reportes_ciudadanos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON public.reportes_ciudadanos (estado);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON public.reportes_ciudadanos (fecha DESC);

ALTER TABLE public.reportes_ciudadanos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reportes_select" ON public.reportes_ciudadanos FOR SELECT USING (true);
CREATE POLICY "reportes_insert" ON public.reportes_ciudadanos FOR INSERT WITH CHECK (true);
CREATE POLICY "reportes_update" ON public.reportes_ciudadanos FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "reportes_delete" ON public.reportes_ciudadanos FOR DELETE USING (auth.role() = 'service_role');

GRANT SELECT ON public.reportes_ciudadanos TO anon;
GRANT INSERT ON public.reportes_ciudadanos TO anon;
