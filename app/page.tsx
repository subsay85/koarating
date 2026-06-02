"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useData } from "./context/DataContext";
import {
  computeRatings,
  type Player,
  type RankType,
  type Tournament,
} from "@/lib/rating";
import { parseLocalDate } from "@/lib/date";

interface PlayerStat {
  player: Player;
  rating: number;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  rankNum?: number | string;
}

/**
 * 렌더마다 새로 만들 필요가 없는 정적 style 객체들은 모듈 스코프로 끌어올린다.
 * (컴포넌트 바깥 → 앱 생애 동안 딱 1번만 생성되고, 모든 렌더가 같은 참조를 공유)
 */
const loadingStyle: React.CSSProperties = {
  padding: "40px",
  textAlign: "center",
  fontSize: "1.2rem",
  color: "#666",
};

const pageStyle: React.CSSProperties = {
  padding: "20px",
  maxWidth: "900px",
  margin: "0 auto",
  fontFamily: "sans-serif",
};

const h1Style: React.CSSProperties = {
  fontSize: "1.8rem",
  margin: "0 0 20px 0",
  color: "#111",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  marginBottom: "16px",
  borderRadius: "8px",
  overflow: "hidden",
  border: "1px solid #d1d5db",
};

const tabButtonBase: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  fontSize: "1rem",
  fontWeight: "bold",
  cursor: "pointer",
  border: "none",
  transition: "all 0.2s",
};

const dateWrapStyle: React.CSSProperties = { marginBottom: "16px" };

const dateInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  fontSize: "1rem",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  outline: "none",
  boxSizing: "border-box",
};

const searchWrapStyle: React.CSSProperties = { marginBottom: "20px" };

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  fontSize: "1rem",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#f9fafb",
};

const tableScrollStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #eaeaea",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
  backgroundColor: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "600px",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  borderBottom: "2px solid #ddd",
  color: "#555",
};

const thStyle: React.CSSProperties = { padding: "14px 10px" };

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
};

const emptyCellStyle: React.CSSProperties = { padding: "40px", color: "#888" };

// --- 행/셀: 값이 몇 가지로 한정되므로 변형(variant)을 미리 만들어 둔다. (행당 객체 생성 0) ---
const rowStyleEven: React.CSSProperties = {
  borderBottom: "1px solid #eaeaea",
  backgroundColor: "#fff",
  transition: "background-color 0.2s",
};

const rowStyleOdd: React.CSSProperties = {
  borderBottom: "1px solid #eaeaea",
  backgroundColor: "#fafafa",
  transition: "background-color 0.2s",
};

const rankCellRanked: React.CSSProperties = {
  padding: "14px 10px",
  fontWeight: "bold",
  color: "#333",
  fontSize: "1rem",
};

const rankCellUnranked: React.CSSProperties = {
  padding: "14px 10px",
  fontWeight: "bold",
  color: "#aaa",
  fontSize: "1rem",
};

const nameCellStyle: React.CSSProperties = {
  padding: "14px 10px",
  fontWeight: "500",
  fontSize: "1rem",
};

const rankTypeCellStyle: React.CSSProperties = {
  padding: "14px 10px",
  color: "#4b5563",
};

const ratingCellStyle: React.CSSProperties = {
  padding: "14px 10px",
  color: "#2563eb",
  fontWeight: "bold",
  fontSize: "1.05rem",
};

const recordCellStyle: React.CSSProperties = {
  padding: "14px 10px",
  fontSize: "0.95rem",
  color: "#4b5563",
};

const pointCellPositive: React.CSSProperties = {
  padding: "14px 10px",
  color: "#10b981",
  fontWeight: "500",
};

const pointCellZero: React.CSSProperties = {
  padding: "14px 10px",
  color: "#4b5563",
  fontWeight: "500",
};

