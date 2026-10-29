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
