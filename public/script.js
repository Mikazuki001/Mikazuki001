var map = L.map('map').setView([16.812032, 100.463233], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

var drawnPoints = [];
var markers = [];
var polyline = null;
var distanceMarkers = [];
var elevationChart = null;

map.on('click', function (e) {
    var latlng = e.latlng;
    drawnPoints.push(latlng);

    var marker = L.marker(latlng, { draggable: true }).addTo(map);
    markers.push(marker);

    var lat = latlng.lat.toFixed(6);
    var lng = latlng.lng.toFixed(6);

    getElevation(lat, lng, marker);

    marker.on('dragend', function (e) {
        var newLatLng = e.target.getLatLng();
        var index = markers.indexOf(marker);
        if (index !== -1) {
            drawnPoints[index] = newLatLng;
            drawPolyline();
        }

        getElevation(newLatLng.lat.toFixed(6), newLatLng.lng.toFixed(6), marker);
    });

    drawPolyline();
});

function calculateTotalDistance() {
    var totalDistance = 0;
    for (var i = 0; i < drawnPoints.length - 1; i++) {
        totalDistance += drawnPoints[i].distanceTo(drawnPoints[i + 1]);
    }
    return totalDistance.toFixed(2);
}

function drawPolyline() {
    if (polyline) {
        map.removeLayer(polyline);
    }

    distanceMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    distanceMarkers = [];

    if (drawnPoints.length > 1) {
        polyline = L.polyline(drawnPoints, { color: 'blue' }).addTo(map);

        for (var i = 0; i < drawnPoints.length - 1; i++) {
            var distance = drawnPoints[i].distanceTo(drawnPoints[i + 1]).toFixed(2);
            var midPoint = L.latLng(
                (drawnPoints[i].lat + drawnPoints[i + 1].lat) / 2,
                (drawnPoints[i].lng + drawnPoints[i + 1].lng) / 2
            );

            var distanceMarker = L.marker(midPoint, {
                icon: L.divIcon({
                    className: 'distance-label',
                    html: `<span>${distance} ม.</span>`,
                    iconSize: [100, 30]
                })
            }).addTo(map);

            distanceMarkers.push(distanceMarker);
        }

        updateInfoBox();
        updateElevationChart();
    }
}

function getElevation(lat, lng, marker) {
    fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
        .then(response => response.json())
        .then(result => {
            var elevation = result.results[0].elevation;
            marker.bindPopup(`ละติจูด: ${lat}<br>ลองจิจูด: ${lng}<br>ความสูง: ${elevation} เมตร`).openPopup();
            updateElevationChart();
        })
        .catch(error => console.error('เกิดข้อผิดพลาดในการดึงข้อมูลความสูง:', error));
}

function updateInfoBox() {
    var totalDistance = calculateTotalDistance();
    var infoBox = document.getElementById('infoBox');
    if (infoBox) {
        infoBox.textContent = `ระยะทางรวม: ${totalDistance} เมตร`;
    }
}

function toggleInfoBox() {
    var container = document.getElementById('infoBoxContainer');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

function initElevationChart() {
    var ctx = document.getElementById('elevationChart').getContext('2d');
    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'ความสูง',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'ความสูง (เมตร)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'ระยะทาง (เมตร)'
                    }
                }
            }
        }
    });
}

function updateElevationChart() {
    if (!elevationChart) {
        initElevationChart();
    }

    var distances = [0];
    var elevations = [];
    var totalDistance = 0;

    for (var i = 0; i < drawnPoints.length; i++) {
        if (i > 0) {
            totalDistance += drawnPoints[i - 1].distanceTo(drawnPoints[i]);
        }
        distances.push(totalDistance);
        elevations.push(parseFloat(markers[i].getPopup().getContent().split('ความสูง: ')[1].split(' เมตร')[0]));
    }

    elevationChart.data.labels = distances;
    elevationChart.data.datasets[0].data = elevations;
    elevationChart.update();
}

function toggleElevationProfile() {
    var container = document.getElementById('elevationProfileContainer');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    if (container.style.display === 'block') {
        updateElevationChart();
    }
}

document.getElementById('clearBtn').addEventListener('click', function () {
    drawnPoints = [];
    markers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    markers = [];
    if (polyline) {
        map.removeLayer(polyline);
    }
    distanceMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    distanceMarkers = [];
    updateInfoBox();
    if (elevationChart) {
        elevationChart.data.labels = [];
        elevationChart.data.datasets[0].data = [];
        elevationChart.update();
    }
});

document.getElementById('undoBtn').addEventListener('click', function () {
    if (drawnPoints.length > 0) {
        drawnPoints.pop();
        var lastMarker = markers.pop();
        map.removeLayer(lastMarker);
        drawPolyline();
        updateElevationChart();
    }
});

document.getElementById('menuToggle').addEventListener('click', function () {
    var menuItems = document.getElementById('menuItems');
    menuItems.style.display = menuItems.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('showDistanceBtn').addEventListener('click', toggleInfoBox);
document.getElementById('toggleElevationBtn').addEventListener('click', toggleElevationProfile);

initElevationChart();

// ฟังก์ชันสำหรับการส่งออกไฟล์
document.getElementById('exportJsonBtn').addEventListener('click', function () {
    const geoData = drawnPoints.map(point => ({
        lat: point.lat,
        lng: point.lng
    }));
    const json = JSON.stringify(geoData, null, 2);
    downloadFile('points.json', json, 'application/json');
});

document.getElementById('exportGpxBtn').addEventListener('click', function () {
    const gpxHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<gpx version="1.1" creator="Leaflet" xmlns="http://www.topografix.com/GPX/1/1"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.topografix.com/GPX/1/1 
http://www.topografix.com/GPX/1/1/gpx.xsd">
<trk>
<trkseg>
`;

    let gpxData = '';
    drawnPoints.forEach(point => {
        gpxData += `<trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>\n`;
    });

    const gpxFooter = `</trkseg>
</trk>
</gpx>`;

    const gpxContent = gpxHeader + gpxData + gpxFooter;
    downloadFile('points.gpx', gpxContent, 'application/gpx+xml');
});

document.getElementById('exportGeoJsonBtn').addEventListener('click', function () {
    const geoJson = {
        type: "FeatureCollection",
        features: drawnPoints.map(point => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [point.lng, point.lat]
            },
            properties: {}
        }))
    };
    const json = JSON.stringify(geoJson, null, 2);
    downloadFile('points.geojson', json, 'application/geo+json');
});

function downloadFile(filename, content, contentType) {
    const blob = new Blob([content], { type: contentType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
