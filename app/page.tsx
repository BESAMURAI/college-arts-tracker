import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-neutral-950 px-6 py-24 text-neutral-100">
      <div className="max-w-3xl space-y-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
          Arts Event — Live Results
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Red, Blue & Green — live house scores
        </h1>
        <p className="mx-auto max-w-2xl text-base text-neutral-400 sm:text-lg">
          Submit event results (student name, house, points), broadcast to the
          display screen, and watch the house leaderboard update in real time.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/admin"
          className="rounded-full bg-indigo-500 px-8 py-3 text-lg font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
        >
          Open Admin Panel
        </Link>
        <Link
          href="/display"
          className="rounded-full border border-neutral-700 px-8 py-3 text-lg font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-900"
        >
          View Auditorium Screen
        </Link>
      </div>

      <div className="grid max-w-4xl gap-6 sm:grid-cols-3">
        {["Real-time sync", "Trustworthy scores", "Majestic reveal"].map((item) => (
          <div key={item} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 text-left">
            <div className="text-sm uppercase tracking-wide text-neutral-500">Feature</div>
            <div className="mt-3 text-xl font-semibold">{item}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
