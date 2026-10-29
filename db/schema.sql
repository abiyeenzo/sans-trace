-- Compteur anonyme par pays. Aucune adresse IP, aucun contenu, aucun identifiant.
create table if not exists country_stats (
  country   char(2) primary key,
  hits      bigint not null default 0,
  last_seen timestamptz not null default now()
);

create table if not exists last_hit (
  id      smallint primary key check (id = 1),
  country char(2) not null,
  at      timestamptz not null default now()
);

-- Retours des utilisateurs sur le detecteur. Jamais de texte, seulement un choix et des chiffres.
create table if not exists feedback (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  label      text not null check (label in ('ai', 'human', 'mixed', 'unknown')),
  lang       text not null check (lang in ('fr', 'en')),
  level      text not null check (level in ('low', 'medium', 'high', 'insufficient')),
  signals    integer not null check (signals between 0 and 1000),
  words      integer not null check (words between 0 and 200000),
  helpful    boolean
);
