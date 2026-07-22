// app.js v2.0 — Geoportal Banos (Vercel + env vars + Mapa de Riesgo)

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
    }
};

// ===== Estado =====

let capasActivas = {};
let capasCargadas = {};
let modoRiesgo = false;
let capasRiesgo = [];
let modoAnalisis = false;
let marcadorAnalisis = null;

// ===== Funciones de UI =====

function toggleLayer(nombre) {
    const toggle = document.getElementById('toggle-' + nombre);
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

// ===== Carga de capas =====

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
        status('Cargando ' + cfg.nombre + ' (' + (i + 1) + '/' + orden.length + ')...');
        document.getElementById('loading-bar').style.width = ((i + 1) / orden.length * 100) + '%';

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

    var geojson = L.geoJSON(
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
                var popupHtml = construirPopup(feature.properties, tabla, cfg);
                layer.bindPopup(popupHtml, { maxWidth: 320 });
                layer.on('click', function() {
                    mostrarInfoPanel(feature.properties, tabla, cfg);
                });
            }
        }
    );
    return geojson;
}

// ===== Popups e info =====

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
// ===== MAPA DE RIESGO =====
// ======================================================================

async function activarMapaRiesgo() {
    if (!SUPABASE_URL || !SUPABASE_KEY) { status('Error: Variables de entorno no configuradas'); return; }

    if (modoRiesgo) {
        desactivarMapaRiesgo();
        return;
    }

    var btn = document.getElementById('btn-riesgo');
    btn.disabled = true;
    showLoading(true);
    status('Cargando Mapa de Riesgo...');

    limpiarAnalisis();

    try {
        var rLahar = await fetch(SUPABASE_URL + '/laharestungurahua?select=*&limit=5000', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
        });
        var rFalla = await fetch(SUPABASE_URL + '/fallasbanos?select=*&limit=5000', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
        });

        if (rLahar.ok) {
            var lahares = await rLahar.json();
            if (Array.isArray(lahares) && lahares.length > 0) {
                var features = [];
                lahares.forEach(function(reg) {
                    var geom = reg.geom || reg.geometry || reg.geojson;
                    if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch(_) {} }
                    if (geom && geom.type && geom.coordinates) {
                        features.push({ type: 'Feature', properties: reg, geometry: geom });
                    }
                });

                var capaLahares = L.geoJSON(
                    { type: 'FeatureCollection', features: features },
                    {
                        style: function() {
                            return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2 };
                        },
                        onEachFeature: function(feature, layer) {
                            layer.bindPopup(
                                '<div class="popup-title" style="color:#dc2626;">Zona de Riesgo ALTO</div>' +
                                '<div class="popup-row"><span class="popup-key">Tipo:</span><span class="popup-val">Zona de Lahar</span></div>' +
                                '<div class="popup-row"><span class="popup-key">Descripcion:</span><span class="popup-val">' + (feature.properties.descrip || 'N/A') + '</span></div>' +
                                '<div class="popup-row"><span class="popup-key">Volcan:</span><span class="popup-val">' + (feature.properties.volcan || 'Tungurahua') + '</span></div>'
                            );
                        }
                    }
                );
                capaLahares.addTo(map);
                capasRiesgo.push(capaLahares);
            }
        }

        if (rFalla.ok) {
            var fallas = await rFalla.json();
            if (Array.isArray(fallas) && fallas.length > 0) {
                var featuresF = [];
                fallas.forEach(function(reg) {
                    var geom = reg.geom || reg.geometry || reg.geojson;
                    if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch(_) {} }
                    if (geom && geom.type && geom.coordinates) {
                        featuresF.push({ type: 'Feature', properties: reg, geometry: geom });
                    }
                });

                var capaFallas = L.geoJSON(
                    { type: 'FeatureCollection', features: featuresF },
                    {
                        style: function() {
                            return { color: '#f97316', weight: 4, dashArray: '10, 6' };
                        },
                        onEachFeature: function(feature, layer) {
                            layer.bindPopup(
                                '<div class="popup-title" style="color:#f97316;">Falla Geologica</div>' +
                                '<div class="popup-row"><span class="popup-key">Nombre:</span><span class="popup-val">' + (feature.properties.nam || 'N/A') + '</span></div>' +
                                '<div class="popup-row"><span class="popup-key">Tipo:</span><span class="popup-val">' + (feature.properties.tfll || 'N/A') + '</span></div>'
                            );
                        }
                    }
                );
                capaFallas.addTo(map);
                capasRiesgo.push(capaFallas);
            }
        }

        // Buffer de riesgo alrededor de fallas (zona media = 200m, zona baja = 500m)
        if (rFalla.ok) {
            var fallasRaw = await fetch(SUPABASE_URL + '/fallasbanos?select=geom&limit=5000', {
                headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
            });
            if (fallasRaw.ok) {
                var fallasGeo = await fallasRaw.json();
                if (Array.isArray(fallasGeo) && fallasGeo.length > 0) {
                    var bufferFeatures = [];
                    fallasGeo.forEach(function(reg) {
                        var geom = reg.geom;
                        if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch(_) {} }
                        if (geom && geom.type && geom.coordinates) {
                            bufferFeatures.push({ type: 'Feature', properties: {}, geometry: geom });
                        }
                    });

                    if (bufferFeatures.length > 0) {
                        var bufMedio = crearBuffers(bufferFeatures, 0.002);
                        if (bufMedio) {
                            var capaMedia = L.geoJSON(bufMedio, {
                                style: function() { return { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.12, weight: 1 }; }
                            });
                            capaMedia.bindPopup('<div class="popup-title" style="color:#f97316;">Zona de Riesgo MEDIO</div><div class="popup-row"><span class="popup-val">Radio ~200m de falla geologica</span></div>');
                            capaMedia.addTo(map);
                            capasRiesgo.push(capaMedia);
                        }

                        var bufBajo = crearBuffers(bufferFeatures, 0.005);
                        if (bufBajo) {
                            var capaBaja = L.geoJSON(bufBajo, {
                                style: function() { return { color: '#22c55e', fillColor: '#4ade80', fillOpacity: 0.08, weight: 1 }; }
                            });
                            capaBaja.bindPopup('<div class="popup-title" style="color:#22c55e;">Zona de Riesgo BAJO</div><div class="popup-row"><span class="popup-val">Radio ~500m de falla geologica</span></div>');
                            capaBaja.addTo(map);
                            capasRiesgo.push(capaBaja);
                        }
                    }
                }
            }
        }

        modoRiesgo = true;
        btn.innerHTML = '<i class="fas fa-times"></i> Cerrar Mapa de Riesgo';
        btn.classList.add('activo');
        status('Mapa de Riesgo activado — Alto (rojo), Medio (naranja), Bajo (verde)');

    } catch(err) {
        console.error('Error cargando riesgo:', err);
        status('Error al cargar mapa de riesgo: ' + err.message);
    }

    btn.disabled = false;
    showLoading(false);
}

