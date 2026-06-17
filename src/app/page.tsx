"use client";

import { useState, useEffect, useMemo } from "react";
import { db, Match, Profile, Prediction } from "@/utils/supabase";

export default function WorldCupPredictor() {
  // Database States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  // Auth States
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  
  // Player Creation States
  const [showCreatePlayer, setShowCreatePlayer] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPin, setNewPin] = useState("");

  // UI States
  const [activeDay, setActiveDay] = useState<string>("");
  const [timeTick, setTimeTick] = useState(new Date());
  const [dbMode, setDbMode] = useState<"Supabase" | "Local Storage">("Local Storage");

  // Admin States
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  // Admin Action States (Creating Match)
  const [newHomeTeam, setNewHomeTeam] = useState("");
  const [newAwayTeam, setNewAwayTeam] = useState("");
  const [newKickoff, setNewKickoff] = useState("");
  const [newStage, setNewStage] = useState("Group Stage");

  // User input prediction buffers
  const [predictionBuffer, setPredictionBuffer] = useState<{
    [matchId: string]: { home: string; away: string };
  }>({});

  // Cool Features States (Live highlights simulator)
  const [highlightLog, setHighlightLog] = useState<string[]>([
    "🏆 Welcome to the World Cup Predictor Portal!",
    "⚽ Prediction locks exactly 30 minutes before the first game of each matchday.",
    "📊 Real-time points are calculated instantly when scores update!"
  ]);

  // Load Initial Data
  useEffect(() => {
    async function loadData() {
      const p = await db.getProfiles();
      const m = await db.getMatches();
      const pred = await db.getPredictions();

      setProfiles(p);
      setMatches(m);
      setPredictions(pred);
      setDbMode(db.isFallback() ? "Local Storage" : "Supabase");

      // Set initial active day to today's date if matches exist, or first day
      if (m.length > 0) {
        const uniqueDays = Array.from(
          new Set(
            m.map((match) =>
              new Date(match.kickoff).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
              })
            )
          )
        );
        
        // Find today's date format
        const todayStr = new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric"
        });

        if (uniqueDays.includes(todayStr)) {
          setActiveDay(todayStr);
        } else {
          setActiveDay(uniqueDays[0] || "");
        }
      }
    }
    loadData();
  }, []);

  // Update clock countdown ticks
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Group and sort match days
  const matchDays = useMemo(() => {
    const days = new Set<string>();
    matches.forEach((m) => {
      const dateStr = new Date(m.kickoff).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
      days.add(dateStr);
    });

    return Array.from(days).sort((a, b) => {
      const matchA = matches.find(
        (m) =>
          new Date(m.kickoff).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          }) === a
      );
      const matchB = matches.find(
        (m) =>
          new Date(m.kickoff).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          }) === b
      );
      if (!matchA || !matchB) return 0;
      return new Date(matchA.kickoff).getTime() - new Date(matchB.kickoff).getTime();
    });
  }, [matches]);

  // Set first day as active if none set
  useEffect(() => {
    if (!activeDay && matchDays.length > 0) {
      setActiveDay(matchDays[0]);
    }
  }, [matchDays, activeDay]);

  // Get matches for active day
  const dayMatches = useMemo(() => {
    if (!activeDay) return [];
    return matches.filter(
      (m) =>
        new Date(m.kickoff).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric"
        }) === activeDay
    );
  }, [matches, activeDay]);

  // Lock status details for the active day
  const lockInfo = useMemo(() => {
    if (dayMatches.length === 0) return { locked: false, text: "No Matches", lockTime: null };
    
    // Earliest kickoff on active day
    const kickoffs = dayMatches.map((m) => new Date(m.kickoff).getTime());
    const earliestKickoff = Math.min(...kickoffs);
    const lockTime = new Date(earliestKickoff - 30 * 60 * 1000); // 30 mins before
    const timeRemaining = lockTime.getTime() - timeTick.getTime();
    const locked = timeRemaining <= 0;

    let text = "";
    if (locked) {
      text = "Predictions Locked";
    } else {
      const diffHrs = Math.floor(timeRemaining / (1000 * 60 * 60));
      const diffMins = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      text = `Locks in: ${diffHrs}h ${diffMins}m ${diffSecs}s`;
    }

    return { locked, text, lockTime };
  }, [dayMatches, timeTick]);

  // Point System calculator
  const calculateSinglePredictionPoints = (
    homePred: number,
    awayPred: number,
    homeScore: number | null,
    awayScore: number | null
  ): number | null => {
    if (homeScore === null || awayScore === null) return null;

    // Rule 1: Exact Match -> 3 pts
    if (homePred === homeScore && awayPred === awayScore) {
      return 3;
    }

    const predDiff = homePred - awayPred;
    const actDiff = homeScore - awayScore;

    const predWinner = Math.sign(predDiff);
    const actWinner = Math.sign(actDiff);

    // Rule 4: Incorrect Outcome -> 0 pts
    if (predWinner !== actWinner) {
      return 0;
    }

    // Rule 2: Correct Outcome + Correct Goal Difference -> 2 pts
    if (predDiff === actDiff) {
      return 2;
    }

    // Rule 3: Correct Outcome + Wrong Goal Difference -> 1 pt
    return 1;
  };

  // Standings data
  const standings = useMemo(() => {
    return profiles.map((p) => {
      let overallPoints = 0;
      let dailyPoints = 0;
      let exacts = 0;
      let diffs = 0;
      let outcomes = 0;

      predictions
        .filter((pred) => pred.profile_id === p.id)
        .forEach((pred) => {
          const m = matches.find((match) => match.id === pred.match_id);
          if (m && m.home_score !== null && m.away_score !== null) {
            const pts = calculateSinglePredictionPoints(
              pred.home_prediction,
              pred.away_prediction,
              m.home_score,
              m.away_score
            );

            if (pts !== null) {
              overallPoints += pts;
              if (pts === 3) exacts++;
              else if (pts === 2) diffs++;
              else if (pts === 1) outcomes++;

              // Check if prediction is for active day
              const matchDateStr = new Date(m.kickoff).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
              });
              if (matchDateStr === activeDay) {
                dailyPoints += pts;
              }
            }
          }
        });

      return {
        id: p.id,
        username: p.username,
        overallPoints,
        dailyPoints,
        stats: { exacts, diffs, outcomes }
      };
    }).sort((a, b) => b.overallPoints - a.overallPoints || b.dailyPoints - a.dailyPoints);
  }, [profiles, predictions, matches, activeDay]);

  // Prediction buffer loader when current profile or day changes
  useEffect(() => {
    if (!currentProfile) return;
    const buffer: typeof predictionBuffer = {};
    dayMatches.forEach((m) => {
      const pred = predictions.find(
        (p) => p.profile_id === currentProfile.id && p.match_id === m.id
      );
      buffer[m.id] = {
        home: pred ? pred.home_prediction.toString() : "",
        away: pred ? pred.away_prediction.toString() : ""
      };
    });
    setPredictionBuffer(buffer);
  }, [currentProfile, dayMatches, predictions]);

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const prof = profiles.find((p) => p.id === selectedProfileId);
    if (!prof) return;

    if (prof.pin === pinInput) {
      setCurrentProfile(prof);
      setPinInput("");
      addHighlight(`🔑 Player "${prof.username}" logged in successfully!`);
    } else {
      alert("Incorrect PIN. Please try again.");
    }
  };

  // Sign out Handler
  const handleSignOut = () => {
    setCurrentProfile(null);
    setSelectedProfileId("");
    setIsAdminAuthenticated(false);
  };

  // Add a new Player
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPin) return;

    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      alert("PIN must be a 4-digit number.");
      return;
    }

    try {
      const created = await db.createProfile(newUsername, newPin, false);
      setProfiles([...profiles, created]);
      setCurrentProfile(created);
      setSelectedProfileId(created.id);
      setNewUsername("");
      setNewPin("");
      setShowCreatePlayer(false);
      addHighlight(`✨ Added new player "${created.username}" to the predictor pool.`);
    } catch (err) {
      console.error(err);
      alert("Failed to create player.");
    }
  };

  // Save Prediction submit
  const handleSavePrediction = async (matchId: string) => {
    if (!currentProfile) return;
    const buf = predictionBuffer[matchId];
    if (!buf || buf.home === "" || buf.away === "") {
      alert("Please fill in both scores.");
      return;
    }

    const homeVal = parseInt(buf.home);
    const awayVal = parseInt(buf.away);

    if (isNaN(homeVal) || isNaN(awayVal)) {
      alert("Scores must be valid numbers.");
      return;
    }

    try {
      const saved = await db.savePrediction(currentProfile.id, matchId, homeVal, awayVal);
      
      // Update predictions local state
      const updated = [...predictions];
      const idx = updated.findIndex(
        (p) => p.profile_id === currentProfile.id && p.match_id === matchId
      );
      if (idx > -1) {
        updated[idx] = saved;
      } else {
        updated.push(saved);
      }
      setPredictions(updated);
      addHighlight(`💾 Prediction saved: ${homeVal}-${awayVal} for match.`);
    } catch (e) {
      console.error(e);
      alert("Failed to save prediction.");
    }
  };

  // Admin Login
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "1234") {
      setIsAdminAuthenticated(true);
      setAdminPin("");
      addHighlight("👑 Admin console unlocked.");
    } else {
      alert("Wrong Admin PIN.");
    }
  };

  // Admin: Update Match Score & recalculate rankings
  const handleUpdateMatchScore = async (
    matchId: string,
    homeScoreStr: string,
    awayScoreStr: string,
    status: "scheduled" | "live" | "completed"
  ) => {
    const homeScore = homeScoreStr === "" ? null : parseInt(homeScoreStr);
    const awayScore = awayScoreStr === "" ? null : parseInt(awayScoreStr);

    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const updatedMatch: Match = {
      ...match,
      home_score: homeScore,
      away_score: awayScore,
      status
    };

    try {
      await db.saveMatch(updatedMatch);
      
      // Update local match state
      const updatedMatches = matches.map((m) => (m.id === matchId ? updatedMatch : m));
      setMatches(updatedMatches);

      // Recalculate Points for all predictions
      const updatedPreds = await db.recalculatePoints(updatedMatches);
      setPredictions(updatedPreds);

      addHighlight(
        `⚽ Admin updated ${match.home_team} vs ${match.away_team} to ${homeScore ?? "?"}-${awayScore ?? "?"} (${status.toUpperCase()})`
      );
    } catch (e) {
      console.error(e);
      alert("Failed to update score.");
    }
  };

  // Admin: Add new match
  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeTeam || !newAwayTeam || !newKickoff) {
      alert("All fields are required.");
      return;
    }

    try {
      const created = await db.createMatch(
        newHomeTeam,
        newAwayTeam,
        new Date(newKickoff).toISOString(),
        newStage
      );

      setMatches([...matches, created].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()));
      setNewHomeTeam("");
      setNewAwayTeam("");
      setNewKickoff("");
      addHighlight(`📅 New match scheduled: ${created.home_team} vs ${created.away_team}.`);
    } catch (err) {
      console.error(err);
      alert("Failed to add match.");
    }
  };

  // Helper to add highlights
  const addHighlight = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    setHighlightLog((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 10)]);
  };

  // Simulated Live scoring event generator
  const runLiveSimulator = () => {
    // Find active day matches that are live or scheduled
    const eligibleMatches = matches.filter((m) => m.status === "live" || m.status === "scheduled");
    if (eligibleMatches.length === 0) {
      addHighlight("📢 Simulator: No live or scheduled matches to simulate today!");
      return;
    }

    // Pick one random match to update
    const randomMatch = eligibleMatches[Math.floor(Math.random() * eligibleMatches.length)];
    const currentHome = randomMatch.home_score ?? 0;
    const currentAway = randomMatch.away_score ?? 0;
    
    // Add random goal to home or away
    const homeGoal = Math.random() > 0.5;
    const nextHome = homeGoal ? currentHome + 1 : currentHome;
    const nextAway = homeGoal ? currentAway : currentAway + 1;

    handleUpdateMatchScore(randomMatch.id, nextHome.toString(), nextAway.toString(), "live");
    addHighlight(`🔥 SIMULATED GOAL! ${homeGoal ? randomMatch.home_team : randomMatch.away_team} scored!`);
  };

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-[#070D09] text-zinc-100 font-sans antialiased flex items-center justify-center p-6 selection:bg-emerald-600 selection:text-white relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none -z-10" />
        
        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-900 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          <div className="text-center mb-8">
            <span className="text-3xl font-black tracking-widest text-emerald-500 block mb-2">
              🏆 WORLD CUP
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Daily Bracket Challenge
            </span>
          </div>

          <h2 className="text-lg font-black uppercase text-emerald-400 mb-2">
            {!showCreatePlayer ? "Player Sign In" : "Register Player"}
          </h2>
          <p className="text-xs text-zinc-500 mb-6">
            {!showCreatePlayer 
              ? "Select your profile and enter your 4-digit PIN to access predictions." 
              : "Create a username and PIN to join the matchday brackets."}
          </p>
          
          {!showCreatePlayer ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="w-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Select Player</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-sm text-zinc-300 focus:outline-none transition-colors appearance-none"
                >
                  <option value="">-- Choose Profile --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN Code"
                  required
                  className="w-full text-center tracking-widest bg-zinc-950 border border-zinc-900 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-sm text-zinc-300 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-emerald-950/35"
              >
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreatePlayer} className="flex flex-col gap-4">
              <div className="w-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Player Name</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. Charlie"
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-sm text-zinc-300 focus:outline-none transition-colors"
                />
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Create 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="e.g. 9999"
                  required
                  className="w-full text-center tracking-widest bg-zinc-950 border border-zinc-900 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-sm text-zinc-300 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition-colors shadow-lg shadow-emerald-950/35"
              >
                Add Player & Log In
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-zinc-800/50 flex justify-between items-center text-xs text-zinc-500">
            <span>Join our prediction pool!</span>
            <button
              type="button"
              onClick={() => {
                setShowCreatePlayer(!showCreatePlayer);
                setNewUsername("");
                setNewPin("");
                setPinInput("");
              }}
              className="text-emerald-400 font-bold hover:underline"
            >
              {showCreatePlayer ? "← Back to Sign In" : "➕ Create Profile"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D09] text-zinc-100 font-sans antialiased pb-20 selection:bg-emerald-600 selection:text-white">
      
      {/* Decorative soccer-themed backdrop blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-80 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Nav bar */}
      <header className="border-b border-emerald-950/40 bg-[#070D09]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-wider text-emerald-500">
              🏆 WORLD CUP <span className="text-zinc-400 font-light">PREDICTOR</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
              {dbMode} Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
            {currentProfile && (
              <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-900 rounded-full pl-4 pr-1 py-1 text-sm font-semibold">
                <span className="text-zinc-300">
                  ⚽ {currentProfile.username}
                  {currentProfile.is_admin && <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black">ADMIN</span>}
                </span>
                <button 
                  onClick={handleSignOut}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded-full text-xs font-bold text-rose-400 tracking-wide transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Container */}
      <main className="max-w-6xl mx-auto px-6 mt-10 grid md:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Main content */}
        <div className="md:col-span-2 flex flex-col gap-8">
          
          {/* Calendar Navigation & Countdown Panel */}
          <div className="bg-[#09110B] border border-emerald-950/30 rounded-3xl p-6">
            
            {/* Calendar Tab Row */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-emerald-950/30 pb-4">
              {matchDays.map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeDay === day ? "bg-emerald-600 text-white" : "bg-zinc-900/50 text-zinc-500 hover:text-zinc-300"}`}
                >
                  📅 {day}
                </button>
              ))}
            </div>

            {/* Lock Info Countdown Banner */}
            <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 font-bold text-xs uppercase tracking-wider ${lockInfo.locked ? "bg-rose-950/30 border border-rose-900/30 text-rose-400" : "bg-emerald-950/30 border border-emerald-900/30 text-emerald-400"}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${lockInfo.locked ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
                <span>LOCK STATUS ({activeDay}): {lockInfo.locked ? "LOCKED" : "OPEN"}</span>
              </div>
              <div className="font-mono text-sm">
                {lockInfo.text}
              </div>
            </div>
          </div>

          {/* Matches List Grid */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Matches of the Day</h2>
            
            {dayMatches.length === 0 ? (
              <div className="bg-zinc-900/25 border border-zinc-900 rounded-3xl p-12 text-center text-zinc-500 font-medium text-sm">
                No matches scheduled for this date.
              </div>
            ) : (
              dayMatches.map((match) => {
                const isLockedMatch = lockInfo.locked;
                
                // Find prediction of current user
                const myPred = currentProfile 
                  ? predictions.find(p => p.profile_id === currentProfile.id && p.match_id === match.id)
                  : null;

                // Load prediction input values
                const homeInput = predictionBuffer[match.id]?.home ?? "";
                const awayInput = predictionBuffer[match.id]?.away ?? "";

                // Get other users predictions once locked
                const otherPreds = isLockedMatch
                  ? predictions.filter(p => p.match_id === match.id && p.profile_id !== currentProfile?.id)
                  : [];

                return (
                  <div
                    key={match.id}
                    className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 flex flex-col gap-6"
                  >
                    
                    {/* Top Row: Meta details */}
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <span>{match.group_stage}</span>
                      <span>
                        ⏰ Kickoff: {new Date(match.kickoff).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Middle Row: Score board */}
                    <div className="grid grid-cols-7 items-center gap-2">
                      
                      {/* Home Team name */}
                      <div className="col-span-2 text-right text-base font-extrabold text-white uppercase truncate">
                        {match.home_team}
                      </div>

                      {/* Home Team flag placeholder */}
                      <div className="col-span-1 flex justify-center text-3xl">
                        ⚽
                      </div>

                      {/* Actual Score (Middle) */}
                      <div className="col-span-1 flex flex-col items-center justify-center bg-zinc-950 border border-zinc-900 rounded-2xl py-2 px-3">
                        <span className="text-[8px] font-black text-zinc-600 uppercase mb-0.5">SCORE</span>
                        <span className="text-lg font-black text-emerald-400">
                          {match.home_score !== null ? match.home_score : "-"} : {match.away_score !== null ? match.away_score : "-"}
                        </span>
                        {match.status === "live" && (
                          <span className="absolute transform translate-y-6 px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Away Team flag placeholder */}
                      <div className="col-span-1 flex justify-center text-3xl">
                        ⚽
                      </div>

                      {/* Away Team name */}
                      <div className="col-span-2 text-left text-base font-extrabold text-white uppercase truncate">
                        {match.away_team}
                      </div>

                    </div>

                    {/* Bottom Row: Prediction form */}
                    <div className="pt-4 border-t border-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Prediction Input Form */}
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Your Guess:</span>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Home"
                            disabled={!currentProfile || isLockedMatch}
                            value={homeInput}
                            onChange={(e) => setPredictionBuffer({
                              ...predictionBuffer,
                              [match.id]: { ...predictionBuffer[match.id], home: e.target.value }
                            })}
                            className="w-16 bg-zinc-950 border border-zinc-900 disabled:opacity-50 text-center text-sm font-extrabold py-2 px-1 rounded-xl text-white focus:outline-none focus:border-emerald-600"
                          />
                          <span className="text-zinc-600 font-bold">:</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="Away"
                            disabled={!currentProfile || isLockedMatch}
                            value={awayInput}
                            onChange={(e) => setPredictionBuffer({
                              ...predictionBuffer,
                              [match.id]: { ...predictionBuffer[match.id], away: e.target.value }
                            })}
                            className="w-16 bg-zinc-950 border border-zinc-900 disabled:opacity-50 text-center text-sm font-extrabold py-2 px-1 rounded-xl text-white focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        {currentProfile && !isLockedMatch && (
                          <button
                            onClick={() => handleSavePrediction(match.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors text-white"
                          >
                            Save
                          </button>
                        )}
                      </div>

                      {/* Points result display */}
                      {myPred && match.home_score !== null && match.away_score !== null && (
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          <span className="text-zinc-500">Result:</span>
                          {(() => {
                            const pts = calculateSinglePredictionPoints(
                              myPred.home_prediction,
                              myPred.away_prediction,
                              match.home_score,
                              match.away_score
                            );
                            if (pts === 3) return <span className="text-emerald-400">✨ EXACT MATCH (+3 PTS)</span>;
                            if (pts === 2) return <span className="text-emerald-300">✅ CORRECT DIFF (+2 PTS)</span>;
                            if (pts === 1) return <span className="text-zinc-300">👍 CORRECT OUTCOME (+1 PT)</span>;
                            return <span className="text-rose-400">❌ WRONG (+0 PTS)</span>;
                          })()}
                        </div>
                      )}

                    </div>

                    {/* Banter / Other players prediction section when locked */}
                    {isLockedMatch && otherPreds.length > 0 && (
                      <div className="bg-zinc-950/50 rounded-2xl p-4 mt-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                          👥 Friend Predictions:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {otherPreds.map((otherPred) => {
                            const otherProfile = profiles.find(p => p.id === otherPred.profile_id);
                            if (!otherProfile) return null;

                            // Calculate points for this friend if match is completed
                            const friendPts = calculateSinglePredictionPoints(
                              otherPred.home_prediction,
                              otherPred.away_prediction,
                              match.home_score,
                              match.away_score
                            );

                            return (
                              <div key={otherPred.id} className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-400 truncate max-w-[80px]">{otherProfile.username}</span>
                                <span className="font-mono font-black text-zinc-200">
                                  {otherPred.home_prediction}-{otherPred.away_prediction}
                                </span>
                                {friendPts !== null && (
                                  <span className={`text-[9px] font-bold ${friendPts > 0 ? "text-emerald-400" : "text-zinc-600"}`}>
                                    +{friendPts}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Column: Standings, Highlights, Admin */}
        <div className="flex flex-col gap-8">
          
          {/* Standing / Leaderboard Section */}
          <div className="bg-zinc-900/60 border border-zinc-900 rounded-3xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-4">🏆 LEADERBOARD</h2>
            
            <div className="flex flex-col gap-3">
              {standings.map((player, idx) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${player.id === currentProfile?.id ? "bg-emerald-950/20 border-emerald-900/30" : "bg-zinc-950/60 border-zinc-900"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${idx === 0 ? "bg-amber-500/20 text-amber-400" : idx === 1 ? "bg-zinc-300/20 text-zinc-300" : idx === 2 ? "bg-amber-800/20 text-amber-600" : "bg-zinc-900 text-zinc-500"}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-extrabold text-white truncate max-w-[100px]">
                        {player.username}
                      </div>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase">
                        🎯 {player.stats.exacts} Exact | {player.stats.diffs} Diff
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-white">{player.overallPoints} pts</div>
                    <div className="text-[9px] font-bold text-emerald-400 uppercase">Today: +{player.dailyPoints}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights & Live Simulator Panel */}
          <div className="bg-zinc-900/60 border border-zinc-900 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-500">⚽ LIVE LOGS / STANDS</h2>
              <button 
                onClick={runLiveSimulator}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors text-white"
              >
                ⚡ Sim Goal
              </button>
            </div>
            
            <div className="h-44 bg-zinc-950 border border-zinc-900 rounded-2xl p-4 overflow-y-auto font-mono text-[10px] text-zinc-400 flex flex-col gap-2">
              {highlightLog.map((log, index) => (
                <div key={index} className="border-b border-zinc-900/50 pb-1.5 leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Point rules checklist */}
          <div className="bg-zinc-900/30 border border-zinc-900/60 rounded-3xl p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 font-bold">Rule Book / Point System</h3>
            <ul className="text-xs text-zinc-400 flex flex-col gap-3 font-medium">
              <li className="flex gap-2">
                <span className="text-emerald-400 font-extrabold">3 pts</span>
                <span><strong>Exact score match</strong>: Guess the exact score of the match.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-extrabold">2 pts</span>
                <span><strong>Goal difference match</strong>: Correct winner and margin of victory, but wrong score (e.g. guess 2-0, result 3-1). Correct draws count too.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-extrabold">1 pt</span>
                <span><strong>Outcome match</strong>: Correct winner/draw, but incorrect difference and score.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-600 font-extrabold">0 pts</span>
                <span>Incorrect winner choice.</span>
              </li>
            </ul>
          </div>

          {/* Admin console trigger */}
          <div className="bg-zinc-900/60 border border-zinc-900 rounded-3xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">👑 ADMIN PORTAL</h2>
            
            {!isAdminAuthenticated ? (
              <form onSubmit={handleAdminAuth} className="flex gap-2">
                <input
                  type="password"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Admin PIN (Try 1234)"
                  required
                  className="flex-1 bg-zinc-950 border border-zinc-900 text-xs rounded-xl px-3 py-2 text-center text-zinc-300 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase transition-colors"
                >
                  Enter
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setShowAdminConsole(!showAdminConsole)}
                  className="w-full py-2.5 bg-zinc-950 border border-zinc-900 hover:border-emerald-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors text-white"
                >
                  {showAdminConsole ? "Hide Admin Dashboard" : "Show Admin Dashboard"}
                </button>

                <div className="text-[10px] text-zinc-500 font-medium">
                  Status: Logged in as Nathan (Organizer). You can add matches and set scores below.
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Admin Dashboard Console Panel */}
      {isAdminAuthenticated && showAdminConsole && (
        <section className="max-w-6xl mx-auto px-6 mt-8 animate-fade-in">
          <div className="bg-zinc-900 border border-amber-500/20 rounded-3xl p-8">
            <h2 className="text-base font-black uppercase tracking-wider text-amber-400 mb-6 flex items-center gap-2">
              🛡️ Admin Organizer Controls
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Add Match Column */}
              <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">Add Match Schedule</h3>
                
                <form onSubmit={handleAddMatch} className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Home Team</label>
                      <input
                        type="text"
                        required
                        value={newHomeTeam}
                        onChange={(e) => setNewHomeTeam(e.target.value)}
                        placeholder="Home Team Name"
                        className="w-full bg-zinc-950 border border-zinc-900 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Away Team</label>
                      <input
                        type="text"
                        required
                        value={newAwayTeam}
                        onChange={(e) => setNewAwayTeam(e.target.value)}
                        placeholder="Away Team Name"
                        className="w-full bg-zinc-950 border border-zinc-900 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Kickoff Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={newKickoff}
                      onChange={(e) => setNewKickoff(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-900 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-zinc-500 mb-1">Stage / Group</label>
                    <input
                      type="text"
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      placeholder="e.g., Group Stage, Round of 16"
                      className="w-full bg-zinc-950 border border-zinc-900 text-xs rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
                  >
                    Add to Calendar
                  </button>
                </form>
              </div>

              {/* Set Match Score Results Column */}
              <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-4">Post Match Results & Calc Standings</h3>
                
                <div className="h-64 overflow-y-auto flex flex-col gap-3 pr-2">
                  {matches.map((m) => (
                    <div key={m.id} className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-900 flex flex-col gap-3 text-xs">
                      
                      <div className="flex justify-between items-center text-[10px] text-zinc-500">
                        <span className="font-semibold">{m.group_stage}</span>
                        <span>{new Date(m.kickoff).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-zinc-300 truncate max-w-[120px]">{m.home_team} vs {m.away_team}</span>
                        
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="Home"
                            defaultValue={m.home_score ?? ""}
                            id={`admin-home-${m.id}`}
                            className="w-12 text-center bg-zinc-950 border border-zinc-900 rounded py-1 px-0.5 font-bold"
                          />
                          <span>:</span>
                          <input
                            type="number"
                            placeholder="Away"
                            defaultValue={m.away_score ?? ""}
                            id={`admin-away-${m.id}`}
                            className="w-12 text-center bg-zinc-950 border border-zinc-900 rounded py-1 px-0.5 font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const homeVal = (document.getElementById(`admin-home-${m.id}`) as HTMLInputElement)?.value || "";
                            const awayVal = (document.getElementById(`admin-away-${m.id}`) as HTMLInputElement)?.value || "";
                            handleUpdateMatchScore(m.id, homeVal, awayVal, "live");
                          }}
                          className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded font-bold text-[9px] uppercase text-amber-500 border border-zinc-800"
                        >
                          Set Live
                        </button>
                        <button
                          onClick={() => {
                            const homeVal = (document.getElementById(`admin-home-${m.id}`) as HTMLInputElement)?.value || "";
                            const awayVal = (document.getElementById(`admin-away-${m.id}`) as HTMLInputElement)?.value || "";
                            if (homeVal === "" || awayVal === "") {
                              alert("Cannot set completed match without score.");
                              return;
                            }
                            handleUpdateMatchScore(m.id, homeVal, awayVal, "completed");
                          }}
                          className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 rounded font-bold text-[9px] uppercase text-emerald-400 border border-emerald-900/30"
                        >
                          End Match
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

    </div>
  );
}
