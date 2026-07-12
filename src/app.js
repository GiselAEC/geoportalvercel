// app.js v1.3 — Geoportal Banos (Vercel + env vars)

// ===== Configuracion Supabase (variables de entorno) =====

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
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
});

const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17
});

const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri World Imagery',
    maxZoom: 18
});

const googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Satelite',
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3']
});

const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Hibrido',
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3']
});

const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB',
    maxZoom: 19
});

const terrainLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Terreno',
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3']
});

osmLayer.addTo(map);

L.control.layers({
    'OpenStreetMap': osmLayer,
    'Topografico': topoLayer,
    'Satelite (Esri)': satLayer,
    'Satelite (Google)': googleSat,
    'Hibrido (Google)': googleHybrid,
    'Terreno (Google)': terrainLayer,
    'Oscuro': darkLayer
}, null, { collapsed: true, position: 'topright' }).addTo(map);

// ===== Configuracion de capas =====

const capasConfig = {
    cantonbanos: {
        nombre: 'Canton Banos',
        color: '#2196f3',
        fillOpacity: 0.15,
        weight: 2.5,
        camposPopup: ['can_descri','pro_descri','region','can_codigo','pro_codigo','area','perimeter'],
        camposLabels: {
            can_descri: 'Canton',
            pro_descri: 'Provincia',
            region: 'Region',
            can_codigo: 'Codigo Canton',
            pro_codigo: 'Codigo Provincia',
            area: 'Area',
            perimeter: 'Perimetro'
        },
        orden: 1
    },
    laharestungurahua: {
        nombre: 'Lahares Tungurahua',
        color: '#f44336',
        fillOpacity: 0.3,
        weight: 2,
        camposPopup: ['descrip','volcan','dxf_text','area','perimeter'],
        camposLabels: {
            descrip: 'Descripcion',
            volcan: 'Volcan',
            dxf_text: 'Referencia',
            area: 'Area',
            perimeter: 'Perimetro'
        },
        orden: 2
    },
    fallasbanos: {
        nombre: 'Fallas Geologicas',
        color: '#ff9800',
        weight: 3,
        dashArray: '8, 4',
        camposPopup: ['nam','tfll','shape_leng'],
        camposLabels: {
            nam: 'Nombre',
            tfll: 'Tipo Falla',
            shape_leng: 'Longitud'
        },
        orden: 3
    },
    viasbanos: {
        nombre: 'Vias',
        color: '#4caf50',
        weight: 2.5,
        camposPopup: ['gid','length'],
        camposLabels: {
            gid: 'ID',
            length: 'Longitud'
        },
        orden: 4
    },
    casasbanos: {
        nombre: 'Casas / Edificaciones',
        color: '#9c27b0',
        camposPopup: ['nam','descripcio','fcode','acc_desc','txt'],
        camposLabels: {
            nam: 'Nombre',
            descripcio: 'Descripcion',
            fcode: 'Codigo',
            acc_desc: 'Acceso',
            txt: 'Texto'
        },
        orden: 5
    },
    reportes_ciudadanos: {
        nombre: 'Reportes Ciudadanos',
        color: '#92400e',
        camposPopup: ['id','tipo_problema','comentario','nombre','telefono','fecha','estado'],
        camposLabels: {
            id: 'Numero',
            tipo_problema: 'Tipo de Problema',
            comentario: 'Comentario',
            nombre: 'Nombre',
            telefono: 'Telefono',
            fecha: 'Fecha',
            estado: 'Estado'
        },
        orden: 6
    }
};

// ===== Estado =====

let capasActivas = {};
let capasCargadas = {};

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
    if (show) {
        bar.style.width = '30%';
        bar.classList.add('visible');
    } else {
        bar.style.width = '100%';
        setTimeout(function() {
            bar.classList.remove('visible');
            bar.style.width = '0';
        }, 400);
    }
}

// ===== Carga de capas =====

