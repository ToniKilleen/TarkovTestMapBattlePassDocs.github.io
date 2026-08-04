(function () {
    'use strict';

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

    // Кэш проверенных иконок (чтобы не проверять каждый раз)
    let iconCache = {};

    const $ = id => document.getElementById(id);

    // ===== INIT =====
    function init() {
        preloadIcons().then(() => {
            loadMarkers();
            renderMapTabs();
            setupEventListeners();
            switchMap(MAPS_CONFIG[0].id);
        });
    }

    // ===== PRELOAD ICONS =====
    // Проверяем какие иконки реально существуют
    function preloadIcons() {
        const promises = Object.keys(ICON_CONFIG).map(cat => {
            return new Promise(resolve => {
                const cfg = ICON_CONFIG[cat];
                if (!cfg.icon) {
                    iconCache[cat] = false;
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    iconCache[cat] = true;
                    console.log(`✅ Иконка [${cat}]: ${cfg.icon}`);
                    resolve();
                };
                img.onerror = () => {
                    iconCache[cat] = false;
                    console.warn(`⚠️ Иконка [${cat}] не найдена: ${cfg.icon} — используется эмодзи`);
                    resolve();
                };
                img.src = cfg.icon;
            });
        });
        return Promise.all(promises);
    }

    // ===== СОЗДАНИЕ HTML ДЛЯ ИКОНКИ МАРКЕРА =====
    function createMarkerIconHtml(category) {
        const cfg = ICON_CONFIG[category] || ICON_CONFIG.loot;
        const hasCustomIcon = iconCache[category];

        let innerHtml;
        if (hasCustomIcon) {
            // Кастомная PNG иконка
            innerHtml = `<img src="${cfg.icon}" alt="${cfg.label}" style="width:20px;height:20px;object-fit:contain;">`;
        } else {
            // Fallback на эмодзи
            innerHtml = `<span style="font-size:15px;line-height:1;">${cfg.emoji}</span>`;
        }

        return `<div class="marker-icon-wrapper marker-cat-${category}">${innerHtml}</div>`;
    }

    // ===== MARKERS =====
    function loadMarkers() {
        markers = JSON.parse(JSON.stringify(DEFAULT_MARKERS));
        const local = localStorage.getItem('tarkov_markers_local');
        if (local) {
            try {
                const localMarkers = JSON.parse(local);
                localMarkers.forEach(lm => {
                    const i = markers.findIndex(m => m.id === lm.id);
                    if (i !== -1) markers[i] = lm;
                    else markers.push(lm);
                });
            } catch (e) { console.warn(e); }
        }
    }

    function saveMarkersLocal() {
        localStorage.setItem('tarkov_markers_local', JSON.stringify(markers));
    }

    // ===== MAP TABS =====
    function renderMapTabs() {
        $('map-selector').innerHTML = '';
        MAPS_CONFIG.forEach(cfg => {
            const tab = document.createElement('button');
            tab.className = 'map-tab';
            tab.textContent = cfg.name;
            tab.dataset.mapId = cfg.id;
            tab.addEventListener('click', () => switchMap(cfg.id));
            $('map-selector').appendChild(tab);
        });
    }

    // ===== SWITCH MAP =====
    function switchMap(mapId) {
        const config = MAPS_CONFIG.find(m => m.id === mapId);
        if (!config) return;
        currentMapId = mapId;
        closeInfoPanel();
        stopAddingMarker();

        document.querySelectorAll('.map-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mapId === mapId);
        });

        loadImageAndInitMap(config);
    }

    // ===== LOAD IMAGE =====
    function loadImageAndInitMap(config) {
        const mapDiv = $('map');
        mapDiv.style.opacity = '0.3';

        const img = new Image();
        img.onload = function () {
            initLeafletMap(config, config.image, [this.height, this.width]);
            mapDiv.style.opacity = '1';
        };
        img.onerror = function () {
            if (map) { map.remove(); map = null; }
            mapDiv.style.opacity = '1';
            mapDiv.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#e74c3c;font-family:'Share Tech Mono',monospace;text-align:center;padding:40px;">
                    <p style="font-size:64px;margin-bottom:20px;">⚠️</p>
                    <h2 style="margin-bottom:12px;">Карта не найдена</h2>
                    <p style="color:#555;">Файл: <code style="color:#c8aa58;background:#1a1b21;padding:4px 8px;border-radius:4px;">${config.image}</code></p>
                </div>`;
        };
        img.src = config.image;
    }

    // ===== LEAFLET INIT =====
    function initLeafletMap(config, imageUrl, imageBounds) {
        if (map) { map.remove(); map = null; }
        $('map').innerHTML = '';

        const h = imageBounds[0], w = imageBounds[1];
        const bounds = [[0, 0], [-h, w]];

        map = L.map('map', {
            crs: L.CRS.Simple,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            attributionControl: false,
            maxBounds: [[200, -200], [-h - 200, w + 200]],
            maxBoundsViscosity: 0.9
        });

        imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
        map.fitBounds(bounds);
        setTimeout(() => map.setZoom(config.defaultZoom), 100);

        markersLayer = L.layerGroup().addTo(map);

        map.on('click', onMapClick);
        map.on('mousemove', (e) => {
            $('cursor-coords').textContent = `${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;
        });

        renderMarkers();
        updateFilterCounts();
    }

    // ===== RENDER MARKERS =====
    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();

        const active = getActiveFilters();
        const filtered = markers.filter(m => m.mapId === currentMapId && active.includes(m.category));

        filtered.forEach(data => {
            const iconHtml = createMarkerIconHtml(data.category);

            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-marker-icon',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });

            const marker = L.marker([data.lat, data.lng], { icon: customIcon, title: data.name });
            marker.bindTooltip(data.name, { direction: 'top', offset: [0, -22] });
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                openInfoPanel(data);
            });
            marker.addTo(markersLayer);
        });

        updateFilterCounts();
    }

    function updateFilterCounts() {
        Object.keys(ICON_CONFIG).forEach(cat => {
            const count = markers.filter(m => m.mapId === currentMapId && m.category === cat).length;
            const el = $(`count-${cat}`);
            if (el) el.textContent = count;
        });
    }

    function getActiveFilters() {
        const active = [];
        document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
            if (cb.checked) active.push(cb.dataset.category);
        });
        return active;
    }

    function toggleAllFilters() {
        const cbs = document.querySelectorAll('.filter-group input[type="checkbox"]');
        const allChecked = Array.from(cbs).every(cb => cb.checked);
        cbs.forEach(cb => cb.checked = !allChecked);
        renderMarkers();
    }

    // ===== INFO PANEL =====
    function openInfoPanel(data) {
        const iconCfg = ICON_CONFIG[data.category] || ICON_CONFIG.loot;
        const mapCfg = MAPS_CONFIG.find(m => m.id === data.mapId);

        // Иконка в info badge
        let badgeIcon;
        if (iconCache[data.category]) {
            badgeIcon = `<img src="${iconCfg.icon}" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;">`;
        } else {
            badgeIcon = iconCfg.emoji;
        }

        $('info-title').textContent = data.name;
        $('info-category').innerHTML = `${badgeIcon} ${iconCfg.label}`;
        $('info-category').style.color = iconCfg.color;
        $('info-category').style.borderColor = iconCfg.color;
        $('info-text').textContent = data.description || 'Нет описания';
        $('info-coords').textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)}`;
        $('info-map-name').textContent = mapCfg ? mapCfg.name : data.mapId;

        const img = $('info-image');
        const noImg = $('info-no-image');
        if (data.screenshot) {
            img.src = data.screenshot;
            img.style.display = 'block';
            noImg.classList.add('hidden');
            img.onerror = () => { img.style.display = 'none'; noImg.classList.remove('hidden'); };
        } else {
            img.style.display = 'none';
            noImg.classList.remove('hidden');
        }

        $('info-actions').classList.toggle('hidden', !isAdminMode);
        $('info-panel').dataset.markerId = data.id;
        $('info-panel').classList.remove('hidden');
    }

    function closeInfoPanel() {
        $('info-panel').classList.add('hidden');
    }

    // ===== ADMIN =====
    function showAdminLogin() {
        if (isAdminMode) {
            isAdminMode = false;
            $('btn-admin-toggle').textContent = '🔒';
            $('btn-admin-toggle').classList.remove('active');
            $('admin-tools').classList.add('hidden');
            $('info-actions').classList.add('hidden');
            stopAddingMarker();
            notify('Режим просмотра');
            return;
        }
        $('admin-modal').classList.remove('hidden');
        $('admin-password').value = '';
        $('admin-password').focus();
        $('admin-error').classList.add('hidden');
    }

    function handleAdminLogin(e) {
        e.preventDefault();
        if ($('admin-password').value === ADMIN_PASSWORD) {
            isAdminMode = true;
            $('btn-admin-toggle').textContent = '🔓';
            $('btn-admin-toggle').classList.add('active');
            $('admin-tools').classList.remove('hidden');
            $('admin-modal').classList.add('hidden');
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

        $('form-lat').value = e.latlng.lat.toFixed(2);
        $('form-lng').value = e.latlng.lng.toFixed(2);

        const hint = $('form-coords-hint');
        hint.classList.add('selected');
        hint.querySelector('.coords-icon').textContent = '✅';
        hint.querySelector('.coords-text').textContent = `Выбрано: ${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;

        if (window._tempMarker) map.removeLayer(window._tempMarker);
        window._tempMarker = L.circleMarker(e.latlng, {
            radius: 12, color: '#c8aa58', fillColor: '#c8aa58',
            fillOpacity: 0.4, weight: 2, dashArray: '4'
        }).addTo(map);
    }

    // ===== ADD / EDIT / DELETE =====
    function startAddingMarker() {
        if (!isAdminMode) return;
        isAddingMarker = true;
        editingMarkerId = null;

        $('marker-form').reset();
        $('form-id').value = '';

        const hint = $('form-coords-hint');
        hint.classList.remove('selected');
        hint.querySelector('.coords-icon').textContent = '📍';
        hint.querySelector('.coords-text').textContent = 'Нажмите на карту';

        $('form-panel-title').textContent = 'ДОБАВИТЬ ТОЧКУ';
        $('marker-form-panel').classList.remove('hidden');
        $('adding-hint').classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    function stopAddingMarker() {
        isAddingMarker = false;
        $('marker-form-panel').classList.add('hidden');
        $('adding-hint').classList.add('hidden');
        $('map').style.cursor = '';
        if (window._tempMarker && map) {
            map.removeLayer(window._tempMarker);
            window._tempMarker = null;
        }
    }

    function startEditingMarker() {
        if (!isAdminMode) return;
        const id = $('info-panel').dataset.markerId;
        const data = markers.find(m => m.id === id);
        if (!data) return;

        isAddingMarker = true;
        editingMarkerId = id;

        $('form-id').value = data.id;
        $('form-name').value = data.name;
        $('form-category').value = data.category;
        $('form-description').value = data.description || '';
        $('form-screenshot').value = data.screenshot || '';
        $('form-lat').value = data.lat;
        $('form-lng').value = data.lng;

        const hint = $('form-coords-hint');
        hint.classList.add('selected');
        hint.querySelector('.coords-icon').textContent = '✅';
        hint.querySelector('.coords-text').textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)} — кликните для изменения`;

        $('form-panel-title').textContent = 'РЕДАКТИРОВАТЬ';
        $('marker-form-panel').classList.remove('hidden');
        $('adding-hint').classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    function saveMarker(e) {
        e.preventDefault();
        const lat = parseFloat($('form-lat').value);
        const lng = parseFloat($('form-lng').value);

        if (isNaN(lat) || isNaN(lng)) {
            notify('⚠️ Сначала кликните на карту!');
            return;
        }

        const data = {
            id: $('form-id').value || generateId(),
            mapId: currentMapId,
            name: $('form-name').value.trim(),
            category: $('form-category').value,
            lat, lng,
            description: $('form-description').value.trim(),
            screenshot: $('form-screenshot').value.trim()
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
        const id = $('info-panel').dataset.markerId;
        if (!confirm('Удалить эту точку?')) return;
        markers = markers.filter(m => m.id !== id);
        saveMarkersLocal();
        renderMarkers();
        closeInfoPanel();
        notify('🗑️ Точка удалена');
    }

    // ===== EXPORT / IMPORT =====
    function exportMarkers() {
        const blob = new Blob([JSON.stringify(markers, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tarkov_markers_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
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
            } catch (err) { notify('❌ Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ===== NOTIFICATION =====
    function notify(text) {
        const el = $('notification');
        $('notification-text').textContent = text;
        el.classList.remove('hidden');
        void el.offsetWidth;
        el.classList.add('show');
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.classList.add('hidden'), 300);
        }, 2500);
    }

    function generateId() {
        return currentMapId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    // ===== EVENTS =====
    function setupEventListeners() {
        document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', renderMarkers);
        });
        $('btn-toggle-all').addEventListener('click', toggleAllFilters);

        $('close-info').addEventListener('click', closeInfoPanel);
        $('btn-edit-marker').addEventListener('click', startEditingMarker);
        $('btn-delete-marker').addEventListener('click', deleteMarker);

        $('btn-admin-toggle').addEventListener('click', showAdminLogin);
        $('admin-form').addEventListener('submit', handleAdminLogin);
        $('btn-cancel-admin').addEventListener('click', () => $('admin-modal').classList.add('hidden'));
        $('btn-close-admin-modal').addEventListener('click', () => $('admin-modal').classList.add('hidden'));

        $('btn-add-marker').addEventListener('click', startAddingMarker);
        $('marker-form').addEventListener('submit', saveMarker);
        $('btn-cancel-form').addEventListener('click', stopAddingMarker);
        $('btn-close-form').addEventListener('click', stopAddingMarker);

        document.querySelectorAll('.modal-overlay').forEach(o => {
            o.addEventListener('click', () => $('admin-modal').classList.add('hidden'));
        });

        $('btn-export').addEventListener('click', exportMarkers);
        $('btn-import').addEventListener('click', () => $('import-file').click());
        $('import-file').addEventListener('change', importMarkers);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isAddingMarker) stopAddingMarker();
                if (!$('admin-modal').classList.contains('hidden')) $('admin-modal').classList.add('hidden');
                closeInfoPanel();
            }
        });

        $('info-image').addEventListener('click', () => {
            const src = $('info-image').src;
            if (src) window.open(src, '_blank');
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();