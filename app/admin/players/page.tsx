"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RankType = "DAN" | "KYU" | "UNRANKED";

interface Player {
  id: number;
  name: string;
  rank_level: number;
  rank_point: number;
  rank_type: RankType;
  renjunet: string | null;
}

const RANK_OPTIONS = [
  { label: "9단", level: 9, type: "DAN" },
  { label: "8단", level: 8, type: "DAN" },
  { label: "7단", level: 7, type: "DAN" },
  { label: "6단", level: 6, type: "DAN" },
  { label: "5단", level: 5, type: "DAN" },
  { label: "4단", level: 4, type: "DAN" },
  { label: "3단", level: 3, type: "DAN" },
  { label: "2단", level: 2, type: "DAN" },
  { label: "1단", level: 1, type: "DAN" },
  { label: "1급", level: 1, type: "KYU" },
  { label: "2급", level: 2, type: "KYU" },
  { label: "3급", level: 3, type: "KYU" },
  { label: "4급", level: 4, type: "KYU" },
  { label: "5급", level: 5, type: "KYU" },
  { label: "6급", level: 6, type: "KYU" },
  { label: "7급", level: 7, type: "KYU" },
  { label: "8급", level: 8, type: "KYU" },
  { label: "9급", level: 9, type: "KYU" },
  { label: "무급", level: 0, type: "UNRANKED" },
];

export default function AdminPlayers() {
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    rankIdx: 18,
    rank_point: 0,
    renjunet: "",
  });

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("id", { ascending: true });
    if (error) console.error("선수 목록 로딩 에러:", error);
    if (data) setPlayers(data);
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      await fetchPlayers();
    })();
  }, []);

  const filteredPlayers = useMemo(() => {
    const s = search.toLowerCase();
    return players.filter(
      (p) =>
        p.id.toString().includes(s) ||
        p.name.toLowerCase().includes(s) ||
        (p.renjunet || "").toLowerCase().includes(s) ||
        p.rank_point.toString().includes(s),
    );
  }, [players, search]);

  const getRankLabel = (level: number, type: RankType) => {
    if (type === "UNRANKED") return "무급";
    return `${level}${type === "DAN" ? "단" : "급"}`;
  };

  const handleOpenAdd = () => {
    setFormData({ name: "", rankIdx: 18, rank_point: 0, renjunet: "" });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Player) => {
    setSelectedPlayer(p);
    const rIdx = RANK_OPTIONS.findIndex(
      (opt) => opt.level === p.rank_level && opt.type === p.rank_type,
    );
    setFormData({
      name: p.name,
      rankIdx: rIdx !== -1 ? rIdx : 18,
      rank_point: p.rank_point,
      renjunet: p.renjunet || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (mode: "ADD" | "EDIT") => {
    if (!formData.name.trim()) return alert("이름을 입력해 주세요.");

    const isDuplicate = players.some(
      (p) =>
        p.name === formData.name.trim() &&
        (mode === "ADD" || p.id !== selectedPlayer?.id),
    );
    if (isDuplicate) return alert("이미 등록된 이름입니다.");

    const rank = RANK_OPTIONS[formData.rankIdx];
    const payload = {
      name: formData.name.trim(),
      rank_level: rank.level,
      rank_type: rank.type,
      rank_point: formData.rank_point,
      renjunet: formData.renjunet.trim() || null,
    };

    if (mode === "ADD") {
      // id 컬럼에 default 가 없으므로 직접 채번한다.
      // 화면 state(stale 가능) 대신 insert 직전 DB의 현재 최대 id 를 조회해 경쟁 구간을 최소화한다.
      const { data: maxRow } = await supabase
        .from("players")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextId = (maxRow?.id ?? 0) + 1;
      const { error } = await supabase
        .from("players")
        .insert([{ id: nextId, ...payload }]);
      if (error) alert("추가 실패: " + error.message);
    } else {
      const { error } = await supabase
        .from("players")
        .update(payload)
        .eq("id", selectedPlayer?.id);
      if (error) alert("수정 실패: " + error.message);
    }

    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    fetchPlayers();
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

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1000px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <h1 style={{ fontSize: "1.8rem", margin: 0 }}>👤 선수 관리</h1>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 20px",
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

          <button
            onClick={handleOpenAdd}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + 선수 추가
          </button>
        </div>
      </header>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="아이디, 이름, 기력, 포인트 등으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#fff",
          boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead
            style={{
              backgroundColor: "#f9fafb",
              borderBottom: "1px solid #eee",
            }}
          >
            <tr>
              <th style={{ padding: "15px" }}>ID</th>
              <th style={{ padding: "15px" }}>이름</th>
              <th style={{ padding: "15px" }}>기력</th>
              <th style={{ padding: "15px" }}>승단포인트</th>
              <th style={{ padding: "15px" }}>렌주넷</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  불러오는 중...
                </td>
              </tr>
            ) : (
              filteredPlayers.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => handleOpenEdit(p)}
                  style={{
                    borderBottom: "1px solid #f9fafb",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f3f4f6")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td style={{ padding: "15px", color: "#666" }}>{p.id}</td>
                  <td
                    style={{
                      padding: "15px",
                      fontWeight: "bold",
                      color: "#2563eb",
                    }}
                  >
                    {p.name}
                  </td>
                  <td style={{ padding: "15px" }}>
                    {getRankLabel(p.rank_level, p.rank_type as RankType)}
                  </td>
                  <td style={{ padding: "15px" }}>{p.rank_point}</td>
                  <td style={{ padding: "15px", color: "#888" }}>
                    {p.renjunet || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(isAddModalOpen || isEditModalOpen) && (
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
              maxWidth: "450px",
              boxShadow: "0 20px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
              {isAddModalOpen ? "신규 선수 등록" : "선수 정보 수정"}
            </h2>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: "#666",
                    marginBottom: "5px",
                  }}
                >
                  아이디 (자동)
                </label>
                <input
                  type="text"
                  value={isAddModalOpen ? "자동 생성" : selectedPlayer?.id}
                  disabled
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    backgroundColor: "#f3f4f6",
                  }}
                />
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
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                  }}
                />
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
                  기력 *
                </label>
                <select
                  value={formData.rankIdx}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rankIdx: Number(e.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                  }}
                >
                  {RANK_OPTIONS.map((opt, idx) => (
                    <option key={idx} value={idx}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                  승단포인트 *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.rank_point}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rank_point: Number(e.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                  }}
                />
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
                  렌주넷 ID (영문 성함)
                </label>
                <input
                  type="text"
                  value={formData.renjunet}
                  onChange={(e) =>
                    setFormData({ ...formData, renjunet: e.target.value })
                  }
                  placeholder="예: Cha Seung-hyun"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
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
              <button
                onClick={() => handleSubmit(isAddModalOpen ? "ADD" : "EDIT")}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
