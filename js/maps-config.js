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
    },
    {
        id: 'icebreaker',
        name: 'Ледокол',
        image: 'images/maps/icebreaker.jpg',
        defaultZoom: -1,
        minZoom: -3,
        maxZoom: 4
    },
    {
        id: 'labyrinth',
        name: 'Лабиринт',
        image: 'images/maps/labyrinth-2d.jpg',
        defaultZoom: -2,
        minZoom: -3,
        maxZoom: 4
    }
];

const ICON_CONFIG = {
    findocs: {
        icon: 'images/icons/findocs.png',
        emoji: '📃',
        color: '#f1c40f',
        label: 'Финансовая документация',
        spawns: ['customs', 'streets', 'interchange'],
        battlePass: 'Таможня, Улицы, Развязка — основной фарм для Battle Pass'
    },
    lpihvk: {
        icon: 'images/icons/lpihvk.png',
        emoji: '📋',
        color: '#3498db',
        label: 'Личные данные ЧВК',
        spawns: ['reserve', 'lighthouse', 'icebreaker'],
        battlePass: 'Резерв, Маяк, Ледокол'
    },
    proectdocs: {
        icon: 'images/icons/proectdocs.png',
        emoji: '📐',
        color: '#2ecc71',
        label: 'Проектная документация',
        spawns: ['factory', 'reserve', 'customs'],
        battlePass: 'Завод, Резерв, Таможня'
    },
    texdocs: {
        icon: 'images/icons/texdocs.png',
        emoji: '📏',
        color: '#e67e22',
        label: 'Чертежи и тех. документация',
        spawns: ['interchange', 'factory', 'labyrinth'],
        battlePass: 'Развязка, Завод, Лабиринт'
    },
    testdocs: {
        icon: 'images/icons/testdock.png',
        emoji: '🧪',
        color: '#9b59b6',
        label: 'Тестовая документация',
        spawns: ['shoreline', 'woods', 'icebreaker'],
        battlePass: 'Берег, Лес, Ледокол'
    },
    polsdocs: {
        icon: 'images/icons/polsdocs.png',
        emoji: '📖',
        color: '#1abc9c',
        label: 'Пользовательская документация',
        spawns: ['groundzero', 'streets', 'laboratory'],
        battlePass: 'Эпицентр, Улицы, Лаборатория'
    },
    meddocs: {
        icon: 'images/icons/meddocs.png',
        emoji: '💊',
        color: '#e91e63',
        label: 'Медицинская документация',
        spawns: ['laboratory', 'groundzero', 'labyrinth'],
        battlePass: 'Лаборатория, Эпицентр, Лабиринт'
    },
    expdocs: {
        icon: 'images/icons/expdocs.png',
        emoji: '🔧',
        color: '#ff9800',
        label: 'Эксплуатационная документация',
        spawns: ['shoreline', 'woods', 'lighthouse'],
        battlePass: 'Берег, Лес, Маяк'
    },
    secretdocs: {
        icon: 'images/icons/secretdocs.png',
        emoji: '🔒',
        color: '#e74c3c',
        label: 'Секретные данные',
        spawns: [],
        battlePass: '??? — засекречено TerraGroup',
        secret: true
    }
};

// Для быстрого поиска: какие доки на какой карте
const MAP_SPAWNS = {};
Object.keys(ICON_CONFIG).forEach(cat => {
    (ICON_CONFIG[cat].spawns || []).forEach(mapId => {
        if (!MAP_SPAWNS[mapId]) MAP_SPAWNS[mapId] = [];
        MAP_SPAWNS[mapId].push(cat);
    });
});
