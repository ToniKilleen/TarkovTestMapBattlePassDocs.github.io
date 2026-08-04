(function () {
    'use strict';

    // ===== STATE =====
    let map = null;
    let imageOverlay = null;
    let currentMapId = null;
    let markersLayer = null;
    let markers = [];
    let leafletMarkers = {};
    let currentUser = null; // { id, username, role }
    let isAddingMarker = false;
    let editingMarkerId = null;
    let iconCache = {};
    let currentView = 'map';
    let formMode = 'add'; // 'add' | 'edit' | 'suggest'

    const $ = id => document.getElementById(id);

    // ===== INIT =====
    function init() {
        checkUrlParams();
        preloadIcons().then(async () => {
            await loadMarkers();
            renderMapTabs();
            renderFilterItems();
            renderCategoryDropdown();
            setupEventListeners();
            setupScreenshotPaste();
            switchMap(MAPS_CONFIG[0].id);
            restoreSession();

            // Если в URL был параметр — обработать после загрузки
            setTimeout(handleUrlParams, 500);
        });
    }

    // ===== URL PARAMS (ссылки на точки) =====
    let pendingUrlMap = null;
    let pendingUrlMarker = null;

    function checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        pendingUrlMap = params.get('map');
        pendingUrlMarker = params.get('marker');
    }

    function handleUrlParams() {
        if (pendingUrlMap) {
            const config = MAPS_CONFIG.find(m => m.id === pendingUrlMap);
            if (config) {
                switchMap(pendingUrlMap);
                if (pendingUrlMarker) {
                    setTimeout(() => {
                        const markerData = markers.find(m => m.id === pendingUrlMarker);
                        if (markerData) {
                            highlightAndFocus(pendingUrlMarker);
                        }
                    }, 600);
                }
            }
        }
        // Очищаем URL без перезагрузки
        if (pendingUrlMap || pendingUrlMarker) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    function generateShareUrl(markerData) {
        const base = window.location.origin + window.location.pathname;
        return `${base}?map=${markerData.mapId}&marker=${markerData.id}`;
    }

    // ===== ICONS =====
    function preloadIcons() {
        const promises = Object.keys(ICON_CONFIG).map(cat => {
            return new Promise(resolve => {
                const cfg = ICON_CONFIG[cat];
                if (!cfg.icon) { iconCache[cat] = false; resolve(); return; }
                const img = new Image();
                img.onload = () => { iconCache[cat] = true; resolve(); };
                img.onerror = () => { iconCache[cat] = false; resolve(); };
                img.src = cfg.icon;
            });
        });
        return Promise.all(promises);
    }

    function getCategoryIconHtml(category) {
        const cfg = ICON_CONFIG[category];
        if (!cfg) return '';
        if (iconCache[category]) {
            return `<img src="${cfg.icon}" alt="${cfg.label}">`;
        }
        return `<span class="emoji-fallback">${cfg.emoji || '📌'}</span>`;
    }

    // ===== AUTH =====
    function restoreSession() {
        const saved = localStorage.getItem('tarkov_user');
        if (saved) {
            try {
                currentUser = JSON.parse(saved);
                updateAuthUI();
            } catch (e) { localStorage.removeItem('tarkov_user'); }
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = $('login-username').value.trim();
        const password = $('login-password').value;

        try {
            const user = await SupabaseDB.login(username, password);
            if (!user) {
                $('login-error').classList.remove('hidden');
                return;
            }
            currentUser = { id: user.id, username: user.username, role: user.role };
            localStorage.setItem('tarkov_user', JSON.stringify(currentUser));
            $('login-modal').classList.add('hidden');
            updateAuthUI();
            notify(`✅ Добро пожаловать, ${user.username}!`);
        } catch (err) {
            $('login-error').classList.remove('hidden');
            console.error(err);
        }
    }

    function handleLogout() {
        currentUser = null;
        localStorage.removeItem('tarkov_user');
        updateAuthUI();
        closeInfoPanel();
        stopAddingMarker();
        notify('Вы вышли из аккаунта');
    }

    function updateAuthUI() {
        const isLoggedIn = !!currentUser;
        const isAdmin = currentUser?.role === 'admin';
        const isOperator = currentUser?.role === 'operator';

        $('btn-login-toggle').classList.toggle('hidden', isLoggedIn);
        $('user-info').classList.toggle('hidden', !isLoggedIn);

        if (isLoggedIn) {
            $('user-name').textContent = currentUser.username;
            const badge = $('user-role-badge');
            badge.textContent = isAdmin ? 'ADMIN' : 'OPERATOR';
            badge.className = `role-badge ${isAdmin ? 'role-admin' : 'role-operator'}`;
        }

        $('admin-tools').classList.toggle('hidden', !isAdmin);
        $('operator-tools').classList.toggle('hidden', !isOperator);
        $('info-actions').classList.toggle('hidden', !isAdmin);
    }

    // ===== MARKERS (from Supabase) =====
    async function loadMarkers() {
        const dbMarkers = await SupabaseDB.getMarkers();
        if (dbMarkers && dbMarkers.length > 0) {
            markers = dbMarkers;
        } else {
            // Fallback на локальный файл
            markers = JSON.parse(JSON.stringify(DEFAULT_MARKERS));
        }
    }

    // ===== VIEW SWITCHER =====
    function switchView(view) {
        currentView = view;
        $('view-map').classList.toggle('active', view === 'map');
        $('view-catalog').classList.toggle('active', view === 'catalog');
        $('view-suggestions').classList.toggle('active', view === 'suggestions');

        $('view-map-container').classList.toggle('hidden', view !== 'map');
        $('view-catalog-container').classList.toggle('hidden', view !== 'catalog');
        $('view-suggestions-container').classList.toggle('hidden', view !== 'suggestions');
        $('map-selector').classList.toggle('hidden', view !== 'map');

        if (view === 'catalog') renderCatalog();
        else if (view === 'suggestions') renderSuggestions();
        else if (view === 'map' && map) setTimeout(() => map.invalidateSize(), 100);
    }

    // ===== CATALOG =====
    function renderCatalog(searchQuery = '') {
        const grid = $('catalog-grid');
        grid.innerHTML = '';
        const query = searchQuery.toLowerCase().trim();
        const grouped = {};
        Object.keys(ICON_CONFIG).forEach(cat => { grouped[cat] = []; });

        markers.forEach(m => {
            if (!grouped[m.category]) return;
            if (query) {
                const name = (m.name || '').toLowerCase();
                const desc = (m.description || '').toLowerCase();
                const mapName = (MAPS_CONFIG.find(mc => mc.id === m.mapId)?.name || '').toLowerCase();
                if (!name.includes(query) && !desc.includes(query) && !mapName.includes(query)) return;
            }
            grouped[m.category].push(m);
        });

        const totalResults = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
        if (query && totalResults === 0) {
            grid.innerHTML = `<div class="catalog-no-results"><div class="catalog-no-results-icon">🔍</div><div>Ничего не найдено</div></div>`;
            return;
        }

        Object.keys(ICON_CONFIG).forEach(cat => {
            const cfg = ICON_CONFIG[cat];
            const items = grouped[cat];
            if (query && items.length === 0) return;

            const card = document.createElement('div');
            card.className = 'catalog-category';
            let locationsHtml = items.length === 0
                ? '<div class="catalog-empty">Пока нет точек</div>'
                : items.map(item => {
                    const mapCfg = MAPS_CONFIG.find(m => m.id === item.mapId);
                    return `<div class="catalog-location" data-marker-id="${item.id}" data-map-id="${item.mapId}">
                        <div class="catalog-loc-map">📍</div>
                        <div class="catalog-loc-info">
                            <div class="catalog-loc-name">${escapeHtml(item.name)}</div>
                            <div class="catalog-loc-meta"><span class="catalog-loc-map-name">${escapeHtml(mapCfg?.name || item.mapId)}</span></div>
                            <div class="catalog-loc-desc">${escapeHtml(item.description || '')}</div>
                        </div>
                        <div class="catalog-loc-arrow">›</div>
                    </div>`;
                }).join('');

            card.innerHTML = `<div class="catalog-cat-header">
                <div class="catalog-cat-icon">${getCategoryIconHtml(cat)}</div>
                <div class="catalog-cat-info"><div class="catalog-cat-title">${cfg.label}</div>
                <div class="catalog-cat-count">${items.length} ${plural(items.length, 'точка', 'точки', 'точек')}</div></div>
                </div><div class="catalog-locations">${locationsHtml}</div>`;
            grid.appendChild(card);
        });

        grid.querySelectorAll('.catalog-location').forEach(el => {
            el.addEventListener('click', () => goToMarker(el.dataset.mapId, el.dataset.markerId));
        });
    }

    // ===== SUGGESTIONS =====
    async function renderSuggestions(status = 'pending') {
        const list = $('suggestions-list');
        const empty = $('suggestions-empty');
        list.innerHTML = '';

        try {
            const suggestions = await SupabaseDB.getSuggestions(status);

            if (!suggestions || suggestions.length === 0) {
                list.classList.add('hidden');
                empty.classList.remove('hidden');
                empty.textContent = status === 'pending' ? 'Нет ожидающих предложений' :
                    status === 'approved' ? 'Нет одобренных предложений' : 'Нет отклонённых предложений';
                return;
            }

            list.classList.remove('hidden');
            empty.classList.add('hidden');

            suggestions.forEach(s => {
                const mapCfg = MAPS_CONFIG.find(m => m.id === s.map_id);
                const iconCfg = ICON_CONFIG[s.category] || {};
                const card = document.createElement('div');
                card.className = `suggestion-card suggestion-${s.status}`;
                card.innerHTML = `
                    <div class="suggestion-header">
                        <div class="suggestion-icon">${getCategoryIconHtml(s.category)}</div>
                        <div class="suggestion-info">
                            <div class="suggestion-name">${escapeHtml(s.name)}</div>
                            <div class="suggestion-meta">
                                <span class="catalog-loc-map-name">${escapeHtml(mapCfg?.name || s.map_id)}</span>
                                <span class="suggestion-author">от ${escapeHtml(s.created_by?.username || '?')}</span>
                                <span class="suggestion-date">${new Date(s.created_at).toLocaleDateString('ru')}</span>
                            </div>
                        </div>
                        <div class="suggestion-status-badge suggestion-status-${s.status}">
                            ${s.status === 'pending' ? '⏳' : s.status === 'approved' ? '✅' : '❌'}
                        </div>
                    </div>
                    ${s.description ? `<div class="suggestion-desc">${escapeHtml(s.description)}</div>` : ''}
                    ${s.screenshot ? `<div class="suggestion-screenshot"><img src="${s.screenshot}" alt=""></div>` : ''}
                    ${s.admin_comment ? `<div class="suggestion-comment">💬 ${escapeHtml(s.admin_comment)}</div>` : ''}
                `;

                // Кнопка рассмотреть (только для админа и pending)
                if (currentUser?.role === 'admin' && s.status === 'pending') {
                    const reviewBtn = document.createElement('button');
                    reviewBtn.className = 'btn-action btn-primary btn-small';
                    reviewBtn.textContent = '👁 Рассмотреть';
                    reviewBtn.addEventListener('click', () => openReviewModal(s));
                    card.appendChild(reviewBtn);
                }

                list.appendChild(card);
            });
        } catch (err) {
            console.error('Ошибка загрузки предложений:', err);
            list.innerHTML = '<div class="catalog-empty">Ошибка загрузки</div>';
        }
    }

    function openReviewModal(suggestion) {
        const body = $('review-body');
        const mapCfg = MAPS_CONFIG.find(m => m.id === suggestion.map_id);
        const iconCfg = ICON_CONFIG[suggestion.category] || {};

        body.innerHTML = `
            <div class="review-item"><strong>Название:</strong> ${escapeHtml(suggestion.name)}</div>
            <div class="review-item"><strong>Категория:</strong> ${getCategoryIconHtml(suggestion.category)} ${iconCfg.label || ''}</div>
            <div class="review-item"><strong>Карта:</strong> ${mapCfg?.name || suggestion.map_id}</div>
            <div class="review-item"><strong>Координаты:</strong> ${suggestion.lat.toFixed(0)}, ${suggestion.lng.toFixed(0)}</div>
            ${suggestion.description ? `<div class="review-item"><strong>Описание:</strong> ${escapeHtml(suggestion.description)}</div>` : ''}
            ${suggestion.screenshot ? `<div class="review-screenshot"><img src="${suggestion.screenshot}" alt=""></div>` : ''}
        `;

        $('review-suggestion-id').value = suggestion.id;
        $('review-comment').value = '';
        $('review-modal').classList.remove('hidden');

        // Сохраняем данные для одобрения
        $('review-modal').dataset.suggestion = JSON.stringify(suggestion);
    }

    async function handleReview(approve) {
        const suggestionId = $('review-suggestion-id').value;
        const comment = $('review-comment').value.trim();
        const status = approve ? 'approved' : 'rejected';

        try {
            await SupabaseDB.reviewSuggestion(suggestionId, status, comment, currentUser.id);

            // Если одобрено — добавляем как маркер
            if (approve) {
                const suggestion = JSON.parse($('review-modal').dataset.suggestion);
                const newMarker = {
                    id: 'sug_' + Date.now().toString(36),
                    mapId: suggestion.map_id,
                    name: suggestion.name,
                    category: suggestion.category,
                    lat: suggestion.lat,
                    lng: suggestion.lng,
                    description: suggestion.description || '',
                    screenshot: suggestion.screenshot || '',
                    userId: currentUser.id
                };
                await SupabaseDB.addMarker(newMarker);
                markers.push(newMarker);
                renderMarkers();
            }

            $('review-modal').classList.add('hidden');
            renderSuggestions('pending');
            notify(approve ? '✅ Предложение одобрено и добавлено' : '❌ Предложение отклонено');
        } catch (err) {
            console.error(err);
            notify('❌ Ошибка: ' + err.message);
        }
    }

    // ===== SCREENSHOT PASTE (Ctrl+V) =====
    function setupScreenshotPaste() {
        // Ctrl+V на всей странице когда форма открыта
        document.addEventListener('paste', async (e) => {
            if ($('marker-form-panel').classList.contains('hidden')) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    await handleScreenshotFile(file);
                    return;
                }
            }
        });

        // Drag & drop
        const dropzone = $('screenshot-dropzone');
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                await handleScreenshotFile(file);
            }
        });

        // File input
        $('screenshot-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await handleScreenshotFile(file);
            e.target.value = '';
        });

        $('btn-browse-screenshot').addEventListener('click', () => {
            $('screenshot-file').click();
        });

        $('btn-remove-screenshot').addEventListener('click', () => {
            clearScreenshotPreview();
        });
    }

    async function handleScreenshotFile(file) {
        // Показать превью
        const reader = new FileReader();
        reader.onload = (e) => {
            $('screenshot-preview-img').src = e.target.result;
            $('screenshot-preview').classList.remove('hidden');
            $('screenshot-dropzone').classList.add('hidden');
        };
        reader.readAsDataURL(file);

        // Загружаем
        try {
            notify('📷 Загрузка скриншота...');
            const url = await SupabaseDB.uploadScreenshot(file);
            $('form-screenshot').value = url;
            notify('✅ Скриншот загружен');
        } catch (err) {
            // Fallback — data URL
            const dataUrl = await SupabaseDB.fileToDataUrl(file);
            $('form-screenshot').value = dataUrl;
            notify('📷 Скриншот сохранён локально');
        }
    }

    function clearScreenshotPreview() {
        $('screenshot-preview').classList.add('hidden');
        $('screenshot-dropzone').classList.remove('hidden');
        $('screenshot-preview-img').src = '';
        $('form-screenshot').value = '';
    }

    // ===== MAP =====
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

    function loadImageAndInitMap(config) {
        $('map').style.opacity = '0.3';
        const img = new Image();
        img.onload = function () {
            initLeafletMap(config, config.image, [this.height, this.width]);
            $('map').style.opacity = '1';
        };
        img.onerror = function () {
            if (map) { map.remove(); map = null; }
            $('map').style.opacity = '1';
            $('map').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#e74c3c;text-align:center;padding:40px;">
                <p style="font-size:64px">⚠️</p><h2>Карта не найдена</h2>
                <p style="color:#555">Файл: <code style="color:#c8aa58">${config.image}</code></p></div>`;
        };
        img.src = config.image;
    }

    function initLeafletMap(config, imageUrl, imageBounds) {
        if (map) { map.remove(); map = null; }
        $('map').innerHTML = '';
        const h = imageBounds[0], w = imageBounds[1];
        const bounds = [[0, 0], [-h, w]];

        map = L.map('map', {
            crs: L.CRS.Simple, minZoom: config.minZoom, maxZoom: config.maxZoom,
            zoomSnap: 0.5, zoomDelta: 0.5, attributionControl: false,
            maxBounds: [[200, -200], [-h - 200, w + 200]], maxBoundsViscosity: 0.9
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

    // ===== MARKERS RENDER =====
    function renderMarkers() {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        leafletMarkers = {};

        const active = getActiveFilters();
        markers.filter(m => m.mapId === currentMapId && active.includes(m.category)).forEach(data => {
            const customIcon = L.divIcon({
                html: `<div class="marker-icon-wrapper marker-cat-${data.category}">${getCategoryIconHtml(data.category)}</div>`,
                className: 'custom-marker-icon', iconSize: [34, 34], iconAnchor: [17, 17]
            });
            const marker = L.marker([data.lat, data.lng], { icon: customIcon, title: data.name });
            marker.bindTooltip(data.name, { direction: 'top', offset: [0, -22] });
            marker.on('click', (e) => { L.DomEvent.stopPropagation(e); openInfoPanel(data); });
            marker.addTo(markersLayer);
            leafletMarkers[data.id] = marker;
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

    // ===== FILTERS =====
    function renderFilterItems() {
        const container = $('filter-group');
        container.innerHTML = '';
        Object.keys(ICON_CONFIG).forEach(cat => {
            const cfg = ICON_CONFIG[cat];
            const label = document.createElement('label');
            label.className = 'filter-item';
            label.innerHTML = `<input type="checkbox" data-category="${cat}" checked>
                <span class="filter-icon">${getCategoryIconHtml(cat)}</span>
                <span class="filter-label">${cfg.label}</span>
                <span class="filter-count" id="count-${cat}">0</span>`;
            container.appendChild(label);
        });
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', renderMarkers));
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
        const all = Array.from(cbs).every(cb => cb.checked);
        cbs.forEach(cb => cb.checked = !all);
        renderMarkers();
    }

    function renderCategoryDropdown() {
        const dropdown = $('form-category-dropdown');
        dropdown.innerHTML = '';
        Object.keys(ICON_CONFIG).forEach(cat => {
            const cfg = ICON_CONFIG[cat];
            const option = document.createElement('div');
            option.className = 'category-option';
            option.dataset.category = cat;
            option.innerHTML = `<span class="category-option-icon">${getCategoryIconHtml(cat)}</span>
                <span class="category-option-label">${cfg.label}</span>`;
            option.addEventListener('click', () => selectCategory(cat));
            dropdown.appendChild(option);
        });
    }

    function selectCategory(cat) {
        const cfg = ICON_CONFIG[cat];
        $('form-category').value = cat;
        const btn = $('form-category-btn');
        btn.querySelector('.category-btn-icon').innerHTML = getCategoryIconHtml(cat);
        const lbl = btn.querySelector('.category-btn-label');
        lbl.textContent = cfg.label;
        lbl.classList.remove('placeholder');
        $('form-category-dropdown').classList.add('hidden');
        btn.classList.remove('open');
    }

    function resetCategoryPicker() {
        $('form-category').value = '';
        const btn = $('form-category-btn');
        btn.querySelector('.category-btn-icon').innerHTML = '';
        const lbl = btn.querySelector('.category-btn-label');
        lbl.textContent = 'Выбрать...';
        lbl.classList.add('placeholder');
        $('form-category-dropdown').classList.add('hidden');
        btn.classList.remove('open');
    }

    // ===== INFO PANEL =====
    function openInfoPanel(data) {
        const iconCfg = ICON_CONFIG[data.category] || {};
        const mapCfg = MAPS_CONFIG.find(m => m.id === data.mapId);

        $('info-title').textContent = data.name;
        $('info-category').innerHTML = `${getCategoryIconHtml(data.category)} ${iconCfg.label || ''}`;
        $('info-category').style.color = iconCfg.color || '';
        $('info-text').textContent = data.description || 'Нет описания';
        $('info-coords').textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)}`;
        $('info-map-name').textContent = mapCfg ? mapCfg.name : data.mapId;

        const img = $('info-image');
        const noImg = $('info-no-image');
        if (data.screenshot) {
            img.src = data.screenshot; img.style.display = 'block'; noImg.classList.add('hidden');
            img.onerror = () => { img.style.display = 'none'; noImg.classList.remove('hidden'); };
        } else { img.style.display = 'none'; noImg.classList.remove('hidden'); }

        $('info-actions').classList.toggle('hidden', currentUser?.role !== 'admin');
        $('info-panel').dataset.markerId = data.id;
        $('info-panel').classList.remove('hidden');
        $('view-map-container').classList.add('info-open');
        setTimeout(() => { if (map) map.invalidateSize(); }, 350);
    }

    function closeInfoPanel() {
        $('info-panel').classList.add('hidden');
        $('view-map-container').classList.remove('info-open');
        setTimeout(() => { if (map) map.invalidateSize(); }, 350);
    }

    // ===== MAP CLICK =====
    function onMapClick(e) {
        if (!isAddingMarker) return;
        $('form-lat').value = e.latlng.lat.toFixed(2);
        $('form-lng').value = e.latlng.lng.toFixed(2);
        const hint = $('form-coords-hint');
        hint.classList.add('selected');
        hint.querySelector('.coords-icon').textContent = '✅';
        hint.querySelector('.coords-text').textContent = `${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;

        if (window._tempMarker) map.removeLayer(window._tempMarker);
        window._tempMarker = L.circleMarker(e.latlng, {
            radius: 12, color: '#c8aa58', fillColor: '#c8aa58', fillOpacity: 0.4, weight: 2, dashArray: '4'
        }).addTo(map);
    }

    // ===== ADD / SUGGEST / EDIT =====
    function startAddingMarker(mode = 'add') {
        if (!currentUser) return;
        if (mode === 'add' && currentUser.role !== 'admin') return;
        if (mode === 'suggest' && !currentUser) return;

        formMode = mode;
        isAddingMarker = true;
        editingMarkerId = null;

        $('marker-form').reset();
        $('form-id').value = '';
        $('form-lat').value = '';
        $('form-lng').value = '';
        $('form-mode').value = mode;
        resetCategoryPicker();
        clearScreenshotPreview();

        const hint = $('form-coords-hint');
        hint.classList.remove('selected');
        hint.querySelector('.coords-icon').textContent = '📍';
        hint.querySelector('.coords-text').textContent = 'Нажмите на карту';

        $('form-panel-title').textContent = mode === 'suggest' ? 'ПРЕДЛОЖИТЬ ТОЧКУ' : 'ДОБАВИТЬ ТОЧКУ';
        $('btn-submit-form').textContent = mode === 'suggest' ? '💡 Отправить предложение' : '💾 Сохранить';
        $('marker-form-panel').classList.remove('hidden');
        $('adding-hint').classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    function stopAddingMarker() {
        isAddingMarker = false;
        $('marker-form-panel').classList.add('hidden');
        $('adding-hint').classList.add('hidden');
        $('map').style.cursor = '';
        $('form-category-dropdown').classList.add('hidden');
        $('form-category-btn').classList.remove('open');
        if (window._tempMarker && map) { map.removeLayer(window._tempMarker); window._tempMarker = null; }
    }

    function startEditingMarker() {
        if (currentUser?.role !== 'admin') return;
        const id = $('info-panel').dataset.markerId;
        const data = markers.find(m => m.id === id);
        if (!data) return;

        formMode = 'edit';
        isAddingMarker = true;
        editingMarkerId = id;

        $('form-id').value = data.id;
        $('form-name').value = data.name;
        $('form-description').value = data.description || '';
        $('form-lat').value = data.lat;
        $('form-lng').value = data.lng;
        $('form-mode').value = 'edit';
        selectCategory(data.category);

        if (data.screenshot) {
            $('screenshot-preview-img').src = data.screenshot;
            $('screenshot-preview').classList.remove('hidden');
            $('screenshot-dropzone').classList.add('hidden');
            $('form-screenshot').value = data.screenshot;
        } else {
            clearScreenshotPreview();
        }

        const hint = $('form-coords-hint');
        hint.classList.add('selected');
        hint.querySelector('.coords-icon').textContent = '✅';
        hint.querySelector('.coords-text').textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)}`;

        $('form-panel-title').textContent = 'РЕДАКТИРОВАТЬ';
        $('btn-submit-form').textContent = '💾 Сохранить';
        $('marker-form-panel').classList.remove('hidden');
        $('adding-hint').classList.remove('hidden');
        $('map').style.cursor = 'crosshair';
    }

    async function saveMarker(e) {
        e.preventDefault();
        const lat = parseFloat($('form-lat').value);
        const lng = parseFloat($('form-lng').value);
        const category = $('form-category').value;
        const mode = $('form-mode').value;

        if (!category) { notify('⚠️ Выберите категорию!'); return; }
        if (isNaN(lat) || isNaN(lng)) { notify('⚠️ Кликните по карте!'); return; }

        const data = {
            mapId: currentMapId,
            name: $('form-name').value.trim(),
            category, lat, lng,
            description: $('form-description').value.trim(),
            screenshot: $('form-screenshot').value.trim(),
            userId: currentUser?.id
        };

        try {
            if (mode === 'suggest') {
                await SupabaseDB.addSuggestion(data);
                notify('💡 Предложение отправлено!');
            } else if (mode === 'edit' && editingMarkerId) {
                data.id = editingMarkerId;
                await SupabaseDB.updateMarker(data);
                const i = markers.findIndex(m => m.id === editingMarkerId);
                if (i !== -1) markers[i] = { ...markers[i], ...data };
                notify('✅ Точка обновлена');
            } else {
                data.id = generateId();
                await SupabaseDB.addMarker(data);
                markers.push(data);
                notify('✅ Точка добавлена');
            }
        } catch (err) {
            console.error(err);
            notify('❌ Ошибка: ' + err.message);
            return;
        }

        stopAddingMarker();
        renderMarkers();
        closeInfoPanel();
    }

    async function deleteMarker() {
        if (currentUser?.role !== 'admin') return;
        const id = $('info-panel').dataset.markerId;
        if (!confirm('Удалить эту точку?')) return;

        try {
            await SupabaseDB.deleteMarker(id);
            markers = markers.filter(m => m.id !== id);
            renderMarkers();
            closeInfoPanel();
            notify('🗑️ Точка удалена');
        } catch (err) {
            notify('❌ Ошибка: ' + err.message);
        }
    }

    // ===== NAV HELPERS =====
    function goToMarker(mapId, markerId) {
        switchView('map');
        if (currentMapId !== mapId) {
            switchMap(mapId);
            setTimeout(() => highlightAndFocus(markerId), 800);
        } else {
            setTimeout(() => highlightAndFocus(markerId), 200);
        }
    }

    function highlightAndFocus(markerId) {
        const data = markers.find(m => m.id === markerId);
        if (!data || !map) return;
        map.setView([data.lat, data.lng], Math.max(map.getZoom(), 1), { animate: true });
        setTimeout(() => openInfoPanel(data), 300);
        const lm = leafletMarkers[markerId];
        if (lm) {
            const el = lm.getElement();
            if (el) { el.classList.add('marker-highlighted'); setTimeout(() => el.classList.remove('marker-highlighted'), 4000); }
        }
    }

    // ===== SHARE LINK =====
    function shareMarker() {
        const id = $('info-panel').dataset.markerId;
        const data = markers.find(m => m.id === id);
        if (!data) return;
        const url = generateShareUrl(data);
        navigator.clipboard.writeText(url).then(() => {
            notify('🔗 Ссылка скопирована!');
        }).catch(() => {
            prompt('Скопируйте ссылку:', url);
        });
    }

    // ===== HELPERS =====
    function plural(n, one, few, many) {
        n = Math.abs(n) % 100; const n1 = n % 10;
        if (n > 10 && n < 20) return many;
        if (n1 > 1 && n1 < 5) return few;
        if (n1 === 1) return one; return many;
    }
    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function generateId() { return currentMapId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5); }
    function notify(text) {
        const el = $('notification');
        $('notification-text').textContent = text;
        el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, 2500);
    }

    // ===== EVENTS =====
    function setupEventListeners() {
        $('view-map').addEventListener('click', () => switchView('map'));
        $('view-catalog').addEventListener('click', () => switchView('catalog'));
        $('view-suggestions').addEventListener('click', () => switchView('suggestions'));
        $('catalog-search').addEventListener('input', (e) => renderCatalog(e.target.value));

        // Suggestion tabs
        document.querySelectorAll('.suggestion-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.suggestion-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSuggestions(tab.dataset.status);
            });
        });

        $('btn-toggle-all').addEventListener('click', toggleAllFilters);
        $('close-info').addEventListener('click', closeInfoPanel);
        $('btn-edit-marker').addEventListener('click', startEditingMarker);
        $('btn-delete-marker').addEventListener('click', deleteMarker);
        $('btn-share-marker').addEventListener('click', shareMarker);

        // Auth
        $('btn-login-toggle').addEventListener('click', () => {
            $('login-modal').classList.remove('hidden');
            $('login-username').value = '';
            $('login-password').value = '';
            $('login-error').classList.add('hidden');
        });
        $('login-form').addEventListener('submit', handleLogin);
        $('btn-cancel-login').addEventListener('click', () => $('login-modal').classList.add('hidden'));
        $('btn-close-login').addEventListener('click', () => $('login-modal').classList.add('hidden'));
        $('btn-logout').addEventListener('click', handleLogout);

        // Add / Suggest
        $('btn-add-marker').addEventListener('click', () => startAddingMarker('add'));
        $('btn-suggest-marker').addEventListener('click', () => startAddingMarker('suggest'));
        $('marker-form').addEventListener('submit', saveMarker);
        $('btn-cancel-form').addEventListener('click', stopAddingMarker);
        $('btn-close-form').addEventListener('click', stopAddingMarker);

        // Category dropdown
        $('form-category-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            $('form-category-dropdown').classList.toggle('hidden');
            $('form-category-btn').classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.category-picker')) {
                $('form-category-dropdown').classList.add('hidden');
                $('form-category-btn').classList.remove('open');
            }
        });

        // Review modal
        $('btn-close-review').addEventListener('click', () => $('review-modal').classList.add('hidden'));
        $('btn-approve-suggestion').addEventListener('click', () => handleReview(true));
        $('btn-reject-suggestion').addEventListener('click', () => handleReview(false));

        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(o => {
            o.addEventListener('click', () => {
                $('login-modal').classList.add('hidden');
                $('review-modal').classList.add('hidden');
            });
        });

        // ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isAddingMarker) stopAddingMarker();
                $('login-modal').classList.add('hidden');
                $('review-modal').classList.add('hidden');
                closeInfoPanel();
            }
        });

        $('info-image').addEventListener('click', () => {
            if ($('info-image').src) window.open($('info-image').src, '_blank');
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();