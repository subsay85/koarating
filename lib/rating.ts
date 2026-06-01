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

  windowTournaments.forEach((t) => {
    const ratingChanges = new Map<number, number>();
    const tGames = games.filter(
      (g) => Number(g.tournament_id) === Number(t.id),
    );

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

      const winPointB = (1 - expectB) * 12 * t.weight + 0.5;
      const losePointB = (0 - expectB) * 12 + 0.5;
      const drawPointB = (winPointB + losePointB) / 2;

      const winPointW = (1 - expectW) * 12 * t.weight + 0.5;
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
  });

  return statsMap;
}
