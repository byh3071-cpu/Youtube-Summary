"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type TrendFilterContextValue = {
  selectedTrendKeyword: string | null;
  setSelectedTrendKeyword: (keyword: string | null) => void;
  /** 클릭 시 선택(또는 같은 키워드면 해제) */
  toggleTrendKeyword: (keyword: string) => void;
};

const TrendFilterContext = createContext<TrendFilterContextValue | null>(null);

export function TrendFilterProvider({ children }: { children: ReactNode }) {
  const [selectedTrendKeyword, setSelectedTrendKeyword] = useState<string | null>(null);

  const toggleTrendKeyword = useCallback((keyword: string) => {
    setSelectedTrendKeyword((prev) => (prev === keyword ? null : keyword));
  }, []);

  return (
    <TrendFilterContext.Provider
      value={{ selectedTrendKeyword, setSelectedTrendKeyword, toggleTrendKeyword }}
    >
      {children}
    </TrendFilterContext.Provider>
  );
}

export function useTrendFilter(): TrendFilterContextValue | null {
  return useContext(TrendFilterContext);
}
