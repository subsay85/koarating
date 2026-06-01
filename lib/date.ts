/**
 * "YYYY-MM-DD" 형식의 날짜 문자열을 로컬 타임존 기준 자정 Date 로 파싱한다.
 *
 * `new Date("2026-02-28")` 은 UTC 자정으로 해석되는 반면,
 * 비교 대상 날짜는 `new Date(y, m, d)` 처럼 로컬 기준으로 만드는 경우가 많아
 * 두 방식을 섞으면 타임존 오프셋만큼 경계일에서 하루가 어긋날 수 있다.
 * 모든 대회 날짜 비교는 이 함수로 통일한다.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
