import { Institution, Result, EventModel } from "./models";

export async function getLeaderboard(limit = 10, level?: "high_school" | "higher_secondary") {
  // Recalculate totals from actual results to ensure accuracy
  // This ensures the leaderboard is always up-to-date even if results are deleted
  
  // Build query to filter results by level if specified
  let query: any = {};
  if (level) {
    // Get all event IDs for the specified level
    const events = await EventModel.find({ level, isActive: true }).select("_id").lean();
    const eventIds = events.map(e => e._id);
    query = { eventId: { $in: eventIds } };
  }
  
  const allResults = await Result.find(query).lean();
  
  // Calculate totals from actual results
  const totalsMap = new Map<string, number>();
  for (const result of allResults) {
    for (const placement of (result.placements || [])) {
      // institutionId can be ObjectId or populated object
      const instId = String(
        (placement.institutionId as any)?._id ?? placement.institutionId
      );
      const currentTotal = totalsMap.get(instId) || 0;
      totalsMap.set(instId, currentTotal + (placement.points || 0));
    }
  }

  // Get all institutions that have points
  const institutionIds = Array.from(totalsMap.keys()).map(id => id);
  const insts = await Institution.find({ _id: { $in: institutionIds } }).select("_id displayName logoUrl code").lean();
  const instMap = new Map(insts.map(i => [String(i._id), i]));

  // Convert to array and sort by total points
  const leaderboard = Array.from(totalsMap.entries())
    .map(([institutionId, totalPoints]) => ({
      institutionId,
      totalPoints,
      displayName: instMap.get(institutionId)?.displayName ?? "Unknown",
      logoUrl: instMap.get(institutionId)?.logoUrl ?? null,
      code: instMap.get(institutionId)?.code ?? ""
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit);

  return leaderboard;
}