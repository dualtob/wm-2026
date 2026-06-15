import { useQuery } from "@tanstack/react-query";
import { fetchMatchDetail } from "../api/espn";

export function useMatchDetail(espnId: string | null | undefined) {
  return useQuery({
    queryKey: ["matchDetail", espnId],
    queryFn: () => fetchMatchDetail(espnId!),
    enabled: !!espnId,
    staleTime: 30_000,
  });
}