export default function Home() {
  const { playersData, gamesData, tournamentsData, loading } = useData();

  const [mode, setMode] = useState<"ALL_TIME" | "SPECIFIC_DATE">(
    "SPECIFIC_DATE",
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    if (tournamentsData.length > 0 && !selectedDateStr) {
      const sorted = [...tournamentsData].sort(
        (a, b) =>
          parseLocalDate(a.start_date).getTime() -
          parseLocalDate(b.start_date).getTime(),
      );
      setSelectedDateStr(sorted[sorted.length - 1].start_date);
    }
  }, [tournamentsData, selectedDateStr]);

  // 대회 정렬은 대회 데이터가 바뀔 때만 한 번 한다.
  const sortedTournaments = useMemo(
    () =>
      [...tournamentsData].sort(
        (a, b) =>
          parseLocalDate(a.start_date).getTime() -
          parseLocalDate(b.start_date).getTime(),
      ),
    [tournamentsData],
  );

  // 주어진 대회 윈도우로 순위표를 만든다. (순수 함수 — 렌더 중 호출 가능)
  const computeRankingForWindow = useCallback(
    (windowTournaments: Tournament[]): PlayerStat[] => {
      const statsMap = computeRatings(
        playersData,
        gamesData,
        windowTournaments,
      );

      const sortedStats: PlayerStat[] = playersData
        .map((p) => {
          const s = statsMap.get(Number(p.id))!;
          return { player: p, ...s };
        })
        .sort((a, b) => {
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
    },
    [playersData, gamesData],
  );

  // 날짜 선택 모드의 대회 윈도우 (선택일 기준 직전 5년). 선택일이 바뀔 때만 다시 만든다.
  const specificDateWindow = useMemo(() => {
    if (!selectedDateStr) return [];
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 5);
    start.setHours(0, 0, 0, 0);
    return sortedTournaments.filter((t) => {
      const td = parseLocalDate(t.start_date);
      return td >= start && td <= end;
    });
  }, [sortedTournaments, selectedDateStr]);

  // 전체 기간: 데이터가 바뀔 때만 1번 계산 후 캐시된다. (탭 토글로는 재계산되지 않음)
  const allTimeRanking = useMemo(() => {
    if (
      playersData.length === 0 ||
      tournamentsData.length === 0 ||
      gamesData.length === 0
    )
      return [];
    return computeRankingForWindow(sortedTournaments);
  }, [
    playersData,
    gamesData,
    tournamentsData,
    sortedTournaments,
    computeRankingForWindow,
  ]);

  // 날짜 선택: 선택일이 바뀔 때만 재계산된다. (탭 토글로는 재계산되지 않음)
  const specificDateRanking = useMemo(() => {
    if (
      playersData.length === 0 ||
      tournamentsData.length === 0 ||
      gamesData.length === 0 ||
      !selectedDateStr
    )
      return [];
    return computeRankingForWindow(specificDateWindow);
  }, [
    playersData,
    gamesData,
    tournamentsData,
    specificDateWindow,
    selectedDateStr,
    computeRankingForWindow,
  ]);

  // 화면에는 현재 모드에 맞는 (이미 계산·캐시된) 결과만 고른다.
  const rankingResult =
    mode === "SPECIFIC_DATE" && selectedDateStr
      ? specificDateRanking
      : allTimeRanking;

  // [개발 모드 전용] 순수 계산 시간 측정.
  // performance.now() 는 렌더 중엔 호출 금지(impure)라 렌더 밖인 이펙트에서 잰다.
  // 프로덕션에선 실행되지 않으므로 측정용 재계산 비용도 들지 않는다.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (
      playersData.length === 0 ||
      tournamentsData.length === 0 ||
      gamesData.length === 0
    )
      return;

    const timeIt = (windowTournaments: Tournament[], label: string) => {
      const start = performance.now();
      computeRankingForWindow(windowTournaments);
      const ms = performance.now() - start;
      console.log(
        `[${label}] 순수 계산 시간: ${ms.toFixed(2)}ms ` +
          `(대회 ${windowTournaments.length}개, 게임 ${gamesData.length}개, 선수 ${playersData.length}명)`,
      );
    };

    timeIt(sortedTournaments, "메인 랭킹 · 전체 기간");
    if (selectedDateStr) {
      timeIt(specificDateWindow, `메인 랭킹 · ${selectedDateStr} 기준 최근 5년`);
    }
  }, [
    playersData,
    gamesData,
    tournamentsData,
    sortedTournaments,
    specificDateWindow,
    selectedDateStr,
    computeRankingForWindow,
  ]);

  const filteredRankingResult = useMemo(() => {
    if (!searchTerm.trim()) return rankingResult;
    return rankingResult.filter((stat) =>
      stat.player.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [rankingResult, searchTerm]);

  const formatRank = (level: number, type: RankType) => {
    if (level === 0 || type === "UNRANKED") return "-";
    if (type === "DAN") return `${level}단`;
    if (type === "KYU") return `${level}급`;
    return "-";
  };

  if (loading)
    return <div style={loadingStyle}>⏳ 데이터를 불러오는 중입니다...</div>;

  return (
    <div style={pageStyle}>
      <h1 style={h1Style}>🏆 KOA 레이팅 랭킹</h1>

      <div style={tabBarStyle}>
        <button
          onClick={() => setMode("ALL_TIME")}
          style={{
            ...tabButtonBase,
            backgroundColor: mode === "ALL_TIME" ? "#3b82f6" : "#fff",
            color: mode === "ALL_TIME" ? "#fff" : "#4b5563",
          }}
        >
          전체 기간
        </button>
        <button
          onClick={() => setMode("SPECIFIC_DATE")}
          style={{
            ...tabButtonBase,
            borderLeft: "1px solid #d1d5db",
            backgroundColor: mode === "SPECIFIC_DATE" ? "#3b82f6" : "#fff",
            color: mode === "SPECIFIC_DATE" ? "#fff" : "#4b5563",
          }}
        >
          날짜 선택
        </button>
      </div>

      {mode === "SPECIFIC_DATE" && (
        <div style={dateWrapStyle}>
          <input
            type="date"
            value={selectedDateStr}
            onChange={(e) => setSelectedDateStr(e.target.value)}
            style={dateInputStyle}
          />
        </div>
      )}

      <div style={searchWrapStyle}>
        <input
          type="text"
          placeholder="🔍 선수 이름 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      <div style={tableScrollStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>순위</th>
              <th style={thStyle}>이름</th>
              <th style={thStyle}>기력</th>
              <th style={thStyle}>레이팅</th>
              <th style={thStyle}>전적 (승-무-패)</th>
              <th style={thStyle}>승단포인트</th>
            </tr>
          </thead>
          <tbody>
            {filteredRankingResult.map((stat, index) => (
              <tr
                key={stat.player.id}
                style={index % 2 === 0 ? rowStyleEven : rowStyleOdd}
              >
                <td
                  style={
                    stat.rankNum === "-" ? rankCellUnranked : rankCellRanked
                  }
                >
                  {stat.rankNum}
                </td>
                <td style={nameCellStyle}>
                  <Link href={`/player/${stat.player.id}`} style={linkStyle}>
                    {stat.player.name}
                  </Link>
                </td>
                <td style={rankTypeCellStyle}>
                  {formatRank(stat.player.rank_level, stat.player.rank_type)}
                </td>
                <td style={ratingCellStyle}>{stat.rating.toFixed(1)}</td>
                <td style={recordCellStyle}>
                  {stat.totalGames}전 ({stat.wins}승 {stat.draws}무{" "}
                  {stat.losses}패)
                </td>
                <td
                  style={
                    stat.player.rank_point > 0
                      ? pointCellPositive
                      : pointCellZero
                  }
                >
                  {stat.player.rank_point}
                </td>
              </tr>
            ))}
            {filteredRankingResult.length === 0 && (
              <tr>
                <td colSpan={6} style={emptyCellStyle}>
                  검색된 선수 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
