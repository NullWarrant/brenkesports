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

  // Highlights Log
  const [highlightLog, setHighlightLog] = useState<string[]>([
    "🏆 Predictions lock 30 minutes before the first kickoff of the day."
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

      // Set initial active day to today's date if matches exist
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

  // Countdown timer clock
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sorted list of match dates
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

  useEffect(() => {
    if (!activeDay && matchDays.length > 0) {
      setActiveDay(matchDays[0]);
    }
  }, [matchDays, activeDay]);

  // Active day matches
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

  // 30-minute lock status
  const lockInfo = useMemo(() => {
    if (dayMatches.length === 0) return { locked: false, text: "No Matches", lockTime: null };
    
    const kickoffs = dayMatches.map((m) => new Date(m.kickoff).getTime());
    const earliestKickoff = Math.min(...kickoffs);
    const lockTime = new Date(earliestKickoff - 30 * 60 * 1000); 
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

  // Points calculator helper
  const calculateSinglePredictionPoints = (
    homePred: number,
    awayPred: number,
    homeScore: number | null,
    awayScore: number | null
  ): number | null => {
    if (homeScore === null || awayScore === null) return null;

    if (homePred === homeScore && awayPred === awayScore) {
      return 3;
    }

    const predDiff = homePred - awayPred;
    const actDiff = homeScore - awayScore;

    const predWinner = Math.sign(predDiff);
    const actWinner = Math.sign(actDiff);

    if (predWinner !== actWinner) {
      return 0;
    }

    if (predDiff === actDiff) {
      return 2;
    }

    return 1;
  };

  // Standing calculations
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

  // Match buffer sync
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

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const prof = profiles.find((p) => p.id === selectedProfileId);
    if (!prof) return;

    if (prof.pin === pinInput) {
      setCurrentProfile(prof);
      setPinInput("");
      addLog(`👤 Logged in as ${prof.username}`);
    } else {
      alert("Incorrect PIN. Please try again.");
    }
  };

  const handleSignOut = () => {
    setCurrentProfile(null);
    setSelectedProfileId("");
    setIsAdminAuthenticated(false);
  };

  // Add user player
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
      addLog(`✨ Welcome new player: ${created.username}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create profile.");
    }
  };

  // Save predictions
  const handleSavePrediction = async (matchId: string) => {
    if (!currentProfile) return;
    const buf = predictionBuffer[matchId];
    if (!buf || buf.home === "" || buf.away === "") {
      alert("Please enter both scores.");
      return;
    }

    const homeVal = parseInt(buf.home);
    const awayVal = parseInt(buf.away);

    if (isNaN(homeVal) || isNaN(awayVal)) {
      alert("Please enter numeric scores.");
      return;
    }

    try {
      const saved = await db.savePrediction(currentProfile.id, matchId, homeVal, awayVal);
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
      addLog(`💾 Saved guess: ${homeVal} - ${awayVal}`);
    } catch (e) {
      console.error(e);
      alert("Error saving prediction.");
    }
  };

  // Admin pin validation
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "1234") {
      setIsAdminAuthenticated(true);
      setAdminPin("");
      addLog("👑 Admin controls unlocked.");
    } else {
      alert("Incorrect Admin code.");
    }
  };

  // Admin update match scores
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
      const updatedMatches = matches.map((m) => (m.id === matchId ? updatedMatch : m));
      setMatches(updatedMatches);

      const updatedPreds = await db.recalculatePoints(updatedMatches);
      setPredictions(updatedPreds);

      addLog(`⚽ Result updated: ${match.home_team} vs ${match.away_team} (${homeScore ?? "?"}-${awayScore ?? "?"})`);
    } catch (e) {
      console.error(e);
      alert("Error saving results.");
    }
  };

  // Admin add match
  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeTeam || !newAwayTeam || !newKickoff) return;

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
      addLog(`📅 Scheduled: ${created.home_team} vs ${created.away_team}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Log tracker helper
  const addLog = (msg: string) => {
    setHighlightLog((prev) => [msg, ...prev.slice(0, 5)]);
  };

  // 1. Render login screen if no profile selected
  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          
          <div className="text-center mb-8">
            <span className="text-2xl font-extrabold tracking-tight text-emerald-600 block mb-1">
              ⚽ World Cup Predictor
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Friendly Prediction Pool
            </span>
          </div>

          <h2 className="text-base font-bold text-slate-900 mb-2">
            {!showCreatePlayer ? "Sign In" : "Create Profile"}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {!showCreatePlayer 
              ? "Select your name and enter your 4-digit PIN." 
              : "Register your name and a login PIN."}
          </p>

          {!showCreatePlayer ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Your Name</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose Profile --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center text-sm font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-sm"
              >
                Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreatePlayer} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Player Name</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. Charlie"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Create PIN (4 digits)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-sm"
              >
                Sign Up & Log In
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between text-xs font-medium">
            <span className="text-slate-400">First time here?</span>
            <button
              onClick={() => {
                setShowCreatePlayer(!showCreatePlayer);
                setNewUsername("");
                setNewPin("");
                setPinInput("");
              }}
              className="text-emerald-600 hover:underline"
            >
              {showCreatePlayer ? "← Back to Login" : "Create Profile"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // 2. Render Main Dashboard once logged in
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      
      {/* Navbar Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-emerald-600">
              ⚽ World Cup Predictor
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm font-semibold">
            <span className="text-slate-600">
              Logged in as: <strong className="text-slate-900">{currentProfile.username}</strong>
            </span>
            <button 
              onClick={handleSignOut}
              className="text-xs font-bold text-rose-500 hover:underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Container */}
      <main className="max-w-5xl mx-auto px-4 mt-8 grid md:grid-cols-3 gap-8">
        
        {/* Left Side: Calendar & Match Predictions */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Day selection */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-wrap gap-2 mb-4">
              {matchDays.map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeDay === day ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Countdown banner */}
            <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${lockInfo.locked ? "bg-rose-50 text-rose-700" : "bg-emerald-55 text-emerald-700"}`}>
              <span>Day Lock Status: {lockInfo.locked ? "Locked" : "Open"}</span>
              <span className="font-mono">{lockInfo.text}</span>
            </div>
          </div>

          {/* Match Lists */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Scheduled Matches</h2>

            {dayMatches.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm">
                No matches scheduled for this date.
              </div>
            ) : (
              dayMatches.map((match) => {
                const isLockedMatch = lockInfo.locked;
                
                // Active prediction
                const myPred = predictions.find(
                  (p) => p.profile_id === currentProfile.id && p.match_id === match.id
                );

                const homeInput = predictionBuffer[match.id]?.home ?? "";
                const awayInput = predictionBuffer[match.id]?.away ?? "";

                // Get other users predictions once locked
                const otherPreds = isLockedMatch
                  ? predictions.filter((p) => p.match_id === match.id && p.profile_id !== currentProfile.id)
                  : [];

                return (
                  <div key={match.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                    
                    {/* Top Row details */}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                      <span>{match.group_stage}</span>
                      <span>
                        ⏰ {new Date(match.kickoff).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Match Center display */}
                    <div className="flex items-center justify-between gap-4 py-2">
                      <div className="flex-1 text-right font-bold text-slate-800 text-sm sm:text-base uppercase truncate">
                        {match.home_team}
                      </div>

                      <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
                        <span className="text-xs font-black text-slate-700 block">
                          {match.home_score !== null ? match.home_score : "-"} : {match.away_score !== null ? match.away_score : "-"}
                        </span>
                        {match.status === "live" ? (
                          <span className="text-[8px] font-bold text-rose-600 uppercase animate-pulse">LIVE</span>
                        ) : match.status === "completed" ? (
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Final</span>
                        ) : (
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Upcoming</span>
                        )}
                      </div>

                      <div className="flex-1 text-left font-bold text-slate-800 text-sm sm:text-base uppercase truncate">
                        {match.away_team}
                      </div>
                    </div>

                    {/* Prediction Inputs */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Your Prediction:</span>
                        
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            disabled={isLockedMatch}
                            value={homeInput}
                            onChange={(e) => setPredictionBuffer({
                              ...predictionBuffer,
                              [match.id]: { ...predictionBuffer[match.id], home: e.target.value }
                            })}
                            placeholder="Home"
                            className="w-14 bg-slate-50 border border-slate-200 disabled:opacity-50 text-center text-xs font-bold py-1.5 px-0.5 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-slate-300 font-bold">:</span>
                          <input
                            type="number"
                            min={0}
                            disabled={isLockedMatch}
                            value={awayInput}
                            onChange={(e) => setPredictionBuffer({
                              ...predictionBuffer,
                              [match.id]: { ...predictionBuffer[match.id], away: e.target.value }
                            })}
                            placeholder="Away"
                            className="w-14 bg-slate-50 border border-slate-200 disabled:opacity-50 text-center text-xs font-bold py-1.5 px-0.5 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {!isLockedMatch && (
                          <button
                            onClick={() => handleSavePrediction(match.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs"
                          >
                            Save
                          </button>
                        )}
                      </div>

                      {/* Display points score */}
                      {myPred && match.home_score !== null && match.away_score !== null && (
                        <div className="text-[10px] font-black uppercase tracking-wider">
                          {(() => {
                            const pts = calculateSinglePredictionPoints(
                              myPred.home_prediction,
                              myPred.away_prediction,
                              match.home_score,
                              match.away_score
                            );
                            if (pts === 3) return <span className="text-emerald-600">🎯 Exact Score Match (+3 pts)</span>;
                            if (pts === 2) return <span className="text-emerald-500">🏆 Correct Margin (+2 pts)</span>;
                            if (pts === 1) return <span className="text-amber-600">👍 Correct Outcome (+1 pt)</span>;
                            return <span className="text-rose-600">❌ Incorrect (+0 pts)</span>;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Banter / Other players prediction section when locked */}
                    {isLockedMatch && otherPreds.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mt-2">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                          👥 Friends Predictions:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {otherPreds.map((otherPred) => {
                            const otherProfile = profiles.find((p) => p.id === otherPred.profile_id);
                            if (!otherProfile) return null;

                            const friendPts = calculateSinglePredictionPoints(
                              otherPred.home_prediction,
                              otherPred.away_prediction,
                              match.home_score,
                              match.away_score
                            );

                            return (
                              <div key={otherPred.id} className="bg-white border border-slate-100 rounded-lg p-2 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-500 truncate max-w-[70px]">{otherProfile.username}</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {otherPred.home_prediction}-{otherPred.away_prediction}
                                </span>
                                {friendPts !== null && (
                                  <span className={`text-[9px] font-bold ${friendPts > 0 ? "text-emerald-600" : "text-slate-300"}`}>
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

        {/* Right Side: Leaderboard & Logs & Admin */}
        <div className="flex flex-col gap-6">
          
          {/* Standing / Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Leaderboard Standings</h2>
            
            <div className="flex flex-col gap-2.5">
              {standings.map((player, idx) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${player.id === currentProfile.id ? "bg-emerald-50/40 border-emerald-200" : "bg-white border-slate-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center ${idx === 0 ? "bg-amber-100 text-amber-800" : idx === 1 ? "bg-slate-100 text-slate-700" : idx === 2 ? "bg-orange-100 text-orange-800" : "bg-slate-50 text-slate-500"}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-800 truncate max-w-[100px]">
                        {player.username}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">
                        🏆 {player.stats.exacts} exact
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">{player.overallPoints} pts</div>
                    <div className="text-[9px] font-bold text-emerald-600 uppercase">Today: +{player.dailyPoints}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simple System Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Recent Activity</h2>
            <div className="flex flex-col gap-2 font-mono text-[10px] text-slate-500">
              {highlightLog.map((log, idx) => (
                <div key={idx} className="border-b border-slate-50 pb-1.5 leading-normal">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Short Rules */}
          <div className="bg-slate-100 border border-slate-200/50 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">Points Rules</h3>
            <ul className="text-xs text-slate-500 flex flex-col gap-1.5">
              <li>🏆 <strong>3 pts</strong>: Exact final score</li>
              <li>🔥 <strong>2 pts</strong>: Correct winner + Goal Difference (or draw score wrong)</li>
              <li>👍 <strong>1 pt</strong>: Correct winner / draw outcome only</li>
              <li>❌ <strong>0 pts</strong>: Incorrect winner outcome</li>
            </ul>
          </div>

          {/* Organizer Console entry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Organizer Panel</h2>
            
            {!isAdminAuthenticated ? (
              <form onSubmit={handleAdminAuth} className="flex gap-2">
                <input
                  type="password"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Admin PIN"
                  className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 text-center text-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase transition-colors"
                >
                  Enter
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowAdminConsole(!showAdminConsole)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold uppercase transition-colors text-slate-700"
                >
                  {showAdminConsole ? "Hide Admin Dashboard" : "Show Admin Dashboard"}
                </button>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Admin Dashboard Controls */}
      {isAdminAuthenticated && showAdminConsole && (
        <section className="max-w-5xl mx-auto px-4 mt-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-4">👑 Organizer Tools</h2>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Add Match Form */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Add Match</h3>
                
                <form onSubmit={handleAddMatch} className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        required
                        value={newHomeTeam}
                        onChange={(e) => setNewHomeTeam(e.target.value)}
                        placeholder="Home Team"
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        value={newAwayTeam}
                        onChange={(e) => setNewAwayTeam(e.target.value)}
                        placeholder="Away Team"
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="datetime-local"
                      required
                      value={newKickoff}
                      onChange={(e) => setNewKickoff(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-lg transition-colors"
                  >
                    Add Match
                  </button>
                </form>
              </div>

              {/* Set Match Score Results */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Post Results</h3>
                
                <div className="h-56 overflow-y-auto flex flex-col gap-2 pr-1">
                  {matches.map((m) => (
                    <div key={m.id} className="bg-white rounded-lg p-2 border border-slate-200 text-xs flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase font-semibold">
                        <span>{m.group_stage}</span>
                        <span>{new Date(m.kickoff).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">{m.home_team} vs {m.away_team}</span>
                        
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="Home"
                            defaultValue={m.home_score ?? ""}
                            id={`admin-home-${m.id}`}
                            className="w-10 text-center bg-slate-50 border border-slate-200 rounded py-0.5 font-bold"
                          />
                          <span>:</span>
                          <input
                            type="number"
                            placeholder="Away"
                            defaultValue={m.away_score ?? ""}
                            id={`admin-away-${m.id}`}
                            className="w-10 text-center bg-slate-50 border border-slate-200 rounded py-0.5 font-bold"
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
                          className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 rounded font-bold text-[9px] text-slate-600 border border-slate-200"
                        >
                          Set Live
                        </button>
                        <button
                          onClick={() => {
                            const homeVal = (document.getElementById(`admin-home-${m.id}`) as HTMLInputElement)?.value || "";
                            const awayVal = (document.getElementById(`admin-away-${m.id}`) as HTMLInputElement)?.value || "";
                            if (homeVal === "" || awayVal === "") {
                              alert("Please input scores.");
                              return;
                            }
                            handleUpdateMatchScore(m.id, homeVal, awayVal, "completed");
                          }}
                          className="flex-1 py-1 bg-emerald-100 hover:bg-emerald-250 text-emerald-800 rounded font-bold text-[9px] border border-emerald-200"
                        >
                          End & Calc
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
