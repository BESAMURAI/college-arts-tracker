import dns from "node:dns/promises";

dns.setServers(["1.1.1.1"]);
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { dbConnect } from "../lib/db";
import { Institution, EventModel, Result } from "../lib/models";

const studentNames = [
  "Alex Johnson", "Sarah Williams", "Michael Brown", "Emily Davis", "James Wilson",
  "Olivia Martinez", "Daniel Anderson", "Sophia Taylor", "Matthew Thomas", "Isabella Jackson",
  "David White", "Emma Harris", "Christopher Martin", "Ava Thompson", "Andrew Garcia",
  "Mia Martinez", "Joshua Robinson", "Charlotte Clark", "Ryan Lewis", "Amelia Walker",
  "Nathan Hall", "Harper Allen", "Tyler Young", "Evelyn King", "Jacob Wright",
  "Abigail Lopez", "Logan Hill", "Madison Scott", "Noah Green", "Chloe Adams"
];

const institutionNames = [
  "Nilgiri College of Arts and Science",
  "St. Joseph's College",
  "Bluebell School",
  "Mountain View Academy",
  "Riverside Institute",
  "Sunset High School",
  "Valley College",
  "Oceanview University",
  "Forest Hills School",
  "Desert Springs Academy"
];

const institutionCodes = ["NCAS", "SJC", "BBS", "MVA", "RI", "SHS", "VC", "OU", "FHS", "DSA"];

const eventNames = [
  "Solo Dance", "Group Dance", "Live Art", "Debate Competition", "Quiz Bowl",
  "Singing Competition", "Drama Performance", "Poetry Recitation", "Essay Writing", "Photography Contest"
];

async function main() {
  await dbConnect();
  console.log("🌱 Starting test seed...");

  // Create institutions
  console.log("📚 Creating institutions...");
  const institutions = [];
  for (let i = 0; i < 10; i++) {
    const inst = await Institution.findOneAndUpdate(
      { code: institutionCodes[i] },
      {
        name: institutionNames[i],
        displayName: institutionNames[i].split(" ")[0] + (institutionNames[i].includes("College") ? " College" : ""),
        code: institutionCodes[i],
        isActive: true
      },
      { upsert: true, new: true }
    );
    institutions.push(inst);
    console.log(`  ✓ Created ${inst.displayName} (${inst.code})`);
  }

  // Create events
  console.log("\n🎭 Creating events...");
  const events = [];
  for (let i = 0; i < 10; i++) {
    const event = await EventModel.findOneAndUpdate(
      { name: eventNames[i] },
      {
        name: eventNames[i],
        category: i < 3 ? "Dance" : i < 6 ? "Academic" : "Arts",
        roomCode: `ROOM-${String(i + 1).padStart(2, "0")}`,
        isActive: true
      },
      { upsert: true, new: true }
    );
    events.push(event);
    console.log(`  ✓ Created ${event.name}`);
  }

  // Create random results for each event
  console.log("\n🏆 Creating random results...");
  for (const event of events) {
    // Check if result already exists
    const existing = await Result.findOne({ eventId: event._id });
    if (existing) {
      console.log(`  ⏭️  Skipping ${event.name} (already has results)`);
      continue;
    }

    // Randomly select 3 different institutions for podium
    const shuffled = [...institutions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);

    // Random points (1st: 8-12, 2nd: 5-8, 3rd: 3-6)
    const points = [
      Math.floor(Math.random() * 5) + 8,  // 8-12
      Math.floor(Math.random() * 4) + 5,  // 5-8
      Math.floor(Math.random() * 4) + 3   // 3-6
    ];

    // Random student names
    const students = [...studentNames].sort(() => Math.random() - 0.5).slice(0, 3);

    const result = await Result.create({
      eventId: event._id,
      placements: [
        {
          rank: 1,
          studentName: students[0],
          institutionId: selected[0]._id,
          points: points[0]
        },
        {
          rank: 2,
          studentName: students[1],
          institutionId: selected[1]._id,
          points: points[1]
        },
        {
          rank: 3,
          studentName: students[2],
          institutionId: selected[2]._id,
          points: points[2]
        }
      ],
      submittedBy: "test-seed"
    });

    console.log(`  ✓ Created results for ${event.name}: ${selected[0].displayName} (${points[0]}pts), ${selected[1].displayName} (${points[1]}pts), ${selected[2].displayName} (${points[2]}pts)`);
  }

  console.log("\n✅ Test seed completed!");
  console.log(`   - ${institutions.length} institutions`);
  console.log(`   - ${events.length} events`);
  console.log(`   - ${events.length} results with random scores`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});

