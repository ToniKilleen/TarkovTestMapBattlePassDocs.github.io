# ⚔ TARKOV INTERACTIVE MAPS — Kord Breach Edition

> Карта документации для Battle Pass Kord Breach (патч 1.1.0). Находи доки, фарми дневной лимит, считай Classified.

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success?style=for-the-badge&logo=github)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet)
![Version](https://img.shields.io/badge/Version-1.3.0-c8aa58?style=for-the-badge)
![Kord Breach](https://img.shields.io/badge/Kord%20Breach-Battle%20Pass-e74c3c?style=for-the-badge)

**[🌐 Демо](https://YOUR_USERNAME.github.io/YOUR_REPO/)** • **[📰 Обновления](#-история-обновлений)** • **[📖 Гайд](#-быстрый-старт)**

---

### 🎮 Что это?

В Escape from Tarkov с патча 1.1.0 добавили **Kord Breach Battle Pass** — бесплатный батл-пасс где надо сдавать **TerraGroup документацию**. Доки — персональный лут (как квестовые), каждый игрок лутает свою копию. Есть **дневной лимит** общий на все режимы.

Этот сайт помогает:
- 🗺 Видеть где спавнится каждый тип доков
- 📅 Не забывать дневной лимит (PvE 10 / PvP 15 / PvP S 25)
- 🧮 Считать сколько Classified Documents нужно докупить за TarCoins
- 📚 Искать точки через каталог + шарить ссылки на точки

---

## ✨ Фичи v1.3.0

- **🗺 12 Локаций:** Лаборатория, Таможня, Улицы, Развязка, Берег, Резерв, Лес, Маяк, Завод, Эпицентр, **Ледокол**, **Лабиринт**
- **📄 9 Типов документов с точными спавнами (твои данные):**
  - 📃 Финансовая → Таможня, Улицы, Развязка
  - 📋 Личные данные ЧВК → Резерв, Маяк, Ледокол
  - 📐 Проектная → Завод, Резерв, Таможня
  - 📏 Чертежи и тех. → Развязка, Завод, Лабиринт
  - 🧪 Тестовая → Берег, Лес, Ледокол
  - 📖 Пользовательская → Эпицентр, Улицы, Лаборатория
  - 💊 Медицинская → Лаборатория, Эпицентр, Лабиринт
  - 🔧 Эксплуатационная → Берег, Лес, Маяк
  - 🔒 Секретные данные → ??? (засекречено)
- **📅 Дневной лимит (Kord Breach правила):**
  - PvE — 10 доков/сутки
  - PvP — 15 доков/сутки
  - PvP S (сезонный) — 25 доков/сутки
  - Прогресс-бар + отсчет до сброса 00:00 МСК, сохраняется в браузере
- **🧮 Калькулятор Classified:** Ввел сколько каких доков не хватает → получил `Нужно Classified = X` и `TarCoins = Y`
- **📍 Подсказки фарма:** В фильтрах, каталоге и инфо-панели теги где фармить
- **📰 Вкладка ОБНОВЛЕНИЯ:** Вся история версий теперь на сайте (берется из `js/version.js`), плюс модалка по клику на версию
- **🎨 Красивый дизайн:** Glassmorphism, градиенты, свечение акцента, анимации, lift-эффекты карточек
- **👥 Роли:** admin / operator, предложения точек, автообновление 15 сек
- **🔗 Шаринг:** `?map=customs&marker=...`

---

## 📁 Структура

```
├── index.html              # 4 режима: карта / каталог / обновления / предложения
├── css/style.css           # 1144 строки, EFT тема + beauty overhaul
├── js/
│   ├── maps-config.js      # 12 карт + 9 типов с точными спавнами
│   ├── supabase-client.js  # REST клиент
│   ├── version.js          # Версия и changelog (рендерится в 2 местах)
│   ├── app.js              # 1400+ строк логики + daily limit + calculator + фарм теги
│   └── route-planner.js    # Планировщик маршрута (TSP) — черновик для будущего
├── images/maps/            # 12 jpg
├── images/icons/           # 9 png
├── supabase/seed.sql       # Демо-точки
└── README.md
```

---

## 🚀 Быстрый старт

### GitHub Pages
1. Залей репо
2. Добавь `.nojekyll` в корень (уже есть)
3. Settings → Pages → main / root

### Supabase

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text check (role in ('admin','operator')),
  created_at timestamp default now()
);
create table markers (
  id text primary key,
  map_id text not null,
  name text not null,
  category text not null,
  lat float8 not null,
  lng float8 not null,
  description text default '',
  screenshot text default '',
  created_by uuid references users(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  map_id text not null,
  name text not null,
  category text not null,
  lat float8 not null,
  lng float8 not null,
  description text default '',
  screenshot text default '',
  created_by uuid references users(id),
  status text default 'pending',
  admin_comment text default '',
  created_at timestamp default now(),
  reviewed_at timestamp,
  reviewed_by uuid references users(id)
);
alter table markers enable row level security;
alter table suggestions enable row level security;
alter table users enable row level security;
create policy "public read markers" on markers for select using (true);
create policy "allow all markers" on markers for all using (true) with check (true);
create policy "public read suggestions" on suggestions for select using (true);
create policy "allow all suggestions" on suggestions for all using (true) with check (true);
create policy "allow read users" on users for select using (true);
create policy "allow all users" on users for all using (true) with check (true);
```
Storage → bucket `screenshots` → Public

Создать админа (хеш SHA-256 через консоль браузера):
```js
async function h(p){const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')} 
h('пароль').then(console.log)
```
```sql
insert into users (username,password_hash,role) values ('admin','ХЕШ','admin');
```

---

## 📰 История обновлений

Вся история ведется в **двух местах параллельно**:

1. **На сайте** — вкладка **ОБНОВЛЕНИЯ** (📰) в шапке. Рендерится из `js/version.js` → `CHANGELOG`
2. **В репозитории** — этот `README.md` + `js/version.js`

**Как добавить обновление:**
```js
// js/version.js
const CURRENT_VERSION = '1.4.0';
const CHANGELOG = [
  {
    version: '1.4.0',
    date: '2026-08-06',
    title: 'Новая фича',
    changes: ['➕ Добавил ...', '🐛 Пофиксил ...']
  },
  ...старые
]
```
Пуш на GitHub → на сайте во вкладке ОБНОВЛЕНИЯ появится новая карточка, бейдж версии в углу обновится.

### Последние изменения

**v1.3.0 (2026-08-05) — Kord Breach точность + красота**
- Лимиты PvE 10 / PvP 15 / PvP S 25
- Точные спавны по твоим данным, Секретные данные → ???
- Редизайн: glassmorphism, градиенты, свечения
- Вкладка ОБНОВЛЕНИЯ
- README ведется

**v1.2.0 — Фарм, лимит, калькулятор**
- Подсказки где фармить
- Дневной лимит + прогресс-бар
- Калькулятор Classified → TarCoins

**v1.1.0 — Ледокол и Лабиринт**
**v1.0.0 — Запуск**

---

## 🧭 Планировщик маршрута (идея)

Файл `js/route-planner.js` — черновик алгоритма:
- Карта = картинка, координаты = пиксели
- Задача = TSP коммивояжера
- Решение: Nearest Neighbor + 2-opt
- Отрисовка: `L.polyline` + нумерованные маркеры
- Будущее: учет стен через A* и маску проходимости

---

## 🤝 Контрибьютинг

Форк → ветка `feat/xxx` → ПР

---

**Сделано для Kord Breach комьюнити ❤️** — кинь ⭐ если помогло фармить Battle Pass
