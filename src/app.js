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
                    if (estado === 'resuelto' || estado === 'completado') colorEstado = '#3f6212';
                    else if (estado === 'en_revision' || estado === 'trabajando') colorEstado = '#0369a1';
                    else if (estado === 'dependiente') colorEstado = '#b45309';
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

function formatearEstado(val) {
    var mapa = {
        pendiente: 'Pendiente', dependiente: 'Dependiente',
        trabajando: 'Trabajando', completado: 'Completado',
        en_revision: 'En Revision', resuelto: 'Resuelto', rechazado: 'Rechazado'
    };
    return mapa[val] || val.charAt(0).toUpperCase() + val.slice(1);
}

function construirPopup(props, tabla, cfg) {
    var html = '<div class="popup-title">' + cfg.nombre + '</div>';
    var campos = cfg.camposPopup || Object.keys(props);
    campos.forEach(function(k) {
        if (['geom','geometry','geojson'].indexOf(k) !== -1) return;
        var val = props[k];
        if (val === null || val === undefined || val === '') return;
        var label = (cfg.camposLabels && cfg.camposLabels[k]) || k;
        if (k === 'estado' && tabla === 'reportes_ciudadanos') val = formatearEstado(val);
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
        if (k === 'estado' && tabla === 'reportes_ciudadanos') {
            var estadosOpciones = [
                { valor: 'pendiente', label: 'Pendiente', color: '#92400e' },
                { valor: 'dependiente', label: 'Dependiente', color: '#b45309' },
                { valor: 'trabajando', label: 'Trabajando', color: '#0369a1' },
                { valor: 'completado', label: 'Completado', color: '#3f6212' }
            ];
            panelHtml += '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + formatearEstado(val) + '</span></div>';
            panelHtml += '<div class="estado-changer">';
            panelHtml += '<div class="estado-changer-title">Cambiar estado:</div>';
            panelHtml += '<div class="estado-buttons">';
            estadosOpciones.forEach(function(est) {
                var activo = (val === est.valor);
                panelHtml += '<button class="estado-btn' + (activo ? ' activo' : '') + '" '
                    + 'style="background:' + est.color + (activo ? ';box-shadow:0 0 8px ' + est.color : '') + '" '
                    + 'data-id="' + props.id + '" data-estado="' + est.valor + '" '
                    + 'onclick="cambiarEstado(' + props.id + ', \'' + est.valor + '\')">'
                    + est.label + '</button>';
            });
            panelHtml += '</div></div>';
        } else if (k !== 'estado') {
            panelHtml += '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + val + '</span></div>';
        }
    });
    document.getElementById('info-panel').innerHTML = panelHtml;
}

async function cambiarEstado(id, nuevoEstado) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    var btns = document.querySelectorAll('.estado-btn');
    btns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });

    try {
        var r = await fetch(SUPABASE_URL + '/reportes_ciudadanos?id=eq.' + id, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_KEY,
                Authorization: 'Bearer ' + SUPABASE_KEY,
                Prefer: 'return=minimal'
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (!r.ok) throw new Error('HTTP ' + r.status);

        status('Estado actualizado a "' + nuevoEstado + '" para reporte #' + id);

        if (capasCargadas['reportes_ciudadanos']) {
            map.removeLayer(capasCargadas['reportes_ciudadanos']);
            delete capasCargadas['reportes_ciudadanos'];
            var capa = await cargarTabla('reportes_ciudadanos', capasConfig['reportes_ciudadanos']);
            if (capa) {
                capa.addTo(map);
                capasCargadas['reportes_ciudadanos'] = capa;
            }
        }
    } catch(err) {
        status('Error al actualizar estado: ' + err.message);
        btns.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
    }
}

// ===== Generar PDF de Reportes =====

