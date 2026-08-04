/**
 * Данные маркеров хранятся в localStorage.
 * Этот файл содержит примеры, которые загрузятся при первом запуске.
 *
 * Чтобы добавить точку — используйте кнопку "+ Добавить точку"
 * или отредактируйте этот файл напрямую.
 */

const DEFAULT_MARKERS = [
    // ===== ЛАБОРАТОРИЯ =====
    {
        id: 'lab_001',
        mapId: 'laboratory',
        name: 'LEDX на столе (Black Room)',
        category: 'medical',
        lat: -1200,
        lng: 2100,
        floor: 'floor1',
        description: 'LEDX Skin Transilluminator лежит на столе в левом углу Черной комнаты. Требуется TerraGroup Labs keycard (Black).',
        screenshot: 'images/screenshots/lab_ledx_01.jpg'
    },
    {
        id: 'lab_002',
        mapId: 'laboratory',
        name: 'Выход: Вентиляция',
        category: 'extract',
        lat: -800,
        lng: 3200,
        floor: 'floor1',
        description: 'Активируется кнопкой на серверной стойке. После активации — 60 секунд до закрытия.',
        screenshot: 'images/screenshots/lab_extract_vent.jpg'
    },
    {
        id: 'lab_003',
        mapId: 'laboratory',
        name: 'Санитар (спавн)',
        category: 'boss',
        lat: -1600,
        lng: 1800,
        floor: 'floor1',
        description: 'Один из спавнов Санитара. Может появиться с 2-3 охранниками.',
        screenshot: 'images/screenshots/lab_sanitar.jpg'
    },

    // ===== ТАМОЖНЯ =====
    {
        id: 'cus_001',
        mapId: 'customs',
        name: 'Marked Room (Dorms 314)',
        category: 'loot',
        lat: -1500,
        lng: 4200,
        floor: 'default',
        description: 'Отмеченная комната в 3-этажном общежитии. Требуется Marked key. Респавн ценного лута: кейсы, оружие.',
        screenshot: 'images/screenshots/cus_marked_314.jpg'
    },
    {
        id: 'cus_002',
        mapId: 'customs',
        name: 'Решала (Dorms)',
        category: 'boss',
        lat: -1400,
        lng: 4100,
        floor: 'default',
        description: 'Решала спавнит в районе общежитий с 4-6 охранниками. Золотой ТТ всегда при нём.',
        screenshot: 'images/screenshots/cus_reshala.jpg'
    },

    // ===== Добавьте свои маркеры по аналогии =====
];
