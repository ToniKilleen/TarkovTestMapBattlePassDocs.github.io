/**
 * Конфигурация всех карт.
 * Чтобы добавить новую локацию — просто добавьте объект в массив.
 *
 * image: путь к файлу карты (положите в images/maps/)
 * bounds: размеры изображения в пикселях [высота, ширина]
 * floors: (опционально) если у карты несколько этажей
 */

const MAPS_CONFIG = [
    {
        id: 'laboratory',
        name: 'Лаборатория',
        image: 'images/maps/laboratory.jpg',
        bounds: [3820, 2189],  // подставьте реальные размеры вашей картинки
        floors: [
            { id: 'basement', name: 'Подвал', image: 'images/maps/laboratory_basement.jpg' }
        ],
        defaultZoom: -1,
        minZoom: -2,
        maxZoom: 3
    },
    {
        id: 'customs',
        name: 'Таможня',
        image: 'images/maps/customs.jpg',
        bounds: [4000, 7200],
        floors: null,
        defaultZoom: -1,
        minZoom: -2,
        maxZoom: 3
    },
    {
        id: 'streets',
        name: 'Улицы',
        image: 'images/maps/streets.jpg',
        bounds: [5000, 8000],
        floors: [
            { id: 'ground', name: 'Улица', image: 'images/maps/streets_ground.jpg' },
            { id: 'underground', name: 'Подземка', image: 'images/maps/streets_underground.jpg' }
        ],
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 2
    },
    {
        id: 'interchange',
        name: 'Развязка',
        image: 'images/maps/interchange.jpg',
        bounds: [4600, 5400],
        floors: [
            { id: 'floor1', name: 'Этаж 1', image: 'images/maps/interchange_floor1.jpg' },
            { id: 'floor2', name: 'Этаж 2', image: 'images/maps/interchange_floor2.jpg' },
            { id: 'floor3', name: 'Этаж 3', image: 'images/maps/interchange_floor3.jpg' }
        ],
        defaultZoom: -1,
        minZoom: -2,
        maxZoom: 3
    },
    {
        id: 'shoreline',
        name: 'Берег',
        image: 'images/maps/shoreline.jpg',
        bounds: [4200, 6800],
        floors: null,
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 2
    },
    {
        id: 'reserve',
        name: 'Резерв',
        image: 'images/maps/reserve.jpg',
        bounds: [4800, 5200],
        floors: null,
        defaultZoom: -1,
        minZoom: -2,
        maxZoom: 3
    },
    {
        id: 'woods',
        name: 'Лес',
        image: 'images/maps/woods.jpg',
        bounds: [4000, 6400],
        floors: null,
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 2
    },
    {
        id: 'lighthouse',
        name: 'Маяк',
        image: 'images/maps/lighthouse.jpg',
        bounds: [4400, 7000],
        floors: null,
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 2
    },
    {
        id: 'factory',
        name: 'Завод',
        image: 'images/maps/factory.jpg',
        bounds: [2600, 3200],
        floors: [
            { id: 'floor1', name: 'Этаж 1', image: 'images/maps/factory_floor1.jpg' },
            { id: 'floor2', name: 'Этаж 2', image: 'images/maps/factory_floor2.jpg' },
            { id: 'floor3', name: 'Этаж 3', image: 'images/maps/factory_floor3.jpg' }
        ],
        defaultZoom: 0,
        minZoom: -1,
        maxZoom: 3
    },
    {
        id: 'groundzero',
        name: 'Эпицентр',
        image: 'images/maps/groundzero.jpg',
        bounds: [3800, 4600],
        floors: null,
        defaultZoom: -1,
        minZoom: -2,
        maxZoom: 3
    }
];

// Конфигурация иконок по категориям
const ICON_CONFIG = {
    loot:    { icon: 'images/icons/loot.png',    emoji: '💰', color: '#f1c40f', label: 'Лут' },
    key:     { icon: 'images/icons/key.png',     emoji: '🔑', color: '#3498db', label: 'Ключ' },
    extract: { icon: 'images/icons/extract.png', emoji: '🚪', color: '#2ecc71', label: 'Выход' },
    boss:    { icon: 'images/icons/boss.png',    emoji: '💀', color: '#e74c3c', label: 'Босс' },
    medical: { icon: 'images/icons/medical.png', emoji: '💊', color: '#e91e63', label: 'Медицина' },
    weapon:  { icon: 'images/icons/weapon.png',  emoji: '🔫', color: '#ff9800', label: 'Оружие' },
    quest:   { icon: 'images/icons/quest.png',   emoji: '📋', color: '#9b59b6', label: 'Квест' }
};
