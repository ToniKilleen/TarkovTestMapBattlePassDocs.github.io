(function () {
    'use strict';

    // ===== НАСТРОЙКИ =====
    const AUTO_REFRESH_INTERVAL = 15000; // 15 секунд

    let map = null;
    let imageOverlay = null;
    let currentMapId = null;
    let markersLayer = null;
    let suggestionsLayer = null;
    let markers = [];
    let suggestions = [];
    let leafletMarkers = {};
    let leafletSuggestions = {};
    let currentUser = null;
    let isAddingMarker = false;
    let editingMarkerId = null;
    let iconCache = {};
    let currentView = 'map';
    let formMode = 'add';
    let autoRefreshTimer = null;
    let previousPendingCount = 0;
    let isTabVisible = true;

    const $ = id => document.getElementById(id);

    function init() {
        checkUrlParams();
        preloadIcons().then(async () => {
            await loadMarkers();
            renderMapTabs();
            renderFilterItems();
            renderCategoryDropdown();
            setupEventListeners();
            setupScreenshotPaste();
            setupVisibilityDetection();
            initVersionSystem();
            switchMap(MAPS_CONFIG[0].id);
            restoreSession();
            setTimeout(handleUrlParams, 500);
        });
    }

    // ===== VERSION SYSTEM =====
    function initVersionSystem() {
        if (typeof CURRENT_VERSION !== 'undefined') {
            const vNum = $('version-number');
            if (vNum) vNum.textContent = CURRENT_VERSION;
        }
        renderVersionChangelog();
    }

    function renderVersionChangelog() {
        const body = $('version-body');
        if (!body || typeof CHANGELOG === 'undefined') return;
        if (!CHANGELOG || CHANGELOG.length === 0) {
            body.innerHTML = '<div class="catalog-empty">История версий пуста</div>';
            return;
        }
        body.innerHTML = CHANGELOG.map((entry, idx) => {
            const isCurrent = idx === 0 && entry.version === (typeof CURRENT_VERSION !== 'undefined' ? CURRENT_VERSION : '');
            return `<div class="version-entry ${isCurrent ? 'version-entry-current' : ''}">
                <div class="version-entry-header">
                    <span class="version-entry-badge">v${escapeHtml(entry.version)}</span>
                    ${isCurrent ? '<span class="version-entry-current-label">Текущая</span>' : ''}
                    <span class="version-entry-title">${escapeHtml(entry.title || '')}</span>
                    <span class="version-entry-date">${escapeHtml(entry.date || '')}</span>
                </div>
                <ul class="version-entry-changes">
                    ${(entry.changes || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                </ul>
            </div>`;
        }).join('');
    }

    function openVersionModal() {
        renderVersionChangelog();
        $('version-modal').classList.remove('hidden');
    }

    // ===== ОТСЛЕЖИВАНИЕ ВИДИМОСТИ ВКЛАДКИ =====
    // Не тратим трафик если пользователь свернул вкладку
    function setupVisibilityDetection() {
        document.addEventListener('visibilitychange', () => {
            isTabVisible = !document.hidden;
            console.log('Вкладка ' + (isTabVisible ? 'активна' : 'свёрнута'));

            if (isTabVisible && currentUser) {
                // Вернулись на вкладку — сразу обновляем
                refreshData(false);
            }
        });
    }

    // ===== АВТООБНОВЛЕНИЕ =====
    function startAutoRefresh() {
        stopAutoRefresh();
        if (!currentUser) return;

        console.log(`⏰ Автообновление запущено (каждые ${AUTO_REFRESH_INTERVAL / 1000} сек)`);
        $('autorefresh-status').classList.remove('hidden');

        autoRefreshTimer = setInterval(() => {
            if (isTabVisible) {
                refreshData(true);
            }
        }, AUTO_REFRESH_INTERVAL);
    }

    function stopAutoRefresh() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            console.log('⏰ Автообновление остановлено');
        }
        $('autorefresh-status').classList.add('hidden');
    }

    // Обновление данных (маркеры + предложения)
    async function refreshData(silent = false) {
        if (!silent) {
            $('btn-refresh').classList.add('refreshing');
        }

        try {
            const prevCount = suggestions.length;

            await loadMarkers();
            await loadSuggestions();

            renderMarkers();
            updatePendingBadge();

            if (currentView === 'suggestions') {
                const activeTab = document.querySelector('.suggestion-tab.active');
                renderSuggestions(activeTab?.dataset.status || 'pending');
            }

            // Уведомление о новых предложениях (только для админа)
            if (silent && currentUser?.role === 'admin') {
                const newCount = suggestions.length;
                if (newCount > prevCount) {
                    const diff = newCount - prevCount;
                    notify(`💡 ${diff === 1 ? 'Новое предложение' : `Новых предложений: ${diff}`}!`);
                    playNotificationSound();
                }
            }

            if (!silent) {
                notify('✅ Данные обновлены');
            }
        } catch (err) {
            console.error('Ошибка обновления:', err);
            if (!silent) notify('❌ Ошибка обновления');
        } finally {
            setTimeout(() => {
                $('btn-refresh').classList.remove('refreshing');
            }, 500);
        }
    }

    // Звук уведомления (короткий бип)
    function playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
            audio.volume = 0.3;
            audio.play().catch(() => {}); // Молча игнорируем если браузер блокирует
        } catch (e) {}
    }

    // ===== БЕЙДЖ С КОЛИЧЕСТВОМ ОЖИДАЮЩИХ =====
    function updatePendingBadge() {
        const badge = $('pending-badge');
        if (!currentUser) {
            badge.classList.add('hidden');
            return;
        }

        // Для админа — общее количество pending
        // Для оператора — только свои
        const count = suggestions.length;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // ===== URL PARAMS =====
    let pendingUrlMap = null;
    let pendingUrlMarker = null;
    let pendingUrlSuggestion = null;

    function checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        pendingUrlMap = params.get('map');
        pendingUrlMarker = params.get('marker');
        pendingUrlSuggestion = params.get('suggestion');
    }

    function handleUrlParams() {
        if (pendingUrlMap) {
            const config = MAPS_CONFIG.find(m => m.id === pendingUrlMap);
            if (config) {
                switchMap(pendingUrlMap);
                if (pendingUrlMarker) {
                    setTimeout(() => highlightAndFocusMarker(pendingUrlMarker), 600);
                } else if (pendingUrlSuggestion) {
                    setTimeout(() => highlightAndFocusSuggestion(pendingUrlSuggestion), 600);
                }
            }
        }
        if (pendingUrlMap || pendingUrlMarker || pendingUrlSuggestion) {
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
        if (iconCache[category]) return `<img src="${cfg.icon}" alt="${cfg.label}">`;
        return `<span class="emoji-fallback">${cfg.emoji || '📌'}</span>`;
    }

    // ===== AUTH =====
    function restoreSession() {
        const saved = localStorage.getItem('tarkov_user');
        if (saved) {
            try {
                currentUser = JSON.parse(saved);
                updateAuthUI();
                loadSuggestions().then(() => {
                    renderMarkers();
                    updatePendingBadge();
                    startAutoRefresh();
                });
            } catch (e) { localStorage.removeItem('tarkov_user'); }
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = $('login-username').value.trim();
        const password = $('login-password').value;
        try {
            const user = await SupabaseDB.login(username, password);
            if (!user) { $('login-error').classList.remove('hidden'); return; }
            currentUser = { id: user.id, username: user.username, role: user.role };
            localStorage.setItem('tarkov_user', JSON.stringify(currentUser));
            $('login-modal').classList.add('hidden');
            updateAuthUI();
            await loadSuggestions();
            renderMarkers();
            updatePendingBadge();
            startAutoRefresh();
            notify(`✅ Добро пожаловать, ${user.username}!`);
        } catch (err) {
            $('login-error').classList.remove('hidden');
            console.error(err);
        }
    }

    function handleLogout() {
        stopAutoRefresh();
        currentUser = null;
        suggestions = [];
        localStorage.removeItem('tarkov_user');
        updateAuthUI();
        closeInfoPanel();
        stopAddingMarker();
        renderMarkers();
        updatePendingBadge();
        notify('Вы вышли из аккаунта');
    }

    function updateAuthUI() {
        const isLoggedIn = !!currentUser;
        const isAdmin = currentUser?.role === 'admin';
        const isOperator = currentUser?.role === 'operator';

        $('btn-login-toggle').classList.toggle('hidden', isLoggedIn);
        $('user-info').classList.toggle('hidden', !isLoggedIn);
        $('view-suggestions').classList.toggle('hidden', !isLoggedIn);
        $('btn-refresh').classList.toggle('hidden', !isLoggedIn);

        if (isLoggedIn) {
            $('user-name').textContent = currentUser.username;
            const badge = $('user-role-badge');
            badge.textContent = isAdmin ? 'ADMIN' : 'OPERATOR';
            badge.className = `role-badge ${isAdmin ? 'role-admin' : 'role-operator'}`;
        }

        $('admin-tools').classList.toggle('hidden', !isAdmin);
        $('operator-tools').classList.toggle('hidden', !isOperator);
    }

    // ===== LOADING =====
    async function loadMarkers() {
        const dbMarkers = await SupabaseDB.getMarkers();
        markers = dbMarkers || [];
    }

    async function loadSuggestions() {
        if (!currentUser) { suggestions = []; return; }
        try {
            const all = await SupabaseDB.getSuggestions('pending');
            if (currentUser.role === 'admin') {
                suggestions = all;
            } else {
                suggestions = all.filter(s => s.created_by === currentUser.id);
            }
        } catch (err) {
            console.error('Ошибка загрузки предложений:', err);
            suggestions = [];
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

        const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
        if (query && total === 0) {
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
            let sugs = await SupabaseDB.getSuggestions(status);

            if (currentUser?.role === 'operator') {
                sugs = sugs.filter(s => s.created_by === currentUser.id);
            }

            if (!sugs || sugs.length === 0) {
                list.classList.add('hidden');
                empty.classList.remove('hidden');
                empty.textContent = status === 'pending' ? 'Нет ожидающих предложений' :
                    status === 'approved' ? 'Нет одобренных предложений' : 'Нет отклонённых предложений';
                return;
            }

            list.classList.remove('hidden');
            empty.classList.add('hidden');

            sugs.forEach(s => {
                const mapCfg = MAPS_CONFIG.find(m => m.id === s.map_id);
                const author = s.author_username || '?';
                const card = document.createElement('div');
                card.className = `suggestion-card suggestion-${s.status}`;
                card.innerHTML = `
                    <div class="suggestion-header">
                        <div class="suggestion-icon">${getCategoryIconHtml(s.category)}</div>
                        <div class="suggestion-info">
                            <div class="suggestion-name">${escapeHtml(s.name)}</div>
                            <div class="suggestion-meta">
                                <span class="catalog-loc-map-name">${escapeHtml(mapCfg?.name || s.map_id)}</span>
                                <span class="suggestion-author">от ${escapeHtml(author)}</span>
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
                    <div class="suggestion-actions"></div>
                `;

                const actionsDiv = card.querySelector('.suggestion-actions');

                if (s.status === 'pending') {
                    const gotoBtn = document.createElement('button');
                    gotoBtn.className = 'btn-action btn-ghost btn-small';
                    gotoBtn.innerHTML = '🗺 На карте';
                    gotoBtn.addEventListener('click', () => goToSuggestion(s.map_id, s.id));
                    actionsDiv.appendChild(gotoBtn);

                    if (currentUser?.role === 'admin') {
                        const reviewBtn = document.createElement('button');
                        reviewBtn.className = 'btn-action btn-primary btn-small';
                        reviewBtn.innerHTML = '👁 Рассмотреть';
                        reviewBtn.addEventListener('click', () => openReviewModal(s));
                        actionsDiv.appendChild(reviewBtn);
                    }
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
        $('review-modal').dataset.suggestion = JSON.stringify(suggestion);
    }

    async function handleReview(approve) {
        const suggestionId = $('review-suggestion-id').value;
        const comment = $('review-comment').value.trim();
        const status = approve ? 'approved' : 'rejected';

        try {
            await SupabaseDB.reviewSuggestion(suggestionId, status, comment, currentUser.id);

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
            }

            $('review-modal').classList.add('hidden');
            await loadSuggestions();
            renderMarkers();
            updatePendingBadge();

            if (currentView === 'suggestions') {
                const activeTab = document.querySelector('.suggestion-tab.active');
                renderSuggestions(activeTab?.dataset.status || 'pending');
            }

            notify(approve ? '✅ Предложение одобрено и добавлено' : '❌ Предложение отклонено');
            closeInfoPanel();
        } catch (err) {
            console.error(err);
            notify('❌ Ошибка: ' + err.message);
        }
    }

    // ===== SCREENSHOT UPLOAD =====
    function setupScreenshotPaste() {
        document.addEventListener('paste', async (e) => {
            if ($('marker-form-panel').classList.contains('hidden')) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    await handleScreenshotFile(item.getAsFile());
                    return;
                }
            }
        });

        const dropzone = $('screenshot-dropzone');
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) await handleScreenshotFile(file);
        });

        $('screenshot-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await handleScreenshotFile(file);
            e.target.value = '';
        });

        $('btn-browse-screenshot').addEventListener('click', () => $('screenshot-file').click());
        $('btn-remove-screenshot').addEventListener('click', () => clearScreenshotPreview());
    }

    async function handleScreenshotFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            $('screenshot-preview-img').src = e.target.result;
            $('screenshot-preview').classList.remove('hidden');
            $('screenshot-dropzone').classList.add('hidden');
        };
        reader.readAsDataURL(file);

        try {
            notify('📷 Загрузка скриншота...');
            const url = await SupabaseDB.uploadScreenshot(file);
            $('form-screenshot').value = url;
            notify('✅ Скриншот загружен');
        } catch (err) {
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
        suggestionsLayer = L.layerGroup().addTo(map);

        map.on('click', onMapClick);
        map.on('mousemove', (e) => {
            $('cursor-coords').textContent = `${e.latlng.lat.toFixed(0)}, ${e.latlng.lng.toFixed(0)}`;
        });

        renderMarkers();
        updateFilterCounts();
    }

    function renderMarkers() {
        if (!markersLayer || !suggestionsLayer) return;
        markersLayer.clearLayers();
        suggestionsLayer.clearLayers();
        leafletMarkers = {};
        leafletSuggestions = {};

        const active = getActiveFilters();

        markers.filter(m => m.mapId === currentMapId && active.includes(m.category)).forEach(data => {
            const customIcon = L.divIcon({
                html: `<div class="marker-icon-wrapper marker-cat-${data.category}">${getCategoryIconHtml(data.category)}</div>`,
                className: 'custom-marker-icon', iconSize: [34, 34], iconAnchor: [17, 17]
            });
            const marker = L.marker([data.lat, data.lng], { icon: customIcon, title: data.name });
            marker.bindTooltip(data.name, { direction: 'top', offset: [0, -22] });
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                openInfoPanel(data, 'marker');
            });
            marker.addTo(markersLayer);
            leafletMarkers[data.id] = marker;
        });

        if (currentUser) {
            suggestions.filter(s => s.map_id === currentMapId && active.includes(s.category)).forEach(data => {
                const customIcon = L.divIcon({
                    html: `<div class="marker-icon-wrapper marker-suggestion marker-cat-${data.category}">
                        ${getCategoryIconHtml(data.category)}
                        <div class="suggestion-badge">?</div>
                    </div>`,
                    className: 'custom-marker-icon suggestion-marker', iconSize: [34, 34], iconAnchor: [17, 17]
                });
                const marker = L.marker([data.lat, data.lng], { icon: customIcon, title: `[Предложение] ${data.name}` });
                marker.bindTooltip(`💡 ${data.name}`, { direction: 'top', offset: [0, -22] });
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    openInfoPanel(data, 'suggestion');
                });
                marker.addTo(suggestionsLayer);
                leafletSuggestions[data.id] = marker;
            });
        }

        updateFilterCounts();
    }

    function updateFilterCounts() {
        Object.keys(ICON_CONFIG).forEach(cat => {
            const count = markers.filter(m => m.mapId === currentMapId && m.category === cat).length;
            const sugCount = currentUser ? suggestions.filter(s => s.map_id === currentMapId && s.category === cat).length : 0;
            const el = $(`count-${cat}`);
            if (el) el.textContent = sugCount > 0 ? `${count}+${sugCount}` : count;
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
    function openInfoPanel(data, type = 'marker') {
        const iconCfg = ICON_CONFIG[data.category] || {};
        const mapId = type === 'suggestion' ? data.map_id : data.mapId;
        const mapCfg = MAPS_CONFIG.find(m => m.id === mapId);

        $('info-title').textContent = data.name;
        $('info-category').innerHTML = `${getCategoryIconHtml(data.category)} ${iconCfg.label || ''}`;
        $('info-category').style.color = iconCfg.color || '';
        $('info-text').textContent = data.description || 'Нет описания';
        $('info-coords').textContent = `${data.lat.toFixed(0)}, ${data.lng.toFixed(0)}`;
        $('info-map-name').textContent = mapCfg ? mapCfg.name : mapId;

        const suggBadge = $('info-suggestion-badge');
        if (type === 'suggestion') {
            suggBadge.classList.remove('hidden');
            const author = data.author_username || '?';
            suggBadge.innerHTML = `💡 <strong>ПРЕДЛОЖЕНИЕ</strong> от ${escapeHtml(author)}`;
        } else {
            suggBadge.classList.add('hidden');
        }

        const img = $('info-image');
        const noImg = $('info-no-image');
        if (data.screenshot) {
            img.src = data.screenshot; img.style.display = 'block'; noImg.classList.add('hidden');
            img.onerror = () => { img.style.display = 'none'; noImg.classList.remove('hidden'); };
        } else { img.style.display = 'none'; noImg.classList.remove('hidden'); }

        updateInfoActions(type);

        $('info-panel').dataset.markerId = data.id;
        $('info-panel').dataset.type = type;
        $('info-panel').classList.remove('hidden');
        $('view-map-container').classList.add('info-open');
        setTimeout(() => { if (map) map.invalidateSize(); }, 350);
    }

    function updateInfoActions(type) {
        const isAdmin = currentUser?.role === 'admin';
        const markerActions = $('info-actions-marker');
        const suggestionActions = $('info-actions-suggestion');
        const shareBtn = $('btn-share-marker');

        if (type === 'suggestion') {
            markerActions.classList.add('hidden');
            shareBtn.classList.add('hidden');
            suggestionActions.classList.toggle('hidden', !isAdmin);
        } else {
            suggestionActions.classList.add('hidden');
            shareBtn.classList.remove('hidden');
            markerActions.classList.toggle('hidden', !isAdmin);
        }
    }

    function closeInfoPanel() {
        $('info-panel').classList.add('hidden');
        $('view-map-container').classList.remove('info-open');
        setTimeout(() => { if (map) map.invalidateSize(); }, 350);
    }

    async function approveSuggestionFromPanel() {
        const id = $('info-panel').dataset.markerId;
        const suggestion = suggestions.find(s => s.id === id);
        if (!suggestion) return;
        if (!confirm(`Одобрить предложение "${suggestion.name}"?`)) return;

        try {
            await SupabaseDB.reviewSuggestion(suggestion.id, 'approved', '', currentUser.id);
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
            await loadSuggestions();
            renderMarkers();
            updatePendingBadge();
            closeInfoPanel();
            notify('✅ Предложение одобрено');
        } catch (err) { notify('❌ Ошибка: ' + err.message); }
    }

    async function rejectSuggestionFromPanel() {
        const id = $('info-panel').dataset.markerId;
        const suggestion = suggestions.find(s => s.id === id);
        if (!suggestion) return;
        const comment = prompt('Причина отклонения (необязательно):', '');
        if (comment === null) return;

        try {
            await SupabaseDB.reviewSuggestion(suggestion.id, 'rejected', comment || '', currentUser.id);
            await loadSuggestions();
            renderMarkers();
            updatePendingBadge();
            closeInfoPanel();
            notify('❌ Предложение отклонено');
        } catch (err) { notify('❌ Ошибка: ' + err.message); }
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
                await loadSuggestions();
                updatePendingBadge();
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
        } catch (err) { notify('❌ Ошибка: ' + err.message); }
    }

    // ===== NAV =====
    function goToMarker(mapId, markerId) {
        switchView('map');
        if (currentMapId !== mapId) {
            switchMap(mapId);
            setTimeout(() => highlightAndFocusMarker(markerId), 800);
        } else {
            setTimeout(() => highlightAndFocusMarker(markerId), 200);
        }
    }

    function goToSuggestion(mapId, suggestionId) {
        switchView('map');
        if (currentMapId !== mapId) {
            switchMap(mapId);
            setTimeout(() => highlightAndFocusSuggestion(suggestionId), 800);
        } else {
            setTimeout(() => highlightAndFocusSuggestion(suggestionId), 200);
        }
    }

    function highlightAndFocusMarker(markerId) {
        const data = markers.find(m => m.id === markerId);
        if (!data || !map) return;
        map.setView([data.lat, data.lng], Math.max(map.getZoom(), 1), { animate: true });
        setTimeout(() => openInfoPanel(data, 'marker'), 300);
        const lm = leafletMarkers[markerId];
        if (lm) {
            const el = lm.getElement();
            if (el) { el.classList.add('marker-highlighted'); setTimeout(() => el.classList.remove('marker-highlighted'), 4000); }
        }
    }

    function highlightAndFocusSuggestion(suggestionId) {
        const data = suggestions.find(s => s.id === suggestionId);
        if (!data || !map) return;
        map.setView([data.lat, data.lng], Math.max(map.getZoom(), 1), { animate: true });
        setTimeout(() => openInfoPanel(data, 'suggestion'), 300);
        const lm = leafletSuggestions[suggestionId];
        if (lm) {
            const el = lm.getElement();
            if (el) { el.classList.add('marker-highlighted'); setTimeout(() => el.classList.remove('marker-highlighted'), 4000); }
        }
    }

    function shareMarker() {
        const id = $('info-panel').dataset.markerId;
        const data = markers.find(m => m.id === id);
        if (!data) return;
        const url = generateShareUrl(data);
        navigator.clipboard.writeText(url).then(() => notify('🔗 Ссылка скопирована!'))
            .catch(() => prompt('Скопируйте ссылку:', url));
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
        $('btn-approve-panel').addEventListener('click', approveSuggestionFromPanel);
        $('btn-reject-panel').addEventListener('click', rejectSuggestionFromPanel);

        // Кнопка ручного обновления
        $('btn-refresh').addEventListener('click', () => refreshData(false));

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

        $('btn-add-marker').addEventListener('click', () => startAddingMarker('add'));
        $('btn-suggest-marker').addEventListener('click', () => startAddingMarker('suggest'));
        $('marker-form').addEventListener('submit', saveMarker);
        $('btn-cancel-form').addEventListener('click', stopAddingMarker);
        $('btn-close-form').addEventListener('click', stopAddingMarker);

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

        $('btn-close-review').addEventListener('click', () => $('review-modal').classList.add('hidden'));
        $('btn-approve-suggestion').addEventListener('click', () => handleReview(true));
        $('btn-reject-suggestion').addEventListener('click', () => handleReview(false));

        $('btn-close-version').addEventListener('click', () => $('version-modal').classList.add('hidden'));
        $('version-badge').addEventListener('click', () => openVersionModal());

        document.querySelectorAll('.modal-overlay').forEach(o => {
            o.addEventListener('click', () => {
                $('login-modal').classList.add('hidden');
                $('review-modal').classList.add('hidden');
                $('version-modal').classList.add('hidden');
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isAddingMarker) stopAddingMarker();
                $('login-modal').classList.add('hidden');
                $('review-modal').classList.add('hidden');
                $('version-modal').classList.add('hidden');
                closeInfoPanel();
            }
            // F5 = ручное обновление (перехватываем стандартный F5)
            if (e.key === 'F5' && currentUser) {
                e.preventDefault();
                refreshData(false);
            }
        });

        $('info-image').addEventListener('click', () => {
            if ($('info-image').src) window.open($('info-image').src, '_blank');
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();