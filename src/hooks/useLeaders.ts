import { useQuery } from "@tanstack/react-query";
import { fetchLeaders } from "../api/espn";

export function useLeaders() {
  return useQuery({
    queryKey: ["leaders"],
    queryFn: fetchLeaders,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
