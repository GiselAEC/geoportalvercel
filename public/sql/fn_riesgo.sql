-- Funcion: Verificar si un punto esta dentro de zona de lahar
CREATE OR REPLACE FUNCTION public.verificar_riesgo_lahar(p_lng double precision, p_lat double precision)
RETURNS TABLE(
    dentro_lahar boolean,
    nombre_lahar text,
    distancia_m double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ST_Intersects(
            l.geom,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
        ) AS dentro_lahar,
        l.descrip AS nombre_lahar,
        ST_DistanceSphere(
            l.geom,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
        ) AS distancia_m
    FROM public.laharestungurahua l
    ORDER BY ST_DistanceSphere(
        l.geom,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Funcion: Distancia minima a falla geologica
CREATE OR REPLACE FUNCTION public.verificar_riesgo_falla(p_lng double precision, p_lat double precision)
RETURNS TABLE(
    nombre_falla text,
    tipo_falla text,
    distancia_m double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.nam AS nombre_falla,
        f.tfll AS tipo_falla,
        ST_DistanceSphere(
            f.geom,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
        ) AS distancia_m
    FROM public.fallasbanos f
    ORDER BY ST_DistanceSphere(
        f.geom,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Funcion: Analisis completo de riesgo
CREATE OR REPLACE FUNCTION public.analizar_riesgo(p_lng double precision, p_lat double precision)
RETURNS TABLE(
    dentro_lahar boolean,
    nombre_lahar text,
    distancia_lahar_m double precision,
    nombre_falla text,
    tipo_falla text,
    distancia_falla_m double precision,
    nivel_riesgo text
) AS $$
DECLARE
    v_dentro boolean := false;
    v_nombre_lahar text := '';
    v_dist_lahar double precision := 999999;
    v_nombre_falla text := '';
    v_tipo_falla text := '';
    v_dist_falla double precision := 999999;
    v_nivel text := 'BAJO';
BEGIN
    -- Verificar lahar
    SELECT
        ST_Intersects(l.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)),
        l.descrip,
        ST_DistanceSphere(l.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    INTO v_dentro, v_nombre_lahar, v_dist_lahar
    FROM public.laharestungurahua l
    ORDER BY ST_DistanceSphere(l.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    LIMIT 1;

    -- Verificar falla
    SELECT
        f.nam,
        f.tfll,
        ST_DistanceSphere(f.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    INTO v_nombre_falla, v_tipo_falla, v_dist_falla
    FROM public.fallasbanos f
    ORDER BY ST_DistanceSphere(f.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    LIMIT 1;

    -- Determinar nivel de riesgo
    IF v_dentro THEN
        v_nivel := 'ALTO';
    ELSIF v_dist_lahar < 500 THEN
        v_nivel := 'ALTO';
    ELSIF v_dist_lahar < 1500 OR v_dist_falla < 200 THEN
        v_nivel := 'MEDIO';
    ELSE
        v_nivel := 'BAJO';
    END IF;

    RETURN QUERY SELECT
        v_dentro, v_nombre_lahar, v_dist_lahar,
        v_nombre_falla, v_tipo_falla, v_dist_falla,
        v_nivel;
END;
$$ LANGUAGE plpgsql;

-- Permisos para anon
GRANT EXECUTE ON FUNCTION public.verificar_riesgo_lahar(double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_riesgo_falla(double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.analizar_riesgo(double precision, double precision) TO anon;
