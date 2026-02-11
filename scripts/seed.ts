import dns from "node:dns/promises";

dns.setServers(["1.1.1.1"]);
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
import { dbConnect } from "../lib/db";
import { Institution, EventModel } from "../lib/models";

async function main() {
  await dbConnect();

  // 3 Houses for the arts event (fixed; no need to add more)
  const houses = [
    { name: "Red House", displayName: "Red", code: "RED" },
    { name: "Blue House", displayName: "Blue", code: "BLUE" },
    { name: "Green House", displayName: "Green", code: "GREEN" },
  ];

  for (const h of houses) {
    await Institution.updateOne({ code: h.code }, { ...h, isActive: true }, { upsert: true });
  }

  // Optional: add example events (admin can add more via Manage)
  const events = [
    { name: "Solo Dance", category: "Dance", level: "high_school" as const },
    { name: "Group Dance", category: "Dance", level: "high_school" as const },
    { name: "Live Art", category: "Art", level: "higher_secondary" as const },
  ];

  for (const e of events) {
    await EventModel.updateOne({ name: e.name }, { ...e, isActive: true }, { upsert: true });
  }

  console.log("Seeded 3 houses (Red, Blue, Green) & example events");
  process.exit(0);
}
main();
