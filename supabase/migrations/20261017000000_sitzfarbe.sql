-- Sitzfarbe pro Spieler (docs/design.md 4.2 und Kap. 10). Reine Anzeige.
-- color: Token-Name wie "seat-red", null bei Spielern von vor der Einführung.
-- Jede Farbe gibt es pro Tisch nur einmal; treten zwei gleichzeitig mit
-- derselben Farbe bei, lässt die Datenbank nur einen durch.
-- Geschrieben wird nur über die Edge Function "lobby".

alter table players add column color text;
create unique index players_session_color on players (session_id, color) where color is not null;
