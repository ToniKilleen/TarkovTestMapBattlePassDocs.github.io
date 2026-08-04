-- Демо-точки для проверки, когда markers пусто
-- Вставь в Supabase SQL Editor

insert into markers (id, map_id, name, category, lat, lng, description) values
-- Таможня
('customs_demo_1', 'customs', 'Финансы в общежитии', 'findocs', -450, 1100, 'Второй этаж, 3х-этажная общага, на столе у окна'),
('customs_demo_2', 'customs', 'Секретка в сейфе', 'secretdocs', -650, 900, 'Директорский кабинет, сейф за картиной'),
-- Лаборатория
('lab_demo_1', 'laboratory', 'Чертежи в лаборатории', 'texdocs', -350, 750, 'Синяя зона, стол с компьютерами'),
-- Ледокол - новая карта
('icebreaker_demo_1', 'icebreaker', 'Доки на Ледоколе', 'findocs', -500, 1000, 'Трюм корабля, каюта капитана'),
-- Лабиринт - новая карта
('labyrinth_demo_1', 'labyrinth', 'Меддоки в Лабиринте', 'meddocs', -400, 600, 'Центральная комната, на полке с медикаментами')
on conflict (id) do nothing;
