const API_KEY = 'UA1PG9vAUEJ8GwCexxSUy6vJhcwKXg0u';
const map = tt.map({
    key: API_KEY,
    container: 'map',
    center: [-121.91599, 37.36765], // Default center coordinates
    zoom: 13,
    scrollZoom: true,
    controls: true
});

let userMarker; // Marker to represent the user's location
let currentRouteLayer = null; // Track the displayed route

if (navigator.geolocation) {
    // Watch the user's position and update the map in real time
    navigator.geolocation.watchPosition(
        (position) => {
            const userCoordinates = [position.coords.longitude, position.coords.latitude];
            updateUserLocation(userCoordinates);
            fetchNearbyHospitals(position.coords.latitude, position.coords.longitude);
        },
        (error) => console.error("Error fetching location: ", error.message),
        { enableHighAccuracy: true, maximumAge: 0 } // High accuracy for live updates
    );
} else {
    alert("Geolocation is not supported by this browser.");
}

// Function to update the user's location on the map
function updateUserLocation(coordinates) {
    map.setCenter(coordinates); // Center the map on the user's location

    if (!userMarker) {
        userMarker = new tt.Marker().setLngLat(coordinates).addTo(map);
    } else {
        userMarker.setLngLat(coordinates); // Update marker position
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
}

function fetchNearbyHospitals(latitude, longitude, radius = 5000) {
    const SEARCH_API_URL = `https://api.tomtom.com/search/2/nearbySearch/.json?key=${API_KEY}&lat=${latitude}&lon=${longitude}&categorySet=7321&radius=${radius}`;

    fetch(SEARCH_API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching nearby hospitals: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.results && data.results.length > 0) {
                let nearestHospital = null;
                let minDistance = Infinity;

                data.results.forEach((hospital) => {
                    const hospitalLat = hospital.position.lat;
                    const hospitalLon = hospital.position.lon;
                    const distance = calculateDistance(latitude, longitude, hospitalLat, hospitalLon);

                    if (distance < minDistance) {
                        nearestHospital = hospital;
                        minDistance = distance;
                    }
                });

                if (nearestHospital) {
                    updateHospitalInfo(nearestHospital, minDistance);
                    getRouteToHospital(latitude, longitude, nearestHospital.position.lat, nearestHospital.position.lon);
                }
            } else {
                console.log("No hospitals found nearby.");
            }
        })
        .catch(error => console.error("Error fetching hospitals:", error));
}

function getRouteToHospital(userLat, userLon, hospitalLat, hospitalLon) {
    const ROUTE_API_URL = `https://api.tomtom.com/routing/1/calculateRoute/${userLat},${userLon}:${hospitalLat},${hospitalLon}/json?key=${API_KEY}&instructionsType=text`;

    fetch(ROUTE_API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching route: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                displayRouteOnMap(route, userLat, userLon, hospitalLat, hospitalLon);
                displayDirections(route);
            } else {
                console.log("No route found.");
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}

function displayDirections(route) {
    const directionsPanel = document.getElementById('directions-panel');
    const summary = route.summary;
    const hours = Math.floor(summary.travelTimeInSeconds / 3600);
    const minutes = Math.floor((summary.travelTimeInSeconds % 3600) / 60);
    const distance = (summary.lengthInMeters / 1000).toFixed(1);

    let html = `
        <div class="direction-summary">
            <p><strong>Total Distance:</strong> ${distance} km</p>
            <p><strong>Estimated Travel Time:</strong> ${hours > 0 ? `${hours} hr ` : ''}${minutes} min</p>
        </div>
    `;

    route.guidance.instructions.forEach((instruction, index) => {
        html += `
            <div class="direction-step">
                <div class="step-number">${index + 1}</div>
                <div class="step-instruction">
                    ${instruction.message}
                    ${instruction.length ? `<small>(${(instruction.length / 1000).toFixed(1)} km)</small>` : ''}
                </div>
            </div>
        `;
    });

    directionsPanel.innerHTML = html;
}

function displayRouteOnMap(route, userLat, userLon, hospitalLat, hospitalLon) {
    if (map.getLayer('route')) {
        map.removeLayer('route');
    }
    if (map.getSource('route')) {
        map.removeSource('route');
    }

    const coordinates = route.legs[0].points.map(point => [point.longitude, point.latitude]);

    map.addLayer({
        id: 'route',
        type: 'line',
        source: {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            }
        },
        paint: {
            'line-color': '#FF0000',
            'line-width': 6
        }
    });

    new tt.Marker().setLngLat([userLon, userLat]).addTo(map);
    new tt.Marker().setLngLat([hospitalLon, hospitalLat]).addTo(map);

    const bounds = new tt.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 50, duration: 1000 });
}

function updateHospitalInfo(hospital, distance) {
    const hospitalInfoDiv = document.getElementById('hospital-info');
    hospitalInfoDiv.innerHTML = `
        <p><strong>Name:</strong> ${hospital.poi.name}</p>
        <p><strong>Address:</strong> ${hospital.address.freeformAddress}</p>
        <p><strong>Distance:</strong> ${distance.toFixed(2)} km</p>
    `;
}
