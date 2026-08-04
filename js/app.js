(function () {
    'use strict';

    // ===== STATE =====
    let map = null;
    let imageOverlay = null;
    let currentMapId = null;
    let markersLayer = null;
    let markers = [];
    let isAddingMarker = false;
    let editingMarkerId = null;

    // ===== DOM REFS =====
    const $mapSelector = document.getElementById('map-selector');
    const $infoPanel = document.getElementById('info-panel');
    const $markerModal = document.getElementById('marker-modal');

    const $infoTitle = document.getElementById('info-title');
    const $infoCategory = document.getElementById('info-category');
    const $infoImage = document.getElementById('info-image');
    const $infoText = document.getElementById('info-text');
    const $infoCoords = document.getElementById('info-coords');

    const $formName = document.getElementById('form-name');
    const $formCategory = document.getElementById('form-category');
    const $formDescription = document.getElementById('form-description');
    const $formScreenshot = document.getElementById('form-screenshot');
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

    // ===== MAP TABS =====
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

        document.querySelectorAll('.map-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mapId === mapId);
        });

        loadImageAndInitMap(config);
    }

    // ===== AUTO-DETECT IMAGE SIZE & INIT =====
    function loadImageAndInitMap(config) {
        const mapDiv = document.getElementById('map');
        mapDiv.style.opacity = '0.5';

        const img = new Image();

        img.onload = function () {
            const bounds = [this.height, this.width];
            console.log(`[${config.id}] Загружено: ${this.width}x${this.height}`);
            initLeafletMap(config, config.image, bounds);
            mapDiv.style.opacity = '1';
        };

        img.onerror = function () {
            console.error(`[${config.id}] НЕ НАЙДЕН: ${config.image}`);
            mapDiv.style.opacity = '1';
            if (map) {
                map.remove();
                map = null;
            }
            mapDiv.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #e74c3c;
                    font-family: 'Share Tech Mono', monospace;
                    text-align: center;
                    padding: 40px;
                ">
                    <p style="font-size: 48px; margin-bottom: 20px;">⚠️</p>
                    <h2 style="margin-bottom: 10px;">Изображение не найдено</h2>
                    <p style="color: #888; margin-bottom: 20px;">Файл: <code style="color: #c8aa58;">${config.image}</code></p>
                    <p style="color: #888; font-size: 14px; max-width: 400px;">
                        Убедитесь что файл существует по указанному пути.<br>
                        Проверьте расширение (.jpg / .png / .webp).<br>
                        Откройте консоль (F12) для деталей.
                    </p>
                </div>
            `;
        };

        img.src = config.image;
    }

    // ===== LEAFLET MAP INIT =====
    function initLeafletMap(config, imageUrl, imageBounds) {
        if (map) {
            map.remove();
            map = null;
        }

        const mapDiv = document.getElementById('map');
        mapDiv.innerHTML = '';

        const h = imageBounds[0];
        const w = imageBounds[1];
        const bounds = [[0, 0], [-h, w]];

        map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            attributionControl: false,
            maxBounds: bounds,
            maxBoundsViscosity: 0.8
        });

        imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);

        setTimeout(() => {
            map.setZoom(config.defaultZoom);
        }, 100);

        markersLayer = L.layerGroup().addTo(map);
        map.on('click', onMapClick);

        renderMarkers();
    }

    // ===== RENDER MARKERS =====
    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();

        const activeCategories = getActiveFilters();

        const filtered = markers.filter(m => {
            if (m.mapId !== currentMapId) return false;
            if (!activeCategories.includes(m.category)) return false;
            return true;
        });

        filtered.forEach(markerData => {
            const iconCfg = ICON_CONFIG[markerData.category] || ICON_CONFIG.loot;

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

            leafletMarker.bindTooltip(markerData.name, {
                direction: 'top',
                offset: [0, -20]
            });

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

        if (markerData.screenshot) {
            $infoImage.src = markerData.screenshot;
            $infoImage.style.display = 'block';
            $infoImage.onerror = () => { $infoImage.style.display = 'none'; };
        } else {
            $infoImage.style.display = 'none';
        }

        $infoPanel.dataset.markerId = markerData.id;
        $infoPanel.classList.remove('hidden');
    }

    function closeInfoPanel() {
        $infoPanel.classList.add('hidden');
    }

    // ===== MAP CLICK =====
    function onMapClick(e) {
        if (!isAddingMarker) return;

        $formLat.value = e.latlng.lat.toFixed(2);
        $formLng.value = e.latlng.lng.toFixed(2);
        $formCoordsHint.textContent = `✅ Координаты: ${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;
        $formCoordsHint.style.color = '#2ecc71';

        if (window._tempMarker) map.removeLayer(window._tempMarker);
        window._tempMarker = L.circleMarker(e.latlng, {
            radius: 10,
            color: '#c8aa58',
            fillColor: '#c8aa58',
            fillOpacity: 0.6,
            weight: 2
        }).addTo(map);
    }

    // ===== ADD / EDIT / DELETE =====
    function startAddingMarker() {
        isAddingMarker = true;
        editingMarkerId = null;
        document.getElementById('marker-form').reset();
        $formId.value = '';
        $formCoordsHint.textContent = '📍 Нажмите на карту, чтобы выбрать позицию';
        $formCoordsHint.style.color = '';
        document.getElementById('modal-title').textContent = 'Добавить точку';
        $markerModal.classList.remove('hidden');
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

    function startEditingMarker() {
        const markerId = $infoPanel.dataset.markerId;
        const markerData = markers.find(m => m.id === markerId);
        if (!markerData) return;

        isAddingMarker = true;
        editingMarkerId = markerId;

        $formId.value = markerData.id;
        $formName.value = markerData.name;
        $formCategory.value = markerData.category;
        $formDescription.value = markerData.description || '';
        $formScreenshot.value = markerData.screenshot || '';
        $formLat.value = markerData.lat;
        $formLng.value = markerData.lng;
        $formCoordsHint.textContent = `Координаты: ${markerData.lat.toFixed(0)}, ${markerData.lng.toFixed(0)} (нажмите на карту для изменения)`;

        document.getElementById('modal-title').textContent = 'Редактировать точку';
        $markerModal.classList.remove('hidden');
        document.getElementById('map').style.cursor = 'crosshair';
    }

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
            description: $formDescription.value.trim(),
            screenshot: $formScreenshot.value.trim()
        };

        if (editingMarkerId) {
            const index = markers.findIndex(m => m.id === editingMarkerId);
            if (index !== -1) markers[index] = markerData;
        } else {
            markers.push(markerData);
        }

        saveMarkers();
        stopAddingMarker();
        renderMarkers();
        closeInfoPanel();
    }

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
        a.download = `tarkov_markers_${Date.now()}.json`;
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
                    alert(`Импортировано: ${added} новых точек`);
                }
            } catch (err) {
                alert('Ошибка: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ===== HELPERS =====
    function generateId() {
        return currentMapId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', renderMarkers);
        });

        document.getElementById('close-info').addEventListener('click', closeInfoPanel);
        document.getElementById('btn-edit-marker').addEventListener('click', startEditingMarker);
        document.getElementById('btn-delete-marker').addEventListener('click', deleteMarker);
        document.getElementById('btn-add-marker').addEventListener('click', startAddingMarker);
        document.getElementById('marker-form').addEventListener('submit', saveMarker);
        document.getElementById('btn-cancel-modal').addEventListener('click', stopAddingMarker);
        document.getElementById('btn-export').addEventListener('click', exportMarkers);
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', importMarkers);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!$markerModal.classList.contains('hidden')) stopAddingMarker();
                closeInfoPanel();
            }
        });

        $infoImage.addEventListener('click', () => {
            if ($infoImage.src) window.open($infoImage.src, '_blank');
        });
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

})();