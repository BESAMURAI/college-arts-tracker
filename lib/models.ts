import { Schema, model, models, Types } from "mongoose";

const InstitutionSchema = new Schema({
  name: { type: String, required: true, unique: true },         // canonical
  displayName: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  logoUrl: { type: String }
}, { timestamps: true });

const EventSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  category: String,
  schedule: { start: Date, end: Date },
  roomCode: String,
  level: { type: String, enum: ["high_school", "higher_secondary"], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const ResultPlacementSchema = new Schema({
  rank: { type: Number, required: true, enum: [1,2,3] },
  studentName: { type: String, required: true },
  institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true },
  points: { type: Number, required: true, min: 0 }
}, { _id: false });

const ResultSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true, unique: true },
  placements: { type: [ResultPlacementSchema], validate: (v: any) => v.length > 0 },
  submittedBy: { type: String },     // later replace with user id from auth
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const TotalsSchema = new Schema({
  institutionId: { type: Schema.Types.ObjectId, ref: "Institution", unique: true, index: true },
  totalPoints: { type: Number, default: 0 },
  lastUpdate: { type: Date, default: Date.now }
}, { timestamps: true });

export const Institution = models.Institution || model("Institution", InstitutionSchema);
export const EventModel = models.Event || model("Event", EventSchema);
export const Result = models.Result || model("Result", ResultSchema);
export const Totals = models.Totals || model("Totals", TotalsSchema);
