# ⚔ TARKOV INTERACTIVE MAPS

> Интерактивные карты Escape from Tarkov для поиска всех типов документации — от финансовой до секретной.

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success?style=for-the-badge&logo=github)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet)
![Version](https://img.shields.io/badge/Version-1.0.0-c8aa58?style=for-the-badge)

**[🌐 Демо на GitHub Pages](https://YOUR_USERNAME.github.io/YOUR_REPO/)** • **[📖 Документация](#-быстрый-старт)** • **[🐛 Репорты](https://github.com/YOUR_USERNAME/YOUR_REPO/issues)**

---

### 🎮 Скриншоты

| Карта | Каталог | Предложения |
|-------|---------|-------------|
| 🗺 Интерактивная карта с маркерами | 📚 Группировка по типам документов | 💡 Модерация от операторов |
| *Добавь свои скрины сюда* | *Поиск по названию и описанию* | *Автообновление каждые 15 сек* |

---

## ✨ Фичи

- **🗺 12 Локаций:** Лаборатория, Таможня, Улицы, Развязка, Берег, Резерв, Лес, Маяк, Завод, Эпицентр, **Ледокол**, **Лабиринт**
- **📄 9 Типов документов:**
  - 📃 Финансовая (`findocs`) — `#f1c40f`
  - 📋 Личные данные ЧВК (`lpihvk`) — `#3498db`
  - 📐 Проектная (`proectdocs`) — `#2ecc71`
  - 📏 Чертежи (`texdocs`) — `#e67e22`
  - 🧪 Тестовая (`testdocs`) — `#9b59b6`
  - 📖 Пользовательская (`polsdocs`) — `#1abc9c`
  - 💊 Медицинская (`meddocs`) — `#e91e63`
  - 🔧 Эксплуатационная (`expdocs`) — `#ff9800`
  - 🔒 Секретная (`secretdocs`) — `#e74c3c`
- **👥 Система ролей:** 
  - `admin` — добавляет / редактирует / удаляет точки, модерирует предложения
  - `operator` — предлагает точки, видит свои предложения
- **🔄 Автообновление:** Каждые 15 сек, ставится на паузу когда вкладка свернута
- **📷 Скриншоты:** Ctrl+V, Drag&Drop, выбор файла → загрузка в Supabase Storage + fallback в base64
- **🔗 Шаринг:** `?map=customs&marker=customs_abc123` — копируется одной кнопкой
- **🔍 Каталог:** Поиск по названию, описанию и названию карты, группировка по категориям
- **🔔 Уведомления:** Звук + тост когда приходит новое предложение (только для admin)
- **🎨 Темная тема EFT:** Цвета как в игре, акцент `#c8aa58`, шрифты Rajdhani + Share Tech Mono

---

## 🛠 Технологии

- **Frontend:** Vanilla JS (IIFE), Leaflet 1.9.4 (CRS.Simple для картинок-карт)
- **Backend:** Supabase (Postgres + Storage)
- **Хостинг:** GitHub Pages (статика, без сборки)
- **Иконки:** PNG из `images/icons/` + Emoji fallback

---

## 📁 Структура

```
├── index.html              # Главная страница (3 режима: карта / каталог / предложения)
├── css/
│   └── style.css           # Вся стилизация (775 строк, EFT тема)
├── js/
│   ├── maps-config.js      # 12 карт + 9 типов иконок
│   ├── supabase-client.js  # REST клиент для Supabase
│   ├── version.js          # Версия и changelog
│   └── app.js              # Основная логика (1200+ строк)
├── images/
│   ├── maps/               # 12 jpg карт
│   └── icons/              # 9 png иконок документов
├── .nojekyll               # Для GitHub Pages
└── README.md
```

---

## 🚀 Быстрый старт

### 1. Клонируй и залей на GitHub

```bash
git clone https://github.com/YOUR_USERNAME/tarkov-maps.git
cd tarkov-maps
# закинь свои images/maps/*.jpg и images/icons/*.png
git add .
git commit -m "feat: initial release v1.0.0 with icebreaker & labyrinth"
git push
```

Включи GitHub Pages: `Settings → Pages → Source: main / root`

### 2. Настрой Supabase

#### Создай таблицы (SQL Editor в Supabase)

```sql
-- Пользователи
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','operator')),
  created_at timestamp default now()
);

-- Маркеры
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

-- Предложения
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
  status text default 'pending' check (status in ('pending','approved','rejected')),
  admin_comment text default '',
  created_at timestamp default now(),
  reviewed_at timestamp,
  reviewed_by uuid references users(id)
);

-- Включи RLS и политики
alter table markers enable row level security;
alter table suggestions enable row level security;
alter table users enable row level security;

-- Публичное чтение маркеров
create policy "public read markers" on markers for select using (true);
-- Только anon с ключом может писать (контролируем через роль в app.js)
create policy "allow insert markers" on markers for insert with check (true);
create policy "allow update markers" on markers for update using (true);
create policy "allow delete markers" on markers for delete using (true);

create policy "public read suggestions" on suggestions for select using (true);
create policy "allow insert suggestions" on suggestions for insert with check (true);
create policy "allow update suggestions" on suggestions for update using (true);

create policy "allow read users" on users for select using (true);
```

#### Storage для скриншотов

1. Storage → New bucket → `screenshots` → Public ✅
2. Policies → Allow public read + allow insert for anon

#### Создай первого админа

Пароль хешируется SHA-256 на клиенте. Чтобы получить хеш, открой консоль браузера (F12) и выполни:

```js
async function hash(p){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
hash('твой_пароль').then(console.log)
```

Скопируй хеш и вставь:

```sql
insert into users (username, password_hash, role) 
values ('admin', 'ТВОЙ_SHA256_ХЕШ', 'admin');

insert into users (username, password_hash, role) 
values ('operator', 'ХЕШ_ДЛЯ_ОПЕРАТОРА', 'operator');
```

Теперь логинься на сайте кнопкой 🔒 в шапке!

---

## 📍 Почему таблица markers пустая?

Это нормально для первого запуска! Есть 2 способа добавить точки:

### Способ 1 — Через UI (рекомендуется)
1. Войди как `admin`
2. Выбери карту (например Таможня)
3. Нажми `+ Добавить точку` в левом меню
4. Кликни по карте куда нужно → введи название, категорию, описание, вставь скриншот `Ctrl+V`
5. `💾 Сохранить` — точка улетит в Supabase и появится у всех

### Способ 2 — SQL (массовая загрузка)
```sql
insert into markers (id, map_id, name, category, lat, lng, description) values
('customs_1', 'customs', 'Доки на столе', 'findocs', -500, 1200, 'Второй этаж общежития'),
('lab_1', 'laboratory', 'Секретка в сейфе', 'secretdocs', -300, 800, 'Лаба, синяя зона');
```

После добавления обнови страницу или нажми 🔄.

---

## 🧊 Добавленные карты v1.1.0

В этом обновлении добавил 2 карты, которые были у тебя в папке, но не в конфиге:

```js
{
  id: 'icebreaker',
  name: 'Ледокол',
  image: 'images/maps/icebreaker.jpg',
  defaultZoom: -1
},
{
  id: 'labyrinth',
  name: 'Лабиринт',
  image: 'images/maps/labyrinth-2d.jpg',
  defaultZoom: -2
}
```

Просто закинь `icebreaker.jpg` и `labyrinth-2d.jpg` в `images/maps/` — они сразу появятся в табах.

> Если у тебя карты Ледокола еще нет — можешь пока скачать заглушки с [MapGenie](https://mapgenie.io/tarkov) или оставить пустыми, будет показываться "Карта не найдена", но остальной функционал работает.

---

## 🏷 Версионирование

Все версии в `js/version.js`:

```js
const CURRENT_VERSION = '1.1.0';

const CHANGELOG = [
  {
    version: '1.1.0',
    date: '2026-08-05',
    title: 'Ледокол и Лабиринт',
    changes: [
      '➕ Добавлены карты Ледокол и Лабиринт',
      '📖 Улучшен README',
      '🐛 Пофикшен бейдж версии'
    ]
  },
  {
    version: '1.0.0',
    date: '2025-08-04',
    title: 'Первая стабильная версия',
    changes: ['🎉 Запуск сайта!']
  }
];
```

Пользователи видят версию в правом нижнем углу `v1.1.0` → клик открывает ченджлог.

---

## 🖥 Локальная разработка

```bash
# Python
python -m http.server 8000
# Node
npx serve .
```

Открой `http://localhost:8000`

---

## 🤝 Контрибьютинг

1. Форкни репу
2. Создай ветку `feat/new-map`
3. Добавь точки / пофиксь баг
4. ПР → я посмотрю

---

## 📜 Лицензия

MIT — делай что хочешь, но укажи автора.

---

**Сделано для сообщества Таркова ❤️** — если помогло, кинь звезду ⭐
