-- Этап 3 разделения, часть 2: мастерская закрыта ролью master и на сервере.
-- До этого её закрывало только приложение; теперь без роли нельзя ни прочитать, ни записать
-- записи мастерской (формы, свечи, склад, люди мастерской, её настройки) и отзывы на свечи.
-- Выполняется после 0014_masters.sql. Повторный запуск безопасен.
--
-- Отзывы получатели по-прежнему отправляют без входа: submit_review работает от имени сервера.

drop policy if exists "own workshop entities" on public.entities;
create policy "own workshop entities" on public.entities for all
  using (owner_id = auth.uid() and not is_grimoire_row(kind, id) and has_role('master'))
  with check (owner_id = auth.uid() and not is_grimoire_row(kind, id) and has_role('master'));

drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews for all
  using (owner_id = auth.uid() and has_role('master'))
  with check (owner_id = auth.uid() and has_role('master'));
