"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type House = { _id: string; displayName: string; code: string };
type EventItem = { _id: string; name: string; category?: string; level?: string };

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  items: Array<{ _id: string; name: string; [key: string]: any }>;
  searchKey: string;
  title: string;
};

function EventSearchModal({ isOpen, onClose, onSelect, items, searchKey, title }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item =>
    item[searchKey]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-xl border-2 border-neutral-700 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-neutral-700">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center text-neutral-400 py-8">No results found</div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map(item => (
                <button
                  key={item._id}
                  onClick={() => {
                    onSelect(item._id, item[searchKey]);
                    onClose();
                    setSearchQuery("");
                  }}
                  className="w-full text-left bg-neutral-800 hover:bg-neutral-700 rounded-lg p-3 transition-colors"
                >
                  <div className="font-medium text-white">{item[searchKey]}</div>
                  {item.code && <div className="text-xs text-neutral-400 mt-1">{item.code}</div>}
                  {item.category && <div className="text-xs text-neutral-400 mt-1">{item.category}</div>}
                  {item.level && <div className="text-xs text-neutral-400 mt-1">{item.level === "high_school" ? "High School" : "Higher Secondary"}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [selectedEventName, setSelectedEventName] = useState("");
  const [form, setForm] = useState({
    r1Name: "", r1Inst: "", r1InstName: "", r1Pts: 10,
    r2Name: "", r2Inst: "", r2InstName: "", r2Pts: 7,
    r3Name: "", r3Inst: "", r3InstName: "", r3Pts: 5
  });
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [h, e] = await Promise.all([
        fetch("/api/institutions").then(r => r.json()),
        fetch("/api/events").then(r => r.json())
      ]);
      setHouses(h);
      setEvents(e);
    }
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  function validate(): { ok: boolean; messages: string[] } {
    const messages: string[] = [];
    if (!eventId) messages.push("Please select an event.");
    const rows = [
      { rank: 1, name: form.r1Name, inst: form.r1Inst, pts: form.r1Pts },
      { rank: 2, name: form.r2Name, inst: form.r2Inst, pts: form.r2Pts },
      { rank: 3, name: form.r3Name, inst: form.r3Inst, pts: form.r3Pts },
    ];
    for (const r of rows) {
      if (!r.name.trim()) messages.push(`Rank ${r.rank}: student name is required.`);
      if (!r.inst) messages.push(`Rank ${r.rank}: house is required.`);
      if (typeof r.pts !== "number" || !Number.isFinite(r.pts) || r.pts <= 0) messages.push(`Rank ${r.rank}: points must be positive.`);
    }
    return { ok: messages.length === 0, messages };
  }

  async function submit() {
    const v = validate();
    setErrors(v.messages);
    if (!v.ok) {
      setStatus("❌ Fix the errors below.");
      return;
    }
    setStatus("Submitting...");
    const placements = [
      { rank: 1, studentName: form.r1Name.trim(), institutionId: form.r1Inst, points: Number(form.r1Pts) },
      { rank: 2, studentName: form.r2Name.trim(), institutionId: form.r2Inst, points: Number(form.r2Pts) },
      { rank: 3, studentName: form.r3Name.trim(), institutionId: form.r3Inst, points: Number(form.r3Pts) },
    ];
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, placements, submittedBy: "roomCoordinator" })
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("✅ Submitted!");
      setErrors([]);
    } else {
      setStatus(`❌ ${data.error}`);
    }
  }

  const rankColors = {
    1: "bg-gradient-to-br from-yellow-600/90 to-yellow-700/90 border-yellow-500/60",
    2: "bg-gradient-to-br from-gray-500/90 to-gray-600/90 border-gray-400/60",
    3: "bg-gradient-to-br from-amber-700/90 to-amber-800/90 border-amber-600/60"
  };

  const rankIcons = {
    1: "🥇",
    2: "🥈",
    3: "🥉"
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div>
            <h1 className="text-2xl font-bold text-white">Event Results</h1>
            <p className="text-neutral-400 text-sm">Submit competition results</p>
          </div>
          <Link 
            href="/admin/manage" 
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span>⚙️</span>
            <span>Manage</span>
          </Link>
        </div>

        {/* Event Selection */}
        <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
          <label className="block text-xs font-semibold text-neutral-300 mb-2">Select Event</label>
          <button
            type="button"
            onClick={() => setEventModalOpen(true)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-left text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:bg-neutral-700 transition-colors"
          >
            {selectedEventName ? (
              <div className="font-medium">{selectedEventName}</div>
            ) : (
              "Click to search events..."
            )}
          </button>
        </div>

        {/* Podium Form Cards */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-200">Podium Results</h2>
          
          {[1,2,3].map(rank => (
            <div 
              key={rank} 
              className={`${rankColors[rank as keyof typeof rankColors]} rounded-lg p-3 border-2 shadow-lg`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-lg">
                  {rankIcons[rank as keyof typeof rankIcons]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place"}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Student Name</label>
                  <input 
                    className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Enter name"
                    value={(form as any)[`r${rank}Name`]}
                    onChange={e=>setForm(s=>({ ...s, [`r${rank}Name`]: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">House</label>
                  <select
                    value={(form as any)[`r${rank}Inst`]}
                    onChange={e => {
                      const id = e.target.value;
                      const name = houses.find(h => h._id === id)?.displayName ?? "";
                      setForm(s => ({ ...s, [`r${rank}Inst`]: id, [`r${rank}InstName`]: name }));
                    }}
                    className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                  >
                    <option value="">Select house...</option>
                    {houses.map(h => (
                      <option key={h._id} value={h._id}>{h.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Points</label>
                  <input 
                    type="number" 
                    className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                    placeholder="Points"
                    value={(form as any)[`r${rank}Pts`]}
                    onChange={e=>setForm(s=>({ ...s, [`r${rank}Pts`]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <button 
            onClick={submit}
            disabled={!eventId}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:cursor-not-allowed transition-colors font-semibold text-sm w-full sm:w-auto min-w-[180px]"
          >
            Submit Results
          </button>

          {/* Status Messages */}
          {status && (
            <div className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm ${
              status.includes("✅") 
                ? "bg-green-500/20 border border-green-500/50 text-green-300" 
                : status.includes("❌")
                ? "bg-red-500/20 border border-red-500/50 text-red-300"
                : "bg-blue-500/20 border border-blue-500/50 text-blue-300"
            }`}>
              <p className="font-medium">{status}</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="font-semibold text-red-300 text-sm mb-1.5">Please fix the following errors:</p>
              <ul className="text-xs text-red-200 list-disc list-inside space-y-0.5">
                {errors.map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Event search modal */}
      <EventSearchModal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSelect={(id, name) => {
          setEventId(id);
          setSelectedEventName(name);
        }}
        items={events.map(e => ({ _id: e._id, name: e.name, category: e.category, level: e.level }))}
        searchKey="name"
        title="Search Events"
      />
    </div>
  );
}
