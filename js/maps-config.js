const MAPS_CONFIG = [
    {
        id: 'laboratory',
        name: 'Лаборатория',
        image: 'images/maps/laboratory.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'customs',
        name: 'Таможня',
        image: 'images/maps/customs.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'streets',
        name: 'Улицы',
        image: 'images/maps/streets.jpg',
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 3
    },
    {
        id: 'interchange',
        name: 'Развязка',
        image: 'images/maps/interchange.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'shoreline',
        name: 'Берег',
        image: 'images/maps/shoreline.jpg',
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 3
    },
    {
        id: 'reserve',
        name: 'Резерв',
        image: 'images/maps/reserve.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'woods',
        name: 'Лес',
        image: 'images/maps/woods.jpg',
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 3
    },
    {
        id: 'lighthouse',
        name: 'Маяк',
        image: 'images/maps/lighthouse.jpg',
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 3
    },
    {
        id: 'factory',
        name: 'Завод',
        image: 'images/maps/factory.jpg',
        defaultZoom: 0,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'groundzero',
        name: 'Эпицентр',
        image: 'images/maps/groundzero.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
	{
        id: 'icebreaker',
        name: 'Ледокол',
        image: 'images/maps/icebreaker.jpg',
        defaultZoom: 0,
        minZoom: -5,
        maxZoom: 4
    }
];

const ICON_CONFIG = {
    loot:    { emoji: '💰', color: '#f1c40f', label: 'Лут' },
    key:     { emoji: '🔑', color: '#3498db', label: 'Ключ' },
    extract: { emoji: '🚪', color: '#2ecc71', label: 'Выход' },
    boss:    { emoji: '💀', color: '#e74c3c', label: 'Босс' },
    medical: { emoji: '💊', color: '#e91e63', label: 'Медицина' },
    weapon:  { emoji: '🔫', color: '#ff9800', label: 'Оружие' },
    quest:   { emoji: '📋', color: '#9b59b6', label: 'Квест' }
};
