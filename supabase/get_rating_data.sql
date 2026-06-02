-- 공개 화면(레이팅 랭킹/선수 상세)에 필요한 세 테이블을 JSON 하나로 묶어 반환한다.
-- 클라이언트는 supabase.rpc('get_rating_data') 한 번만 호출하면 된다.
--
-- 효과:
--  - 요청 5개 → 1개, 왕복 2회 → 1회
--  - 함수 반환값(JSON 1행)에는 PostgREST 의 1000행 제한이 적용되지 않으므로
--    games 가 1000행을 넘어도 페이지네이션이 필요 없다.
--  - 공개에 필요한 컬럼만 노출(games.note, players.renjunet 등 제외).
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.

create or replace function public.get_rating_data()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'players', coalesce(
      (select json_agg(p) from (
        select id, name, rank_level, rank_point, rank_type
        from public.players
      ) p), '[]'::json),
    'tournaments', coalesce(
      (select json_agg(t) from (
        select id, name, weight, start_date
        from public.tournaments
      ) t), '[]'::json),
    'games', coalesce(
      (select json_agg(g) from (
        select id, tournament_id, black_player_id, white_player_id, result
        from public.games
      ) g), '[]'::json)
  );
$$;

-- 공개 읽기용 호출 권한 (현재 anon 키로 이미 테이블을 읽고 있으므로 RLS 변경은 불필요)
grant execute on function public.get_rating_data() to anon, authenticated;
