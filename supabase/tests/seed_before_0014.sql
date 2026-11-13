-- People in the workshop before 0014: two of the witch's (one in the bin) and one of someone with no role.
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into public.entities (owner_id, kind, id, data, delete_date) values
  ('00000000-0000-0000-0000-00000000000a', 'person', 'p1', '{"id": "p1", "name": "Сестра", "contact": "", "notes": ""}', null),
  ('00000000-0000-0000-0000-00000000000a', 'person', 'p2', '{"id": "p2", "name": "Старый знакомый", "contact": "", "notes": ""}', now()),
  ('00000000-0000-0000-0000-00000000000d', 'person', 'p3', '{"id": "p3", "name": "Покупатель", "contact": "", "notes": ""}', null)
on conflict do nothing;
