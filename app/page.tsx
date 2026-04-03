"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useData } from "./context/DataContext";

type RankType = "DAN" | "KYU" | "UNRANKED";

interface PlayerStat {
  player: {
    id: number;
    name: string;
    rank_level: number;
    rank_point: number;
    rank_type: RankType;
    renjunet: string | null;
  };
  rating: number;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  rankNum?: number | string;
}

export default function Home() {
  const { playersData, gamesData, tournamentsData, loading } = useData();

  const [mode, setMode] = useState<"ALL_TIME" | "SPECIFIC_DATE">(
    "SPECIFIC_DATE",
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");

  useEffect(() => {
    if (tournamentsData.length > 0 && !selectedDateStr) {
      const sorted = [...tournamentsData].sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
      setSelectedDateStr(sorted[sorted.length - 1].start_date);
    }
  }, [tournamentsData, selectedDateStr]);

  const rankingResult = useMemo(() => {
    if (
      playersData.length === 0 ||
      tournamentsData.length === 0 ||
      gamesData.length === 0
    )
      return [];

    const sortedTournaments = [...tournamentsData].sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );

    let targetEndDate = new Date();
    let targetStartDate = new Date(0);

    if (mode === "SPECIFIC_DATE" && selectedDateStr) {
      const [y, m, d] = selectedDateStr.split("-").map(Number);
      targetEndDate = new Date(y, m - 1, d, 23, 59, 59, 999);

      targetStartDate = new Date(targetEndDate);
      targetStartDate.setFullYear(targetStartDate.getFullYear() - 5);
      targetStartDate.setHours(0, 0, 0, 0);
    }

    const windowTournaments = sortedTournaments.filter((t) => {
      const td = new Date(t.start_date);
      return td >= targetStartDate && td <= targetEndDate;
    });

    const statsMap = new Map<number, PlayerStat>();
    playersData.forEach((p) => {
      statsMap.set(Number(p.id), {
        player: p,
        rating: 1200,
        totalGames: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    });

    windowTournaments.forEach((t) => {
      const ratingChanges = new Map<number, number>();
      const tGames = gamesData.filter(
        (g) => Number(g.tournament_id) === Number(t.id),
      );

      tGames.forEach((g) => {
        const blackId = Number(g.black_player_id);
        const whiteId = Number(g.white_player_id);

        const black = statsMap.get(blackId);
        const white = statsMap.get(whiteId);

        if (!black || !white) return;

        const rB = black.rating,
          rW = white.rating;
        const expectB = 1 / (1 + Math.pow(10, (rW - rB) / 400));
        const expectW = 1 / (1 + Math.pow(10, (rB - rW) / 400));

        const winPointB = (1 - expectB) * 12 * t.weight + 0.5;
        const losePointB = (0 - expectB) * 12 + 0.5;
        const drawPointB = (winPointB + losePointB) / 2;

        const winPointW = (1 - expectW) * 12 * t.weight + 0.5;
        const losePointW = (0 - expectW) * 12 + 0.5;
        const drawPointW = (winPointW + losePointW) / 2;

        let changeB = 0,
          changeW = 0;
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

    const sortedStats = Array.from(statsMap.values()).sort((a, b) => {
      const aEligible = a.totalGames >= 6;
      const bEligible = b.totalGames >= 6;
      if (aEligible && !bEligible) return -1;
      if (!aEligible && bEligible) return 1;
      return b.rating - a.rating;
    });

    let currentRank = 1;
    sortedStats.forEach((stat) => {
      if (stat.totalGames < 6) {
        stat.rankNum = "-";
      } else {
        stat.rankNum = currentRank++;
      }
    });

    return sortedStats;
  }, [playersData, gamesData, tournamentsData, mode, selectedDateStr]);

  const formatRank = (level: number, type: RankType) => {
    if (level === 0 || type === "UNRANKED") return "-";
    if (type === "DAN") return `${level}단`;
    if (type === "KYU") return `${level}급`;
    return "-";
  };

  if (loading)
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

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "900px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "1.8rem",
          margin: "0 0 20px 0",
          color: "#111",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        🏆 KOA 레이팅 랭킹
      </h1>

      <div
        style={{
          display: "flex",
          width: "100%",
          marginBottom: "16px",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #d1d5db",
        }}
      >
        <button
          onClick={() => setMode("ALL_TIME")}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            border: "none",
            transition: "all 0.2s",
            backgroundColor: mode === "ALL_TIME" ? "#3b82f6" : "#fff",
            color: mode === "ALL_TIME" ? "#fff" : "#4b5563",
          }}
        >
          전체 기간
        </button>
        <button
          onClick={() => setMode("SPECIFIC_DATE")}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            border: "none",
            borderLeft: "1px solid #d1d5db",
            transition: "all 0.2s",
            backgroundColor: mode === "SPECIFIC_DATE" ? "#3b82f6" : "#fff",
            color: mode === "SPECIFIC_DATE" ? "#fff" : "#4b5563",
          }}
        >
          날짜 선택
        </button>
      </div>

      {mode === "SPECIFIC_DATE" && (
        <div style={{ marginBottom: "20px" }}>
          <input
            type="date"
            value={selectedDateStr}
            onChange={(e) => setSelectedDateStr(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      <div
        style={{
          overflowX: "auto",
          border: "1px solid #eaeaea",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          backgroundColor: "#fff",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "600px",
            borderCollapse: "collapse",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f8f9fa",
                borderBottom: "2px solid #ddd",
                color: "#555",
              }}
            >
              <th style={{ padding: "14px 10px" }}>순위</th>
              <th style={{ padding: "14px 10px" }}>이름</th>
              <th style={{ padding: "14px 10px" }}>기력</th>
              <th style={{ padding: "14px 10px" }}>레이팅</th>
              <th style={{ padding: "14px 10px" }}>전적 (승-무-패)</th>
              <th style={{ padding: "14px 10px" }}>승단포인트</th>
            </tr>
          </thead>
          <tbody>
            {rankingResult.map((stat, index) => (
              <tr
                key={stat.player.id}
                style={{
                  borderBottom: "1px solid #eaeaea",
                  backgroundColor: index % 2 === 0 ? "#fff" : "#fafafa",
                  transition: "background-color 0.2s",
                }}
              >
                <td
                  style={{
                    padding: "14px 10px",
                    fontWeight: "bold",
                    color: stat.rankNum === "-" ? "#aaa" : "#333",
                    fontSize: "1rem",
                  }}
                >
                  {stat.rankNum}
                </td>
                <td
                  style={{
                    padding: "14px 10px",
                    fontWeight: "500",
                    fontSize: "1rem",
                  }}
                >
                  <Link
                    href={`/player/${stat.player.id}`}
                    style={{
                      color: "#2563eb",
                      textDecoration: "underline",
                      textUnderlineOffset: "4px",
                    }}
                  >
                    {stat.player.name}
                  </Link>
                </td>
                <td style={{ padding: "14px 10px", color: "#4b5563" }}>
                  {formatRank(stat.player.rank_level, stat.player.rank_type)}
                </td>
                <td
                  style={{
                    padding: "14px 10px",
                    color: "#2563eb",
                    fontWeight: "bold",
                    fontSize: "1.05rem",
                  }}
                >
                  {stat.rating.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: "14px 10px",
                    fontSize: "0.95rem",
                    color: "#4b5563",
                  }}
                >
                  {stat.totalGames}전 ({stat.wins}승 {stat.draws}무{" "}
                  {stat.losses}패)
                </td>
                <td
                  style={{
                    padding: "14px 10px",
                    color: stat.player.rank_point > 0 ? "#10b981" : "#4b5563",
                    fontWeight: "500",
                  }}
                >
                  {stat.player.rank_point}
                </td>
              </tr>
            ))}
            {rankingResult.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "40px", color: "#888" }}>
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
