"use client";

import React, { useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useData } from "../../context/DataContext";
import { computeRatings, type RankType, type Tournament } from "@/lib/rating";
import { parseLocalDate } from "@/lib/date";

interface ChartData {
  dateLabel: string;
  ratingCumulative: number;
  rating5YearsOld: number;
}

export default function PlayerDetail() {
  const params = useParams();
  const router = useRouter();
  const targetPlayerId = Number(params.id);

  const { playersData, gamesData, tournamentsData, loading } = useData();

  const targetPlayer = playersData.find((p) => Number(p.id) === targetPlayerId);

  // id → 선수 빠른 조회용 맵 (대국 이력 렌더 시 선형 탐색 방지)
  const playerById = useMemo(
    () => new Map(playersData.map((p) => [Number(p.id), p])),
    [playersData],
  );

  const calculateRatingsForWindow = useCallback(
    (tournamentsInWindow: Tournament[]) =>
      computeRatings(playersData, gamesData, tournamentsInWindow),
    [playersData, gamesData],
  );

  const { finalStat, chartData } = useMemo(() => {
    if (!targetPlayer || tournamentsData.length === 0)
      return { finalStat: null, chartData: [] };

    const sortedAllTournaments = [...tournamentsData].sort((a, b) => {
      const dA = parseLocalDate(a.start_date).getTime();
      const dB = parseLocalDate(b.start_date).getTime();
      if (dA === dB) return Number(a.id) - Number(b.id);
      return dA - dB;
    });

    const latestDateStr =
      sortedAllTournaments[sortedAllTournaments.length - 1].start_date;
    const globalEnd = parseLocalDate(latestDateStr);
    const globalStart = parseLocalDate(latestDateStr);
    globalStart.setFullYear(globalStart.getFullYear() - 5);

    const globalWindowTournaments = sortedAllTournaments.filter((t) => {
      const tDate = parseLocalDate(t.start_date);
      return tDate >= globalStart && tDate <= globalEnd;
    });

    const finalStatsMap = calculateRatingsForWindow(globalWindowTournaments);
    const targetFinalStat = finalStatsMap.get(targetPlayerId) || {
      rating: 1200,
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };

    const historyData: ChartData[] = [];
    const participatedTournaments = sortedAllTournaments.filter((t) => {
      return gamesData.some(
        (g) =>
          Number(g.tournament_id) === Number(t.id) &&
          (Number(g.black_player_id) === targetPlayerId ||
            Number(g.white_player_id) === targetPlayerId),
      );
    });

    if (participatedTournaments.length > 0) {
      const firstTDate = parseLocalDate(participatedTournaments[0].start_date);
      const startMonth = new Date(
        firstTDate.getFullYear(),
        firstTDate.getMonth(),
        1,
      );
      const now = new Date();
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonth = new Date(startMonth);

      const preStart = new Date(startMonth);
      preStart.setMonth(preStart.getMonth() - 1);
      historyData.push({
        dateLabel: `${preStart.getFullYear()}-${String(preStart.getMonth() + 1).padStart(2, "0")}`,
        rating5YearsOld: 1200,
        ratingCumulative: 1200,
      });

      while (currentMonth <= endMonth) {
        const tCum = sortedAllTournaments.filter(
          (t) => parseLocalDate(t.start_date) < currentMonth,
        );
        const rCum =
          calculateRatingsForWindow(tCum).get(targetPlayerId)?.rating || 1200;

        const pTournamentsUpToMonth = participatedTournaments.filter(
          (t) => parseLocalDate(t.start_date) <= currentMonth,
        );
        let rOld = 1200;
        if (pTournamentsUpToMonth.length > 0) {
          const lastT = pTournamentsUpToMonth[pTournamentsUpToMonth.length - 1];
          const lastTDate = parseLocalDate(lastT.start_date);
          const oldStart = new Date(lastTDate);
          oldStart.setFullYear(oldStart.getFullYear() - 5);
          const tOld = sortedAllTournaments.filter((t) => {
            const d = parseLocalDate(t.start_date);
            return d >= oldStart && d <= lastTDate;
          });
          rOld =
            calculateRatingsForWindow(tOld).get(targetPlayerId)?.rating || 1200;
        }

        historyData.push({
          dateLabel: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`,
          rating5YearsOld: Number(rOld.toFixed(1)),
          ratingCumulative: Number(rCum.toFixed(1)),
        });

        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
    }

    return {
      finalStat: targetFinalStat,
      chartData: historyData,
    };
  }, [
    targetPlayerId,
    targetPlayer,
    tournamentsData,
    gamesData,
    calculateRatingsForWindow,
  ]);

  const playerHistory = useMemo(() => {
    if (!targetPlayerId || !targetPlayer || tournamentsData.length === 0)
      return [];

    const sortedAllTournaments = [...tournamentsData].sort((a, b) => {
      const dA = parseLocalDate(a.start_date).getTime();
      const dB = parseLocalDate(b.start_date).getTime();
      if (dA === dB) return Number(a.id) - Number(b.id);
      return dA - dB;
    });

    const pGames = gamesData.filter(
      (g) =>
        Number(g.black_player_id) === targetPlayerId ||
        Number(g.white_player_id) === targetPlayerId,
    );
    const tIds = Array.from(
      new Set(pGames.map((g) => Number(g.tournament_id))),
    );
    const pTournaments = sortedAllTournaments.filter((t) =>
      tIds.includes(Number(t.id)),
    );

    const displayTournaments = [...pTournaments].sort(
      (a, b) =>
        parseLocalDate(b.start_date).getTime() -
        parseLocalDate(a.start_date).getTime(),
    );

    return displayTournaments.map((t) => {
      const gamesInT = pGames.filter(
        (g) => Number(g.tournament_id) === Number(t.id),
      );

      const formattedGames = gamesInT.map((g) => {
        const blackId = Number(g.black_player_id);
        const whiteId = Number(g.white_player_id);
        const blackPlayer = playerById.get(blackId);
        const whitePlayer = playerById.get(whiteId);
        const blackName = blackPlayer?.name || "알 수 없음";
        const whiteName = whitePlayer?.name || "알 수 없음";

        let resultText = "";
        let isWin = false;
        const resultUpper = String(g.result).toUpperCase();
        const isDraw = resultUpper === "DRAW";

        if (resultUpper === "BLACK_WIN") {
          resultText = `${blackName} 승`;
          if (blackId === targetPlayerId) isWin = true;
        } else if (resultUpper === "WHITE_WIN") {
          resultText = `${whiteName} 승`;
          if (whiteId === targetPlayerId) isWin = true;
        } else {
          resultText = "무승부";
        }

        return {
          id: g.id,
          blackName,
          whiteName,
          resultText,
          isWin,
          isDraw,
        };
      });

      return {
        tournament: t,
        games: formattedGames,
      };
    });
  }, [targetPlayerId, targetPlayer, tournamentsData, gamesData, playerById]);

  const formatRank = (level: number, type: RankType) => {
    if (level === 0 || type === "UNRANKED") return "-";
    if (type === "DAN") return `${level}단`;
    if (type === "KYU") return `${level}급`;
    return "-";
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          fontSize: "1.2rem",
          color: "#666",
        }}
      >
        ⏳ 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (!targetPlayer || !finalStat) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        선수 정보를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <button
        onClick={() => router.push("/")}
        style={{
          marginBottom: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #ccc",
          backgroundColor: "#f9f9f9",
        }}
      >
        ← 목록으로 돌아가기
      </button>

      {/* 요약 카드 */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          marginBottom: "30px",
        }}
      >
        <h1 style={{ margin: "0 0 16px 0", fontSize: "2rem", color: "#333" }}>
          {targetPlayer.name}{" "}
          <span
            style={{ fontSize: "1.2rem", color: "#666", fontWeight: "normal" }}
          >
            ({formatRank(targetPlayer.rank_level, targetPlayer.rank_type)})
          </span>
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              padding: "16px",
              backgroundColor: "#f0fdf4",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "0.9rem", color: "#166534" }}>
              최근 5년 레이팅 (마지막 대회)
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#15803d",
              }}
            >
              {finalStat.rating.toFixed(1)}
            </div>
          </div>
          <div
            style={{
              padding: "16px",
              backgroundColor: "#eff6ff",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "0.9rem", color: "#1e40af" }}>
              최근 5년 전적
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "bold",
                color: "#1d4ed8",
                marginTop: "4px",
              }}
            >
              {finalStat.totalGames}전 {finalStat.wins}승 {finalStat.draws}무{" "}
              {finalStat.losses}패
            </div>
          </div>
          <div
            style={{
              padding: "16px",
              backgroundColor: "#fffbeb",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "0.9rem", color: "#92400e" }}>
              승단 포인트
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#b45309",
              }}
            >
              {targetPlayer.rank_point}
            </div>
          </div>
        </div>
      </div>

      {/* 방식별 레이팅 변화 그래프 */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          marginBottom: "30px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontSize: "1.2rem",
            color: "#444",
            marginBottom: "20px",
          }}
        >
          📈 방식별 레이팅 변화 추이 비교
        </h2>
        <div style={{ width: "100%", height: "350px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 12 }}
                tickMargin={10}
                minTickGap={30}
              />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                labelStyle={{
                  fontWeight: "bold",
                  color: "#333",
                  marginBottom: "4px",
                }}
              />
              <Legend verticalAlign="top" height={36} />

              <Line
                type="monotone"
                dataKey="rating5YearsOld"
                name="마지막 대회 기준"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: "#ef4444" }}
              />
              <Line
                type="monotone"
                dataKey="ratingCumulative"
                name="전체 누적"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: "#f59e0b" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 전체 대국 결과 목록 */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontSize: "1.2rem",
            color: "#444",
            marginBottom: "20px",
          }}
        >
          📝 전체 대국 결과
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {playerHistory.map((group) => (
            <div
              key={group.tournament.id}
              style={{
                borderBottom: "1px solid #eaeaea",
                paddingBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  color: "#333",
                  margin: "0 0 12px 0",
                }}
              >
                {group.tournament.name}{" "}
                <span
                  style={{
                    fontSize: "0.95rem",
                    color: "#888",
                    fontWeight: "normal",
                  }}
                >
                  ({group.tournament.start_date})
                </span>
              </h3>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {group.games.map((game) => (
                  <li
                    key={game.id}
                    style={{
                      fontSize: "0.95rem",
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: game.isWin
                          ? "#10b981"
                          : game.isDraw
                            ? "#f59e0b"
                            : "#ef4444",
                        marginRight: "10px",
                      }}
                    ></span>
                    <span
                      style={{
                        fontWeight:
                          game.blackName === targetPlayer.name
                            ? "bold"
                            : "normal",
                      }}
                    >
                      {game.blackName}(흑)
                    </span>
                    <span style={{ margin: "0 8px", color: "#aaa" }}>vs</span>
                    <span
                      style={{
                        fontWeight:
                          game.whiteName === targetPlayer.name
                            ? "bold"
                            : "normal",
                      }}
                    >
                      {game.whiteName}(백)
                    </span>
                    <span
                      style={{
                        marginLeft: "10px",
                        color: game.isWin
                          ? "#10b981"
                          : game.isDraw
                            ? "#f59e0b"
                            : "#ef4444",
                        fontWeight: "bold",
                      }}
                    >
                      , {game.resultText}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {playerHistory.length === 0 && (
            <div
              style={{ color: "#888", textAlign: "center", padding: "20px 0" }}
            >
              대국 기록이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