function crearBuffers(features, radioGrados) {
    var buffered = [];
    features.forEach(function(f) {
        if (!f.geometry || !f.geometry.coordinates) return;
        var coords = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
        var ringPoints = [];
        coords.forEach(function(line) {
            line.forEach(function(pt) {
                var lng = pt[0], lat = pt[1];
                var steps = 16;
                var ring = [];
                for (var s = 0; s <= steps; s++) {
                    var angle = (s / steps) * 2 * Math.PI;
                    ring.push([lng + radioGrados * Math.cos(angle), lat + radioGrados * Math.sin(angle)]);
                }
                ringPoints.push({ type: 'Polygon', coordinates: [ring] });
            });
        });
        if (ringPoints.length > 0) {
            if (ringPoints.length === 1) {
                buffered.push({ type: 'Feature', properties: {}, geometry: ringPoints[0] });
            } else {
                buffered.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: ringPoints.map(function(p) { return p.coordinates; }) } });
            }
        }
    });
    if (buffered.length === 0) return null;
    if (buffered.length === 1) return buffered[0];
    return { type: 'FeatureCollection', features: buffered };
}

function desactivarMapaRiesgo() {
    capasRiesgo.forEach(function(capa) { map.removeLayer(capa); });
    capasRiesgo = [];
    modoRiesgo = false;
    var btn = document.getElementById('btn-riesgo');
    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Mapa de Riesgo';
    btn.classList.remove('activo');
    status('Mapa de Riesgo desactivado');
}

// ======================================================================
// ===== ANALIZAR RIESGO POR DIRECCION =====
// ======================================================================

function activarAnalisis() {
    if (modoAnalisis) {
        limpiarAnalisis();
        return;
    }

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
    if (btn) {
        btn.innerHTML = '<i class="fas fa-search-location"></i> Analizar Riesgo';
        btn.classList.remove('activo');
    }
    var panel = document.getElementById('info-panel');
    if (panel) {
        panel.innerHTML = '<div style="font-size:11px;color:#888;text-align:center;padding:8px;">Haz clic en una feature del mapa para ver sus atributos</div>';
    }
}

