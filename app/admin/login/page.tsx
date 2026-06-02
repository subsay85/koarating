"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(`로그인 실패: ${error.message}`);
      setLoading(false);
    } else {
      router.replace("/admin/players");
      router.refresh();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "8px",
            color: "#111",
          }}
        >
          KOA 관리자 시스템
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#6b7280",
            marginBottom: "30px",
            fontSize: "0.95rem",
          }}
        >
          접근 권한이 있는 계정으로 로그인하세요.
        </p>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: "bold",
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: "bold",
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                color: "#ef4444",
                fontSize: "0.9rem",
                textAlign: "center",
                backgroundColor: "#fef2f2",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "14px",
              backgroundColor: "#2563eb",
              color: "#fff",
              fontWeight: "bold",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
