import { useSuspenseQuery } from "@tanstack/react-query";

import { participantQueries } from "@/features/participants/queries";

import TopParticipantsWidget from "./TopParticipantsWidget";

interface Props {
  params: {
    from: string;
    limit: number;
    mode: "combined" | "incoming" | "outgoing";
    to: string;
  };
}

export default function DashboardParticipantsSection({ params }: Props) {
  const { data: leaderboardData } = useSuspenseQuery(participantQueries.leaderboard(params));
  const topParticipants = leaderboardData.participants || [];

  return <TopParticipantsWidget data={topParticipants} error={null} loading={false} />;
}
