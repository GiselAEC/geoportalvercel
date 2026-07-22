// app.js v2.1 — Geoportal Banos (Riesgo client-side + capas integradas)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// ===== Mapa =====

const map = L.map('map', {
    center: [-1.3928, -78.4364],
    zoom: 14,
    zoomControl: false
});

L.control.zoom({ position: 'topright' }).addTo(map);

// ===== Basemaps =====

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19
});
const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenTopoMap', maxZoom: 17
});
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri', maxZoom: 18
});
const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google', maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3']
});
const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google', maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3']
});
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB', maxZoom: 19
});
const terrainLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google', maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3']
});

osmLayer.addTo(map);

L.control.layers({
    'OpenStreetMap': osmLayer, 'Topografico': topoLayer,
    'Satelite (Esri)': satLayer, 'Satelite (Google)': googleSat,
    'Hibrido (Google)': googleHybrid, 'Terreno (Google)': terrainLayer,
    'Oscuro': darkLayer
}, null, { collapsed: true, position: 'topright' }).addTo(map);

// ===== Configuracion de capas =====

const capasConfig = {
    cantonbanos: {
        nombre: 'Canton Banos', color: '#2196f3', fillOpacity: 0.15, weight: 2.5,
        camposPopup: ['can_descri','pro_descri','region','can_codigo','pro_codigo','area','perimeter'],
        camposLabels: { can_descri:'Canton', pro_descri:'Provincia', region:'Region', can_codigo:'Codigo Canton', pro_codigo:'Codigo Provincia', area:'Area', perimeter:'Perimetro' },
        orden: 1
    },
    laharestungurahua: {
        nombre: 'Lahares Tungurahua', color: '#f44336', fillOpacity: 0.3, weight: 2,
        camposPopup: ['descrip','volcan','dxf_text','area','perimeter'],
        camposLabels: { descrip:'Descripcion', volcan:'Volcan', dxf_text:'Referencia', area:'Area', perimeter:'Perimetro' },
        orden: 2
    },
    fallasbanos: {
        nombre: 'Fallas Geologicas', color: '#ff9800', weight: 3, dashArray: '8, 4',
        camposPopup: ['nam','tfll','shape_leng'],
        camposLabels: { nam:'Nombre', tfll:'Tipo Falla', shape_leng:'Longitud' },
        orden: 3
    },
    viasbanos: {
        nombre: 'Vias', color: '#4caf50', weight: 2.5,
        camposPopup: ['gid','length'],
        camposLabels: { gid:'ID', length:'Longitud' },
        orden: 4
    },
    casasbanos: {
        nombre: 'Casas / Edificaciones', color: '#9c27b0',
        camposPopup: ['nam','descripcio','fcode','acc_desc','txt'],
        camposLabels: { nam:'Nombre', descripcio:'Descripcion', fcode:'Codigo', acc_desc:'Acceso', txt:'Texto' },
        orden: 5
    },
    reportes_ciudadanos: {
        nombre: 'Reportes Ciudadanos', color: '#92400e',
        camposPopup: ['id','tipo_problema','comentario','nombre','telefono','fecha'],
        camposLabels: { id:'Numero', tipo_problema:'Tipo de Problema', comentario:'Comentario', nombre:'Nombre', telefono:'Telefono', fecha:'Fecha' },
        orden: 6
    },
    zonas_riesgo: {
        nombre: 'Zonas de Riesgo',
        orden: 7
    }
};

// ===== Estado =====

let capasActivas = {};
let capasCargadas = {};
let datosGeologia = { lahares: [], fallas: [] };
let modoAnalisis = false;
let marcadorAnalisis = null;

// ===== Funciones de UI =====

