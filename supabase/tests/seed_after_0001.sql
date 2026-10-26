-- State of the live project before the grimoire: one master with workshop data.
insert into public.profiles (user_id, slug, name) values ('00000000-0000-0000-0000-00000000000a', 'witch', 'Ведьма');
insert into public.entities (owner_id, kind, id, data) values
  ('00000000-0000-0000-0000-00000000000a', 'mold', 'M-001', '{"id": "M-001", "name": "Книжка"}'),
  ('00000000-0000-0000-0000-00000000000a', 'meta', 'counters', '{"M": 1}');
