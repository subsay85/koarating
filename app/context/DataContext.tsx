"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllData } from "@/lib/queries";
import type { Player, Game, Tournament } from "@/lib/rating";

export type { Player, Game, Tournament, RankType } from "@/lib/rating";

interface DataContextType {
  playersData: Player[];
  gamesData: Game[];
  tournamentsData: Tournament[];
  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [playersData, setPlayersData] = useState<Player[]>([]);
  const [gamesData, setGamesData] = useState<Game[]>([]);
  const [tournamentsData, setTournamentsData] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDatabase() {
      const __loadStart = performance.now();
      try {
        let pData: Player[];
        let tData: Tournament[];
        let gData: Game[];

        // 1순위: DB 함수 get_rating_data 로 단일 요청·단일 왕복.
        // (함수 반환값(JSON 1행)에는 PostgREST 1000행 제한이 적용되지 않음)
        const { data, error } = await supabase.rpc("get_rating_data");

        if (!error && data) {
          const result = data as {
            players?: Player[];
            tournaments?: Tournament[];
            games?: Game[];
          };
          pData = result.players ?? [];
          tData = result.tournaments ?? [];
          gData = result.games ?? [];
        } else {
          // 폴백: 함수가 없거나 호출 실패 시 테이블별 조회 (anon 키만으로 동작).
          // 공개 화면에 안 쓰는 컬럼(games.note, players.renjunet 등)은 제외해 전송량을 줄인다.
          if (error) {
            console.warn(
              "get_rating_data RPC 사용 불가 — 테이블별 조회로 폴백합니다:",
              error.message,
            );
          }
          const [p, t, g] = await Promise.all([
            fetchAllData<Player>(
              "players",
              "id,name,rank_level,rank_point,rank_type",
            ),
            fetchAllData<Tournament>(
              "tournaments",
              "id,name,weight,start_date",
            ),
            fetchAllData<Game>(
              "games",
              "id,tournament_id,black_player_id,white_player_id,result",
            ),
          ]);
          pData = p;
          tData = t;
          gData = g;
        }

        const __loadMs = performance.now() - __loadStart;
        console.log(
          `[데이터 로딩] 전체 로딩 시간: ${__loadMs.toFixed(2)}ms ` +
            `(선수 ${pData.length}명, 대회 ${tData.length}개, 게임 ${gData.length}개)`,
        );

        setPlayersData(pData);
        setTournamentsData(tData);
        setGamesData(gData);
      } catch (error) {
        console.error("DB 로딩 중 예외 발생:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDatabase();
  }, []);

  return (
    <DataContext.Provider
      value={{ playersData, gamesData, tournamentsData, loading }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
