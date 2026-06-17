import { useQuery } from "@tanstack/react-query";
import { fetchTeamRoster } from "../api/espn";
import { queryKeys } from "./queryKeys";

export function useTeamRoster(espnId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.roster(espnId),
    queryFn: () => fetchTeamRoster(espnId!),
    enabled: !!espnId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