async function onMapaClickAnalisis(e) {
    if (!modoAnalisis) return;

    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    if (marcadorAnalisis) { map.removeLayer(marcadorAnalisis); }

    marcadorAnalisis = L.circleMarker([lat, lng], {
        radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 3, fillOpacity: 1
    }).addTo(map);

    map.off('click', onMapaClickAnalisis);

    status('Analizando riesgo en ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '...');

    try {
        var r = await fetch(SUPABASE_URL + '/rpc/analizar_riesgo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_KEY,
                Authorization: 'Bearer ' + SUPABASE_KEY
            },
            body: JSON.stringify({ p_lng: lng, p_lat: lat })
        });

        if (!r.ok) throw new Error('HTTP ' + r.status);

        var resultado = await r.json();
        var res = Array.isArray(resultado) ? resultado[0] : resultado;

        var nivel = res.nivel_riesgo || 'BAJO';
        var colorNivel = '#22c55e';
        var iconoNivel = 'check-circle';
        if (nivel === 'ALTO') { colorNivel = '#dc2626'; iconoNivel = 'times-circle'; }
        else if (nivel === 'MEDIO') { colorNivel = '#f97316'; iconoNivel = 'exclamation-circle'; }

        if (marcadorAnalisis) {
            marcadorAnalisis.setStyle({ fillColor: colorNivel, color: colorNivel });
        }

        var panelHtml = '<div class="popup-title" style="font-size:12px;color:' + colorNivel + ';">Resultado de Analisis</div>';
        panelHtml += '<div class="info-row" style="padding:6px 0;"><span class="info-label">Nivel de Riesgo</span><span class="info-value" style="color:' + colorNivel + ';font-weight:700;font-size:13px;"><i class="fas fa-' + iconoNivel + '"></i> ' + nivel + '</span></div>';
        panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';

        if (res.dentro_lahar) {
            panelHtml += '<div class="info-row"><span class="info-label">Lahar</span><span class="info-value" style="color:#dc2626;font-weight:600;">DENTRO de zona de lahar</span></div>';
            panelHtml += '<div class="info-row"><span class="info-label">Nombre lahar</span><span class="info-value">' + (res.nombre_lahar || 'N/A') + '</span></div>';
        } else {
            panelHtml += '<div class="info-row"><span class="info-label">Lahar</span><span class="info-value">Fuera de zona de lahar</span></div>';
            panelHtml += '<div class="info-row"><span class="info-label">Dist. lahar</span><span class="info-value">' + (res.distancia_lahar_m ? Math.round(res.distancia_lahar_m) + ' m' : 'N/A') + '</span></div>';
        }

        panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';

        panelHtml += '<div class="info-row"><span class="info-label">Falla mas cercana</span><span class="info-value">' + (res.nombre_falla || 'N/A') + '</span></div>';
        panelHtml += '<div class="info-row"><span class="info-label">Tipo falla</span><span class="info-value">' + (res.tipo_falla || 'N/A') + '</span></div>';
        panelHtml += '<div class="info-row"><span class="info-label">Dist. falla</span><span class="info-value">' + (res.distancia_falla_m ? Math.round(res.distancia_falla_m) + ' m' : 'N/A') + '</span></div>';

        panelHtml += '<div style="border-top:1px solid #2a3a5e;margin:6px 0;"></div>';
        panelHtml += '<div class="info-row"><span class="info-label">Coordenadas</span><span class="info-value">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</span></div>';

        document.getElementById('info-panel').innerHTML = panelHtml;
        status('Analisis completado — Riesgo: ' + nivel);

        setTimeout(function() {
            if (modoAnalisis) map.on('click', onMapaClickAnalisis);
        }, 500);

    } catch(err) {
        console.error('Error en analisis:', err);
        status('Error al analizar: ' + err.message + '. Verifica que las funciones SQL esten creadas.');
        setTimeout(function() {
            if (modoAnalisis) map.on('click', onMapaClickAnalisis);
        }, 500);
    }
}

