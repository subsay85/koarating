"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type RankType = "DAN" | "KYU" | "UNRANKED";

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

interface DataContextType {
  playersData: Player[];
  gamesData: Game[];
  tournamentsData: Tournament[];
  loading: boolean;
}

async function fetchAllData<T>(tableName: string): Promise<T[]> {
  let allData: T[] = [];
  const step = 1000;
  let from = 0;
  let to = step - 1;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, to);
    if (error) {
      console.error(`${tableName} 데이터 로딩 에러:`, error);
      throw error;
    }
    allData = [...allData, ...(data as T[])];
    if (data.length < step) hasMore = false;
    else {
      from += step;
      to += step;
    }
  }
  return allData;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [playersData, setPlayersData] = useState<Player[]>([]);
  const [gamesData, setGamesData] = useState<Game[]>([]);
  const [tournamentsData, setTournamentsData] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDatabase() {
      try {
        const pData = await fetchAllData<Player>("players");
        const tData = await fetchAllData<Tournament>("tournaments");
        const gData = await fetchAllData<Game>("games");

        if (pData) setPlayersData(pData);
        if (tData) setTournamentsData(tData);
        if (gData) setGamesData(gData);
      } catch (error) {
        console.error("DB 로딩 중 예외 발생:", error);
      } finally {
        setLoading(false);
      }
    }

    if (supabaseUrl && supabaseAnonKey) {
      fetchDatabase();
    } else {
      setLoading(false);
    }
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
