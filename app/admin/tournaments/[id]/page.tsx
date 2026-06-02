"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAllData } from "@/lib/queries";

interface Player {
  id: number;
  name: string;
  renjunet: string | null;
}
interface Game {
  id: number;
  tournament_id: number;
  black_player_id: number;
  white_player_id: number;
  result: string;
  note: string | null;
}
interface Tournament {
  id: number;
  name: string;
  weight: number;
  start_date: string;
}

interface GameInsert {
  tournament_id: number;
  black_player_id: number;
  white_player_id: number;
  result: string;
  note: string;
}

export default function TournamentDetail() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = Number(params.id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT">("ADD");
  const [inputTab, setInputTab] = useState<"MANUAL" | "AUTO">("MANUAL");

  const [gameForm, setGameForm] = useState({
    id: 0,
    blackName: "",
    whiteName: "",
    result: "BLACK_WIN",
    note: "",
  });
  const [autoText, setAutoText] = useState("");

  const loadData = useCallback(async () => {
    const [tData, gData, pData] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase
        .from("games")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: true }),
      fetchAllData<Player>("players"),
    ]);
    if (tData.error) console.error("대회 정보 로딩 에러:", tData.error);
    if (gData.error) console.error("대국 목록 로딩 에러:", gData.error);
    if (tData.data) setTournament(tData.data);
    if (gData.data) setGames(gData.data);
    setPlayers(pData);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, [loadData]);

  // id → 선수 빠른 조회용 맵 (루프/렌더에서 players.find 선형 탐색 방지)
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const tournamentResults = useMemo(() => {
    const stats: Record<
      number,
      {
        id: number;
        name: string;
        wins: number;
        draws: number;
        losses: number;
        points: number;
        total: number;
      }
    > = {};

    games.forEach((g) => {
      if (!stats[g.black_player_id]) {
        const p = playerById.get(g.black_player_id);
        stats[g.black_player_id] = {
          id: g.black_player_id,
          name: p?.name || "알 수 없음",
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          total: 0,
        };
      }
      if (!stats[g.white_player_id]) {
        const p = playerById.get(g.white_player_id);
        stats[g.white_player_id] = {
          id: g.white_player_id,
          name: p?.name || "알 수 없음",
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          total: 0,
        };
      }

      const bStat = stats[g.black_player_id];
      const wStat = stats[g.white_player_id];

      bStat.total += 1;
      wStat.total += 1;

      // 승무패 및 승점 계산 (승리: 1점, 무승부: 0.5점)
      if (g.result === "BLACK_WIN") {
        bStat.wins += 1;
        bStat.points += 1;
        wStat.losses += 1;
      } else if (g.result === "WHITE_WIN") {
        wStat.wins += 1;
        wStat.points += 1;
        bStat.losses += 1;
      } else if (g.result === "DRAW") {
        bStat.draws += 1;
        bStat.points += 0.5;
        wStat.draws += 1;
        wStat.points += 0.5;
      }
    });

    // 승점 높은 순 -> 승수 높은 순 -> 패배 적은 순으로 정렬
    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
  }, [games, playerById]);

  const handleTournamentUpdate = async () => {
    if (!tournament) return;
    const { error } = await supabase
      .from("tournaments")
      .update({
        name: tournament.name,
        weight: tournament.weight,
        start_date: tournament.start_date,
      })
      .eq("id", tournamentId);
    if (error) alert("대회 수정 실패: " + error.message);
    else alert("대회 정보가 수정되었습니다.");
  };

  const openGameModal = (mode: "ADD" | "EDIT", game?: Game) => {
    setModalMode(mode);
    setInputTab("MANUAL");
    setAutoText("");
    if (mode === "ADD") {
      setGameForm({
        id: 0,
        blackName: "",
        whiteName: "",
        result: "BLACK_WIN",
        note: "",
      });
    } else if (game) {
      const bPlayer = playerById.get(game.black_player_id);
      const wPlayer = playerById.get(game.white_player_id);
      setGameForm({
        id: game.id,
        blackName: bPlayer?.name || "",
        whiteName: wPlayer?.name || "",
        result: game.result,
        note: game.note || "",
      });
    }
    setIsGameModalOpen(true);
  };

  const handleAutoParse = async () => {
    const text = autoText.trim();
    if (!text) return;

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    if (lines.length === 0) return alert("입력된 데이터가 없습니다.");

    // 한 줄만 있으면 → 기존처럼 폼에 채워넣기 (수동 검토용)
    if (lines.length === 1) {
      parseSingleLineToForm(lines[0]);
      return;
    }

    // 여러 줄이면 → 일괄 등록 모드
    const payloads: GameInsert[] = [];
    const errors: string[] = [];

    lines.forEach((line, idx) => {
      const result = parseSingleLine(line);
      if (typeof result === "string") {
        errors.push(`${idx + 1}번째 줄: ${result}`);
      } else {
        payloads.push({
          tournament_id: tournamentId,
          black_player_id: result.blackId,
          white_player_id: result.whiteId,
          result: result.dbResult,
          note: result.note,
        });
      }
    });

    if (errors.length > 0) {
      return alert(
        `다음 줄에서 오류가 발생했습니다.\n\n${errors.join("\n")}\n\n수정 후 다시 시도해주세요.`,
      );
    }

    if (
      !window.confirm(`총 ${payloads.length}개의 대국을 일괄 등록하시겠습니까?`)
    )
      return;

    const { error } = await supabase.from("games").insert(payloads);
    if (error) {
      alert("일괄 등록 실패: " + error.message);
    } else {
      alert(`${payloads.length}개의 대국이 등록되었습니다.`);
      setIsGameModalOpen(false);
      loadData();
    }
  };

  // 한 줄을 파싱해서 폼에 채워넣는 함수 (단일 입력용)
  const parseSingleLineToForm = (line: string) => {
    const result = parseSingleLine(line);
    if (typeof result === "string") {
      return alert(result);
    }

    const bPlayer = playerById.get(result.blackId);
    const wPlayer = playerById.get(result.whiteId);

    setGameForm({
      ...gameForm,
      blackName: bPlayer?.name || "",
      whiteName: wPlayer?.name || "",
      result: result.dbResult,
      note: result.note,
    });
    setInputTab("MANUAL");
  };

  // 한 줄 파싱 핵심 로직 (성공: 객체, 실패: 에러 메시지 문자열)
  const parseSingleLine = (
    line: string,
  ):
    | { blackId: number; whiteId: number; dbResult: string; note: string }
    | string => {
    const resultMatch = line.match(/(1\s*:\s*0|0\s*:\s*1|0\.5\s*:\s*0\.5)/);
    if (!resultMatch)
      return `결과(1:0, 0:1, 0.5:0.5)를 찾을 수 없습니다. → "${line}"`;

    const resStr = resultMatch[0].replace(/\s/g, "");
    let dbResult = "DRAW";
    if (resStr === "1:0") dbResult = "BLACK_WIN";
    else if (resStr === "0:1") dbResult = "WHITE_WIN";

    const [leftPart, rightPart] = line.split(resultMatch[0]);

    const noteMatch = leftPart.match(/^\s*(\d+)/);
    const parsedNote = noteMatch ? noteMatch[1] : "";

    const bStr = leftPart
      .replace(/^\s*\d+\s*/, "")
      .replace(/\b[A-Z]{3}\b/g, "")
      .trim();
    const wStr = rightPart.replace(/\b[A-Z]{3}\b/g, "").trim();

    const bPlayer = players.find(
      (p) => p.renjunet?.toLowerCase() === bStr.toLowerCase(),
    );
    const wPlayer = players.find(
      (p) => p.renjunet?.toLowerCase() === wStr.toLowerCase(),
    );

    if (!bPlayer) return `흑 대국자 '${bStr}'를 찾을 수 없습니다.`;
    if (!wPlayer) return `백 대국자 '${wStr}'를 찾을 수 없습니다.`;

    return {
      blackId: bPlayer.id,
      whiteId: wPlayer.id,
      dbResult,
      note: parsedNote,
    };
  };

  const handleSaveGame = async () => {
    const bPlayer = players.find((p) => p.name === gameForm.blackName);
    const wPlayer = players.find((p) => p.name === gameForm.whiteName);

    if (!bPlayer || !wPlayer)
      return alert("흑/백 대국자 이름을 정확히 선택해 주세요.");
    if (bPlayer.id === wPlayer.id)
      return alert("흑과 백 대국자는 동일인일 수 없습니다.");

    const payload = {
      tournament_id: tournamentId,
      black_player_id: bPlayer.id,
      white_player_id: wPlayer.id,
      result: gameForm.result,
      note: gameForm.note,
    };

    if (modalMode === "ADD") {
      const { error } = await supabase.from("games").insert([payload]);
      if (error) alert("대국 추가 실패: " + error.message);
    } else {
      const { error } = await supabase
        .from("games")
        .update(payload)
        .eq("id", gameForm.id);
      if (error) alert("대국 수정 실패: " + error.message);
    }

    setIsGameModalOpen(false);
    loadData();
  };

  const handleDeleteGame = async (id: number) => {
    if (!window.confirm("정말 이 대국 기록을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      setIsGameModalOpen(false);
      loadData();
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("로그아웃 실패: " + error.message);
    } else {
      alert("안전하게 로그아웃 되었습니다.");
      router.push("/admin/login");
    }
  };

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>로딩 중...</div>
    );
  if (!tournament)
    return <div style={{ padding: "40px" }}>대회 정보를 찾을 수 없습니다.</div>;

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1000px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => router.push("/admin/tournaments")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: "#f9f9f9",
            cursor: "pointer",
          }}
        >
          ← 대회 목록으로
        </button>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          로그아웃
        </button>
      </div>

      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          marginBottom: "30px",
          border: "1px solid #eee",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0", fontSize: "1.5rem" }}>
          ⚙️ 대회 정보 수정
        </h2>
        <div
          style={{
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#666",
                marginBottom: "5px",
              }}
            >
              대회명
            </label>
            <input
              type="text"
              value={tournament.name}
              onChange={(e) =>
                setTournament({ ...tournament, name: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
              }}
            />
          </div>
          <div style={{ width: "120px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#666",
                marginBottom: "5px",
              }}
            >
              가중치
            </label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={tournament.weight}
              onChange={(e) =>
                setTournament({ ...tournament, weight: Number(e.target.value) })
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
              }}
            />
          </div>
          <div style={{ width: "150px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#666",
                marginBottom: "5px",
              }}
            >
              시작일
            </label>
            <input
              type="date"
              value={tournament.start_date}
              onChange={(e) =>
                setTournament({ ...tournament, start_date: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
              }}
            />
          </div>
          <button
            onClick={handleTournamentUpdate}
            style={{
              padding: "10px 20px",
              height: "42px",
              backgroundColor: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            정보 저장
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>
          ⚔️ 등록된 대국 리스트 ({games.length}건)
        </h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setIsResultModalOpen(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            📊 대회 결과
          </button>
          <button
            onClick={() => openGameModal("ADD")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + 대국 추가
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#fff",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "center",
          }}
        >
          <thead
            style={{
              backgroundColor: "#f9fafb",
              borderBottom: "1px solid #eee",
              color: "#555",
            }}
          >
            <tr>
              <th style={{ padding: "12px" }}>비고(No)</th>
              <th style={{ padding: "12px" }}>흑 대국자</th>
              <th style={{ padding: "12px" }}>결과</th>
              <th style={{ padding: "12px" }}>백 대국자</th>
            </tr>
          </thead>
          <tbody>
            {games.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "30px", color: "#999" }}>
                  등록된 대국이 없습니다.
                </td>
              </tr>
            ) : null}
            {games.map((g) => {
              const bPlayer =
                playerById.get(g.black_player_id)?.name || "알 수 없음";
              const wPlayer =
                playerById.get(g.white_player_id)?.name || "알 수 없음";
              let resStr = "무승부",
                resColor = "#f59e0b";
              if (g.result === "BLACK_WIN") {
                resStr = "흑 승";
                resColor = "#111";
              } else if (g.result === "WHITE_WIN") {
                resStr = "백 승";
                resColor = "#111";
              }

              return (
                <tr
                  key={g.id}
                  onClick={() => openGameModal("EDIT", g)}
                  style={{
                    borderBottom: "1px solid #f9fafb",
                    cursor: "pointer",
                    transition: "0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f3f4f6")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td style={{ padding: "12px", color: "#888" }}>
                    {g.note || "-"}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontWeight: "bold",
                      color: g.result === "BLACK_WIN" ? "#2563eb" : "#333",
                    }}
                  >
                    {bPlayer}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontWeight: "bold",
                      color: resColor,
                    }}
                  >
                    {resStr}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontWeight: "bold",
                      color: g.result === "WHITE_WIN" ? "#2563eb" : "#333",
                    }}
                  >
                    {wPlayer}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <datalist id="player-list">
        {players.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      {isResultModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "20px",
                color: "#111",
                fontSize: "1.4rem",
              }}
            >
              📊 {tournament.name} 결과
            </h2>

            <div
              style={{
                border: "1px solid #eee",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "center",
                }}
              >
                <thead
                  style={{
                    backgroundColor: "#f9fafb",
                    borderBottom: "1px solid #eee",
                    color: "#555",
                  }}
                >
                  <tr>
                    <th style={{ padding: "12px" }}>순위</th>
                    <th style={{ padding: "12px" }}>이름</th>
                    <th style={{ padding: "12px" }}>승점</th>
                    <th style={{ padding: "12px" }}>대국수</th>
                    <th style={{ padding: "12px" }}>승</th>
                    <th style={{ padding: "12px" }}>무</th>
                    <th style={{ padding: "12px" }}>패</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ padding: "20px", color: "#888" }}
                      >
                        기록된 대국이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    tournamentResults.map((stat, idx) => (
                      <tr
                        key={stat.id}
                        style={{ borderBottom: "1px solid #f9fafb" }}
                      >
                        <td style={{ padding: "12px", fontWeight: "bold" }}>
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            fontWeight: "bold",
                            color: "#2563eb",
                          }}
                        >
                          {stat.name}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            fontWeight: "bold",
                            color: "#10b981",
                          }}
                        >
                          {stat.points}
                        </td>
                        <td style={{ padding: "12px", color: "#666" }}>
                          {stat.total}
                        </td>
                        <td style={{ padding: "12px", color: "#333" }}>
                          {stat.wins}
                        </td>
                        <td style={{ padding: "12px", color: "#333" }}>
                          {stat.draws}
                        </td>
                        <td style={{ padding: "12px", color: "#333" }}>
                          {stat.losses}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setIsResultModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px",
                border: "none",
                borderRadius: "8px",
                backgroundColor: "#e5e7eb",
                color: "#374151",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {isGameModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {modalMode === "ADD" ? "새 대국 등록" : "대국 수정"}
              {modalMode === "EDIT" && (
                <button
                  onClick={() => handleDeleteGame(gameForm.id)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.85rem",
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
              )}
            </h2>

            {modalMode === "ADD" && (
              <div
                style={{
                  display: "flex",
                  marginBottom: "20px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <button
                  onClick={() => setInputTab("MANUAL")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "none",
                    border: "none",
                    borderBottom:
                      inputTab === "MANUAL"
                        ? "3px solid #2563eb"
                        : "3px solid transparent",
                    fontWeight: inputTab === "MANUAL" ? "bold" : "normal",
                    cursor: "pointer",
                    color: inputTab === "MANUAL" ? "#2563eb" : "#666",
                  }}
                >
                  수동 입력
                </button>
                <button
                  onClick={() => setInputTab("AUTO")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "none",
                    border: "none",
                    borderBottom:
                      inputTab === "AUTO"
                        ? "3px solid #2563eb"
                        : "3px solid transparent",
                    fontWeight: inputTab === "AUTO" ? "bold" : "normal",
                    cursor: "pointer",
                    color: inputTab === "AUTO" ? "#2563eb" : "#666",
                  }}
                >
                  자동 파싱 (RenjuNet)
                </button>
              </div>
            )}

            {inputTab === "MANUAL" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <div style={{ display: "flex", gap: "15px" }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        color: "#111",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      ⚫ 흑 대국자 (이름 검색)
                    </label>
                    <input
                      type="text"
                      list="player-list"
                      placeholder="이름 입력..."
                      value={gameForm.blackName}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, blackName: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        color: "#111",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      ⚪ 백 대국자 (이름 검색)
                    </label>
                    <input
                      type="text"
                      list="player-list"
                      placeholder="이름 입력..."
                      value={gameForm.whiteName}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, whiteName: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      color: "#666",
                      marginBottom: "8px",
                    }}
                  >
                    경기 결과
                  </label>
                  <div style={{ display: "flex", gap: "15px" }}>
                    <label>
                      <input
                        type="radio"
                        name="result"
                        checked={gameForm.result === "BLACK_WIN"}
                        onChange={() =>
                          setGameForm({ ...gameForm, result: "BLACK_WIN" })
                        }
                      />{" "}
                      흑 승
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="result"
                        checked={gameForm.result === "WHITE_WIN"}
                        onChange={() =>
                          setGameForm({ ...gameForm, result: "WHITE_WIN" })
                        }
                      />{" "}
                      백 승
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="result"
                        checked={gameForm.result === "DRAW"}
                        onChange={() =>
                          setGameForm({ ...gameForm, result: "DRAW" })
                        }
                      />{" "}
                      무승부
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      color: "#666",
                      marginBottom: "5px",
                    }}
                  >
                    비고 (Note)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 1 (경기 번호)"
                    value={gameForm.note}
                    onChange={(e) =>
                      setGameForm({ ...gameForm, note: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                  RenjuNet 포맷을 그대로 복사해 붙여넣으세요.
                  <br />
                  <span style={{ color: "#2563eb" }}>
                    예: 1 KOR Cha Seung-hyun 1 : 0 KOR Choi Seung-hyeok
                  </span>
                </p>
                <textarea
                  rows={4}
                  value={autoText}
                  onChange={(e) => setAutoText(e.target.value)}
                  placeholder="여기에 붙여넣기..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    resize: "none",
                  }}
                />
                <button
                  onClick={handleAutoParse}
                  style={{
                    padding: "12px",
                    backgroundColor: "#10b981",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  데이터 자동 파싱하기
                </button>
              </div>
            )}

            <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => setIsGameModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              {inputTab === "MANUAL" && (
                <button
                  onClick={handleSaveGame}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: "8px",
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  저장하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
