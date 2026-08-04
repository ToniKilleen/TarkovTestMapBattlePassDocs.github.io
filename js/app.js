    function openInfoPanel(data) {
        const iconCfg = ICON_CONFIG[data.category] || {};
        const mapCfg = MAPS_CONFIG.find(m => m.id === data.mapId);

        $('info-title').textContent = data.name;
        $('info-category').innerHTML = `${getCategoryIconHtml(data.category)} ${iconCfg.label || ''}`;
        $('info-category').style.color = iconCfg.color || '';
        $('info-category').style.borderColor = iconCfg.color || '';
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

        // ⬇ Сжимаем карту чтобы она не заезжала под панель
        $('view-map-container').classList.add('info-open');

        // Пересчитываем размер Leaflet карты после анимации
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 350);
    }

    function closeInfoPanel() {
        $('info-panel').classList.add('hidden');

        // ⬇ Возвращаем карту в полный размер
        $('view-map-container').classList.remove('info-open');

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 350);
    }