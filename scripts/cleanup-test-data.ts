import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { dbConnect } from "../lib/db";
import { Institution, EventModel, Result } from "../lib/models";

const testInstitutionCodes = ["MVA", "RI", "SHS", "VC", "OU", "FHS", "DSA"];
const testEventNames = [
  "Debate Competition", "Quiz Bowl", "Singing Competition", 
  "Drama Performance", "Poetry Recitation", "Essay Writing", "Photography Contest"
];

async function main() {
  await dbConnect();
  console.log("🧹 Starting cleanup of test data...");

  // Delete test results
  console.log("\n🗑️  Deleting test results...");
  const testEvents = await EventModel.find({ name: { $in: testEventNames } });
  const testEventIds = testEvents.map(e => e._id);
  
  const deletedResults = await Result.deleteMany({ 
    eventId: { $in: testEventIds },
    submittedBy: "test-seed"
  });
  console.log(`  ✓ Deleted ${deletedResults.deletedCount} test results`);

  // Delete test events
  console.log("\n🗑️  Deleting test events...");
  const deletedEvents = await EventModel.deleteMany({ name: { $in: testEventNames } });
  console.log(`  ✓ Deleted ${deletedEvents.deletedCount} test events`);

  // Delete test institutions (only if they don't have any results)
  console.log("\n🗑️  Checking test institutions...");
  for (const code of testInstitutionCodes) {
    const inst = await Institution.findOne({ code });
    if (inst) {
      // Check if institution has any results
      const hasResults = await Result.findOne({ 
        "placements.institutionId": inst._id 
      });
      
      if (!hasResults) {
        await Institution.deleteOne({ _id: inst._id });
        console.log(`  ✓ Deleted institution ${inst.displayName} (${code})`);
      } else {
        console.log(`  ⚠️  Kept institution ${inst.displayName} (${code}) - has results`);
      }
    }
  }

  console.log("\n✅ Cleanup completed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});

