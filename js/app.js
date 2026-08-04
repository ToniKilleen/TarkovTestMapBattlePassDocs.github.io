(function () {
    'use strict';

    /*
     * ПАРОЛЬ ДЛЯ РЕЖИМА РЕДАКТИРОВАНИЯ
     * Измените на свой. Это НЕ безопасная защита,
     * но достаточная чтобы случайные посетители
     * не могли менять точки.
     * Реальная защита — через GitHub (только вы пушите изменения).
     */
    const ADMIN_PASSWORD = 'tarkov2024';

    // ===== STATE =====
    let map = null;
    let imageOverlay = null;
    let currentMapId = null;
    let markersLayer = null;
    let markers = [];
    let isAdminMode = false;
    let isAddingMarker = false;
    let editingMarkerId = null;

    // ===== DOM =====
    const $ = id => document.getElementById(id);

    const $mapSelector = $('map-selector');
    const $infoPanel = $('info-panel');
    const $markerModal = $('marker-modal');
    const $adminModal = $('admin-modal');

    const $infoTitle = $('info-title');
    const $infoCategory = $('info-category');
    const $infoImage = $('info-image');
    const $infoNoImage = $('info-no-image');
    const $infoText = $('info-text');
    const $infoCoords = $('info-coords');
    const $infoMapName = $('info-map-name');
    const $infoActions = $('info-actions');

    const $formName = $('form-name');
    const $formCategory = $('form-category');
    const $formDescription = $('form-description');
    const $formScreenshot = $('form-screenshot');
    const $formLat = $('form-lat');
    const $formLng = $('form-lng');
    const $formId = $('form-id');
    const $formCoordsHint = $('form-coords-hint');

    const $cursorCoords = $('cursor-coords');
    const $adminToggle = $('btn-admin-toggle');

    // ===== INIT =====
    function init() {
        loadMarkers();
        renderMapTabs();
        setupEventListeners();
        switchMap(MAPS_CONFIG[0].id);
    }

    // ===== MARKERS STORAGE =====
    function loadMarkers() {
        // Всегда начинаем с публичных маркеров из файла
        markers = JSON.parse(JSON.stringify(DEFAULT_MARKERS));

        // Если админ ранее добавлял локальные изменения — мержим
        const local = localStorage.getItem('tarkov_markers_local');
        if (local) {
            try {
                const localMarkers = JSON.parse(local);
                const defaultIds = new Set(DEFAULT_MARKERS.map(m => m.id));

                localMarkers.forEach(lm => {
                    const existingIndex = markers.findIndex(m => m.id === lm.id);
                    if (existingIndex !== -1) {
                        // Обновляем существующий
                        markers[existingIndex] = lm;
                    } else {
                        // Добавляем новый
                        markers.push(lm);
                    }
                });
            } catch (e) {
                console.warn('Ошибка загрузки локальных маркеров:', e);
            }
        }
    }

    function saveMarkersLocal() {
        localStorage.setItem('tarkov_markers_local', JSON.stringify(markers));
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
        closeInfoPanel();

        document.querySelectorAll('.map-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mapId === mapId);
        });

        loadImageAndInitMap(config);
    }

    // ===== AUTO-DETECT IMAGE SIZE =====
    function loadImageAndInitMap(config) {
        const mapDiv = $('map');
        mapDiv.style.opacity = '0.3';

        const img = new Image();

        img.onload = function () {
            console.log(`[${config.id}] ✅ ${this.width}x${this.height}`);
            initLeafletMap(config, config.image, [this.height, this.width]);
            mapDiv.style.opacity = '1';
        };

        img.onerror = function () {
            console.error(`[${config.id}] ❌ ${config.image}`);
            if (map) { map.remove(); map = null; }
            mapDiv.style.opacity = '1';
            mapDiv.innerHTML = `
                <div style="
                    display:flex; flex-direction:column; align-items:center;
                    justify-content:center; height:100%; color:#e74c3c;
                    font-family:'Share Tech Mono',monospace; text-align:center; padding:40px;
                ">
                    <p style="font-size:64px; margin-bottom:20px;">⚠️</p>
                    <h2 style="margin-bottom:12px; font-size:20px;">Карта не найдена</h2>
                    <p style="color:#555; margin-bottom:8px;">
                        Файл: <code style="color:#c8aa58; background:#1a1b21; padding:4px 8px; border-radius:4px;">${config.image}</code>
                    </p>
                    <p style="color:#444; font-size:13px; max-width:400px; line-height:1.6;">
                        Проверьте что файл существует в репозитории.<br>
                        Убедитесь что расширение (.jpg/.png) совпадает.
                    </p>
                </div>
            `;
        };

        img.src = config.image;
    }

    // ===== LEAFLET INIT =====
    function initLeafletMap(config, imageUrl, imageBounds) {
        if (map) { map.remove(); map = null; }

        $('map').innerHTML = '';

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
            maxBounds: [
                [bounds[0][0] + 200, bounds[0][1] - 200],
                [bounds[1][0] - 200, bounds[1][1] + 200]
            ],
            maxBoundsViscosity: 0.9
        });

        imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);

        setTimeout(() => map.setZoom(config.defaultZoom), 100);

        markersLayer = L.layerGroup().addTo(map);

        // Events
        map.on('click', onMapClick);
        map.on('mousemove', (e) => {
            $cursorCoords.textContent = `${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;
        });

        renderMarkers();
        updateFilterCounts();
    }

    // ===== RENDER MARKERS =====
    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();

        const activeCategories = getActiveFilters();

        const filtered = markers.filter(m =>
            m.mapId === currentMapId && activeCategories.includes(m.category)
        );

        filtered.forEach(data => {
            const iconCfg = ICON_CONFIG[data.category] || ICON_CONFIG.loot;

            const customIcon = L.divIcon({
                html: `<div class="marker-icon-wrapper marker-cat-${data.category}">
                    <span style="font-size:15px">${iconCfg.emoji}</span>
                </div>`,
                className: 'custom-marker-icon',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });

            const marker = L.marker([data.lat, data.lng], {
                icon: customIcon,
                title: data.name
            });

            marker.bindTooltip(data.name, {
                direction: 'top',
                offset: [0, -22]
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                openInfoPanel(data);
            });

            marker.addTo(markersLayer);
        });

        updateFilterCounts();
    }

    // ===== FILTER COUNTS =====
    function updateFilterCounts() {
        Object.keys(ICON_CONFIG).forEach(cat => {
            const count = markers.filter(m => m.mapId === currentMapId && m.category === cat).length;
            const el = $(`count-${cat}`);
            if (el) el.textContent = count;
        });
    }

    // ===== FILTERS =====
    function getActiveFilters() {
        const active = [];
        document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
            if (cb.checked) active.push(cb.dataset.category);
        });
        return active;
    }

    function toggleAllFilters() {
        const checkboxes = document.querySelectorAll('.filter-group input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        renderMarkers();
    }

    // ===== INFO PANEL =====
    function openInfoPanel(data) {
        const iconCfg = ICON_CONFIG[data.category] || ICON_CONFIG.loot;
        const mapCfg = MAPS_CONFIG.find(m => m.id === data.mapId);

        $infoTitle.textContent = data.name;
        $infoCategory.textContent = `${iconCfg.emoji} ${iconCfg.label}`;
        $infoCategory.style.color = iconCfg.color;
        $infoCategory.style.borderColor = iconCfg.color;
        $infoText.textContent = data.description || 'Нет описания';
        $infoCoords.textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)}`;
        $infoMapName.textContent = mapCfg ? mapCfg.name : data.mapId;

        if (data.screenshot) {
            $infoImage.src = data.screenshot;
            $infoImage.style.display = 'block';
            $infoNoImage.classList.add('hidden');
            $infoImage.onerror = () => {
                $infoImage.style.display = 'none';
                $infoNoImage.classList.remove('hidden');
            };
        } else {
            $infoImage.style.display = 'none';
            $infoNoImage.classList.remove('hidden');
        }

        // Show edit/delete only in admin mode
        $infoActions.classList.toggle('hidden', !isAdminMode);

        $infoPanel.dataset.markerId = data.id;
        $infoPanel.classList.remove('hidden');
    }

    function closeInfoPanel() {
        $infoPanel.classList.add('hidden');
    }

    // ===== ADMIN MODE =====
    function showAdminLogin() {
        if (isAdminMode) {
            // Logout
            isAdminMode = false;
            $adminToggle.textContent = '🔒';
            $adminToggle.classList.remove('active');
            $('admin-tools').classList.add('hidden');
            $infoActions.classList.add('hidden');
            notify('Режим просмотра');
            return;
        }
        $adminModal.classList.remove('hidden');
        $('admin-password').value = '';
        $('admin-password').focus();
        $('admin-error').classList.add('hidden');
    }

    function handleAdminLogin(e) {
        e.preventDefault();
        const password = $('admin-password').value;

        if (password === ADMIN_PASSWORD) {
            isAdminMode = true;
            $adminToggle.textContent = '🔓';
            $adminToggle.classList.add('active');
            $('admin-tools').classList.remove('hidden');
            $adminModal.classList.add('hidden');
            notify('Режим редактирования активирован');
        } else {
            $('admin-error').classList.remove('hidden');
            $('admin-password').value = '';
            $('admin-password').focus();
        }
    }

    // ===== MAP CLICK =====
    function onMapClick(e) {
        if (!isAddingMarker) return;

        $formLat.value = e.latlng.lat.toFixed(2);
        $formLng.value = e.latlng.lng.toFixed(2);

        $formCoordsHint.classList.add('selected');
        $formCoordsHint.querySelector('.coords-icon').textContent = '✅';
        $formCoordsHint.querySelector('.coords-text').textContent =
            `Выбрано: ${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;

        if (window._tempMarker) map.removeLayer(window._tempMarker);
        window._tempMarker = L.circleMarker(e.latlng, {
            radius: 12,
            color: '#c8aa58',
            fillColor: '#c8aa58',
            fillOpacity: 0.4,
            weight: 2,
            dashArray: '4'
        }).addTo(map);
    }

    // ===== ADD / EDIT / DELETE =====
    function startAddingMarker() {
        if (!isAdminMode) return;

        isAddingMarker = true;
        editingMarkerId = null;

        $('marker-form').reset();
        $formId.value = '';
        $formCoordsHint.classList.remove('selected');
        $formCoordsHint.querySelector('.coords-icon').textContent = '📍';
        $formCoordsHint.querySelector('.coords-text').textContent = 'Нажмите на карту, чтобы выбрать позицию';
        $('modal-title').textContent = 'Добавить точку';

        $markerModal.classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    function stopAddingMarker() {
        isAddingMarker = false;
        $markerModal.classList.add('hidden');
        $('map').style.cursor = '';
        if (window._tempMarker) {
            map.removeLayer(window._tempMarker);
            window._tempMarker = null;
        }
    }

    function startEditingMarker() {
        if (!isAdminMode) return;

        const markerId = $infoPanel.dataset.markerId;
        const data = markers.find(m => m.id === markerId);
        if (!data) return;

        isAddingMarker = true;
        editingMarkerId = markerId;

        $formId.value = data.id;
        $formName.value = data.name;
        $formCategory.value = data.category;
        $formDescription.value = data.description || '';
        $formScreenshot.value = data.screenshot || '';
        $formLat.value = data.lat;
        $formLng.value = data.lng;

        $formCoordsHint.classList.add('selected');
        $formCoordsHint.querySelector('.coords-icon').textContent = '✅';
        $formCoordsHint.querySelector('.coords-text').textContent =
            `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)} — нажмите на карту для изменения`;

        $('modal-title').textContent = 'Редактировать точку';
        $markerModal.classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    function saveMarker(e) {
        e.preventDefault();

        const lat = parseFloat($formLat.value);
        const lng = parseFloat($formLng.value);

        if (isNaN(lat) || isNaN(lng)) {
            notify('⚠️ Нажмите на карту чтобы указать позицию!');
            return;
        }

        const data = {
            id: $formId.value || generateId(),
            mapId: currentMapId,
            name: $formName.value.trim(),
            category: $formCategory.value,
            lat, lng,
            description: $formDescription.value.trim(),
            screenshot: $formScreenshot.value.trim()
        };

        if (editingMarkerId) {
            const i = markers.findIndex(m => m.id === editingMarkerId);
            if (i !== -1) markers[i] = data;
            notify('✅ Точка обновлена');
        } else {
            markers.push(data);
            notify('✅ Точка добавлена');
        }

        saveMarkersLocal();
        stopAddingMarker();
        renderMarkers();
        closeInfoPanel();
    }

    function deleteMarker() {
        if (!isAdminMode) return;
        const markerId = $infoPanel.dataset.markerId;
        if (!confirm('Удалить эту точку?')) return;

        markers = markers.filter(m => m.id !== markerId);
        saveMarkersLocal();
        renderMarkers();
        closeInfoPanel();
        notify('🗑️ Точка удалена');
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
        notify('📥 Маркеры экспортированы');
    }

    function importMarkers(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported = JSON.parse(evt.target.result);
                if (Array.isArray(imported)) {
                    markers = imported;
                    saveMarkersLocal();
                    renderMarkers();
                    notify(`📤 Импортировано ${imported.length} точек`);
                }
            } catch (err) {
                notify('❌ Ошибка импорта: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ===== NOTIFICATION =====
    function notify(text) {
        const el = $('notification');
        $('notification-text').textContent = text;
        el.classList.remove('hidden');

        // Trigger reflow for animation
        void el.offsetWidth;
        el.classList.add('show');

        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.classList.add('hidden'), 300);
        }, 2500);
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
        $('btn-toggle-all').addEventListener('click', toggleAllFilters);

        // Info panel
        $('close-info').addEventListener('click', closeInfoPanel);
        $('btn-edit-marker').addEventListener('click', startEditingMarker);
        $('btn-delete-marker').addEventListener('click', deleteMarker);

        // Admin
        $adminToggle.addEventListener('click', showAdminLogin);
        $('admin-form').addEventListener('submit', handleAdminLogin);
        $('btn-cancel-admin').addEventListener('click', () => $adminModal.classList.add('hidden'));
        $('btn-close-admin-modal').addEventListener('click', () => $adminModal.classList.add('hidden'));

        // Add marker
        $('btn-add-marker').addEventListener('click', startAddingMarker);

        // Marker modal
        $('marker-form').addEventListener('submit', saveMarker);
        $('btn-cancel-modal').addEventListener('click', stopAddingMarker);
        $('btn-close-modal').addEventListener('click', stopAddingMarker);

        // Modal overlays close on click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                $markerModal.classList.add('hidden');
                $adminModal.classList.add('hidden');
                stopAddingMarker();
            });
        });

        // Export / Import
        $('btn-export').addEventListener('click', exportMarkers);
        $('btn-import').addEventListener('click', () => $('import-file').click());
        $('import-file').addEventListener('change', importMarkers);

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!$markerModal.classList.contains('hidden')) stopAddingMarker();
                if (!$adminModal.classList.contains('hidden')) $adminModal.classList.add('hidden');
                closeInfoPanel();
            }
        });

        // Screenshot click → fullscreen
        $infoImage.addEventListener('click', () => {
            if ($infoImage.src) window.open($infoImage.src, '_blank');
        });
    }

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

})();