function toggleLayer(nombre) {
    var toggle = document.getElementById('toggle-' + nombre);
    if (capasActivas[nombre]) {
        delete capasActivas[nombre];
        toggle.classList.remove('on');
        document.querySelector('.layer-card[data-layer="' + nombre + '"]').classList.remove('active');
        if (capasCargadas[nombre]) {
            map.removeLayer(capasCargadas[nombre]);
            delete capasCargadas[nombre];
        }
    } else {
        capasActivas[nombre] = true;
        toggle.classList.add('on');
        document.querySelector('.layer-card[data-layer="' + nombre + '"]').classList.add('active');
    }
}

function status(msg) {
    document.getElementById('status-bar').innerHTML = '<i class="fas fa-info-circle"></i> ' + msg;
}

function showLoading(show) {
    var bar = document.getElementById('loading-bar');
    if (show) { bar.style.width = '30%'; bar.classList.add('visible'); }
    else {
        bar.style.width = '100%';
        setTimeout(function() { bar.classList.remove('visible'); bar.style.width = '0'; }, 400);
    }
}

// ======================================================================
// ===== GEOMETRIA CLIENT-SIDE =====
// ======================================================================

function pointInRing(point, ring) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1];
        var xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function pointInPolygon(point, polygon) {
    if (polygon.length === 0) return false;
    if (!pointInRing(point, polygon[0])) return false;
    for (var i = 1; i < polygon.length; i++) {
        if (pointInRing(point, polygon[i])) return false;
    }
    return true;
}

function pointInGeom(point, geom) {
    if (!geom || !geom.type || !geom.coordinates) return false;
    if (geom.type === 'Polygon') {
        return pointInPolygon(point, geom.coordinates);
    }
    if (geom.type === 'MultiPolygon') {
        for (var i = 0; i < geom.coordinates.length; i++) {
            if (pointInPolygon(point, geom.coordinates[i])) return true;
        }
        return false;
    }
    return false;
}

function distToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px-ax)*(px-ax) + (py-ay)*(py-ay));
    var t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
    var projX = ax + t * dx, projY = ay + t * dy;
    return Math.sqrt((px-projX)*(px-projX) + (py-projY)*(py-projY));
}

