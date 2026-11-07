export function topCounts(rows: { label: string | null | undefined; count: number }[], max = 6) {
  return rows.filter(row => row.label && row.label.trim()).sort((a,b)=>b.count-a.count).slice(0,max).map(row => ({ label: row.label!, count: row.count }));
}
export function successRate(total: number, failures: number) {
  if (total <= 0) return 100;
  return Math.min(100,Math.max(0,Math.round((1-failures/total)*100)));
}
