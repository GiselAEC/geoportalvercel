// form.js v1.3 — Formulario de reportes (Vercel + env vars)

var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
var SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

var map = L.map('map', {
    center: [-1.3928, -78.4364],
    zoom: 15,
    zoomControl: false
});

L.control.zoom({ position: 'topleft' }).addTo(map);

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Hibrido',
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = null;

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

function formMsg(msg, type) {
    var el = document.getElementById('form-msg');
    el.className = 'form-msg ' + type;
    el.innerHTML = msg;
}

map.on('click', function(e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    document.getElementById('lat').value = lat.toFixed(6);
    document.getElementById('lng').value = lng.toFixed(6);

    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-pin"></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(map);

    var status = document.getElementById('coord-status');
    status.innerHTML = '<i class="fas fa-check-circle"></i> Punto seleccionado: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
    status.className = 'coord-status ok';
});

document.getElementById('lat').addEventListener('input', actualizarMarkerManual);
document.getElementById('lng').addEventListener('input', actualizarMarkerManual);

function actualizarMarkerManual() {
    var lat = parseFloat(document.getElementById('lat').value);
    var lng = parseFloat(document.getElementById('lng').value);
    if (isNaN(lat) || isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-pin"></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(map);
    map.setView([lat, lng], 16);

    var status = document.getElementById('coord-status');
    status.innerHTML = '<i class="fas fa-check-circle"></i> Coordenadas ingresadas: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
    status.className = 'coord-status ok';
}

async function enviarReporte() {
    var lat = parseFloat(document.getElementById('lat').value);
    var lng = parseFloat(document.getElementById('lng').value);
    var tipo = document.getElementById('tipo_problema').value;
    var comentario = document.getElementById('comentario').value.trim();
    var nombre = document.getElementById('nombre').value.trim();
    var telefono = document.getElementById('telefono').value.trim();

    if (isNaN(lat) || isNaN(lng)) {
        formMsg('Debes seleccionar una ubicacion en el mapa.', 'error');
        return;
    }
    if (!tipo) {
        formMsg('Debes seleccionar un tipo de problema.', 'error');
        return;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        formMsg('Error: Variables de entorno no configuradas.', 'error');
        return;
    }

    var btn = document.getElementById('btn-enviar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    showLoading(true);

    var geomGeoJSON = {
        type: 'Point',
        coordinates: [lng, lat]
    };

    var enviado = false;

    // Intento 1: via funcion RPC
    try {
        var r = await fetch(SUPABASE_URL + '/rpc/insertar_reporte', {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_tipo_problema: tipo,
                p_comentario: comentario || null,
                p_nombre: nombre || null,
                p_telefono: telefono || null,
                p_latitud: lat,
                p_longitud: lng
            })
        });

        if (r.ok) {
            var result = await r.json();
            if (result && result.success) {
                formMsg(
                    '<i class="fas fa-check-circle"></i> <b>Reporte enviado!</b><br>' +
                    'Numero de reporte: <b>#' + result.id + '</b><br>' +
                    'Gracias por contribuir a mejorar la ciudad.',
                    'success'
                );
                enviado = true;
                limpiarFormulario();
            }
        }
    } catch(_) {}

    // Intento 2: insercion directa REST
    if (!enviado) {
        try {
            var r2 = await fetch(SUPABASE_URL + '/reportes_ciudadanos', {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({
                    tipo_problema: tipo,
                    comentario: comentario || null,
                    nombre: nombre || null,
                    telefono: telefono || null,
                    geom: geomGeoJSON
                })
            });

            if (r2.ok) {
                var rows = await r2.json();
                var id = (rows && rows[0]) ? rows[0].id : '?';
                formMsg(
                    '<i class="fas fa-check-circle"></i> <b>Reporte enviado!</b><br>' +
                    'Numero de reporte: <b>#' + id + '</b><br>' +
                    'Gracias por contribuir a mejorar la ciudad.',
                    'success'
                );
                limpiarFormulario();
            } else {
                formMsg('Error al enviar. Verifica que la tabla exista en Supabase.', 'error');
            }
        } catch(err2) {
            formMsg('Error de conexion. Verifica tu internet.', 'error');
            console.error(err2);
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Reporte';
    showLoading(false);
}

function limpiarFormulario() {
    document.getElementById('tipo_problema').value = '';
    document.getElementById('comentario').value = '';
    document.getElementById('nombre').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    if (marker) { map.removeLayer(marker); marker = null; }
    var status = document.getElementById('coord-status');
    status.innerHTML = '<i class="fas fa-crosshairs"></i> Selecciona un punto en el mapa';
    status.className = 'coord-status';
}
