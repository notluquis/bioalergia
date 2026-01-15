import { useSuspenseQuery } from "@tanstack/react-query";

import { participantQueries } from "@/features/participants/queries";

import TopParticipantsWidget from "./TopParticipantsWidget";

type Props = {
  params: {
    from: string;
    to: string;
    limit: number;
    mode: "combined" | "incoming" | "outgoing";
  };
};

export default function DashboardParticipantsSection({ params }: Props) {
  const { data: leaderboardData } = useSuspenseQuery(participantQueries.leaderboard(params));
  const topParticipants = leaderboardData.participants || [];

  return <TopParticipantsWidget data={topParticipants} loading={false} error={null} />;
}
