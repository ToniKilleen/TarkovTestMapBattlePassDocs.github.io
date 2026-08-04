/*
 * ЭТО ПУБЛИЧНАЯ БАЗА ТОЧЕК.
 * Все посетители видят эти маркеры.
 *
 * Чтобы обновить:
 * 1. Войдите в режим редактирования (🔒)
 * 2. Добавьте/измените точки
 * 3. Нажмите "Экспорт JSON"
 * 4. Замените содержимое DEFAULT_MARKERS в этом файле
 * 5. Запушьте на GitHub
 */

const DEFAULT_MARKERS = [
    {
        id: 'lab_001',
        mapId: 'laboratory',
        name: 'LEDX на столе (Black Room)',
        category: 'medical',
        lat: -1200,
        lng: 2100,
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
        description: 'Активируется кнопкой на серверной стойке. После активации — 60 секунд до закрытия.',
        screenshot: ''
    },
    {
        id: 'lab_003',
        mapId: 'laboratory',
        name: 'Санитар (спавн)',
        category: 'boss',
        lat: -1600,
        lng: 1800,
        description: 'Один из спавнов Санитара. Может появиться с 2-3 охранниками.',
        screenshot: ''
    },
    {
        id: 'cus_001',
        mapId: 'customs',
        name: 'Marked Room (Dorms 314)',
        category: 'loot',
        lat: -1500,
        lng: 4200,
        description: 'Отмеченная комната в 3-этажном общежитии. Требуется Marked key.',
        screenshot: ''
    },
    {
        id: 'cus_002',
        mapId: 'customs',
        name: 'Решала (Dorms)',
        category: 'boss',
        lat: -1400,
        lng: 4100,
        description: 'Решала спавнит в районе общежитий с 4-6 охранниками.',
        screenshot: ''
    }
];