async function cargarTodasLasCapas() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        status('Error: Variables de entorno no configuradas');
        return;
    }

    var tablas = Object.keys(capasActivas);
    if (tablas.length === 0) {
        status('Selecciona al menos una capa');
        return;
    }

    var btn = document.getElementById('btn-cargar');
    btn.disabled = true;
    showLoading(true);

    for (var t in capasCargadas) {
        map.removeLayer(capasCargadas[t]);
    }
    capasCargadas = {};

    var bounds = L.latLngBounds();
    var cargadas = 0;

    var orden = tablas.sort(function(a, b) {
        return (capasConfig[a].orden || 99) - (capasConfig[b].orden || 99);
    });

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
                    if (l.getBounds) {
                        try { bounds.extend(l.getBounds()); } catch(_) {}
                    } else if (l.getLatLng) {
                        bounds.extend(l.getLatLng());
                    }
                });
                cargadas++;
            }
        } catch(err) {
            console.warn('Error cargando ' + tabla + ': ' + err.message);
        }
    }

    if (cargadas > 0) {
        try { map.fitBounds(bounds, { padding: [40, 40] }); } catch(_) {}
    }

    btn.disabled = false;
    btn.classList.add('cargado');
    btn.innerHTML = '<i class="fas fa-check"></i> Capas Cargadas (' + cargadas + ')';
    showLoading(false);
    status(cargadas + ' capa(s) cargada(s) correctamente');
}

async function cargarTabla(tabla, cfg) {
    var r = await fetch(SUPABASE_URL + '/' + tabla + '?select=*&limit=5000', {
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY
        }
    });
    if (!r.ok) {
        console.warn('Tabla "' + tabla + '" no accesible: ' + r.status);
        return null;
    }
    var datos = await r.json();
    if (!Array.isArray(datos) || datos.length === 0) return null;

    var features = [];
    datos.forEach(function(reg) {
        var geom = reg.geom || reg.geometry || reg.geojson;
        if (typeof geom === 'string') {
            try { geom = JSON.parse(geom); } catch(_) {}
        }
        if (geom && geom.type && geom.coordinates) {
            features.push({ type: 'Feature', properties: reg, geometry: geom });
        }
    });

    if (features.length === 0) return null;

    var isLine = features[0].geometry.type.includes('Line');
    var isPoly = features[0].geometry.type.includes('Polygon');

    var style = {};
    if (isPoly) {
        style.color = cfg.color;
        style.fillColor = cfg.color;
        style.fillOpacity = cfg.fillOpacity || 0.2;
        style.weight = cfg.weight || 2;
        if (cfg.dashArray) style.dashArray = cfg.dashArray;
    } else if (isLine) {
        style.color = cfg.color;
        style.weight = cfg.weight || 2.5;
        if (cfg.dashArray) style.dashArray = cfg.dashArray;
    }

    var isReporte = (tabla === 'reportes_ciudadanos');

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

                    return L.circleMarker(ll, {
                        radius: 8,
                        fillColor: colorEstado,
                        color: '#fff',
                        weight: 2,
                        fillOpacity: 0.9
                    });
                }
                return L.circleMarker(ll, {
                    radius: 5,
                    fillColor: cfg.color,
                    color: '#fff',
                    weight: 1.5,
                    fillOpacity: 0.85
                });
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

function construirPopup(props, tabla, cfg) {
    var html = '<div class="popup-title">' + cfg.nombre + '</div>';
    var campos = cfg.camposPopup || Object.keys(props);
    campos.forEach(function(k) {
        if (['geom','geometry','geojson'].indexOf(k) !== -1) return;
        var val = props[k];
        if (val === null || val === undefined || val === '') return;
        var label = (cfg.camposLabels && cfg.camposLabels[k]) || k;
        html += '<div class="popup-row"><span class="popup-key">' + label + ':</span><span class="popup-val">' + val + '</span></div>';
    });
    return html;
}

function mostrarInfoPanel(props, tabla, cfg) {
    var panelHtml = '<div class="popup-title" style="font-size:12px;">' + cfg.nombre + '</div>';
    Object.keys(props).forEach(function(k) {
        if (['geom','geometry','geojson'].indexOf(k) !== -1) return;
        var val = props[k];
        if (val === null || val === undefined || val === '') return;
        var label = (cfg.camposLabels && cfg.camposLabels[k]) || k;
        panelHtml += '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + val + '</span></div>';
    });
    document.getElementById('info-panel').innerHTML = panelHtml;
}

// ===== Inicializacion =====

window.addEventListener('load', function() {
    Object.keys(capasConfig).forEach(function(t) { toggleLayer(t); });
    setTimeout(cargarTodasLasCapas, 500);
});
