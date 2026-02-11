"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BoardRow = { institutionId: string; displayName: string; logoUrl?: string | null; code: string; totalPoints: number };
type Placement = {
  rank: number;
  studentName: string;
  institutionName: string;
  institutionCode: string;
  institutionId: string;
  points: number;
};
type ResultItem = {
  id: string;
  eventId: string;
  eventName: string;
  eventLevel?: "high_school" | "higher_secondary" | null;
  submittedAt: string;
  placements: Placement[];
};

const rankColors = {
  1: "from-yellow-400 via-yellow-500 to-yellow-600",
  2: "from-gray-300 via-gray-400 to-gray-500",
  3: "from-amber-600 via-amber-700 to-amber-800"
};

function playTone(frequency: number, duration: number, volume: number = 0.3) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {}
}

const TRANSITION_DURATION = {
  OVERLAY_FADE: 500,
  EVENT_NAME_DISPLAY: 5500,
  TRANSITION_CLEAR: 2800
};

export default function Display() {
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [lastEvent, setLastEvent] = useState<ResultItem | null>(null);
  const [recentResults, setRecentResults] = useState<ResultItem[]>([]);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [newEventName, setNewEventName] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<ResultItem | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [finished, setFinished] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const transitionSoundRef = useRef<HTMLAudioElement | null>(null);
  const updateSoundRef = useRef<HTMLAudioElement | null>(null);
  const eventScrollSoundRef = useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef = useRef<HTMLAudioElement | null>(null);
  const isTransitioningRef = useRef(false);

  async function refreshBoard() {
    const r = await fetch("/api/leaderboard");
    const j = await r.json();
    setBoard(j.data || []);
  }

  async function refreshResults(skipLastEventUpdate = false) {
    const r = await fetch("/api/results");
    const j = await r.json();
    const data = (j.data || []) as ResultItem[];
    setRecentResults(data);
    setLastEvent((current) => {
      if (!data?.length) return null;
      if (current && data.some((r: ResultItem) => r.id === current.id)) return current;
      if (skipLastEventUpdate && isTransitioningRef.current) return current;
      return data[0];
    });
  }

  useEffect(() => {
    const img = new Image();
    img.src = "/college-logo.png";
    if (img.complete) setLogoLoaded(true);
    else { img.onload = () => setLogoLoaded(true); img.onerror = () => setLogoLoaded(false); }
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      if (transitionSoundRef.current) {
        transitionSoundRef.current.play().catch(() => {});
        transitionSoundRef.current.pause();
        transitionSoundRef.current.currentTime = 0;
      }
    };
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    refreshBoard();
    refreshResults(false);
    fetch("/api/finalize")
      .then(r => r.json())
      .then(data => {
        setIsFinalized(data.finalized || false);
        if (data.finalized) {
          setCurrentEventIndex(0);
          setShowWinner(false);
          setFinished(false);
        }
      });

    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL ?? "/api/stream";
    const s = new EventSource(streamUrl);
    s.onopen = () => console.log("SSE connection opened");
    s.onerror = (err) => console.error("SSE connection error:", err);
    s.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "result") {
          const payload: ResultItem = msg.payload;
          if (isTransitioningRef.current) return;
          isTransitioningRef.current = true;
          setTransitioning(true);
          setNewEventName(payload.eventName);
          setPendingEvent(payload);

          const playTransitionSound = () => {
            if (transitionSoundRef.current) {
              try {
                transitionSoundRef.current.pause();
                transitionSoundRef.current.currentTime = 0;
                transitionSoundRef.current.play().catch(() => playTone(200, 0.3, 0.2));
              } catch { playTone(200, 0.3, 0.2); }
            } else playTone(200, 0.3, 0.2);
          };
          setTimeout(playTransitionSound, 50);

          setTimeout(() => {
            setTransitioning(false);
            setNewEventName(null);
            setPendingEvent(null);
            setTimeout(() => { isTransitioningRef.current = false; }, TRANSITION_DURATION.OVERLAY_FADE + 100);
            setTimeout(() => {
              setLastEvent((currentLastEvent) => {
                const oldEvent = currentLastEvent;
                setRecentResults((prev) => {
                  const filtered = prev.filter((r) => r.id !== payload.id);
                  const newList = oldEvent ? [oldEvent, ...filtered] : filtered;
                  return newList.slice(0, 10);
                });
                return payload;
              });
              if (updateSoundRef.current) {
                try {
                  updateSoundRef.current.pause();
                  updateSoundRef.current.currentTime = 0;
                  updateSoundRef.current.play().catch(() => playTone(400, 0.4, 0.25));
                } catch { playTone(400, 0.4, 0.25); }
              } else playTone(400, 0.4, 0.25);
            }, 100);
          }, TRANSITION_DURATION.EVENT_NAME_DISPLAY);
          setTimeout(() => refreshBoard(), TRANSITION_DURATION.EVENT_NAME_DISPLAY + TRANSITION_DURATION.OVERLAY_FADE + 500);
        } else if (msg.type === "result_deleted") {
          const { id: deletedId } = msg.payload;
          setRecentResults((prev) => prev.filter((r) => r.id !== deletedId));
          setLastEvent((current) => (current?.id === deletedId ? null : current));
          refreshResults(false);
          refreshBoard();
        } else if (msg.type === "finalize") {
          const { finalized } = msg.payload;
          setIsFinalized(finalized);
          if (finalized) {
            setCurrentEventIndex(0);
            setShowWinner(false);
            setFinished(false);
            refreshResults(false);
            refreshBoard();
          }
        }
      } catch {}
    };
    streamRef.current = s;
    return () => s.close();
  }, []);

  useEffect(() => {
    if (isFinalized && finished && !showWinner) setShowWinner(true);
  }, [isFinalized, finished, showWinner]);

  useEffect(() => {
    if (!isFinalized || recentResults.length === 0 || showWinner) {
      setFinished(false);
      return;
    }
    const eventDuration = 4000;
    const interval = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev < recentResults.length - 1) {
          if (eventScrollSoundRef.current) {
            eventScrollSoundRef.current.pause();
            eventScrollSoundRef.current.currentTime = 0;
            eventScrollSoundRef.current.play().catch(() => playTone(300, 0.2, 0.15));
          } else playTone(300, 0.2, 0.15);
          return prev + 1;
        }
        clearInterval(interval);
        setFinished(true);
        return prev;
      });
    }, eventDuration);
    return () => clearInterval(interval);
  }, [isFinalized, recentResults.length, showWinner]);

  useEffect(() => {
    if (showWinner && isFinalized) {
      setTimeout(() => {
        if (winnerSoundRef.current) {
          winnerSoundRef.current.pause();
          winnerSoundRef.current.currentTime = 0;
          winnerSoundRef.current.play().catch(() => {
            playTone(523, 0.3, 0.2);
            setTimeout(() => playTone(659, 0.3, 0.2), 150);
            setTimeout(() => playTone(784, 0.5, 0.25), 300);
          });
        } else {
          playTone(523, 0.3, 0.2);
          setTimeout(() => playTone(659, 0.3, 0.2), 150);
          setTimeout(() => playTone(784, 0.5, 0.25), 300);
        }
      }, 200);
    }
  }, [showWinner, isFinalized]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshBoard();
      refreshResults(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const winningHouseBg = (displayName: string) => {
    const name = (displayName || "").toLowerCase();
    if (name === "red") return "rgb(229, 62, 53)";
    if (name === "green") return "rgb(79, 187, 85)";
    if (name === "blue") return "rgb(0, 160, 227)";
    return "rgb(139, 69, 188)";
  };

  /* KALA KRITI / Arts Fest poster colors for house boxes */
  const houseColorClass = (displayName: string) => {
    const name = (displayName || "").toLowerCase();
    if (name === "red") return "bg-[rgb(229,62,53)] text-white border-2 border-[rgb(200,50,45)] shadow-lg arts-brush-box";
    if (name === "green") return "bg-[rgb(79,187,85)] text-white border-2 border-[rgb(60,160,70)] shadow-lg arts-brush-box";
    if (name === "blue") return "bg-[rgb(0,160,227)] text-white border-2 border-[rgb(0,130,200)] shadow-lg arts-brush-box";
    return "bg-neutral-500/90 text-white border-2 border-neutral-400 arts-brush-box";
  };

  const renderPodium = (result: ResultItem, compact = false) => {
    const sorted = result.placements.slice().sort((a, b) => a.rank - b.rank);
    const second = sorted.find(p => p.rank === 2);
    const first = sorted.find(p => p.rank === 1);
    const third = sorted.find(p => p.rank === 3);
    const order = [second, first, third].filter(Boolean);
    const heights = { 1: "h-56", 2: "h-44", 3: "h-32" };
    const textSizes = compact
      ? { 1: { badge: "text-lg", name: "text-base", inst: "text-xs", pts: "text-sm" }, 2: { badge: "text-base", name: "text-sm", inst: "text-xs", pts: "text-xs" }, 3: { badge: "text-sm", name: "text-xs", inst: "text-xs", pts: "text-xs" } }
      : { 1: { badge: "text-2xl", name: "text-xl", inst: "text-sm", pts: "text-lg" }, 2: { badge: "text-xl", name: "text-lg", inst: "text-xs", pts: "text-base" }, 3: { badge: "text-lg", name: "text-base", inst: "text-xs", pts: "text-sm" } };
    const badgeSizes = { 1: "w-12 h-12", 2: "w-10 h-10", 3: "w-8 h-8" };
    return (
      <div className={`flex items-end justify-center gap-2 ${compact ? "h-48" : "h-64"}`}>
        {order.map((p) => {
          if (!p) return null;
          const sizes = textSizes[p.rank as keyof typeof textSizes];
          const badgeSize = badgeSizes[p.rank as keyof typeof badgeSizes];
          return (
            <motion.div
              key={p.rank}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: p.rank * 0.1 }}
              className={`flex-1 min-w-0 ${heights[p.rank as keyof typeof heights]} flex flex-col justify-end`}
            >
              <div className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-t-2xl p-4 shadow-2xl h-full flex flex-col justify-center gap-2 overflow-hidden min-w-0 border border-white/20 ${p.rank === 1 ? "shadow-[0_0_25px_rgba(234,179,8,0.4)]" : p.rank === 2 ? "shadow-[0_0_20px_rgba(156,163,175,0.35)]" : "shadow-[0_0_20px_rgba(180,83,9,0.4)]"}`}>
                <div className={`inline-flex items-center justify-center ${badgeSize} rounded-full bg-white/20 mb-2 flex-shrink-0`}>
                  <span className={`${sizes.badge} font-black text-white`}>{p.rank}</span>
                </div>
                <div className={`${sizes.name} font-black text-white truncate px-2 min-h-[1.5em]`} title={p.studentName}>{p.studentName}</div>
                <div className={`${sizes.inst} text-white/90 font-semibold truncate px-2`} title={p.institutionName}>{p.institutionName}</div>
                <div className={`${sizes.pts} text-white font-bold flex-shrink-0`}>{p.points} pts</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dark gradient background + soft blur to emphasize results */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_20%,rgba(139,69,188,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_80%,rgba(0,160,227,0.12),transparent_50%)]" />
        <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" aria-hidden />
      </div>

      <audio ref={transitionSoundRef} preload="auto" src="/sounds/transition.mp3" crossOrigin="anonymous" />
      <audio ref={updateSoundRef} preload="auto" src="/sounds/update.mp3" crossOrigin="anonymous" />
      <audio ref={eventScrollSoundRef} preload="auto" src="/sounds/event-scroll.mp3" crossOrigin="anonymous" />
      <audio ref={winnerSoundRef} preload="auto" src="/sounds/winner.mp3" crossOrigin="anonymous" />

      <AnimatePresence>
        {transitioning && newEventName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TRANSITION_DURATION.OVERLAY_FADE / 1000 }}
            className="fixed inset-0 bg-[rgb(139,69,188)]/95 backdrop-blur-md z-[100] flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center"
            >
              <motion.div className="text-8xl font-black text-white mb-4">{newEventName}</motion.div>
              <motion.div className="text-2xl text-[rgb(240,107,43)] font-bold uppercase tracking-widest">NEW RESULT</motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isFinalized ? (
        <div className="relative z-10 min-h-screen p-8">
          <div className="text-center mb-8 relative z-20">
            <h1 className="text-5xl font-black text-white drop-shadow-lg">FINAL RESULTS</h1>
          </div>
          {!showWinner ? (
            <div className="max-w-4xl mx-auto">
              {recentResults.length > 0 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentEventIndex}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.8 }}
                    className="arts-container-glass rounded-2xl p-8 text-center"
                  >
                    <h2 className="text-3xl font-black text-white mb-4">
                      {recentResults[currentEventIndex]?.eventName || "Event"}
                    </h2>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      {recentResults[currentEventIndex]?.placements
                        .slice()
                        .sort((a: Placement, b: Placement) => a.rank - b.rank)
                        .map((p: Placement) => (
                          <motion.div
                            key={p.rank}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + p.rank * 0.1 }}
                            className={`bg-gradient-to-br ${
                              p.rank === 1 ? "from-amber-400 to-[rgb(240,107,43)]" :
                              p.rank === 2 ? "from-gray-300 to-gray-500" :
                              "from-amber-600 to-amber-800"
                            } rounded-xl p-4 text-white min-w-0 overflow-hidden arts-brush-box border border-white/30`}
                          >
                            <div className="text-3xl mb-2">{p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}</div>
                            <div className="text-lg font-bold mb-1 truncate text-neutral-800" title={p.studentName}>{p.studentName}</div>
                            <div className="text-sm text-neutral-700 truncate" title={p.institutionName}>{p.institutionName}</div>
                            <div className="text-xl font-black mt-2 text-neutral-900">{p.points} pts</div>
                          </motion.div>
                        ))}
                    </div>
                    <div className="mt-6 text-[rgb(240,107,43)] font-semibold text-sm">
                      Event {currentEventIndex + 1} of {recentResults.length}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          ) : (
            <>
              {/* Winner explosion: background bursts into winning house color */}
              <motion.div
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 5 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: "200vmax",
                    height: "200vmax",
                    marginLeft: "-100vmax",
                    marginTop: "-100vmax",
                    background: winningHouseBg(board[0]?.displayName ?? ""),
                    boxShadow: `0 0 120px 60px ${winningHouseBg(board[0]?.displayName ?? "")}`,
                  }}
                  initial={{ scale: 0, opacity: 0.95 }}
                  animate={{ scale: 1, opacity: 0.98 }}
                  transition={{
                    type: "tween",
                    duration: 1.4,
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                />
              </motion.div>
              <div className="relative z-10 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center -mt-8">
                <div className="text-center max-w-2xl mx-auto arts-container-glass rounded-2xl p-10">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-white mb-4">{board[0]?.displayName || "Winner"}</h2>
                  <div className="text-3xl font-black text-[rgb(240,107,43)]">{board[0]?.totalPoints ?? 0} Points</div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative z-10 min-h-screen">
          <div className="flex items-center justify-center p-6">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 shadow-xl flex items-center justify-center overflow-hidden flex-shrink-0 relative">
              <img src="/college-logo.png" alt="Logo" className="w-full h-full object-cover" onLoad={() => setLogoLoaded(true)} onError={() => setLogoLoaded(false)} suppressHydrationWarning />
              {!logoLoaded && <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs text-center px-2 font-medium" suppressHydrationWarning>College<br/>Logo</div>}
            </div>
            <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-black text-white drop-shadow-lg tracking-tight ml-4">🏆 LIVE RESULTS</motion.h1>
          </div>

          <div className="max-w-5xl mx-auto px-4 pb-8">
            {board.length > 0 && (
              <div className="flex justify-center gap-6 mb-6 flex-wrap">
                {board.map((row, i) => (
                  <motion.div
                    key={row.institutionId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`px-6 py-3 font-bold shadow-lg ${houseColorClass(row.displayName)} flex items-center gap-2`}
                  >
                    {i === 0 && <span className="text-2xl" title="Leader">👑</span>}
                    <span className="text-lg">{row.displayName}</span>
                    <span className="text-2xl">{row.totalPoints}</span>
                    <span className="text-white/95 text-base">pts</span>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="p-4 overflow-y-auto">
              <AnimatePresence mode="wait">
                {lastEvent && (
                  <motion.div
                    key={lastEvent.id}
                    initial={{ opacity: 0, scale: 0.3, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 100 }}
                    transition={{ type: "tween", ease: [0.34, 1.56, 0.64, 1], duration: transitioning ? 0.8 : 1.2 }}
                    className="mb-6"
                  >
                    <motion.div className="arts-container-glass rounded-2xl p-6 relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="text-[rgb(240,107,43)] font-bold text-sm uppercase tracking-widest mb-2">LATEST EVENT</div>
                        <motion.div className="text-5xl font-black text-white mb-8">{lastEvent.eventName}</motion.div>
                        {renderPodium(lastEvent, false)}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3 max-h-[calc(100vh-520px)] overflow-y-auto pr-2">
                <div className="text-xl font-bold text-white drop-shadow-md mb-3">Recent Events</div>
                {recentResults.length === 0 ? (
                  <div className="arts-container-glass-purple rounded-xl p-6 text-white/80 text-center text-sm">Waiting for event results...</div>
                ) : (
                  recentResults.slice(1).map((result, idx) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="arts-container-glass rounded-xl p-4 hover:shadow-[0_0_40px_rgba(240,107,43,0.3)] transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-lg font-bold text-white">{result.eventName}</div>
                        <div className="text-white/60 text-xs">{new Date(result.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {result.placements
                          .slice()
                          .sort((a, b) => a.rank - b.rank)
                          .map((p) => (
                            <motion.div
                              key={p.rank}
                              initial={{ opacity: 0, y: 30, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: idx * 0.1, type: "spring", stiffness: 200, damping: 15 }}
                              className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-lg p-3 text-white shadow-lg min-w-0 overflow-hidden`}
                            >
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 mb-1 flex-shrink-0">
                                <span className="text-sm font-black">{p.rank}</span>
                              </div>
                              <div className="font-bold text-sm truncate" title={p.studentName}>{p.studentName}</div>
                              <div className="text-xs opacity-90 truncate" title={p.institutionName}>{p.institutionName}</div>
                              <div className="text-sm font-bold mt-1">{p.points} pts</div>
                            </motion.div>
                          ))}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
