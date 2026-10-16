-- Der 4-stellige Code muss nur unter laufenden Tischen eindeutig sein,
-- sonst wäre jeder Code für immer verbraucht (nur 10.000 Stück).

alter table sessions drop constraint sessions_code_key;
create unique index sessions_code_aktiv on sessions (code) where status <> 'over';
