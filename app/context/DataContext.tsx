"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
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
      try {
        const pData = await fetchAllData<Player>("players");
        const tData = await fetchAllData<Tournament>("tournaments");
        const gData = await fetchAllData<Game>("games");

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