function distToLineString(point, coords) {
    var minDist = Infinity;
    for (var i = 0; i < coords.length - 1; i++) {
        var d = distToSegment(point[0], point[1], coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

function distToGeom(point, geom) {
    if (!geom || !geom.type || !geom.coordinates) return Infinity;
    if (geom.type === 'LineString') {
        return distToLineString(point, geom.coordinates);
    }
    if (geom.type === 'MultiLineString') {
        var min = Infinity;
        for (var i = 0; i < geom.coordinates.length; i++) {
            var d = distToLineString(point, geom.coordinates[i]);
            if (d < min) min = d;
        }
        return min;
    }
    return Infinity;
}

function gradosAMetros(g) { return g * 111320; }

function analizarRiesgoPunto(lng, lat) {
    var point = [lng, lat];
    var dentroLahar = false;
    var nombreLahar = '';
    var distLahar = Infinity;

    for (var i = 0; i < datosGeologia.lahares.length; i++) {
        var l = datosGeologia.lahares[i];
        if (pointInGeom(point, l.geom)) {
            dentroLahar = true;
            nombreLahar = l.descrip || l.volcan || 'Lahar';
            distLahar = 0;
            break;
        }
    }

    if (!dentroLahar) {
        for (var i = 0; i < datosGeologia.lahares.length; i++) {
            var l = datosGeologia.lahares[i];
            var ringCoords = null;
            if (l.geom.type === 'Polygon') ringCoords = l.geom.coordinates[0];
            else if (l.geom.type === 'MultiPolygon' && l.geom.coordinates.length > 0) ringCoords = l.geom.coordinates[0][0];
            if (ringCoords) {
                var minD = Infinity;
                for (var j = 0; j < ringCoords.length - 1; j++) {
                    var d = distToSegment(lng, lat, ringCoords[j][0], ringCoords[j][1], ringCoords[j+1][0], ringCoords[j+1][1]);
                    if (d < minD) minD = d;
                }
                if (minD < distLahar) { distLahar = minD; nombreLahar = l.descrip || ''; }
            }
        }
        distLahar = gradosAMetros(distLahar);
    }

    var nombreFalla = '';
    var tipoFalla = '';
    var distFalla = Infinity;

    for (var i = 0; i < datosGeologia.fallas.length; i++) {
        var f = datosGeologia.fallas[i];
        var d = distToGeom(point, f.geom);
        if (d < distFalla) {
            distFalla = d;
            nombreFalla = f.nam || '';
            tipoFalla = f.tfll || '';
        }
    }
    distFalla = gradosAMetros(distFalla);

    var nivel = 'BAJO';
    if (dentroLahar || distLahar < 500) nivel = 'ALTO';
    else if (distLahar < 1500 || distFalla < 200) nivel = 'MEDIO';

    return {
        dentro_lahar: dentroLahar,
        nombre_lahar: nombreLahar,
        distancia_lahar_m: distLahar === Infinity ? null : Math.round(distLahar),
        nombre_falla: nombreFalla,
        tipo_falla: tipoFalla,
        distancia_falla_m: distFalla === Infinity ? null : Math.round(distFalla),
        nivel_riesgo: nivel
    };
}

// ======================================================================
// ===== CARGA DE CAPAS =====
// ======================================================================

async function cargarTodasLasCapas() {
    if (!SUPABASE_URL || !SUPABASE_KEY) { status('Error: Variables de entorno no configuradas'); return; }

    var tablas = Object.keys(capasActivas);
    if (tablas.length === 0) { status('Selecciona al menos una capa'); return; }

    var btn = document.getElementById('btn-cargar');
    btn.disabled = true;
    showLoading(true);

    for (var t in capasCargadas) { map.removeLayer(capasCargadas[t]); }
    capasCargadas = {};

    var bounds = L.latLngBounds();
    var cargadas = 0;
    var orden = tablas.sort(function(a, b) { return (capasConfig[a].orden || 99) - (capasConfig[b].orden || 99); });

    for (var i = 0; i < orden.length; i++) {
        var tabla = orden[i];
        var cfg = capasConfig[tabla];

        if (tabla === 'zonas_riesgo') {
            status('Cargando Zonas de Riesgo (' + (i+1) + '/' + orden.length + ')...');
            document.getElementById('loading-bar').style.width = ((i+1)/orden.length*100)+'%';
            try {
                var capa = await cargarZonasRiesgo();
                if (capa) {
                    capa.addTo(map);
                    capasCargadas['zonas_riesgo'] = capa;
                    cargadas++;
                }
            } catch(err) { console.warn('Error cargando zonas de riesgo: ' + err.message); }
            continue;
        }

        status('Cargando ' + cfg.nombre + ' (' + (i+1) + '/' + orden.length + ')...');
        document.getElementById('loading-bar').style.width = ((i+1)/orden.length*100)+'%';

        try {
            var capa = await cargarTabla(tabla, cfg);
            if (capa) {
                capa.addTo(map);
                capasCargadas[tabla] = capa;
                capa.eachLayer(function(l) {
                    if (l.getBounds) { try { bounds.extend(l.getBounds()); } catch(_) {} }
                    else if (l.getLatLng) { bounds.extend(l.getLatLng()); }
                });
                cargadas++;
            }
        } catch(err) { console.warn('Error cargando ' + tabla + ': ' + err.message); }
    }

    if (cargadas > 0) { try { map.fitBounds(bounds, { padding: [40, 40] }); } catch(_) {} }

    btn.disabled = false;
    btn.classList.add('cargado');
    btn.innerHTML = '<i class="fas fa-check"></i> Capas Cargadas (' + cargadas + ')';
    showLoading(false);
    status(cargadas + ' capa(s) cargada(s) correctamente');
}

async function cargarDatosGeologia() {
    if (datosGeologia.lahares.length > 0 && datosGeologia.fallas.length > 0) return;

    try {
        var rL = await fetch(SUPABASE_URL + '/laharestungurahua?select=*&limit=5000', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
        });
        if (rL.ok) {
            var lahares = await rL.json();
            if (Array.isArray(lahares)) {
                datosGeologia.lahares = lahares.filter(function(r) {
                    var g = r.geom || r.geometry || r.geojson;
                    if (typeof g === 'string') { try { g = JSON.parse(g); } catch(_) {} }
                    if (g && g.type && g.coordinates) { r.geom = g; return true; }
                    return false;
                });
            }
        }

        var rF = await fetch(SUPABASE_URL + '/fallasbanos?select=*&limit=5000', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
        });
        if (rF.ok) {
            var fallas = await rF.json();
            if (Array.isArray(fallas)) {
                datosGeologia.fallas = fallas.filter(function(r) {
                    var g = r.geom || r.geometry || r.geojson;
                    if (typeof g === 'string') { try { g = JSON.parse(g); } catch(_) {} }
                    if (g && g.type && g.coordinates) { r.geom = g; return true; }
                    return false;
                });
            }
        }
    } catch(err) { console.warn('Error cargando geologia: ' + err.message); }
}

async function cargarTabla(tabla, cfg) {
    var r = await fetch(SUPABASE_URL + '/' + tabla + '?select=*&limit=5000', {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    });
    if (!r.ok) { console.warn('Tabla "' + tabla + '" no accesible: ' + r.status); return null; }
    var datos = await r.json();
    if (!Array.isArray(datos) || datos.length === 0) return null;

    var features = [];
    datos.forEach(function(reg) {
        var geom = reg.geom || reg.geometry || reg.geojson;
        if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch(_) {} }
        if (geom && geom.type && geom.coordinates) {
            features.push({ type: 'Feature', properties: reg, geometry: geom });
        }
    });

    if (features.length === 0) return null;

    var isLine = features[0].geometry.type.includes('Line');
    var isPoly = features[0].geometry.type.includes('Polygon');
    var isReporte = (tabla === 'reportes_ciudadanos');

    var style = {};
    if (isPoly) {
        style.color = cfg.color; style.fillColor = cfg.color;
        style.fillOpacity = cfg.fillOpacity || 0.2; style.weight = cfg.weight || 2;
        if (cfg.dashArray) style.dashArray = cfg.dashArray;
    } else if (isLine) {
        style.color = cfg.color; style.weight = cfg.weight || 2.5;
        if (cfg.dashArray) style.dashArray = cfg.dashArray;
    }

    return L.geoJSON(
        { type: 'FeatureCollection', features: features },
        {
            style: function() { return style; },
            pointToLayer: function(f, ll) {
                if (isReporte) {
                    var props = f.properties || {};
                    var estado = props.estado || 'pendiente';
                    var colorEstado = '#92400e';
                    if (estado === 'resuelto') colorEstado = '#3f6212';
                    else if (estado === 'en_revision') colorEstado = '#b45309';
                    else if (estado === 'rechazado') colorEstado = '#57534e';
                    return L.circleMarker(ll, { radius: 8, fillColor: colorEstado, color: '#fff', weight: 2, fillOpacity: 0.9 });
                }
                return L.circleMarker(ll, { radius: 5, fillColor: cfg.color, color: '#fff', weight: 1.5, fillOpacity: 0.85 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(construirPopup(feature.properties, tabla, cfg), { maxWidth: 320 });
                layer.on('click', function() { mostrarInfoPanel(feature.properties, tabla, cfg); });
            }
        }
    );
}

// ======================================================================
// ===== ZONAS DE RIESGO (capa) =====
// ======================================================================

async function cargarZonasRiesgo() {
    await cargarDatosGeologia();

    var capasCombo = L.layerGroup();

    // Lahares = Alto riesgo (rojo)
    if (datosGeologia.lahares.length > 0) {
        var fLahares = datosGeologia.lahares.map(function(r) {
            return { type: 'Feature', properties: { tipo: 'alto', desc: r.descrip || 'Zona de lahar', volcan: r.volcan || 'Tungurahua' }, geometry: r.geom };
        });
        var capaLahares = L.geoJSON(
            { type: 'FeatureCollection', features: fLahares },
            {
                style: function() { return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2 }; },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(
                        '<div class="popup-title" style="color:#dc2626;">Riesgo ALTO</div>' +
                        '<div class="popup-row"><span class="popup-key">Tipo:</span><span class="popup-val">Zona de Lahar</span></div>' +
                        '<div class="popup-row"><span class="popup-key">Descripcion:</span><span class="popup-val">' + feature.properties.desc + '</span></div>'
                    );
                }
            }
        );
        capaLahares.addTo(capasCombo);
    }

    // Buffers alrededor de fallas
    if (datosGeologia.fallas.length > 0) {
        // Zona media (~200m = ~0.0018 grados)
        var fMedia = [];
        datosGeologia.fallas.forEach(function(f) {
            var coords = extraerCoordsLine(f.geom);
            if (coords) {
                coords.forEach(function(line) {
                    var ring = [];
                    var pasos = 20;
                    for (var i = 0; i < line.length; i++) {
                        var lng = line[i][0], lat = line[i][1];
                        for (var s = 0; s <= pasos; s++) {
                            var angle = (s / pasos) * 2 * Math.PI;
                            ring.push([lng + 0.0018 * Math.cos(angle), lat + 0.0018 * Math.sin(angle)]);
                        }
                    }
                    if (ring.length > 2) {
                        fMedia.push({ type: 'Feature', properties: { tipo: 'medio' }, geometry: { type: 'Polygon', coordinates: [ring] } });
                    }
                });
            }
        });
        if (fMedia.length > 0) {
            var capaMedia = L.geoJSON(
                { type: 'FeatureCollection', features: fMedia },
                {
                    style: function() { return { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.15, weight: 1 }; },
                    onEachFeature: function() {
                        this.bindPopup('<div class="popup-title" style="color:#f97316;">Riesgo MEDIO</div><div class="popup-row"><span class="popup-val">Radio ~200m de falla geologica</span></div>');
                    }
                }
            );
            capaMedia.addTo(capasCombo);
        }

        // Zona baja (~500m = ~0.0045 grados)
        var fBaja = [];
        datosGeologia.fallas.forEach(function(f) {
            var coords = extraerCoordsLine(f.geom);
            if (coords) {
                coords.forEach(function(line) {
                    var ring = [];
                    var pasos = 16;
                    for (var i = 0; i < line.length; i++) {
                        var lng = line[i][0], lat = line[i][1];
                        for (var s = 0; s <= pasos; s++) {
                            var angle = (s / pasos) * 2 * Math.PI;
                            ring.push([lng + 0.0045 * Math.cos(angle), lat + 0.0045 * Math.sin(angle)]);
                        }
                    }
                    if (ring.length > 2) {
                        fBaja.push({ type: 'Feature', properties: { tipo: 'bajo' }, geometry: { type: 'Polygon', coordinates: [ring] } });
                    }
                });
            }
        });
        if (fBaja.length > 0) {
            var capaBaja = L.geoJSON(
                { type: 'FeatureCollection', features: fBaja },
                {
                    style: function() { return { color: '#22c55e', fillColor: '#4ade80', fillOpacity: 0.1, weight: 1 }; },
                    onEachFeature: function() {
                        this.bindPopup('<div class="popup-title" style="color:#22c55e;">Riesgo BAJO</div><div class="popup-row"><span class="popup-val">Radio ~500m de falla geologica</span></div>');
                    }
                }
            );
            capaBaja.addTo(capasCombo);
        }
    }

    return capasCombo;
}

