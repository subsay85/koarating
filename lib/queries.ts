import { supabase } from "./supabase";

/**
 * Supabase 의 1000행 응답 제한을 우회하여 테이블 전체를 가져온다.
 * columns 로 가져올 컬럼을 좁히면 전송량을 줄일 수 있다. (기본값은 전체 컬럼)
 */
export async function fetchAllData<T>(
  tableName: string,
  columns: string = "*",
): Promise<T[]> {
  const step = 1000;

  const { data, error, count } = await supabase
    .from(tableName)
    .select(columns, { count: "exact" })
    .range(0, step - 1);

  if (error) {
    console.error(`${tableName} 데이터 로딩 에러:`, error);
    throw error;
  }

  const firstPage = (data as T[]) ?? [];

  if (count === null || count <= step || firstPage.length < step) {
    return firstPage;
  }

  const restRequests: PromiseLike<T[]>[] = [];
  for (let from = step; from < count; from += step) {
    restRequests.push(
      supabase
        .from(tableName)
        .select(columns)
        .range(from, from + step - 1)
        .then(({ data: pageData, error: pageError }) => {
          if (pageError) {
            console.error(`${tableName} 데이터 로딩 에러:`, pageError);
            throw pageError;
          }
          return (pageData as T[]) ?? [];
        }),
    );
  }

  const restPages = await Promise.all(restRequests);
  return firstPage.concat(...restPages);
}
