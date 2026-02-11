import mongoose from "mongoose";

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: Cached | undefined;
}

export async function dbConnect() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI. Define it in your environment variables.");
  }

  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }

  if (global.mongooseCache.conn) {
    return global.mongooseCache.conn;
  }

  if (!global.mongooseCache.promise) {
    global.mongooseCache.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }

  global.mongooseCache.conn = await global.mongooseCache.promise;
  return global.mongooseCache.conn;
}
