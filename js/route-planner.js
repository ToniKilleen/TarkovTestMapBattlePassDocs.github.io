/**
 * Kord Breach Маршрутка — планировщик маршрута для фарма документов
 * 
 * Как это работает на картинке-карте (CRS.Simple):
 * 1. Карта - это просто картинка, Leaflet считает координаты как пиксели: lat = -y, lng = x
 * 2. Расстояние между точками = евклидово расстояние в пикселях
 * 3. Задача = TSP (Traveling Salesman Problem) — найти кратчайший путь по всем точкам
 * 4. Рисуем L.polyline с номером порядка
 */

class RoutePlanner {
    constructor(mapInstance) {
        this.map = mapInstance;
        this.routeLine = null;
        this.routeMarkers = [];
        this.currentRoute = [];
    }

    // Евклидово расстояние между двумя точками на картинке
    distance(p1, p2) {
        const dx = p1.lat - p2.lat;
        const dy = p1.lng - p2.lng;
        return Math.sqrt(dx*dx + dy*dy);
    }

    // Получить все активные маркеры текущей карты
    getActivePoints() {
        // Берем из глобальных markers + фильтры
        const activeFilters = Array.from(document.querySelectorAll('.filter-group input:checked')).map(cb => cb.dataset.category);
        const currentMapId = window.currentMapId || 'customs'; // из app.js
        return window.markers ? window.markers.filter(m => m.mapId === currentMapId && activeFilters.includes(m.category)) : [];
    }

    // Решение TSP: Nearest Neighbor + 2-opt улучшение
    solveTSP(points, startIndex = 0) {
        if (points.length < 2) return points;

        // 1. Nearest Neighbor
        let unvisited = [...points];
        let route = [];
        let current = unvisited.splice(startIndex, 1)[0];
        route.push(current);

        while (unvisited.length > 0) {
            let nearestIdx = 0;
            let nearestDist = this.distance(current, unvisited[0]);
            for (let i = 1; i < unvisited.length; i++) {
                const d = this.distance(current, unvisited[i]);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            }
            current = unvisited.splice(nearestIdx, 1)[0];
            route.push(current);
        }

        // 2. 2-opt оптимизация (убираем пересечения)
        let improved = true;
        while (improved) {
            improved = false;
            for (let i = 1; i < route.length - 2; i++) {
                for (let j = i + 1; j < route.length; j++) {
                    if (j === i+1) continue;
                    const a = route[i-1], b = route[i], c = route[j-1], d = route[j % route.length];
                    const currentDist = this.distance(a,b) + this.distance(c,d);
                    const newDist = this.distance(a,c) + this.distance(b,d);
                    if (newDist < currentDist - 10) { // улучшение на 10px
                        route = [...route.slice(0,i), ...route.slice(i,j).reverse(), ...route.slice(j)];
                        improved = true;
                    }
                }
            }
        }

        return route;
    }

    // Нарисовать маршрут на Leaflet
    drawRoute(route) {
        this.clearRoute();

        if (route.length < 2) return;

        // Линия маршрута
        const latlngs = route.map(p => [p.lat, p.lng]);
        this.routeLine = L.polyline(latlngs, {
            color: '#c8aa58',
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 10',
            smoothFactor: 1
        }).addTo(this.map);

        // Нумерованные маркеры порядка
        route.forEach((point, idx) => {
            const numberedIcon = L.divIcon({
                html: `<div style="
                    width:28px;height:28px;background:#c8aa58;color:#000;
                    border-radius:50%;display:flex;align-items:center;
                    justify-content:center;font-weight:700;font-family:Share Tech Mono;
                    border:2px solid #000;box-shadow:0 2px 8px rgba(0,0,0,0.5)
                ">${idx+1}</div>`,
                className: 'route-number-icon',
                iconSize: [28,28],
                iconAnchor: [14,14]
            });
            const m = L.marker([point.lat, point.lng], { icon: numberedIcon, zIndexOffset: 1000 }).addTo(this.map);
            m.bindTooltip(`${idx+1}. ${point.name}`, { direction: 'top' });
            this.routeMarkers.push(m);
        });

        // Общая дистанция
        let totalDist = 0;
        for (let i = 0; i < route.length -1; i++) {
            totalDist += this.distance(route[i], route[i+1]);
        }
        
        const totalMeters = Math.round(totalDist * 0.5); // примерно 1px = 0.5м, можно калибровать по карте
        if (window.notify) window.notify(`🗺 Маршрут: ${route.length} точек, ~${totalMeters}м`);

        this.currentRoute = route;
    }

    clearRoute() {
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        this.routeMarkers.forEach(m => this.map.removeLayer(m));
        this.routeMarkers = [];
        this.currentRoute = [];
    }

    buildForCurrentMap() {
        const points = this.getActivePoints();
        if (points.length === 0) {
            if (window.notify) window.notify('⚠️ Нет точек на этой карте для маршрута');
            return;
        }
        if (points.length === 1) {
            if (window.notify) window.notify('⚠️ Только 1 точка, маршрут не нужен');
            return;
        }
        const optimized = this.solveTSP(points, 0);
        this.drawRoute(optimized);
    }
}

// Как подключить в app.js:
// 1. Добавь <script src="js/route-planner.js"></script> после leaflet
// 2. В initLeafletMap: window.routePlanner = new RoutePlanner(map);
// 3. Добавь кнопку в header: <button id="btn-route">🗺 Маршрут</button>
// 4. В setupEventListeners: $('btn-route').addEventListener('click', () => routePlanner.buildForCurrentMap());
// 5. Для продвинутого: добавить выбор точки старта (спавн игрока) и экспорт маршрута в текстовый файл

// Продвинутая версия с препятствиями:
// Если хочешь чтобы маршрут не шел сквозь стены, нужно:
// - Админ в режиме редактирования рисует L.polygon зоны "нельзя ходить" (стены)
// - Или загружаешь маску карты (черно-белую картинку где белый = можно ходить)
// - Потом строишь граф из сетки 50x50 и используешь A* (javascript-astar)
// - Но для Kord Breach доков достаточно прямых линий — игроки сами обходят стены по памяти карты.
