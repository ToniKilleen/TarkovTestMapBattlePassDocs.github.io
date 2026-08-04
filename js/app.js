/**
 * Tarkov Interactive Maps — Main Application
 * Uses Leaflet.js for map rendering with image overlay
 */

(function () {
    'use strict';

    // ===== STATE =====
    let map = null;
    let imageOverlay = null;
    let currentMapId = null;
    let currentFloor = null;
    let markersLayer = null;
    let markers = [];
    let isAddingMarker = false;
    let editingMarkerId = null;
    let pendingLatLng = null;

    // ===== DOM REFS =====
    const $mapContainer = document.getElementById('map');
    const $mapSelector = document.getElementById('map-selector');
    const $floorSelector = document.getElementById('floor-selector');
    const $infoPanel = document.getElementById('info-panel');
    const $filterPanel = document.getElementById('filter-panel');
    const $markerModal = document.getElementById('marker-modal');

    // Info panel elements
    const $infoTitle = document.getElementById('info-title');
    const $infoCategory = document.getElementById('info-category');
    const $infoImage = document.getElementById('info-image');
    const $infoText = document.getElementById('info-text');
    const $infoCoords = document.getElementById('info-coords');
    const $infoFloor = document.getElementById('info-floor');

    // Form elements
    const $formName = document.getElementById('form-name');
    const $formCategory = document.getElementById('form-category');
    const $formDescription = document.getElementById('form-description');
    const $formScreenshot = document.getElementById('form-screenshot');
    const $formFloor = document.getElementById('form-floor');
    const $formLat = document.getElementById('form-lat');
    const $formLng = document.getElementById('form-lng');
    const $formId = document.getElementById('form-id');
    const $formCoordsHint = document.getElementById('form-coords-hint');

    // ===== INIT =====
    function init() {
        loadMarkers();
        renderMapTabs();
        setupEventListeners();
        switchMap(MAPS_CONFIG[0].id);
    }

    // ===== LOCAL STORAGE =====
    function loadMarkers() {
        const saved = localStorage.getItem('tarkov_markers');
        if (saved) {
            markers = JSON.parse(saved);
        } else {
            markers = [...DEFAULT_MARKERS];
            saveMarkers();
        }
    }

    function saveMarkers() {
        localStorage.setItem('tarkov_markers', JSON.stringify(markers));
    }

    // ===== RENDER MAP TABS =====
    function renderMapTabs() {
        $mapSelector.innerHTML = '';
        MAPS_CONFIG.forEach(cfg => {
            const tab = document.createElement('button');
            tab.className = 'map-tab';
            tab.textContent = cfg.name;
            tab.dataset.mapId = cfg.id;
            tab.addEventListener('click', () => switchMap(cfg.id));
            $mapSelector.appendChild(tab);
        });
    }

    // ===== SWITCH MAP =====
    function switchMap(mapId) {
        const config = MAPS_CONFIG.find(m => m.id === mapId);
        if (!config) return;

        currentMapId = mapId;

        // Update tab active state
        document.querySelectorAll('.map-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mapId === mapId);
        });

        // Setup floors
        renderFloorButtons(config);

        // Determine which floor/image to show
        let imageUrl = config.image;
        if (config.floors && config.floors.length > 0) {
            currentFloor = config.floors[0].id;
            imageUrl = config.floors[0].image;
        } else {
            currentFloor = 'default';
        }

        // Initialize or reset Leaflet map
        initLeafletMap(config, imageUrl);

        // Render markers
        renderMarkers();
    }

    // ===== FLOOR BUTTONS =====
    function renderFloorButtons(config) {
        $floorSelector.innerHTML = '';
        if (!config.floors) return;

        config.floors.forEach((floor, index) => {
            const btn = document.createElement('button');
            btn.className = 'floor-btn' + (index === 0 ? ' active' : '');
            btn.textContent = floor.name;
            btn.dataset.floorId = floor.id;
            btn.addEventListener('click', () => switchFloor(config, floor));
            $floorSelector.appendChild(btn);
        });
    }

    function switchFloor(config, floor) {
        currentFloor = floor.id;

        // Update button states
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.floorId === floor.id);
        });

        // Update image overlay
        const bounds = [[0, 0], [-config.bounds[0], config.bounds[1]]];
        if (imageOverlay) {
            map.removeLayer(imageOverlay);
        }
        imageOverlay = L.imageOverlay(floor.image, bounds).addTo(map);

        // Re-render markers for this floor
        renderMarkers();
    }

    // ===== LEAFLET MAP INIT =====
    function initLeafletMap(config, imageUrl) {
        // Destroy existing map
        if (map) {
            map.remove();
            map = null;
        }

        const h = config.bounds[0];
        const w = config.bounds[1];
        const bounds = [[0, 0], [-h, w]];

        map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            attributionControl: false
        });

        imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);
        map.setZoom(config.defaultZoom);

        // Markers layer
        markersLayer = L.layerGroup().addTo(map);

        // Click on map — for adding markers
        map.on('click', onMapClick);

        // Show coordinates on mouse move (for debugging)
        map.on('mousemove', (e) => {
            // Optional: display coords in header or console
            // console.log(`Lat: ${e.latlng.lat.toFixed(0)}, Lng: ${e.latlng.lng.toFixed(0)}`);
        });
    }

    // ===== RENDER MARKERS =====
    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();

        // Get active filters
        const activeCategories = getActiveFilters();

        // Filter markers for current map and floor
        const filtered = markers.filter(m => {
            if (m.mapId !== currentMapId) return false;
            if (!activeCategories.includes(m.category)) return false;

            // Floor filtering
            if (currentFloor !== 'default' && m.floor && m.floor !== 'default') {
                return m.floor === currentFloor;
            }
            return true;
        });

        filtered.forEach(markerData => {
            const iconCfg = ICON_CONFIG[markerData.category] || ICON_CONFIG.loot;

            // Create custom HTML icon
            const iconHtml = `
                <div class="marker-icon-wrapper marker-cat-${markerData.category}">
                    <span style="font-size: 16px;">${iconCfg.emoji}</span>
                </div>
            `;

            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-marker-icon',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const leafletMarker = L.marker([markerData.lat, markerData.lng], {
                icon: customIcon,
                title: markerData.name
            });

            // Tooltip on hover
            leafletMarker.bindTooltip(markerData.name, {
                direction: 'top',
                offset: [0, -20]
            });

            // Click — open info panel
            leafletMarker.on('click', () => openInfoPanel(markerData));

            leafletMarker.addTo(markersLayer);
        });
    }

    // ===== FILTERS =====
    function getActiveFilters() {
        const checkboxes = document.querySelectorAll('.filter-group input[type="checkbox"]');
        const active = [];
        checkboxes.forEach(cb => {
            if (cb.checked) active.push(cb.dataset.category);
        });
        return active;
    }

    // ===== INFO PANEL =====
    function openInfoPanel(markerData) {
        const iconCfg = ICON_CONFIG[markerData.category] || ICON_CONFIG.loot;

        $infoTitle.textContent = markerData.name;
        $infoCategory.textContent = `${iconCfg.emoji} ${iconCfg.label}`;
        $infoCategory.style.borderLeft = `3px solid ${iconCfg.color}`;
        $infoText.textContent = markerData.description || 'Нет описания';
        $infoCoords.textContent = `${markerData.lat.toFixed(0)}, ${markerData.lng.toFixed(0)}`;
        $infoFloor.textContent = markerData.floor || 'По умолчанию';

        // Screenshot
        if (markerData.screenshot) {
            $infoImage.src = markerData.screenshot;
            $infoImage.style.display = 'block';
            $infoImage.onerror = () => {
                $infoImage.style.display = 'none';
            };
        } else {
            $infoImage.style.display = 'none';
        }

        // Store current marker ID for edit/delete
        $infoPanel.dataset.markerId = markerData.id;

        // Show panel
        $infoPanel.classList.remove('hidden');
    }

    function closeInfoPanel() {
        $infoPanel.classList.add('hidden');
    }

    // ===== MAP CLICK (for adding markers) =====
    function onMapClick(e) {
        if (!isAddingMarker) return;

        pendingLatLng = e.latlng;
        $formLat.value = e.latlng.lat.toFixed(2);
        $formLng.value = e.latlng.lng.toFixed(2);
        $formCoordsHint.textContent = `Координаты: ${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)} ✓`;
        $formCoordsHint.style.color = '#2ecc71';

        // Show a temporary marker
        if (window._tempMarker) {
            map.removeLayer(window._tempMarker);
        }
        window._tempMarker = L.circleMarker(e.latlng, {
            radius: 8,
            color: '#c8aa58',
            fillColor: '#c8aa58',
            fillOpacity: 0.5
        }).addTo(map);
    }

    // ===== ADD MARKER =====
    function startAddingMarker() {
        isAddingMarker = true;
        editingMarkerId = null;
        pendingLatLng = null;

        // Reset form
        document.getElementById('marker-form').reset();
        $formId.value = '';
        $formCoordsHint.textContent = '📍 Нажмите на карту, чтобы выбрать позицию';
        $formCoordsHint.style.color = '';
        document.getElementById('modal-title').textContent = 'Добавить точку';

        // Set current floor
        $formFloor.value = currentFloor;

        // Show modal
        $markerModal.classList.remove('hidden');

        // Change cursor
        document.getElementById('map').style.cursor = 'crosshair';
    }

    function stopAddingMarker() {
        isAddingMarker = false;
        $markerModal.classList.add('hidden');
        document.getElementById('map').style.cursor = '';

        if (window._tempMarker) {
            map.removeLayer(window._tempMarker);
            window._tempMarker = null;
        }
    }

    // ===== EDIT MARKER =====
    function startEditingMarker() {
        const markerId = $infoPanel.dataset.markerId;
        const markerData = markers.find(m => m.id === markerId);
        if (!markerData) return;

        isAddingMarker = true;
        editingMarkerId = markerId;

        // Fill form
        $formId.value = markerData.id;
        $formName.value = markerData.name;
        $formCategory.value = markerData.category;
        $formDescription.value = markerData.description || '';
        $formScreenshot.value = markerData.screenshot || '';
        $formFloor.value = markerData.floor || 'default';
        $formLat.value = markerData.lat;
        $formLng.value = markerData.lng;
        $formCoordsHint.textContent = `Координаты: ${markerData.lat.toFixed(0)}, ${markerData.lng.toFixed(0)} (нажмите на карту для изменения)`;

        document.getElementById('modal-title').textContent = 'Редактировать точку';
        $markerModal.classList.remove('hidden');
        document.getElementById('map').style.cursor = 'crosshair';
    }

    // ===== SAVE MARKER =====
    function saveMarker(e) {
        e.preventDefault();

        const lat = parseFloat($formLat.value);
        const lng = parseFloat($formLng.value);

        if (isNaN(lat) || isNaN(lng)) {
            alert('Нажмите на карту, чтобы указать позицию маркера!');
            return;
        }

        const markerData = {
            id: $formId.value || generateId(),
            mapId: currentMapId,
            name: $formName.value.trim(),
            category: $formCategory.value,
            lat: lat,
            lng: lng,
            floor: $formFloor.value,
            description: $formDescription.value.trim(),
            screenshot: $formScreenshot.value.trim()
        };

        if (editingMarkerId) {
            // Update existing
            const index = markers.findIndex(m => m.id === editingMarkerId);
            if (index !== -1) {
                markers[index] = markerData;
            }
        } else {
            // Add new
            markers.push(markerData);
        }

        saveMarkers();
        stopAddingMarker();
        renderMarkers();
        closeInfoPanel();
    }

    // ===== DELETE MARKER =====
    function deleteMarker() {
        const markerId = $infoPanel.dataset.markerId;
        if (!confirm('Удалить эту точку?')) return;

        markers = markers.filter(m => m.id !== markerId);
        saveMarkers();
        renderMarkers();
        closeInfoPanel();
    }

    // ===== EXPORT / IMPORT =====
    function exportMarkers() {
        const data = JSON.stringify(markers, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tarkov_markers_${currentMapId}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importMarkers(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported = JSON.parse(evt.target.result);
                if (Array.isArray(imported)) {
                    // Merge (avoid duplicates by ID)
                    const existingIds = new Set(markers.map(m => m.id));
                    let added = 0;
                    imported.forEach(m => {
                        if (!existingIds.has(m.id)) {
                            markers.push(m);
                            added++;
                        }
                    });
                    saveMarkers();
                    renderMarkers();
                    alert(`Импортировано ${added} новых точек (${imported.length - added} дубликатов пропущено)`);
                }
            } catch (err) {
                alert('Ошибка чтения файла: ' + err.message);
            }
        };
        reader.readAsText(file);

        // Reset input
        e.target.value = '';
    }

    // ===== HELPERS =====
    function generateId() {
        return currentMapId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Filters
        document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', renderMarkers);
        });

        // Info panel
        document.getElementById('close-info').addEventListener('click', closeInfoPanel);
        document.getElementById('btn-edit-marker').addEventListener('click', startEditingMarker);
        document.getElementById('btn-delete-marker').addEventListener('click', deleteMarker);

        // Add marker
        document.getElementById('btn-add-marker').addEventListener('click', startAddingMarker);

        // Modal
        document.getElementById('marker-form').addEventListener('submit', saveMarker);
        document.getElementById('btn-cancel-modal').addEventListener('click', stopAddingMarker);

        // Export / Import
        document.getElementById('btn-export').addEventListener('click', exportMarkers);
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', importMarkers);

        // Close modal on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!$markerModal.classList.contains('hidden')) {
                    stopAddingMarker();
                }
                closeInfoPanel();
            }
        });

        // Click on screenshot to open full size
        $infoImage.addEventListener('click', () => {
            if ($infoImage.src) {
                window.open($infoImage.src, '_blank');
            }
        });
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

})();
