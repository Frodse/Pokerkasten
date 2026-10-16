-- Online wählt jeder seinen Buy-in selbst (in der Lobby oder beim späteren Beitreten).
-- buy_in: Betrag in der Einheit des Tisches – in €, wenn mit Geld gespielt
--         wird, sonst in Chips. null = Vorschlag des Admins.
-- Geschrieben wird nur über die Edge Function "lobby".

alter table players add column buy_in numeric;
