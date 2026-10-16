-- Spielzüge am Online-Tisch (Edge Function "game").
-- version: steigt bei jeder Änderung. Tippen zwei Leute gleichzeitig, schreibt
--          nur der durch, der den aktuellen Stand gesehen hat; der andere wird
--          gegen den neuen Stand neu geprüft.
-- history: Undo-Verlauf, höchstens 20 Spielstände (nur der Host darf Undo).

alter table sessions add column version integer not null default 0;
alter table sessions add column history jsonb not null default '[]';