async function generarPDF() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        status('Error: Variables de entorno no configuradas');
        return;
    }

    var btn = document.getElementById('btn-pdf');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    showLoading(true);
    status('Consultando reportes...');

    try {
        var r = await fetch(SUPABASE_URL + '/reportes_ciudadanos?select=*&order=id.asc&limit=5000', {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: 'Bearer ' + SUPABASE_KEY
            }
        });

        if (!r.ok) {
            status('Error al consultar reportes: ' + r.status, 'red');
            return;
        }

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
        if (!jsPDF) {
            status('Error: jsPDF no se cargo correctamente. Recarga la pagina.');
            return;
        }
        var doc = new jsPDF('l', 'mm', 'letter');

        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();

        // ===== Portada =====
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

        var fechaGen = new Date().toLocaleDateString('es-EC', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        doc.setFontSize(10);
        doc.text('Fecha de generacion: ' + fechaGen, pageWidth / 2, 95, { align: 'center' });

        // Estadisticas
        var total = reportes.length;
        var pendientes = reportes.filter(function(r) { return r.estado === 'pendiente'; }).length;
        var dependientes = reportes.filter(function(r) { return r.estado === 'dependiente'; }).length;
        var revision = reportes.filter(function(r) { return r.estado === 'en_revision' || r.estado === 'trabajando'; }).length;
        var resueltos = reportes.filter(function(r) { return r.estado === 'resuelto' || r.estado === 'completado'; }).length;
        var rechazados = reportes.filter(function(r) { return r.estado === 'rechazado'; }).length;

        doc.setFillColor(30, 41, 59);
        doc.roundedRect(40, 110, pageWidth - 80, 50, 3, 3, 'F');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN', pageWidth / 2, 125, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        var col1 = 70;
        var col2 = 150;
        var yStat = 138;

        doc.text('Total de reportes: ' + total, col1, yStat);
        doc.text('Pendientes: ' + pendientes, col2, yStat);
        doc.text('Dependientes: ' + dependientes, col1, yStat + 8);
        doc.text('En revision/Trabajando: ' + revision, col2, yStat + 8);
        doc.text('Resueltos/Completados: ' + resueltos, col1, yStat + 16);
        doc.text('Rechazados: ' + rechazados, col2, yStat + 16);

        // ===== Pagina 2: Tabla de reportes =====
        doc.addPage();

        doc.setFillColor(15, 52, 96);
        doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE REPORTES', pageWidth / 2, 10, { align: 'center' });

        doc.setTextColor(0, 0, 0);

        var tiposLabel = {
            bache_via: 'Bache en via',
            alumbrado_deficiente: 'Alumbrado deficiente',
            basura_acumulada: 'Basura acumulada',
            deslave: 'Deslave / derrumbe',
            inundacion: 'Inundacion',
            senalizacion: 'Falta senalizacion',
            acera_danada: 'Acera danada',
            arbol_caido: 'Arbol caido',
            fuga_agua: 'Fuga de agua',
            peligro_volcanico: 'Peligro volcanico',
            falla_geologica: 'Falla geologica',
            vialidad_peligrosa: 'Vialidad peligrosa',
            contaminacion: 'Contaminacion',
            otro: 'Otro'
        };

        var estadosLabel = {
            pendiente: 'Pendiente',
            dependiente: 'Dependiente',
            en_revision: 'En revision',
            trabajando: 'Trabajando',
            resuelto: 'Resuelto',
            completado: 'Completado',
            rechazado: 'Rechazado'
        };

        var tableData = reportes.map(function(rep) {
            var fecha = '';
            if (rep.fecha) {
                var f = new Date(rep.fecha);
                fecha = f.toLocaleDateString('es-EC') + ' ' + f.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
            }
            var lat = '';
            var lng = '';
            if (rep.geom && rep.geom.coordinates) {
                lng = rep.geom.coordinates[0].toFixed(6);
                lat = rep.geom.coordinates[1].toFixed(6);
            }
            return [
                rep.id || '',
                (tiposLabel[rep.tipo_problema] || rep.tipo_problema || '').substring(0, 25),
                (rep.comentario || '').substring(0, 35),
                (rep.nombre || '').substring(0, 18),
                fecha,
                (estadosLabel[rep.estado] || rep.estado || ''),
                lat,
                lng
            ];
        });

        doc.autoTable({
            startY: 20,
            head: [['#', 'Tipo', 'Comentario', 'Nombre', 'Fecha', 'Estado', 'Lat', 'Lng']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [15, 52, 96],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 7,
                textColor: [30, 30, 30]
            },
            alternateRowStyles: {
                fillColor: [240, 245, 255]
            },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 40 },
                2: { cellWidth: 60 },
                3: { cellWidth: 30 },
                4: { cellWidth: 40 },
                5: { cellWidth: 25 },
                6: { cellWidth: 25 },
                7: { cellWidth: 25 }
            },
            margin: { left: 10, right: 10 },
            didDrawPage: function(data) {
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(
                    'Geoportal Banos — UTPL 2026 Especialidad SIG — Pagina ' + doc.internal.getNumberOfPages(),
                    pageWidth / 2, pageHeight - 8,
                    { align: 'center' }
                );
            }
        });

        // Guardar
        var nombreArchivo = 'Reportes_Banos_' + new Date().toISOString().slice(0, 10) + '.pdf';
        doc.save(nombreArchivo);

        status('PDF generado: ' + nombreArchivo, 'green');

    } catch(err) {
        console.error('Error generando PDF:', err);
        status('Error al generar PDF: ' + err.message, 'red');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF Reportes';
    showLoading(false);
}

// ===== Exponer funciones al scope global (para onclick del HTML) =====

window.toggleLayer = toggleLayer;
window.cargarTodasLasCapas = cargarTodasLasCapas;
window.generarPDF = generarPDF;
window.cambiarEstado = cambiarEstado;

// ===== Inicializacion =====

window.addEventListener('load', function() {
    Object.keys(capasConfig).forEach(function(t) { toggleLayer(t); });
    setTimeout(cargarTodasLasCapas, 500);
});
