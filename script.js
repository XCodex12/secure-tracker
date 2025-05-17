const firebaseConfig = {
  apiKey: "AIzaSyDLxUyxeu7bIEFFtLTtqxAQVmF2ERNBlIw",
  authDomain: "tracker-eff8b.firebaseapp.com",
  databaseURL: "https://tracker-eff8b-default-rtdb.firebaseio.com",
  projectId: "tracker-eff8b",
  storageBucket: "tracker-eff8b.appspot.com",
  messagingSenderId: "720334436858",
  appId: "1:720334436858:web:392e0ec127cf666dd08c43"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const locationRef = db.ref("userLocation");
const destinationRef = db.ref("destination");
const statusRef = db.ref("status");

// ========= index.html logic =========
function startSharing() {
  const userId = "default"; // Shared user ID
  const link = `https://xcodex12.github.io/secure-tracker/track.html?user=${userId}`;
  document.getElementById("share-link").value = link;

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(position => {
      const { latitude, longitude } = position.coords;
      locationRef.set({ lat: latitude, lng: longitude });
      statusRef.set({ safe: false });
    }, error => {
      alert("Location access denied.");
    }, { enableHighAccuracy: true });
  } else {
    alert("Geolocation not supported.");
  }
}

function markSafe() {
  statusRef.set({ safe: true });
  alert("Status set to safe.");
}

function geocodeAndSetDestination() {
  const address = document.getElementById("destination").value;
  if (!address) return alert("Please enter an address.");

  const fullAddress = `${address}, Durban, South Africa`;
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent("https://nominatim.openstreetmap.org/search?format=json&q=" + fullAddress)}`;

  fetch(url)
    .then(res => res.json())
    .then(result => {
      const data = JSON.parse(result.contents);
      if (data.length > 0) {
        destinationRef.set({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        alert("Destination set.");
      } else {
        alert("Address not found.");
      }
    }).catch(err => {
      alert("Error finding address.");
    });
}

// ========= track.html logic =========
const params = new URLSearchParams(window.location.search);
const trackingUser = params.get("user");
if (trackingUser === "default" && document.getElementById("map")) {
  const map = L.map("map").setView([-29.85, 31.02], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  let marker, destMarker, polyline;
  let destinationCoords = null;

  const emergencyServices = [
    { name: "Durban Central SAPS", phone: "0313254000" },
    { name: "Netcare Ambulance", phone: "082911" },
    { name: "Addington Hospital", phone: "0313272000" }
  ];

  const drawRoute = (from, to) => {
    const apiKey = "YOUR_ORS_API_KEY"; // Replace with your OpenRouteService API key
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        if (polyline) map.removeLayer(polyline);
        polyline = L.polyline(coords, { color: "blue" }).addTo(map);
      });
  };

  locationRef.on("value", snap => {
    const loc = snap.val();
    if (loc) {
      const latlng = [loc.lat, loc.lng];
      if (!marker) marker = L.marker(latlng).addTo(map);
      else marker.setLatLng(latlng);
      map.setView(latlng, 15);

      if (destinationCoords) {
        const dist = getDistance(loc.lat, loc.lng, destinationCoords.lat, destinationCoords.lng);
        document.getElementById("alert").textContent = dist > 1 ? "🚨 Detour detected!" : "";
        drawRoute({ lat: loc.lat, lng: loc.lng }, destinationCoords);
      }

      const list = document.getElementById("emergency-list");
      list.innerHTML = "";
      emergencyServices.forEach(e => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${e.name}</strong> - <a href=\"tel:${e.phone}\">${e.phone}</a>`;
        list.appendChild(li);
      });
    }
  });

  destinationRef.on("value", snap => {
    const dest = snap.val();
    if (dest) {
      destinationCoords = dest;
      const latlng = [dest.lat, dest.lng];
      if (!destMarker) destMarker = L.marker(latlng).addTo(map).bindPopup("Destination").openPopup();
      else destMarker.setLatLng(latlng);
    }
  });

  statusRef.on("value", snap => {
    if (snap.val()?.safe) {
      document.getElementById("alert").textContent = "✅ User marked themselves SAFE.";
    }
  });

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = deg2rad(lat2 - lat1), dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
}
