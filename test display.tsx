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

// Helper function to generate tones if audio files don't exist
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
  } catch (e) {
    // Ignore if Web Audio API not supported
  }
}

// Animation duration constants (in milliseconds)
const TRANSITION_DURATION = {
  OVERLAY_FADE: 500,      // Fade in/out of the dark overlay
  EVENT_NAME_DISPLAY: 5500, // How long the event name is shown
  TRANSITION_CLEAR: 2800    // Delay before clearing transition state
};

export default function Display() {
  // High School state
  const [boardHS, setBoardHS] = useState<BoardRow[]>([]);
  const [lastEventHS, setLastEventHS] = useState<ResultItem | null>(null);
  const [recentResultsHS, setRecentResultsHS] = useState<ResultItem[]>([]);
  
  // Higher Secondary state
  const [boardHSS, setBoardHSS] = useState<BoardRow[]>([]);
  const [lastEventHSS, setLastEventHSS] = useState<ResultItem | null>(null);
  const [recentResultsHSS, setRecentResultsHSS] = useState<ResultItem[]>([]);
  
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [newEventName, setNewEventName] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<ResultItem | null>(null);
  const [pendingEventLevel, setPendingEventLevel] = useState<"high_school" | "higher_secondary" | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [currentEventIndexHS, setCurrentEventIndexHS] = useState(0);
  const [currentEventIndexHSS, setCurrentEventIndexHSS] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [hsFinished, setHsFinished] = useState(false);
  const [hssFinished, setHssFinished] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const transitionSoundRef = useRef<HTMLAudioElement | null>(null);
  const updateSoundRef = useRef<HTMLAudioElement | null>(null);
  const eventScrollSoundRef = useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef = useRef<HTMLAudioElement | null>(null);
  const isTransitioningRef = useRef(false);

  async function refreshBoard(level: "high_school" | "higher_secondary") {
    const r = await fetch(`/api/leaderboard?level=${level}`);
    const j = await r.json();
    if (level === "high_school") {
      setBoardHS(j.data);
    } else {
      setBoardHSS(j.data);
    }
  }

  async function refreshResults(level: "high_school" | "higher_secondary", skipLastEventUpdate = false) {
    const r = await fetch(`/api/results?level=${level}`);
    const j = await r.json();
    const data = j.data as ResultItem[];
    
    if (level === "high_school") {
      setRecentResultsHS(data);
      setLastEventHS((current) => {
        if (!data?.length) {
        return null;
      }
        if (current && data.some((r: ResultItem) => r.id === current.id)) {
        return current;
      }
      if (skipLastEventUpdate && isTransitioningRef.current) {
          return current;
        }
        return data[0];
      });
    } else {
      setRecentResultsHSS(data);
      setLastEventHSS((current) => {
        if (!data?.length) {
          return null;
        }
        if (current && data.some((r: ResultItem) => r.id === current.id)) {
          return current;
        }
        if (skipLastEventUpdate && isTransitioningRef.current) {
          return current;
        }
        return data[0];
      });
    }
  }

  useEffect(() => {
    // Check if image is already loaded (client-side only)
    const img = new Image();
    img.src = "/college-logo.png";
    if (img.complete) {
      setLogoLoaded(true);
    } else {
      img.onload = () => setLogoLoaded(true);
      img.onerror = () => setLogoLoaded(false);
    }
  }, []);

  // Unlock audio on user interaction (required for autoplay)
  useEffect(() => {
    const unlockAudio = () => {
      // Try to play and pause to unlock audio context
      if (transitionSoundRef.current) {
        transitionSoundRef.current.play().catch(() => {});
        transitionSoundRef.current.pause();
        transitionSoundRef.current.currentTime = 0;
      }
    };
    
    // Unlock on any user interaction
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
    refreshBoard("high_school");
    refreshBoard("higher_secondary");
    refreshResults("high_school", false);
    refreshResults("higher_secondary", false);
    
    // Check finalize status on load
    fetch("/api/finalize")
      .then(r => r.json())
      .then(data => {
        setIsFinalized(data.finalized || false);
        if (data.finalized) {
          setCurrentEventIndexHS(0);
          setCurrentEventIndexHSS(0);
          setShowWinner(false);
          setHsFinished(false);
          setHssFinished(false);
        }
      });

    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL ?? "/api/stream";
    const s = new EventSource(streamUrl);
    
    s.onopen = () => {
      console.log("SSE connection opened");
    };
    
    s.onerror = (err) => {
      console.error("SSE connection error:", err);
    };
    
    s.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        console.log("SSE message received:", msg.type);
        if (msg.type === "result") {
          const payload: ResultItem = msg.payload;
          const eventLevel = payload.eventLevel || (msg.payload as any).level || null;
          
          console.log("Result received:", { eventName: payload.eventName, eventLevel, payload });
          
          // Prevent duplicate triggers if already transitioning
          if (isTransitioningRef.current) {
            console.log("Skipping duplicate result message - already transitioning");
            return;
          }
          
          // Start transition sequence
          isTransitioningRef.current = true;
          setTransitioning(true);
          setNewEventName(payload.eventName);
          setPendingEvent(payload);
          setPendingEventLevel(eventLevel as "high_school" | "higher_secondary" | null);
          
          console.log("Starting transition, playing sound...");
          
          // Play transition sound (screen darken) - try multiple approaches
          const playTransitionSound = () => {
          if (transitionSoundRef.current) {
              try {
            transitionSoundRef.current.pause();
            transitionSoundRef.current.currentTime = 0;
                const playPromise = transitionSoundRef.current.play();
                if (playPromise !== undefined) {
                  playPromise
                    .then(() => {
                      console.log("Transition sound played successfully");
                    })
                    .catch((err) => {
                      console.warn("Failed to play transition sound:", err);
              // Fallback: generate sound if file doesn't exist
              playTone(200, 0.3, 0.2);
            });
                }
              } catch (err) {
                console.warn("Error playing transition sound:", err);
                playTone(200, 0.3, 0.2);
              }
          } else {
              console.log("Transition sound ref not available, using fallback");
            playTone(200, 0.3, 0.2);
          }
          };
          
          // Small delay to ensure state is set before playing sound
          setTimeout(playTransitionSound, 50);
          
          // Step 1: Show event name
          setTimeout(() => {
            // Step 2: Start fading out overlay first, then show new result
            // This ensures the overlay is fading out as the new result appears
            setTransitioning(false);
            setNewEventName(null);
            setPendingEvent(null);
            setPendingEventLevel(null);
            // Clear transition flag after overlay fade completes
            setTimeout(() => {
              isTransitioningRef.current = false;
            }, TRANSITION_DURATION.OVERLAY_FADE + 100);
            
            // Step 3: Show new result after a brief delay (overlay starts fading)
            // The overlay fade (500ms) and result animation (1.2s) will overlap nicely
            setTimeout(() => {
              if (eventLevel === "high_school") {
                setLastEventHS((currentLastEvent) => {
                const oldEvent = currentLastEvent;
                  setRecentResultsHS((prev) => {
                  const filtered = prev.filter((r) => r.id !== payload.id);
                  const newList = oldEvent ? [oldEvent, ...filtered] : filtered;
                  return newList.slice(0, 10);
                });
                return payload;
              });
              } else if (eventLevel === "higher_secondary") {
                setLastEventHSS((currentLastEvent) => {
                  const oldEvent = currentLastEvent;
                  setRecentResultsHSS((prev) => {
                    const filtered = prev.filter((r) => r.id !== payload.id);
                    const newList = oldEvent ? [oldEvent, ...filtered] : filtered;
                    return newList.slice(0, 10);
                  });
                  return payload;
                });
              }
              
              // Play update sound (latest event appears)
              console.log("Playing update sound...");
              const playUpdateSound = () => {
              if (updateSoundRef.current) {
                  try {
                updateSoundRef.current.pause();
                updateSoundRef.current.currentTime = 0;
                    const playPromise = updateSoundRef.current.play();
                    if (playPromise !== undefined) {
                      playPromise
                        .then(() => {
                          console.log("Update sound played successfully");
                        })
                        .catch((err) => {
                          console.warn("Failed to play update sound:", err);
                  playTone(400, 0.4, 0.25);
                });
                    }
                  } catch (err) {
                    console.warn("Error playing update sound:", err);
                    playTone(400, 0.4, 0.25);
                  }
              } else {
                  console.log("Update sound ref not available, using fallback");
                playTone(400, 0.4, 0.25);
              }
              };
              setTimeout(playUpdateSound, 50);
            }, 100); // Small delay so overlay fade starts first
          }, TRANSITION_DURATION.EVENT_NAME_DISPLAY);
          
          if (eventLevel === "high_school") {
            setTimeout(() => refreshBoard("high_school"), TRANSITION_DURATION.EVENT_NAME_DISPLAY + TRANSITION_DURATION.OVERLAY_FADE + 500);
          } else if (eventLevel === "higher_secondary") {
            setTimeout(() => refreshBoard("higher_secondary"), TRANSITION_DURATION.EVENT_NAME_DISPLAY + TRANSITION_DURATION.OVERLAY_FADE + 500);
          }
        } else if (msg.type === "result_deleted") {
          // Handle result deletion via SSE
          const { id: deletedId } = msg.payload;
          
          // Remove from recent results for both levels
          setRecentResultsHS((prev) => prev.filter((r) => r.id !== deletedId));
          setRecentResultsHSS((prev) => prev.filter((r) => r.id !== deletedId));
          
          // Update lastEvent if it was the deleted one
          setLastEventHS((current) => {
            if (current?.id === deletedId) {
              return null;
            }
            return current;
          });
          setLastEventHSS((current) => {
            if (current?.id === deletedId) {
              return null;
            }
            return current;
          });
          
          // Refresh to get updated data (allow lastEvent update for deletions)
          refreshResults("high_school", false);
          refreshResults("higher_secondary", false);
          refreshBoard("high_school");
          refreshBoard("higher_secondary");
        } else if (msg.type === "finalize") {
          // Handle finalize/undo finalize
          const { finalized } = msg.payload;
          setIsFinalized(finalized);
          if (finalized) {
            setCurrentEventIndexHS(0);
            setCurrentEventIndexHSS(0);
            setShowWinner(false);
            setHsFinished(false);
            setHssFinished(false);
            // Refresh to get all results for the summary
            refreshResults("high_school", false);
            refreshResults("higher_secondary", false);
            refreshBoard("high_school");
            refreshBoard("higher_secondary");
          }
        }
      } catch {}
    };
    streamRef.current = s;
    return () => s.close();
  }, []);

  // Check if both sections are finished and show winner
  useEffect(() => {
    if (isFinalized && hsFinished && hssFinished && !showWinner) {
      // Both sections finished, show winner
      setShowWinner(true);
    }
  }, [isFinalized, hsFinished, hssFinished, showWinner]);

  // Auto-scroll through events in finalize mode - High School
  useEffect(() => {
    if (!isFinalized || recentResultsHS.length === 0 || showWinner) {
      setHsFinished(false);
      return;
    }

    const eventDuration = 4000; // 4 seconds per event
    const interval = setInterval(() => {
      setCurrentEventIndexHS((prev) => {
        if (prev < recentResultsHS.length - 1) {
          const nextIndex = prev + 1;
          // Play sound when moving to next event
          if (eventScrollSoundRef.current) {
            eventScrollSoundRef.current.pause();
            eventScrollSoundRef.current.currentTime = 0;
            eventScrollSoundRef.current.play().catch(() => {
              playTone(300, 0.2, 0.15);
            });
          } else {
            playTone(300, 0.2, 0.15);
          }
          return nextIndex;
        } else {
          // Reached the end of High School events
          clearInterval(interval);
          setHsFinished(true);
          return prev;
        }
      });
    }, eventDuration);

    return () => clearInterval(interval);
  }, [isFinalized, recentResultsHS.length, showWinner]);

  // Auto-scroll through events in finalize mode - Higher Secondary
  useEffect(() => {
    if (!isFinalized || recentResultsHSS.length === 0 || showWinner) {
      setHssFinished(false);
      return;
    }

    const eventDuration = 4000; // 4 seconds per event
    const interval = setInterval(() => {
      setCurrentEventIndexHSS((prev) => {
        if (prev < recentResultsHSS.length - 1) {
          const nextIndex = prev + 1;
          // Play sound when moving to next event
          if (eventScrollSoundRef.current) {
            eventScrollSoundRef.current.pause();
            eventScrollSoundRef.current.currentTime = 0;
            eventScrollSoundRef.current.play().catch(() => {
              playTone(300, 0.2, 0.15);
            });
          } else {
            playTone(300, 0.2, 0.15);
          }
          return nextIndex;
        } else {
          // Reached the end of Higher Secondary events
          clearInterval(interval);
          setHssFinished(true);
          return prev;
        }
      });
    }, eventDuration);

    return () => clearInterval(interval);
  }, [isFinalized, recentResultsHSS.length, showWinner]);

  // Play winner sound when winner is revealed
  useEffect(() => {
    if (showWinner && isFinalized) {
      // Small delay to sync with animation
      setTimeout(() => {
        if (winnerSoundRef.current) {
          winnerSoundRef.current.pause();
          winnerSoundRef.current.currentTime = 0;
          winnerSoundRef.current.play().catch(() => {
            // Fallback: generate celebratory sound if file doesn't exist
            playTone(523, 0.3, 0.2); // C note
            setTimeout(() => playTone(659, 0.3, 0.2), 150); // E note
            setTimeout(() => playTone(784, 0.5, 0.25), 300); // G note
          });
        } else {
          playTone(523, 0.3, 0.2); // C note
          setTimeout(() => playTone(659, 0.3, 0.2), 150); // E note
          setTimeout(() => playTone(784, 0.5, 0.25), 300); // G note
        }
      }, 200);
    }
  }, [showWinner, isFinalized]);

  // Periodic refresh to catch deletions made directly in MongoDB
  useEffect(() => {
    const interval = setInterval(() => {
      refreshBoard("high_school");
      refreshBoard("higher_secondary");
      // Skip lastEvent update during periodic refresh to avoid interfering with animations
      refreshResults("high_school", true);
      refreshResults("higher_secondary", true);
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient with darker blue, cyan, and purple */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-800 bg-[length:200%_200%] animate-gradient-xy">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.4),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(6,182,212,0.5),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.3),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_70%,rgba(14,165,233,0.4),transparent_50%)]" />
      </div>

      {/* Audio elements for sound effects */}
      <audio
        ref={transitionSoundRef}
        preload="auto"
        src="/sounds/transition.mp3"
        crossOrigin="anonymous"
      />
      <audio
        ref={updateSoundRef}
        preload="auto"
        src="/sounds/update.mp3"
        crossOrigin="anonymous"
      />
      <audio
        ref={eventScrollSoundRef}
        preload="auto"
        src="/sounds/event-scroll.mp3"
        crossOrigin="anonymous"
      />
      <audio
        ref={winnerSoundRef}
        preload="auto"
        src="/sounds/winner.mp3"
        crossOrigin="anonymous"
      />

      {/* Transition overlay - darken screen and show event name */}
      <AnimatePresence>
        {transitioning && newEventName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TRANSITION_DURATION.OVERLAY_FADE / 1000 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center"
            style={{ pointerEvents: "auto" }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 20,
                duration: 0.8
              }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [0.8, 1.1, 1],
                  opacity: [0, 1, 1],
                  textShadow: [
                    "0 0 20px rgba(255, 255, 255, 0.5)",
                    "0 0 50px rgba(59, 130, 246, 1), 0 0 80px rgba(6, 182, 212, 0.8), 0 0 120px rgba(139, 92, 246, 0.6)",
                    "0 0 30px rgba(255, 255, 255, 0.7), 0 0 60px rgba(59, 130, 246, 0.8)",
                  ]
                }}
                transition={{
                  scale: {
                    times: [0, 0.5, 1],
                    duration: 1.2
                  },
                  opacity: {
                    times: [0, 0.3, 1],
                    duration: 1.2
                  },
                  textShadow: {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
                className="text-8xl font-black text-white mb-4"
              >
                {newEventName}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="text-2xl text-white/80 uppercase tracking-widest"
              >
                NEW RESULT
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      {isFinalized ? (
        /* Finalize View - Two Sections */
        <div className="relative z-10 min-h-screen p-8">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black text-white drop-shadow-2xl">FINAL RESULTS</h1>
          </div>
          <div className="flex gap-8">
            {/* High School Section */}
            <div className="flex-1">
              <h2 className="text-3xl font-black text-white mb-6 text-center">HIGH SCHOOL</h2>
            {!showWinner ? (
                <div className="space-y-4">
                  {recentResultsHS.length > 0 && (
                <AnimatePresence mode="wait">
                  <motion.div
                        key={currentEventIndexHS}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        transition={{ duration: 0.8 }}
                        className="bg-white/20 backdrop-blur-xl rounded-2xl p-8 border-2 border-white/30 shadow-2xl text-center"
                      >
                        <h2 className="text-3xl font-black text-white mb-4">
                          {recentResultsHS[currentEventIndexHS]?.eventName || "Event"}
                  </h2>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          {recentResultsHS[currentEventIndexHS]?.placements
                      .slice()
                            .sort((a: Placement, b: Placement) => a.rank - b.rank)
                            .map((p: Placement) => (
                        <motion.div
                          key={p.rank}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + p.rank * 0.1 }}
                          className={`bg-gradient-to-br ${
                                  p.rank === 1 ? "from-yellow-400 to-yellow-600" :
                                  p.rank === 2 ? "from-gray-300 to-gray-500" :
                                  "from-amber-600 to-amber-800"
                                } rounded-xl p-4 text-white`}
                              >
                                <div className="text-3xl mb-2">
                            {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                          </div>
                                <div className="text-lg font-bold mb-1">{p.studentName}</div>
                          <div className="text-sm opacity-90">{p.institutionName}</div>
                                <div className="text-xl font-black mt-2">{p.points} pts</div>
                        </motion.div>
                      ))}
                  </div>
                        <div className="mt-6 text-white/60 text-sm">
                          Event {currentEventIndexHS + 1} of {recentResultsHS.length}
                  </div>
                  </motion.div>
                </AnimatePresence>
                  )}
              </div>
            ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-white mb-4">
                    {boardHS[0]?.displayName || "Winner"}
                  </h2>
                  <div className="text-3xl font-black text-white">
                    {boardHS[0]?.totalPoints || 0} Points
                  </div>
                </div>
              )}
            </div>
            {/* Higher Secondary Section */}
            <div className="flex-1">
              <h2 className="text-3xl font-black text-white mb-6 text-center">HIGHER SECONDARY</h2>
              {!showWinner ? (
                <div className="space-y-4">
                  {recentResultsHSS.length > 0 && (
                    <AnimatePresence mode="wait">
              <motion.div
                        key={currentEventIndexHSS}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        transition={{ duration: 0.8 }}
                        className="bg-white/20 backdrop-blur-xl rounded-2xl p-8 border-2 border-white/30 shadow-2xl text-center"
                      >
                        <h2 className="text-3xl font-black text-white mb-4">
                          {recentResultsHSS[currentEventIndexHSS]?.eventName || "Event"}
                        </h2>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          {recentResultsHSS[currentEventIndexHSS]?.placements
                            .slice()
                            .sort((a: Placement, b: Placement) => a.rank - b.rank)
                            .map((p: Placement) => (
                <motion.div
                                key={p.rank}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + p.rank * 0.1 }}
                                className={`bg-gradient-to-br ${
                                  p.rank === 1 ? "from-yellow-400 to-yellow-600" :
                                  p.rank === 2 ? "from-gray-300 to-gray-500" :
                                  "from-amber-600 to-amber-800"
                                } rounded-xl p-4 text-white`}
                              >
                                <div className="text-3xl mb-2">
                                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                                </div>
                                <div className="text-lg font-bold mb-1">{p.studentName}</div>
                                <div className="text-sm opacity-90">{p.institutionName}</div>
                                <div className="text-xl font-black mt-2">{p.points} pts</div>
                </motion.div>
                            ))}
                        </div>
                        <div className="mt-6 text-white/60 text-sm">
                          Event {currentEventIndexHSS + 1} of {recentResultsHSS.length}
                        </div>
              </motion.div>
                    </AnimatePresence>
            )}
          </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-white mb-4">
                    {boardHSS[0]?.displayName || "Winner"}
                  </h2>
                  <div className="text-3xl font-black text-white">
                    {boardHSS[0]?.totalPoints || 0} Points
                </div>
                </div>
              )}
              </div>
            </div>
        </div>
      ) : (
        /* Normal View - Two Sections Side by Side */
        <div className="relative z-10 min-h-screen">
          {/* Header with logo and title */}
          <div className="flex items-center justify-center p-6 relative">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/20 shadow-xl flex items-center justify-center overflow-hidden hover:border-white/40 transition-colors flex-shrink-0 relative">
              <img 
                src="/college-logo.png" 
                alt="College Logo" 
                className="w-full h-full object-cover"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoLoaded(false)}
                suppressHydrationWarning
              />
              {!logoLoaded && (
                <div 
                  className="absolute inset-0 flex items-center justify-center text-white/40 text-xs text-center px-2 font-medium pointer-events-none"
                  suppressHydrationWarning
                >
                  College<br/>Logo
                </div>
              )}
            </div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-black text-white drop-shadow-2xl tracking-tight ml-4"
              >
                🏆 LIVE RESULTS
              </motion.h1>
          </div>

          {/* Two Columns: High School and Higher Secondary */}
          <div className="flex gap-4 px-4 pb-4">
            {/* High School Section */}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-120px)]">
              <div className="text-center mb-4">
                <h2 className="text-3xl font-black text-white drop-shadow-lg">HIGH SCHOOL</h2>
              </div>
              <div className="flex-1">
                {/* Main results area */}
                <div className="p-4 overflow-y-auto">
          {/* Latest result - podium layout */}
          <AnimatePresence mode="wait">
                    {lastEventHS && (
          <motion.div
                        key={lastEventHS.id}
                initial={{ opacity: 0, scale: 0.3, y: 100, rotateX: -90, rotateZ: -15 }}
                animate={{ 
                  opacity: 1, 
                  scale: [0.3, 1.1, 1],
                  y: [100, -10, 0],
                  rotateX: [90, -5, 0],
                  rotateZ: [15, -2, 0],
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.8, 
                  y: 100,
                  rotateX: 15
                }}
                transition={{ 
                  type: "tween",
                  ease: [0.34, 1.56, 0.64, 1],
                          duration: transitioning && pendingEventLevel === "high_school" ? 0.8 : 1.2,
                  scale: {
                    times: [0, 0.6, 1],
                            duration: transitioning && pendingEventLevel === "high_school" ? 0.8 : 1.2
                  },
                  y: {
                    times: [0, 0.7, 1],
                            duration: transitioning && pendingEventLevel === "high_school" ? 0.8 : 1.2
                  }
                }}
                        className="mb-6"
              >
                <motion.div 
                          className="bg-white/20 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl relative overflow-hidden"
                  animate={{
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 50px rgba(59, 130, 246, 0.3)",
                      "0 35px 70px -12px rgba(59, 130, 246, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 80px rgba(6, 182, 212, 0.5)",
                      "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 50px rgba(59, 130, 246, 0.3)",
                    ],
                    borderColor: [
                      "rgba(255, 255, 255, 0.3)",
                      "rgba(59, 130, 246, 0.8)",
                      "rgba(255, 255, 255, 0.3)",
                    ]
                  }}
                  transition={{
                    scale: {
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    },
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    },
                    borderColor: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  }}
                >
                  {/* Animated glow effects */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-400/40 via-cyan-400/50 to-purple-400/40"
                    animate={{
                      x: ["-100%", "200%"],
                      opacity: [0.3, 0.7, 0.3]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-l from-cyan-400/30 via-blue-400/40 to-cyan-400/30"
                    animate={{
                      x: ["200%", "-100%"],
                      opacity: [0.2, 0.6, 0.2]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}
                  />
                  <div className="relative z-10">
                    <motion.div 
                      className="text-white/90 text-sm uppercase tracking-widest mb-2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      LATEST EVENT
                    </motion.div>
                    <motion.div 
                      className="text-5xl font-black text-white mb-8 drop-shadow-lg"
                      initial={{ opacity: 0, scale: 0.5, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        scale: [0.5, 1.1, 1],
                        y: [20, -5, 0],
                        textShadow: [
                          "0 0 15px rgba(255, 255, 255, 0.6), 0 0 25px rgba(59, 130, 246, 0.4)",
                          "0 0 30px rgba(59, 130, 246, 1), 0 0 50px rgba(6, 182, 212, 0.8), 0 0 70px rgba(139, 92, 246, 0.6)",
                          "0 0 15px rgba(255, 255, 255, 0.6), 0 0 25px rgba(59, 130, 246, 0.4)",
                        ]
                      }}
                      transition={{ 
                        delay: 0.4,
                        scale: {
                          times: [0, 0.6, 1],
                          duration: 1
                        },
                        y: {
                          times: [0, 0.7, 1],
                          duration: 1
                        },
                        textShadow: {
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }
                      }}
                    >
                            {lastEventHS.eventName}
                    </motion.div>
                  
                  {/* Podium layout */}
                          <div className="flex items-end justify-center gap-2 h-64">
                    {(() => {
                              const sorted = lastEventHS.placements.slice().sort((a, b) => a.rank - b.rank);
                      const second = sorted.find(p => p.rank === 2);
                      const first = sorted.find(p => p.rank === 1);
                      const third = sorted.find(p => p.rank === 3);
                      const order = [second, first, third].filter(Boolean);
                      
                      return order.map((p) => {
                        if (!p) return null;
                              const heights = { 1: "h-56", 2: "h-44", 3: "h-32" };
                        const delays = { 1: 0.2, 2: 0.1, 3: 0.3 };
                        const textSizes = {
                                1: { badge: "text-2xl", name: "text-xl", inst: "text-sm", pts: "text-lg" },
                                2: { badge: "text-xl", name: "text-lg", inst: "text-xs", pts: "text-base" },
                                3: { badge: "text-lg", name: "text-base", inst: "text-xs", pts: "text-sm" }
                              };
                              const badgeSizes = { 1: "w-12 h-12", 2: "w-10 h-10", 3: "w-8 h-8" };
                        const sizes = textSizes[p.rank as keyof typeof textSizes];
                        const badgeSize = badgeSizes[p.rank as keyof typeof badgeSizes];
                        
                        return (
                          <motion.div
                            key={p.rank}
                            initial={{ opacity: 0, y: 150, scale: 0.2, rotateY: -180, rotateX: 45, z: -100 }}
                            animate={{ 
                              opacity: 1, 
                              y: [150, -20, 0],
                              scale: [0.2, 1.15, 1],
                              rotateY: [180, -10, 0],
                              rotateX: [45, -5, 0],
                              z: [-100, 20, 0]
                            }}
                            transition={{ 
                              delay: delays[p.rank as keyof typeof delays], 
                              type: "tween",
                              ease: [0.34, 1.56, 0.64, 1],
                              duration: 1.5,
                              y: {
                                times: [0, 0.7, 1],
                                duration: 1.5
                              },
                              scale: {
                                times: [0, 0.6, 1],
                                duration: 1.5
                              }
                            }}
                            className={`flex-1 ${heights[p.rank as keyof typeof heights]} flex flex-col justify-end`}
                          >
                            <motion.div 
                              className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-t-2xl p-4 shadow-2xl h-full flex flex-col justify-center gap-2 overflow-hidden relative`}
                              animate={{
                                scale: p.rank === 1 ? [1, 1.08, 1] : p.rank === 2 ? [1, 1.03, 1] : [1, 1.02, 1],
                                y: p.rank === 1 ? [0, -8, 0] : p.rank === 2 ? [0, -4, 0] : [0, -2, 0],
                                rotateZ: p.rank === 1 ? [-2, 2, -2] : 0,
                                boxShadow: p.rank === 1 ? [
                                  "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3), 0 0 30px rgba(234, 179, 8, 0.4)",
                                  "0 35px 60px -12px rgba(234, 179, 8, 0.8), 0 0 0 2px rgba(234, 179, 8, 0.5), 0 0 60px rgba(234, 179, 8, 0.6)",
                                  "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3), 0 0 30px rgba(234, 179, 8, 0.4)",
                                ] : undefined
                              }}
                              transition={{
                                scale: {
                                  duration: 1.8,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                },
                                y: {
                                  duration: 1.8,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                },
                                rotateZ: {
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                },
                                boxShadow: {
                                  duration: 1.8,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }
                              }}
                            >
                              {/* Sparkle effect for 1st place */}
                              {p.rank === 1 && (
                                <>
                                  {[...Array(12)].map((_, i) => (
                                    <motion.div
                                      key={i}
                                      className="absolute w-3 h-3 bg-white rounded-full"
                                      style={{
                                        top: `${15 + (i % 4) * 20}%`,
                                        left: `${10 + Math.floor(i / 4) * 30}%`,
                                      }}
                                      animate={{
                                        opacity: [0, 1, 0.8, 0],
                                        scale: [0, 2, 1.5, 0],
                                        rotate: [0, 180, 360],
                                      }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                        ease: "easeInOut"
                                      }}
                                    />
                                  ))}
                                </>
                              )}
                              <div className="text-center space-y-1 relative z-10">
                                <motion.div 
                                  className={`inline-flex items-center justify-center ${badgeSize} rounded-full bg-white/20 mb-2`}
                                  animate={p.rank === 1 ? {
                                    rotate: [0, 360],
                                    scale: [1, 1.25, 1],
                                    y: [0, -5, 0]
                                  } : p.rank === 2 ? {
                                    scale: [1, 1.1, 1]
                                  } : {
                                    scale: [1, 1.05, 1]
                                  }}
                                  transition={{
                                    rotate: {
                                      duration: 2.5,
                                      repeat: Infinity,
                                      ease: "linear"
                                    },
                                    scale: {
                                      duration: 1.2,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    },
                                    y: {
                                      duration: 1.2,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }
                                  }}
                                >
                                  <span className={`${sizes.badge} font-black text-white`}>{p.rank}</span>
                                </motion.div>
                                <motion.div 
                                  className={`${sizes.name} font-black text-white mb-1 px-2 whitespace-normal break-words`} 
                                  title={p.studentName}
                                  animate={p.rank === 1 ? {
                                    textShadow: [
                                      "0 0 5px rgba(255, 255, 255, 0.5)",
                                      "0 0 15px rgba(234, 179, 8, 0.8), 0 0 25px rgba(234, 179, 8, 0.6)",
                                      "0 0 5px rgba(255, 255, 255, 0.5)",
                                    ]
                                  } : {}}
                                  transition={{
                                    textShadow: {
                                      duration: 2,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }
                                  }}
                                >
                                  {p.studentName}
                                </motion.div>
                                <div className={`${sizes.inst} text-white/90 font-semibold mb-1 px-2 whitespace-normal break-words`} title={p.institutionName}>{p.institutionName}</div>
                                <motion.div 
                                  className={`${sizes.pts} text-white font-bold`}
                                  animate={p.rank === 1 ? {
                                    scale: [1, 1.2, 1],
                                    y: [0, -3, 0],
                                    textShadow: [
                                      "0 0 5px rgba(255, 255, 255, 0.5)",
                                      "0 0 20px rgba(234, 179, 8, 1), 0 0 30px rgba(234, 179, 8, 0.8)",
                                      "0 0 5px rgba(255, 255, 255, 0.5)",
                                    ]
                                  } : p.rank === 2 ? {
                                    scale: [1, 1.1, 1]
                                  } : {
                                    scale: [1, 1.05, 1]
                                  }}
                                  transition={{
                                    duration: 1.2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    textShadow: {
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }
                                  }}
                                >
                                  {p.points} pts
                                </motion.div>
                              </div>
                            </motion.div>
                          </motion.div>
                        );
                      });
                    })()}
                </div>
            </div>
                </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

          {/* Recent results feed */}
                  <div className="space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto pr-2">
                    <div className="text-xl font-bold text-white mb-3 drop-shadow-lg">Recent Events</div>
                    {recentResultsHS.length === 0 ? (
                      <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 text-white/70 text-center text-sm">
                Waiting for event results...
              </div>
            ) : (
                      recentResultsHS.slice(1).map((result, idx) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                        className="bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-bold text-white">{result.eventName}</div>
                          <div className="text-white/60 text-xs">
                      {new Date(result.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                        <div className="grid grid-cols-3 gap-2">
                    {result.placements
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((p, placementIdx) => (
                        <motion.div
                          key={p.rank}
                          initial={{ opacity: 0, y: 30, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ 
                            delay: idx * 0.1 + placementIdx * 0.1,
                            type: "spring",
                            stiffness: 200,
                            damping: 15
                          }}
                            className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-lg p-3 text-white shadow-lg hover:shadow-xl transition-shadow`}
                        >
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 mb-1">
                              <span className="text-sm font-black">{p.rank}</span>
                          </div>
                            <div className="font-bold text-sm">{p.studentName}</div>
                            <div className="text-xs opacity-90">{p.institutionName}</div>
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

            {/* Higher Secondary Section */}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-120px)]">
              <div className="text-center mb-4">
                <h2 className="text-3xl font-black text-white drop-shadow-lg">HIGHER SECONDARY</h2>
        </div>
              <div className="flex-1">
                {/* Main results area */}
                <div className="p-4 overflow-y-auto">
                  {/* Latest result - podium layout */}
                  <AnimatePresence mode="wait">
                    {lastEventHSS && (
                      <motion.div
                        key={lastEventHSS.id}
                        initial={{ opacity: 0, scale: 0.3, y: 100, rotateX: -90, rotateZ: -15 }}
                        animate={{ 
                          opacity: 1, 
                          scale: [0.3, 1.1, 1],
                          y: [100, -10, 0],
                          rotateX: [90, -5, 0],
                          rotateZ: [15, -2, 0],
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 0.8, 
                          y: 100,
                          rotateX: 15
                        }}
                        transition={{ 
                          type: "tween",
                          ease: [0.34, 1.56, 0.64, 1],
                          duration: transitioning && pendingEventLevel === "higher_secondary" ? 0.8 : 1.2,
                          scale: {
                            times: [0, 0.6, 1],
                            duration: transitioning && pendingEventLevel === "higher_secondary" ? 0.8 : 1.2
                          },
                          y: {
                            times: [0, 0.7, 1],
                            duration: transitioning && pendingEventLevel === "higher_secondary" ? 0.8 : 1.2
                          }
                        }}
                        className="mb-6"
                      >
                        <motion.div 
                          className="bg-white/20 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl relative overflow-hidden"
                          animate={{
                            scale: [1, 1.02, 1],
                            boxShadow: [
                              "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 50px rgba(59, 130, 246, 0.3)",
                              "0 35px 70px -12px rgba(59, 130, 246, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 80px rgba(6, 182, 212, 0.5)",
                              "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 50px rgba(59, 130, 246, 0.3)",
                            ],
                            borderColor: [
                              "rgba(255, 255, 255, 0.3)",
                              "rgba(59, 130, 246, 0.8)",
                              "rgba(255, 255, 255, 0.3)",
                            ]
                          }}
                          transition={{
                            scale: {
                              duration: 2.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            },
                            boxShadow: {
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            },
                            borderColor: {
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }
                          }}
                        >
                          {/* Animated glow effects */}
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-blue-400/40 via-cyan-400/50 to-purple-400/40"
                            animate={{
                              x: ["-100%", "200%"],
                              opacity: [0.3, 0.7, 0.3]
                            }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}
                          />
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-l from-cyan-400/30 via-blue-400/40 to-cyan-400/30"
                            animate={{
                              x: ["200%", "-100%"],
                              opacity: [0.2, 0.6, 0.2]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 0.5
                            }}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}
                          />
                          <div className="relative z-10">
                            <motion.div 
                              className="text-white/90 text-sm uppercase tracking-widest mb-2"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 }}
                            >
                              LATEST EVENT
                            </motion.div>
                            <motion.div 
                              className="text-5xl font-black text-white mb-8 drop-shadow-lg"
                              initial={{ opacity: 0, scale: 0.5, y: 20 }}
                              animate={{ 
                                opacity: 1, 
                                scale: [0.5, 1.1, 1],
                                y: [20, -5, 0],
                                textShadow: [
                                  "0 0 15px rgba(255, 255, 255, 0.6), 0 0 25px rgba(59, 130, 246, 0.4)",
                                  "0 0 30px rgba(59, 130, 246, 1), 0 0 50px rgba(6, 182, 212, 0.8), 0 0 70px rgba(139, 92, 246, 0.6)",
                                  "0 0 15px rgba(255, 255, 255, 0.6), 0 0 25px rgba(59, 130, 246, 0.4)",
                                ]
                              }}
                              transition={{ 
                                delay: 0.4,
                                scale: {
                                  times: [0, 0.6, 1],
                                  duration: 1
                                },
                                y: {
                                  times: [0, 0.7, 1],
                                  duration: 1
                                },
                                textShadow: {
                                  duration: 1.8,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }
                              }}
                            >
                              {lastEventHSS.eventName}
                            </motion.div>
                          
                            {/* Podium layout */}
                            <div className="flex items-end justify-center gap-2 h-64">
                              {(() => {
                                const sorted = lastEventHSS.placements.slice().sort((a, b) => a.rank - b.rank);
                                const second = sorted.find(p => p.rank === 2);
                                const first = sorted.find(p => p.rank === 1);
                                const third = sorted.find(p => p.rank === 3);
                                const order = [second, first, third].filter(Boolean);
                                
                                return order.map((p) => {
                                  if (!p) return null;
                                  const heights = { 1: "h-56", 2: "h-44", 3: "h-32" };
                                  const textSizes = {
                                    1: { badge: "text-2xl", name: "text-xl", inst: "text-sm", pts: "text-lg" },
                                    2: { badge: "text-xl", name: "text-lg", inst: "text-xs", pts: "text-base" },
                                    3: { badge: "text-lg", name: "text-base", inst: "text-xs", pts: "text-sm" }
                                  };
                                  const badgeSizes = { 1: "w-12 h-12", 2: "w-10 h-10", 3: "w-8 h-8" };
                                  const sizes = textSizes[p.rank as keyof typeof textSizes];
                                  const badgeSize = badgeSizes[p.rank as keyof typeof badgeSizes];
                                  
                                  const delays = { 1: 0.2, 2: 0.1, 3: 0.3 };
                                  
                                  return (
                                    <motion.div
                                      key={p.rank}
                                      initial={{ opacity: 0, y: 150, scale: 0.2, rotateY: -180, rotateX: 45, z: -100 }}
                                      animate={{ 
                                        opacity: 1, 
                                        y: [150, -20, 0],
                                        scale: [0.2, 1.15, 1],
                                        rotateY: [180, -10, 0],
                                        rotateX: [45, -5, 0],
                                        z: [-100, 20, 0]
                                      }}
                                      transition={{ 
                                        delay: delays[p.rank as keyof typeof delays], 
                                        type: "tween",
                                        ease: [0.34, 1.56, 0.64, 1],
                                        duration: 1.5,
                                        y: {
                                          times: [0, 0.7, 1],
                                          duration: 1.5
                                        },
                                        scale: {
                                          times: [0, 0.6, 1],
                                          duration: 1.5
                                        }
                                      }}
                                      className={`flex-1 ${heights[p.rank as keyof typeof heights]} flex flex-col justify-end`}
                                    >
                                      <motion.div 
                                        className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-t-2xl p-4 shadow-2xl h-full flex flex-col justify-center gap-2 overflow-hidden relative`}
                                        animate={{
                                          scale: p.rank === 1 ? [1, 1.08, 1] : p.rank === 2 ? [1, 1.03, 1] : [1, 1.02, 1],
                                          y: p.rank === 1 ? [0, -8, 0] : p.rank === 2 ? [0, -4, 0] : [0, -2, 0],
                                          rotateZ: p.rank === 1 ? [-2, 2, -2] : 0,
                                          boxShadow: p.rank === 1 ? [
                                            "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3), 0 0 30px rgba(234, 179, 8, 0.4)",
                                            "0 35px 60px -12px rgba(234, 179, 8, 0.8), 0 0 0 2px rgba(234, 179, 8, 0.5), 0 0 60px rgba(234, 179, 8, 0.6)",
                                            "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3), 0 0 30px rgba(234, 179, 8, 0.4)",
                                          ] : undefined
                                        }}
                                        transition={{
                                          scale: {
                                            duration: 1.8,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                          },
                                          y: {
                                            duration: 1.8,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                          },
                                          rotateZ: {
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                          },
                                          boxShadow: {
                                            duration: 1.8,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                          }
                                        }}
                                      >
                                        {/* Sparkle effect for 1st place */}
                                        {p.rank === 1 && (
                                          <>
                                            {[...Array(12)].map((_, i) => (
                                              <motion.div
                                                key={i}
                                                className="absolute w-3 h-3 bg-white rounded-full"
                                                style={{
                                                  top: `${15 + (i % 4) * 20}%`,
                                                  left: `${10 + Math.floor(i / 4) * 30}%`,
                                                }}
                                                animate={{
                                                  opacity: [0, 1, 0.8, 0],
                                                  scale: [0, 2, 1.5, 0],
                                                  rotate: [0, 180, 360],
                                                }}
                                                transition={{
                                                  duration: 2,
                                                  repeat: Infinity,
                                                  delay: i * 0.15,
                                                  ease: "easeInOut"
                                                }}
                                              />
                                            ))}
                                          </>
                                        )}
                                        <div className="text-center space-y-1 relative z-10">
                                          <motion.div 
                                            className={`inline-flex items-center justify-center ${badgeSize} rounded-full bg-white/20 mb-2`}
                                            animate={p.rank === 1 ? {
                                              rotate: [0, 360],
                                              scale: [1, 1.25, 1],
                                              y: [0, -5, 0]
                                            } : p.rank === 2 ? {
                                              scale: [1, 1.1, 1]
                                            } : {
                                              scale: [1, 1.05, 1]
                                            }}
                                            transition={{
                                              rotate: {
                                                duration: 2.5,
                                                repeat: Infinity,
                                                ease: "linear"
                                              },
                                              scale: {
                                                duration: 1.2,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                              },
                                              y: {
                                                duration: 1.2,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                              }
                                            }}
                                          >
                                            <span className={`${sizes.badge} font-black text-white`}>{p.rank}</span>
                                          </motion.div>
                                          <motion.div 
                                            className={`${sizes.name} font-black text-white mb-1 px-2 whitespace-normal break-words`} 
                                            title={p.studentName}
                                            animate={p.rank === 1 ? {
                                              textShadow: [
                                                "0 0 5px rgba(255, 255, 255, 0.5)",
                                                "0 0 15px rgba(234, 179, 8, 0.8), 0 0 25px rgba(234, 179, 8, 0.6)",
                                                "0 0 5px rgba(255, 255, 255, 0.5)",
                                              ]
                                            } : {}}
                                            transition={{
                                              textShadow: {
                                                duration: 2,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                              }
                                            }}
                                          >
                                            {p.studentName}
                                          </motion.div>
                                          <div className={`${sizes.inst} text-white/90 font-semibold mb-1 px-2 whitespace-normal break-words`} title={p.institutionName}>{p.institutionName}</div>
                                          <motion.div 
                                            className={`${sizes.pts} text-white font-bold`}
                                            animate={p.rank === 1 ? {
                                              scale: [1, 1.2, 1],
                                              y: [0, -3, 0],
                                              textShadow: [
                                                "0 0 5px rgba(255, 255, 255, 0.5)",
                                                "0 0 20px rgba(234, 179, 8, 1), 0 0 30px rgba(234, 179, 8, 0.8)",
                                                "0 0 5px rgba(255, 255, 255, 0.5)",
                                              ]
                                            } : p.rank === 2 ? {
                                              scale: [1, 1.1, 1]
                                            } : {
                                              scale: [1, 1.05, 1]
                                            }}
                                            transition={{
                                              duration: 1.2,
                                              repeat: Infinity,
                                              ease: "easeInOut",
                                              textShadow: {
                                                duration: 1.5,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                              }
                                            }}
                                          >
                                            {p.points} pts
                                          </motion.div>
              </div>
                                      </motion.div>
                                    </motion.div>
                                  );
                                });
                              })()}
            </div>
          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recent results feed */}
                  <div className="space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto pr-2">
                    <div className="text-xl font-bold text-white mb-3 drop-shadow-lg">Recent Events</div>
                    {recentResultsHSS.length === 0 ? (
                      <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 text-white/70 text-center text-sm">
                        Waiting for event results...
                      </div>
                    ) : (
                      recentResultsHSS.slice(1).map((result, idx) => (
              <motion.div
                          key={result.id}
                          initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-lg font-bold text-white">{result.eventName}</div>
                            <div className="text-white/60 text-xs">
                              {new Date(result.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                          <div className="grid grid-cols-3 gap-2">
                            {result.placements
                              .slice()
                              .sort((a, b) => a.rank - b.rank)
                              .map((p, placementIdx) => (
                    <motion.div
                                  key={p.rank}
                                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{ 
                                    delay: idx * 0.1 + placementIdx * 0.1,
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 15
                                  }}
                                  className={`bg-gradient-to-br ${rankColors[p.rank as keyof typeof rankColors]} rounded-lg p-3 text-white shadow-lg hover:shadow-xl transition-shadow`}
                                >
                                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 mb-1">
                                    <span className="text-sm font-black">{p.rank}</span>
              </div>
                                  <div className="font-bold text-sm">{p.studentName}</div>
                                  <div className="text-xs opacity-90">{p.institutionName}</div>
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
        </div>
      </div>
      )}
    </div>
  );
}