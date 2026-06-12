-- Migration: menu options / modifiers foundation
--
-- POS-style customization model:
-- - option groups belong to a menu (e.g. "빵 선택", "토핑 추가")
-- - option values can carry price deltas and their own ingredient recipe
-- - sale_item_options stores sale-time snapshots so past sales stay immutable

create table public.menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null,
  selection_type text not null default 'add_on',
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menu_option_groups_name_len check (char_length(name) between 1 and 50),
  constraint menu_option_groups_selection_type check (selection_type in ('single', 'add_on')),
  constraint menu_option_groups_min_nonneg check (min_select >= 0),
  constraint menu_option_groups_max_valid check (max_select is null or max_select >= min_select),
  constraint menu_option_groups_unique_name unique (menu_id, name)
);

comment on table public.menu_option_groups is
  '메뉴 옵션 그룹. single=택1/분배형, add_on=추가 토핑형.';

create index menu_option_groups_menu_idx on public.menu_option_groups (menu_id, is_active, sort_order);
create index menu_option_groups_user_idx on public.menu_option_groups (user_id);

create trigger menu_option_groups_set_updated_at
before update on public.menu_option_groups
for each row
execute function public.set_updated_at();

create table public.menu_option_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  option_group_id uuid not null references public.menu_option_groups (id) on delete cascade,
  name text not null,
  price_delta numeric(10, 2) not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menu_option_values_name_len check (char_length(name) between 1 and 50),
  constraint menu_option_values_price_delta_nonneg check (price_delta >= 0),
  constraint menu_option_values_unique_name unique (option_group_id, name)
);

comment on table public.menu_option_values is
  '옵션 선택지. 판매 시 price_delta와 재료 레시피가 sale_item_options로 스냅샷된다.';

create index menu_option_values_group_idx on public.menu_option_values (option_group_id, is_active, sort_order);
create index menu_option_values_user_idx on public.menu_option_values (user_id);

create trigger menu_option_values_set_updated_at
before update on public.menu_option_values
for each row
execute function public.set_updated_at();

create table public.menu_option_value_recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  option_value_id uuid not null references public.menu_option_values (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity_per_selection numeric(12, 3) not null,
  created_at timestamptz not null default now(),

  constraint menu_option_value_recipe_unique unique (option_value_id, ingredient_id),
  constraint menu_option_value_recipe_quantity_positive check (quantity_per_selection > 0)
);

comment on table public.menu_option_value_recipe_items is
  '옵션 선택 1회당 추가/대체 재료 소모량.';

create index menu_option_value_recipe_option_idx
on public.menu_option_value_recipe_items (option_value_id);

create index menu_option_value_recipe_ingredient_idx
on public.menu_option_value_recipe_items (ingredient_id);

create table public.sale_item_options (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  option_group_id uuid not null references public.menu_option_groups (id) on delete restrict,
  option_value_id uuid not null references public.menu_option_values (id) on delete restrict,
  quantity integer not null,
  group_name_snapshot text not null,
  value_name_snapshot text not null,
  price_delta_snapshot numeric(10, 2) not null,
  option_cost_snapshot numeric(14, 4) not null default 0,
  recipe_items_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  constraint sale_item_options_quantity_positive check (quantity > 0),
  constraint sale_item_options_price_delta_nonneg check (price_delta_snapshot >= 0),
  constraint sale_item_options_cost_nonneg check (option_cost_snapshot >= 0),
  constraint sale_item_options_unique_value_per_item unique (sale_item_id, option_value_id)
);

comment on table public.sale_item_options is
  '판매 시점 옵션 스냅샷. 옵션명/가격/재료가 나중에 바뀌어도 과거 판매는 불변.';

create index sale_item_options_sale_item_idx on public.sale_item_options (sale_item_id);
create index sale_item_options_value_idx on public.sale_item_options (option_value_id);
create index sale_item_options_user_idx on public.sale_item_options (user_id);

alter table public.menu_option_groups enable row level security;
alter table public.menu_option_values enable row level security;
alter table public.menu_option_value_recipe_items enable row level security;
alter table public.sale_item_options enable row level security;

create policy menu_option_groups_isolated
on public.menu_option_groups
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy menu_option_values_isolated
on public.menu_option_values
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy menu_option_value_recipe_items_isolated
on public.menu_option_value_recipe_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy sale_item_options_isolated
on public.sale_item_options
for select
using (auth.uid() = user_id);

grant select, insert, update, delete on public.menu_option_groups to authenticated;
grant select, insert, update, delete on public.menu_option_values to authenticated;
grant select, insert, update, delete on public.menu_option_value_recipe_items to authenticated;
grant select on public.sale_item_options to authenticated;
