import { parseLocalDate } from "./date";

export type RankType = "DAN" | "KYU" | "UNRANKED";

export interface Player {
  id: number;
  name: string;
  rank_level: number;
  rank_point: number;
  rank_type: RankType;
  renjunet: string | null;
}

export interface Game {
  id: number;
  tournament_id: number;
  black_player_id: number;
  white_player_id: number;
  result: "BLACK_WIN" | "WHITE_WIN" | "DRAW" | string;
}

export interface Tournament {
  id: number;
  name: string;
  weight: number;
  start_date: string;
}

export interface PlayerRatingStat {
  rating: number;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
}

export const INITIAL_RATING = 1200;

/** 모든 선수를 초기 레이팅/빈 전적으로 채운 statsMap 을 만든다. */
function initStatsMap(players: Player[]): Map<number, PlayerRatingStat> {
  const statsMap = new Map<number, PlayerRatingStat>();
  players.forEach((p) => {
    statsMap.set(Number(p.id), {
      rating: INITIAL_RATING,
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    });
  });
  return statsMap;
}

/**
 * 게임을 tournament_id 로 한 번만 그룹핑한다. (대회마다 games 전체를 재스캔하지 않도록)
 */
function groupGamesByTournament(games: Game[]): Map<number, Game[]> {
  const byTournament = new Map<number, Game[]>();
  games.forEach((g) => {
    const tid = Number(g.tournament_id);
    const arr = byTournament.get(tid);
    if (arr) arr.push(g);
    else byTournament.set(tid, [g]);
  });
  return byTournament;
}

/**
 * 한 대회의 모든 경기를 statsMap 에 누적 적용한다.
 * 대회 시작 시점의 레이팅으로 변화량을 계산한 뒤(대회 단위 일괄 반영) 한꺼번에 적용한다.
 */
function applyTournament(
  tournament: Tournament,
  tGames: Game[],
  statsMap: Map<number, PlayerRatingStat>,
): void {
  const ratingChanges = new Map<number, number>();

  tGames.forEach((g) => {
    const blackId = Number(g.black_player_id);
    const whiteId = Number(g.white_player_id);

    const black = statsMap.get(blackId);
    const white = statsMap.get(whiteId);
    if (!black || !white) return;

    const rB = black.rating;
    const rW = white.rating;
    const expectB = 1 / (1 + Math.pow(10, (rW - rB) / 400));
    const expectW = 1 / (1 + Math.pow(10, (rB - rW) / 400));

    const winPointB = (1 - expectB) * 12 * tournament.weight + 0.5;
    const losePointB = (0 - expectB) * 12 + 0.5;
    const drawPointB = (winPointB + losePointB) / 2;

    const winPointW = (1 - expectW) * 12 * tournament.weight + 0.5;
    const losePointW = (0 - expectW) * 12 + 0.5;
    const drawPointW = (winPointW + losePointW) / 2;

    let changeB = 0;
    let changeW = 0;
    const resultUpper = String(g.result).toUpperCase();

    if (resultUpper === "BLACK_WIN") {
      changeB = winPointB;
      changeW = losePointW;
      black.wins++;
      white.losses++;
    } else if (resultUpper === "WHITE_WIN") {
      changeB = losePointB;
      changeW = winPointW;
      black.losses++;
      white.wins++;
    } else if (resultUpper === "DRAW") {
      changeB = drawPointB;
      changeW = drawPointW;
      black.draws++;
      white.draws++;
    }

    black.totalGames++;
    white.totalGames++;

    ratingChanges.set(blackId, (ratingChanges.get(blackId) || 0) + changeB);
    ratingChanges.set(whiteId, (ratingChanges.get(whiteId) || 0) + changeW);
  });

  ratingChanges.forEach((change, playerId) => {
    const p = statsMap.get(playerId);
    if (p) p.rating += change;
  });
}

/**
 * 주어진 대회 목록(windowTournaments)을 시간 순서대로 적용하여
 * 모든 선수의 레이팅/전적을 계산한다.
 * windowTournaments 는 호출하는 쪽에서 기간 필터링 + 정렬을 끝낸 상태로 넘겨준다.
 */
export function computeRatings(
  players: Player[],
  games: Game[],
  windowTournaments: Tournament[],
): Map<number, PlayerRatingStat> {
  const statsMap = initStatsMap(players);
  const gamesByTournament = groupGamesByTournament(games);

  windowTournaments.forEach((t) => {
    applyTournament(t, gamesByTournament.get(Number(t.id)) || [], statsMap);
  });

  return statsMap;
}

/**
 * 전체 누적 레이팅 추이를 한 번의 누적 패스로 구한다. (증분 계산)
 *
 * 누적 레이팅은 오래된 대회가 빠지지 않고 새 대회만 더해지므로, 매 월 0부터
 * 다시 계산할 필요 없이 대회를 시간순으로 한 번만 적용하면서 각 월 경계 직전까지의
 * 한 선수 레이팅을 기록하면 된다.
 *
 * 각 monthBoundaries[i] 에 대해, 시작일이 그 경계보다 "이전(<)"인 대회들만 적용한
 * 시점의 targetPlayerId 레이팅을 반환한다. (computeRatings 를 매 경계마다 호출한 것과
 * 동일한 값이지만 비용은 O(게임수 + 경계수))
 */
export function computeCumulativeRatingTimeline(
  players: Player[],
  games: Game[],
  sortedTournaments: Tournament[],
  targetPlayerId: number,
  monthBoundaries: Date[],
): number[] {
  const statsMap = initStatsMap(players);
  const gamesByTournament = groupGamesByTournament(games);
  const targetId = Number(targetPlayerId);

  const timeline: number[] = [];
  let ti = 0;

  monthBoundaries.forEach((boundary) => {
    const boundaryTime = boundary.getTime();
    while (
      ti < sortedTournaments.length &&
      parseLocalDate(sortedTournaments[ti].start_date).getTime() < boundaryTime
    ) {
      const t = sortedTournaments[ti];
      applyTournament(t, gamesByTournament.get(Number(t.id)) || [], statsMap);
      ti++;
    }
    timeline.push(statsMap.get(targetId)?.rating ?? INITIAL_RATING);
  });

  return timeline;
}