function extraerCoordsLine(geom) {
    if (!geom || !geom.coordinates) return null;
    if (geom.type === 'LineString') return [geom.coordinates];
    if (geom.type === 'MultiLineString') return geom.coordinates;
    return null;
}

// ======================================================================
// ===== POPUPS E INFO =====
// ======================================================================

function formatFecha(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    var pad = function(n) { return n < 10 ? '0' + n : n; };
    return d.getFullYear() + '/' + pad(d.getMonth()+1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function construirPopup(props, tabla, cfg) {
    var html = '<div class="popup-title">' + cfg.nombre + '</div>';
    var campos = cfg.camposPopup || Object.keys(props);
    campos.forEach(function(k) {
        if (['geom','geometry','geojson','estado'].indexOf(k) !== -1) return;
        var val = props[k];
        if (val === null || val === undefined || val === '') return;
        var label = (cfg.camposLabels && cfg.camposLabels[k]) || k;
        if (k === 'fecha' && tabla === 'reportes_ciudadanos') val = formatFecha(val);
        html += '<div class="popup-row"><span class="popup-key">' + label + ':</span><span class="popup-val">' + val + '</span></div>';
    });
    return html;
}

function mostrarInfoPanel(props, tabla, cfg) {
    var panelHtml = '<div class="popup-title" style="font-size:12px;">' + cfg.nombre + '</div>';
    Object.keys(props).forEach(function(k) {
        if (['geom','geometry','geojson','estado'].indexOf(k) !== -1) return;
        var val = props[k];
        if (val === null || val === undefined || val === '') return;
        var label = (cfg.camposLabels && cfg.camposLabels[k]) || k;
        if (k === 'fecha' && tabla === 'reportes_ciudadanos') val = formatFecha(val);
        panelHtml += '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + val + '</span></div>';
    });
    document.getElementById('info-panel').innerHTML = panelHtml;
}

// ======================================================================
// ===== ANALIZAR RIESGO POR DIRECCION =====
// ======================================================================

function activarAnalisis() {
    if (modoAnalisis) { limpiarAnalisis(); return; }

    limpiarAnalisis();
    modoAnalisis = true;

    var btn = document.getElementById('btn-analisis');
    btn.innerHTML = '<i class="fas fa-times"></i> Cancelar Analisis';
    btn.classList.add('activo');

    map.getContainer().style.cursor = 'crosshair';
    status('Haz clic en el mapa para analizar riesgo en ese punto');

    map.on('click', onMapaClickAnalisis);
}

function limpiarAnalisis() {
    if (marcadorAnalisis) { map.removeLayer(marcadorAnalisis); marcadorAnalisis = null; }
    modoAnalisis = false;
    map.getContainer().style.cursor = '';
    map.off('click', onMapaClickAnalisis);
    var btn = document.getElementById('btn-analisis');
    if (btn) { btn.innerHTML = '<i class="fas fa-search-location"></i> Analizar Riesgo'; btn.classList.remove('activo'); }
    var panel = document.getElementById('info-panel');
    if (panel) {
        panel.innerHTML = '<div style="font-size:11px;color:#888;text-align:center;padding:8px;">Haz clic en una feature del mapa para ver sus atributos</div>';
    }
}

async function onMapaClickAnalisis(e) {
    if (!modoAnalisis) return;

    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    if (marcadorAnalisis) map.removeLayer(marcadorAnalisis);

    marcadorAnalisis = L.circleMarker([lat, lng], {
        radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 3, fillOpacity: 1
    }).addTo(map);

    map.off('click', onMapaClickAnalisis);
    status('Analizando riesgo...');

    await cargarDatosGeologia();

    var res = analizarRiesgoPunto(lng, lat);

    var nivel = res.nivel_riesgo;
    var colorNivel = '#22c55e';
    var iconoNivel = 'check-circle';
    if (nivel === 'ALTO') { colorNivel = '#dc2626'; iconoNivel = 'times-circle'; }
    else if (nivel === 'MEDIO') { colorNivel = '#f97316'; iconoNivel = 'exclamation-circle'; }

    if (marcadorAnalisis) marcadorAnalisis.setStyle({ fillColor: colorNivel, color: colorNivel });

    var panelHtml = '<div class="popup-title" style="font-size:12px;color:' + colorNivel + ';">Resultado de Analisis</div>';
    panelHtml += '<div class="info-row" style="padding:6px 0;"><span class="info-label">Nivel de Riesgo</span><span class="info-value" style="color:' + colorNivel + ';font-weight:700;font-size:13px;"><i class="fas fa-' + iconoNivel + '"></i> ' + nivel + '</span></div>';
    panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';

    if (res.dentro_lahar) {
        panelHtml += '<div class="info-row"><span class="info-label">Lahar</span><span class="info-value" style="color:#dc2626;font-weight:600;">DENTRO de zona de lahar</span></div>';
        panelHtml += '<div class="info-row"><span class="info-label">Nombre</span><span class="info-value">' + (res.nombre_lahar || 'N/A') + '</span></div>';
    } else {
        panelHtml += '<div class="info-row"><span class="info-label">Lahar</span><span class="info-value">Fuera de zona</span></div>';
        panelHtml += '<div class="info-row"><span class="info-label">Dist. lahar</span><span class="info-value">' + (res.distancia_lahar_m !== null ? res.distancia_lahar_m + ' m' : 'N/A') + '</span></div>';
    }

    panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';
    panelHtml += '<div class="info-row"><span class="info-label">Falla cercana</span><span class="info-value">' + (res.nombre_falla || 'N/A') + '</span></div>';
    panelHtml += '<div class="info-row"><span class="info-label">Tipo falla</span><span class="info-value">' + (res.tipo_falla || 'N/A') + '</span></div>';
    panelHtml += '<div class="info-row"><span class="info-label">Dist. falla</span><span class="info-value">' + (res.distancia_falla_m !== null ? res.distancia_falla_m + ' m' : 'N/A') + '</span></div>';
    panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';
    panelHtml += '<div class="info-row"><span class="info-label">Coordenadas</span><span class="info-value">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</span></div>';

    document.getElementById('info-panel').innerHTML = panelHtml;
    status('Analisis completado — Riesgo: ' + nivel);

    setTimeout(function() { if (modoAnalisis) map.on('click', onMapaClickAnalisis); }, 500);
}

// ======================================================================
// ===== GENERAR PDF =====
// ======================================================================

async function generarPDF() {
    if (!SUPABASE_URL || !SUPABASE_KEY) { status('Error: Variables de entorno no configuradas'); return; }

    var btn = document.getElementById('btn-pdf');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    showLoading(true);
    status('Consultando reportes...');

    try {
        var r = await fetch(SUPABASE_URL + '/reportes_ciudadanos?select=*&order=id.asc&limit=5000', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
        });

        if (!r.ok) { status('Error al consultar reportes: ' + r.status); return; }

        var reportes = await r.json();
        if (!Array.isArray(reportes) || reportes.length === 0) {
            status('No hay reportes para generar el PDF');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF Reportes';
            showLoading(false);
            return;
        }

        var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) { status('Error: jsPDF no se cargo. Recarga la pagina.'); return; }
        var doc = new jsPDF('l', 'mm', 'letter');
        var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();

        doc.setFillColor(15, 52, 96); doc.rect(0, 0, pw, ph, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE PROBLEMAS CIUDADANOS', pw/2, 50, { align: 'center' });
        doc.setFontSize(16); doc.setFont('helvetica', 'normal');
        doc.text('Banos de Agua Santa — Tungurahua, Ecuador', pw/2, 65, { align: 'center' });
        doc.setFontSize(12); doc.text('Especialidad SIG — UTPL 2026', pw/2, 80, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Fecha: ' + new Date().toLocaleDateString('es-EC', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }), pw/2, 95, { align: 'center' });

        var total = reportes.length;
        var pendientes = reportes.filter(function(r){return r.estado==='pendiente';}).length;
        var revision = reportes.filter(function(r){return r.estado==='en_revision';}).length;
        var resueltos = reportes.filter(function(r){return r.estado==='resuelto';}).length;
        var rechazados = reportes.filter(function(r){return r.estado==='rechazado';}).length;

        doc.setFillColor(30, 41, 59); doc.roundedRect(40, 110, pw-80, 50, 3, 3, 'F');
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('RESUMEN', pw/2, 125, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        doc.text('Total: ' + total + '  |  Pendientes: ' + pendientes + '  |  En revision: ' + revision, pw/2, 138, { align: 'center' });
        doc.text('Resueltos: ' + resueltos + '  |  Rechazados: ' + rechazados, pw/2, 148, { align: 'center' });

        doc.addPage();
        doc.setFillColor(15, 52, 96); doc.rect(0, 0, pw, 14, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE REPORTES', pw/2, 10, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        var tiposLabel = { bache_via:'Bache en via', alumbrado_deficiente:'Alumbrado deficiente', basura_acumulada:'Basura acumulada', deslave:'Deslave', inundacion:'Inundacion', senalizacion:'Falta senalizacion', acera_danada:'Acera danada', arbol_caido:'Arbol caido', fuga_agua:'Fuga de agua', peligro_volcanico:'Peligro volcanico', falla_geologica:'Falla geologica', vialidad_peligrosa:'Vialidad peligrosa', contaminacion:'Contaminacion', otro:'Otro' };
        var estadosLabel = { pendiente:'Pendiente', en_revision:'En revision', resuelto:'Resuelto', rechazado:'Rechazado' };

        var tableData = reportes.map(function(rep) {
            var fecha = '';
            if (rep.fecha) {
                var f = new Date(rep.fecha);
                var pad = function(n) { return n < 10 ? '0' + n : n; };
                fecha = f.getFullYear()+'/'+pad(f.getMonth()+1)+'/'+pad(f.getDate())+' '+pad(f.getHours())+':'+pad(f.getMinutes())+':'+pad(f.getSeconds());
            }
            var lat = '', lng = '';
            if (rep.geom && rep.geom.coordinates) { lng = rep.geom.coordinates[0].toFixed(6); lat = rep.geom.coordinates[1].toFixed(6); }
            return [ rep.id||'', (tiposLabel[rep.tipo_problema]||rep.tipo_problema||'').substring(0,25), (rep.comentario||'').substring(0,35), (rep.nombre||'').substring(0,18), fecha, (estadosLabel[rep.estado]||rep.estado||''), lat, lng ];
        });

        doc.autoTable({
            startY: 20, head: [['#','Tipo','Comentario','Nombre','Fecha','Estado','Lat','Lng']], body: tableData, theme: 'grid',
            headStyles: { fillColor: [15,52,96], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7, textColor: [30,30,30] },
            alternateRowStyles: { fillColor: [240,245,255] },
            columnStyles: { 0:{cellWidth:12}, 1:{cellWidth:40}, 2:{cellWidth:60}, 3:{cellWidth:30}, 4:{cellWidth:40}, 5:{cellWidth:25}, 6:{cellWidth:25}, 7:{cellWidth:25} },
            margin: { left: 10, right: 10 },
            didDrawPage: function() {
                doc.setFontSize(7); doc.setTextColor(150);
                doc.text('Geoportal Banos — UTPL 2026 — Pagina ' + doc.internal.getNumberOfPages(), pw/2, ph-8, { align: 'center' });
            }
        });

        doc.save('Reportes_Banos_' + new Date().toISOString().slice(0,10) + '.pdf');
        status('PDF generado correctamente');
    } catch(err) { status('Error al generar PDF: ' + err.message); }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF Reportes';
    showLoading(false);
}

// ===== Exponer funciones al scope global =====

window.toggleLayer = toggleLayer;
window.cargarTodasLasCapas = cargarTodasLasCapas;
window.generarPDF = generarPDF;
window.activarAnalisis = activarAnalisis;

// ===== Inicializacion =====

window.addEventListener('load', function() {
    Object.keys(capasConfig).forEach(function(t) { toggleLayer(t); });
    setTimeout(cargarTodasLasCapas, 500);
});
