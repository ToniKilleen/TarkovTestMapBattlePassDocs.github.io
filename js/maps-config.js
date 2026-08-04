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
        minZoom: -1,
        maxZoom: 4
    },
    {
        id: 'groundzero',
        name: 'Эпицентр',
        image: 'images/maps/groundzero.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    }
];

/*
 * ИКОНКИ КАТЕГОРИЙ
 *
 * icon: путь к PNG файлу (32x32 или 64x64, прозрачный фон)
 * emoji: fallback если картинка не загрузится
 * color: цвет рамки маркера
 * label: название для UI
 *
 * Чтобы добавить новую категорию:
 * 1. Добавьте PNG в images/icons/
 * 2. Добавьте запись сюда
 * 3. Добавьте чекбокс в index.html в filter-group
 */
const ICON_CONFIG = {
    loot: {
        icon: 'images/icons/findocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Финансовая документация'
    },
    loot: {
        icon: 'images/icons/lpihvk.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Личные Данные ЧВК'
    },
	    loot: {
        icon: 'images/icons/proectdocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Проектная документация'
    },
	    loot: {
        icon: 'images/icons/texdocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Чертежи и тех документация'
    },
	    loot: {
        icon: 'images/icons/testdock.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Тестовая документация'
    },
	    loot: {
        icon: 'images/icons/polsdocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Пользовательская документация'
    },
	    loot: {
        icon: 'images/icons/meddocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Медицинская документация'
    },
	    loot: {
        icon: 'images/icons/expdocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Эксплуатационная документация'
    },
	    loot: {
        icon: 'images/icons/secretdocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Секретная документация'
    }
};