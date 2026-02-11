"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type EventItem = { _id: string; name: string; category?: string; roomCode?: string; description?: string; level?: string };

export default function ManagePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizeConfirmStep, setFinalizeConfirmStep] = useState(0);
  const [undoConfirmStep, setUndoConfirmStep] = useState(0);

  // Event form
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    category: "",
    roomCode: ""
  });
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [eventErrors, setEventErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    checkFinalizeStatus();
  }, []);

  async function checkFinalizeStatus() {
    const res = await fetch("/api/finalize");
    const data = await res.json();
    setIsFinalized(data.finalized || false);
  }

  async function loadData() {
    const eventRes = await fetch("/api/events").then(r => r.json());
    setEvents(eventRes);
  }

  function validateEvent(): { ok: boolean; messages: string[] } {
    const messages: string[] = [];
    if (!eventForm.name.trim()) messages.push("Event name is required");
    return { ok: messages.length === 0, messages };
  }

  async function submitEvent() {
    const v = validateEvent();
    setEventErrors(v.messages);
    if (!v.ok) {
      setEventStatus("❌ Fix the errors below.");
      return;
    }
    setEventStatus("Submitting...");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: eventForm.name.trim(),
        description: eventForm.description.trim() || undefined,
        category: eventForm.category.trim() || undefined,
        roomCode: eventForm.roomCode.trim() || undefined
      })
    });
    const data = await res.json();
    if (res.ok) {
      setEventStatus("✅ Event added!");
      setEventErrors([]);
      setEventForm({ name: "", description: "", category: "", roomCode: "" });
      loadData();
    } else {
      setEventStatus(`❌ ${data.error}`);
    }
  }

  async function handleFinalize() {
    if (finalizeConfirmStep === 0) {
      setFinalizeConfirmStep(1);
      return;
    }
    if (finalizeConfirmStep === 1) {
      setFinalizeConfirmStep(2);
      return;
    }
    // Final confirmation
    const res = await fetch("/api/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize" })
    });
    const data = await res.json();
    if (res.ok) {
      setIsFinalized(true);
      setFinalizeConfirmStep(0);
    }
  }

  async function handleUndoFinalize() {
    if (undoConfirmStep === 0) {
      setUndoConfirmStep(1);
      return;
    }
    // Confirmation
    const res = await fetch("/api/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" })
    });
    const data = await res.json();
    if (res.ok) {
      setIsFinalized(false);
      setUndoConfirmStep(0);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Manage Events</h1>
          <Link href="/admin" className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors">
            ← Back to Admin
          </Link>
        </div>

        {/* Finalize Expo Section */}
        <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-xl p-6 border-2 border-purple-500/30 mb-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span>🏁</span>
            <span>Finalize Expo</span>
          </h2>
          
          {!isFinalized ? (
            <div className="space-y-4">
              <p className="text-neutral-300">Finalize the expo to show the summary and reveal the winner on the display screen.</p>
              <button
                onClick={handleFinalize}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  finalizeConfirmStep === 0
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                    : finalizeConfirmStep === 1
                    ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500"
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
                }`}
              >
                {finalizeConfirmStep === 0 && "Finalize Expo"}
                {finalizeConfirmStep === 1 && "⚠️ Confirm Finalization (1/2)"}
                {finalizeConfirmStep === 2 && "⚠️⚠️ Final Confirmation (2/2)"}
              </button>
              {finalizeConfirmStep > 0 && (
                <button
                  onClick={() => setFinalizeConfirmStep(0)}
                  className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-green-300 font-semibold">✅ Expo is finalized. Display screen is showing the summary.</p>
              </div>
              <button
                onClick={handleUndoFinalize}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  undoConfirmStep === 0
                    ? "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
                }`}
              >
                {undoConfirmStep === 0 && "Undo Finalization"}
                {undoConfirmStep === 1 && "⚠️ Confirm Undo"}
              </button>
              {undoConfirmStep > 0 && (
                <button
                  onClick={() => setUndoConfirmStep(0)}
                  className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {/* Events */}
          <div className="space-y-6">
            <div className="bg-neutral-900 rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">Add New Event</h2>
              
              <div>
                <label className="block text-sm opacity-80 mb-1">Event Name *</label>
                <input
                  type="text"
                  className="w-full bg-neutral-800 rounded-lg p-3"
                  placeholder="e.g., Solo Dance"
                  value={eventForm.name}
                  onChange={e => setEventForm(s => ({ ...s, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Category (optional)</label>
                <input
                  type="text"
                  className="w-full bg-neutral-800 rounded-lg p-3"
                  placeholder="e.g., Dance, Art, Music"
                  value={eventForm.category}
                  onChange={e => setEventForm(s => ({ ...s, category: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Room Code (optional)</label>
                <input
                  type="text"
                  className="w-full bg-neutral-800 rounded-lg p-3"
                  placeholder="e.g., AUD-1, G-Block-102"
                  value={eventForm.roomCode}
                  onChange={e => setEventForm(s => ({ ...s, roomCode: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Description (optional)</label>
                <textarea
                  className="w-full bg-neutral-800 rounded-lg p-3 min-h-[100px]"
                  placeholder="Event description..."
                  value={eventForm.description}
                  onChange={e => setEventForm(s => ({ ...s, description: e.target.value }))}
                />
              </div>

              <button
                onClick={submitEvent}
                className="px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Add Event
              </button>

              {eventStatus && <p className="text-sm opacity-90">{eventStatus}</p>}
              {eventErrors.length > 0 && (
                <ul className="text-sm text-red-400 list-disc pl-5 space-y-1">
                  {eventErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>

            {/* Existing Events */}
            <div className="bg-neutral-900 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Existing Events ({events.length})</h2>
              <div className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-neutral-400">No events found</p>
                ) : (
                  events.map(event => (
                    <div key={event._id} className="bg-neutral-800 rounded-lg p-3">
                      <div className="font-medium">{event.name}</div>
                      {(event.category || event.roomCode) && (
                        <div className="text-sm text-neutral-400 mt-1">
                          {event.category && <span>{event.category}</span>}
                          {event.category && event.roomCode && <span> • </span>}
                          {event.roomCode && <span>Room: {event.roomCode}</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

