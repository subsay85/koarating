import { supabase } from "./supabase";

/**
 * Supabase 의 1000행 응답 제한을 우회하여 테이블 전체를 페이지네이션으로 가져온다.
 */
export async function fetchAllData<T>(tableName: string): Promise<T[]> {
  const step = 1000;
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, from + step - 1);

    if (error) {
      console.error(`${tableName} 데이터 로딩 에러:`, error);
      throw error;
    }
    if (!data) break;

    allData = [...allData, ...(data as T[])];
    if (data.length < step) hasMore = false;
    else from += step;
  }

  return allData;
}
