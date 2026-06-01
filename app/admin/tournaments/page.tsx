"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // 1. 공용 supabase 통로 임포트

interface Tournament {
  id: number;
  name: string;
  weight: number;
  start_date: string;
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    weight: 1,
    start_date: "",
  });

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) console.error("대회 목록 로딩 에러:", error);
    if (data) setTournaments(data);
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      await fetchTournaments();
    })();
  }, []);

  const filteredTournaments = useMemo(() => {
    const s = search.toLowerCase();
    return tournaments.filter(
      (t) =>
        t.id.toString().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.weight.toString().includes(s) ||
        t.start_date.includes(s),
    );
  }, [tournaments, search]);

  const handleOpenAdd = () => {
    setFormData({ name: "", weight: 1, start_date: "" });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.start_date)
      return alert("대회명과 시작일을 입력해 주세요.");
    if (formData.weight < 1) return alert("가중치는 1 이상이어야 합니다.");

    // id 컬럼에 default 가 없으므로 직접 채번한다.
    // 화면 state(stale 가능) 대신 insert 직전 DB의 현재 최대 id 를 조회해 경쟁 구간을 최소화한다.
    const { data: maxRow } = await supabase
      .from("tournaments")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (maxRow?.id ?? 0) + 1;
    const { error } = await supabase.from("tournaments").insert([
      {
        id: nextId,
        name: formData.name.trim(),
        weight: formData.weight,
        start_date: formData.start_date,
      },
    ]);

    if (error) alert("대회 추가 실패: " + error.message);
    else {
      setIsModalOpen(false);
      fetchTournaments();
    }
  };

  // --- 2. 로그아웃 처리 함수 추가 ---
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("로그아웃 실패: " + error.message);
    } else {
      alert("안전하게 로그아웃 되었습니다.");
      router.push("/admin/login"); // 로그아웃 후 로그인 페이지로 이동
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
        <h1 style={{ fontSize: "1.8rem", margin: 0 }}>
          🏆 대회(Tournament) 관리
        </h1>

        {/* 3. 버튼들을 한데 묶어주는 영역 (로그아웃 버튼 추가) */}
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
            + 대회 추가
          </button>
        </div>
      </header>

      {/* 필터 바 */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="아이디, 대회명, 가중치, 시작일로 검색..."
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

      {/* 리스트 테이블 */}
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
              <th style={{ padding: "15px" }}>대회명</th>
              <th style={{ padding: "15px" }}>가중치</th>
              <th style={{ padding: "15px" }}>시작일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={4}
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
              filteredTournaments.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/admin/tournaments/${t.id}`)}
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
                  <td style={{ padding: "15px", color: "#666" }}>{t.id}</td>
                  <td
                    style={{
                      padding: "15px",
                      fontWeight: "bold",
                      color: "#2563eb",
                    }}
                  >
                    {t.name}
                  </td>
                  <td style={{ padding: "15px" }}>{t.weight}</td>
                  <td style={{ padding: "15px", color: "#888" }}>
                    {t.start_date}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 추가 모달 */}
      {isModalOpen && (
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
              maxWidth: "400px",
              boxShadow: "0 20px 25px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
              신규 대회 등록
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
                  value="자동 생성"
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
                  대회명 *
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
                  가중치 *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: Number(e.target.value) })
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
                  시작일 *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
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

            <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => setIsModalOpen(false)}
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
                onClick={handleSubmit}
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
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