// ===== Generar PDF de Reportes =====

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

        status('Generando PDF con ' + reportes.length + ' reporte(s)...');

        var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) { status('Error: jsPDF no se cargo correctamente. Recarga la pagina.'); return; }
        var doc = new jsPDF('l', 'mm', 'letter');

        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();

        doc.setFillColor(15, 52, 96);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE PROBLEMAS CIUDADANOS', pageWidth / 2, 50, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text('Banos de Agua Santa — Tungurahua, Ecuador', pageWidth / 2, 65, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Especialidad SIG — UTPL 2026', pageWidth / 2, 80, { align: 'center' });

        var fechaGen = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        doc.setFontSize(10);
        doc.text('Fecha de generacion: ' + fechaGen, pageWidth / 2, 95, { align: 'center' });

        var total = reportes.length;
        var pendientes = reportes.filter(function(r) { return r.estado === 'pendiente'; }).length;
        var revision = reportes.filter(function(r) { return r.estado === 'en_revision'; }).length;
        var resueltos = reportes.filter(function(r) { return r.estado === 'resuelto'; }).length;
        var rechazados = reportes.filter(function(r) { return r.estado === 'rechazado'; }).length;

        doc.setFillColor(30, 41, 59);
        doc.roundedRect(40, 110, pageWidth - 80, 50, 3, 3, 'F');
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN', pageWidth / 2, 125, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        var col1 = 70, col2 = 150, yStat = 138;
        doc.text('Total de reportes: ' + total, col1, yStat);
        doc.text('Pendientes: ' + pendientes, col2, yStat);
        doc.text('En revision: ' + revision, col1, yStat + 8);
        doc.text('Resueltos: ' + resueltos, col2, yStat + 8);
        doc.text('Rechazados: ' + rechazados, col1, yStat + 16);

        doc.addPage();
        doc.setFillColor(15, 52, 96);
        doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE REPORTES', pageWidth / 2, 10, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        var tiposLabel = { bache_via:'Bache en via', alumbrado_deficiente:'Alumbrado deficiente', basura_acumulada:'Basura acumulada', deslave:'Deslave / derrumbe', inundacion:'Inundacion', senalizacion:'Falta senalizacion', acera_danada:'Acera danada', arbol_caido:'Arbol caido', fuga_agua:'Fuga de agua', peligro_volcanico:'Peligro volcanico', falla_geologica:'Falla geologica', vialidad_peligrosa:'Vialidad peligrosa', contaminacion:'Contaminacion', otro:'Otro' };
        var estadosLabel = { pendiente:'Pendiente', en_revision:'En revision', resuelto:'Resuelto', rechazado:'Rechazado' };

        var tableData = reportes.map(function(rep) {
            var fecha = '';
            if (rep.fecha) {
                var f = new Date(rep.fecha);
                var pad = function(n) { return n < 10 ? '0' + n : n; };
                fecha = f.getFullYear() + '/' + pad(f.getMonth()+1) + '/' + pad(f.getDate()) + ' ' + pad(f.getHours()) + ':' + pad(f.getMinutes()) + ':' + pad(f.getSeconds());
            }
            var lat = '', lng = '';
            if (rep.geom && rep.geom.coordinates) { lng = rep.geom.coordinates[0].toFixed(6); lat = rep.geom.coordinates[1].toFixed(6); }
            return [ rep.id||'', (tiposLabel[rep.tipo_problema]||rep.tipo_problema||'').substring(0,25), (rep.comentario||'').substring(0,35), (rep.nombre||'').substring(0,18), fecha, (estadosLabel[rep.estado]||rep.estado||''), lat, lng ];
        });

        doc.autoTable({
            startY: 20,
            head: [['#', 'Tipo', 'Comentario', 'Nombre', 'Fecha', 'Estado', 'Lat', 'Lng']],
            body: tableData, theme: 'grid',
            headStyles: { fillColor: [15,52,96], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7, textColor: [30,30,30] },
            alternateRowStyles: { fillColor: [240,245,255] },
            columnStyles: { 0:{cellWidth:12}, 1:{cellWidth:40}, 2:{cellWidth:60}, 3:{cellWidth:30}, 4:{cellWidth:40}, 5:{cellWidth:25}, 6:{cellWidth:25}, 7:{cellWidth:25} },
            margin: { left: 10, right: 10 },
            didDrawPage: function() {
                doc.setFontSize(7); doc.setTextColor(150);
                doc.text('Geoportal Banos — UTPL 2026 Especialidad SIG — Pagina ' + doc.internal.getNumberOfPages(), pageWidth/2, pageHeight-8, { align: 'center' });
            }
        });

        var nombreArchivo = 'Reportes_Banos_' + new Date().toISOString().slice(0,10) + '.pdf';
        doc.save(nombreArchivo);
        status('PDF generado: ' + nombreArchivo);

    } catch(err) {
        console.error('Error generando PDF:', err);
        status('Error al generar PDF: ' + err.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF Reportes';
    showLoading(false);
}

// ===== Exponer funciones al scope global =====

window.toggleLayer = toggleLayer;
window.cargarTodasLasCapas = cargarTodasLasCapas;
window.generarPDF = generarPDF;
window.activarMapaRiesgo = activarMapaRiesgo;
window.activarAnalisis = activarAnalisis;

// ===== Inicializacion =====

window.addEventListener('load', function() {
    Object.keys(capasConfig).forEach(function(t) { toggleLayer(t); });
    setTimeout(cargarTodasLasCapas, 500);
});
