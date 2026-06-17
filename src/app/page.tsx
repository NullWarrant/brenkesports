"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase";

interface Match {
  id: string;
  game: "CS2" | "Valorant" | "League of Legends";
  opponent: string;
  status: "LIVE" | "UPCOMING" | "COMPLETED";
  result?: string;
  date: string;
  time?: string;
}

interface Player {
  name: string;
  handle: string;
  role: string;
  avatar: string;
  specialty: string;
}

export default function Home() {
  const [activeRoster, setActiveRoster] = useState<"cs2" | "valorant">("cs2");
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const matches: Match[] = [
    {
      id: "1",
      game: "CS2",
      opponent: "FaZe Clan",
      status: "LIVE",
      date: "TODAY",
      time: "NOW PLAYING"
    },
    {
      id: "2",
      game: "Valorant",
      opponent: "Sentinels",
      status: "UPCOMING",
      date: "June 24, 2026",
      time: "8:00 PM EST"
    },
    {
      id: "3",
      game: "League of Legends",
      opponent: "T1 Esports",
      status: "COMPLETED",
      result: "W 2-1",
      date: "June 14, 2026"
    },
    {
      id: "4",
      game: "CS2",
      opponent: "Natus Vincere",
      status: "COMPLETED",
      result: "L 1-2",
      date: "June 10, 2026"
    }
  ];

  const cs2Roster: Player[] = [
    { name: "Marcus Vane", handle: "Apex", role: "In-Game Leader", avatar: "/players/player1.jpg", specialty: "Strategy & Clutches" },
    { name: "Lukas Novak", handle: "Vortex", role: "AWPer / Sniper", avatar: "/players/player2.jpg", specialty: "Entry Kills & Reflexes" },
    { name: "Sarah Lin", handle: "Shifter", role: "Entry Fragger", avatar: "/players/player3.jpg", specialty: "Site Entry & Aggression" },
    { name: "Alex Mercer", handle: "Cipher", role: "Lurker", avatar: "/players/player4.jpg", specialty: "Flanks & Map Control" },
    { name: "Jordan Brooks", handle: "Breaker", role: "Support", avatar: "/players/player5.jpg", specialty: "Utility & Retakes" }
  ];

  const valorantRoster: Player[] = [
    { name: "Elena Rostova", handle: "Specter", role: "Duelist (Jett)", avatar: "/players/player6.jpg", specialty: "Fragging & Dash Plays" },
    { name: "Kenji Sato", handle: "Phantom", role: "Initiator (Sova)", avatar: "/players/player7.jpg", specialty: "Recon & Info Gathering" },
    { name: "David Miller", handle: "Vandal", role: "Sentinel (Killjoy)", avatar: "/players/player8.jpg", specialty: "Site Hold & Setups" },
    { name: "Zoe Dubois", handle: "Operator", role: "Controller (Omen)", avatar: "/players/player9.jpg", specialty: "Smokes & Shrouded Steps" },
    { name: "Marcus Reed", handle: "Odin", role: "Flex (KAY/O)", avatar: "/players/player10.jpg", specialty: "Flashes & Suppression" }
  ];

  const currentRoster = activeRoster === "cs2" ? cs2Roster : valorantRoster;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubscribeStatus("loading");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert([{ email }]);

      if (error) {
        if (error.code === "23505") {
          throw new Error("This email is already registered!");
        }
        throw error;
      }

      setSubscribeStatus("success");
      setEmail("");
    } catch (err: any) {
      console.error("Subscription error:", err);
      setSubscribeStatus("error");
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100 font-sans selection:bg-rose-500 selection:text-white overflow-x-hidden">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] right-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-[#050508]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-600 to-violet-600">
              BRENK<span className="text-zinc-400 font-light">//</span>ESPORTS
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
            <a href="#hero" className="hover:text-rose-500 transition-colors">Home</a>
            <a href="#schedule" className="hover:text-rose-500 transition-colors">Schedule</a>
            <a href="#roster" className="hover:text-rose-500 transition-colors">Roster</a>
            <a href="#newsletter" className="hover:text-rose-500 transition-colors">Join Clan</a>
          </nav>
          <div>
            <a
              href="#newsletter"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-violet-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-rose-900/20 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Join Roster
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative pt-24 pb-20 md:pt-32 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs font-semibold tracking-wider uppercase mb-8 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            Season 2026 Live Operations
          </div>
          <h1 className="text-5xl md:text-8xl font-extrabold tracking-tighter text-white uppercase mb-8">
            We Do Not Just Play.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-600 to-violet-600">
              We Dominate.
            </span>
          </h1>
          <p className="max-w-2xl text-zinc-400 text-base md:text-lg leading-relaxed mb-12">
            Brenk Esports is a premier competitive gaming organization. We forge elite tier-1 athletes, field championship-winning rosters, and push gaming boundaries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <a
              href="#schedule"
              className="px-8 py-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 hover:bg-zinc-800/80 text-white font-semibold text-sm uppercase tracking-wider transition-all duration-300"
            >
              Watch Matches
            </a>
            <a
              href="#newsletter"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 hover:brightness-110 text-white font-semibold text-sm uppercase tracking-wider shadow-lg shadow-rose-600/10 transition-all duration-300"
            >
              Newsletter Signup
            </a>
          </div>
        </div>
      </section>

      {/* Matches / Schedule Section */}
      <section id="schedule" className="py-24 border-t border-zinc-900 bg-zinc-950/30 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold tracking-widest text-rose-500 uppercase mb-3">Schedule</h2>
            <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase">Recent & Upcoming Matches</p>
          </div>
          
          <div className="grid gap-4">
            {matches.map((match) => (
              <div 
                key={match.id} 
                className="group relative overflow-hidden bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300"
              >
                {/* Active glow hover border */}
                <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-gradient-to-b group-hover:from-rose-500 group-hover:to-violet-600 transition-all duration-300" />
                
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="px-4 py-2 rounded-lg bg-zinc-950 font-bold text-xs uppercase tracking-widest text-zinc-400 group-hover:text-rose-500 transition-colors">
                    {match.game}
                  </div>
                  
                  <div className="text-center md:text-left">
                    <span className="text-zinc-500 text-xs font-semibold tracking-wider block uppercase mb-1">vs Opponent</span>
                    <span className="text-xl font-bold text-white uppercase group-hover:text-zinc-200 transition-colors">
                      {match.opponent}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center md:text-right">
                    <span className="text-zinc-500 text-xs font-semibold tracking-wider block uppercase mb-1">{match.date}</span>
                    <span className="text-sm font-semibold text-zinc-300">{match.time || match.result}</span>
                  </div>

                  <div>
                    {match.status === "LIVE" ? (
                      <span className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-widest uppercase animate-pulse flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        LIVE
                      </span>
                    ) : match.status === "UPCOMING" ? (
                      <span className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-black tracking-widest uppercase">
                        UPCOMING
                      </span>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-md text-[10px] font-black tracking-widest uppercase ${match.result?.startsWith("W") ? "bg-emerald-950/80 text-emerald-400" : "bg-zinc-900 text-zinc-500"}`}>
                        ENDED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roster Section */}
      <section id="roster" className="py-24 border-t border-zinc-900 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16">
            <div>
              <h2 className="text-xs font-bold tracking-widest text-rose-500 uppercase mb-3 text-center md:text-left">Elite Roster</h2>
              <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase text-center md:text-left">Meet Our Athletes</p>
            </div>
            
            <div className="flex p-1 rounded-xl bg-zinc-950 border border-zinc-900">
              <button 
                onClick={() => setActiveRoster("cs2")}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeRoster === "cs2" ? "bg-rose-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                CS2
              </button>
              <button 
                onClick={() => setActiveRoster("valorant")}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeRoster === "valorant" ? "bg-rose-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                VALORANT
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {currentRoster.map((player, idx) => (
              <div 
                key={idx} 
                className="group relative bg-[#09090e] border border-zinc-900 hover:border-rose-500/20 rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-1"
              >
                {/* Visual Avatar Placeholder with gradient */}
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-rose-500/20 to-violet-500/20 flex items-center justify-center mb-6 relative overflow-hidden group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-black text-rose-500 uppercase">
                    {player.handle[0]}
                  </span>
                  <div className="absolute inset-0 border border-rose-500/20 rounded-full" />
                </div>
                
                <h3 className="text-xs text-zinc-500 font-semibold tracking-wider uppercase mb-1">{player.name}</h3>
                <p className="text-xl font-extrabold text-white tracking-wide uppercase mb-2 group-hover:text-rose-500 transition-colors">
                  &quot;{player.handle}&quot;
                </p>
                <div className="h-px bg-zinc-900 my-4" />
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{player.role}</p>
                <p className="text-[10px] text-rose-400/80 uppercase tracking-wider font-semibold">{player.specialty}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup (Supabase connection) */}
      <section id="newsletter" className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-zinc-900/60 to-[#07070a] border border-zinc-900 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
          
          {/* Inner ambient light */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/10 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-600/10 rounded-full blur-[60px] pointer-events-none" />

          <h2 className="text-xs font-bold tracking-widest text-rose-500 uppercase mb-3">Join The Clan</h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase mb-4">Get Brenk Esports Updates</h3>
          <p className="max-w-lg mx-auto text-zinc-400 text-sm md:text-base leading-relaxed mb-8">
            Stay in the loop with tournament brackets, roster changes, live matches, and limited edition merch drops. Sign up to our newsletter.
          </p>

          <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              disabled={subscribeStatus === "loading"}
              className="flex-1 bg-zinc-950 border border-zinc-900 focus:border-rose-500/60 rounded-xl px-5 py-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={subscribeStatus === "loading"}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-violet-600 text-white font-bold text-xs uppercase tracking-widest shadow-md shadow-rose-950/30 transition-all duration-300 disabled:opacity-50 flex items-center justify-center"
            >
              {subscribeStatus === "loading" ? "Registering..." : "Subscribe"}
            </button>
          </form>

          {subscribeStatus === "success" && (
            <div className="mt-6 text-sm text-emerald-400 font-semibold uppercase tracking-wider animate-fade-in">
              ✓ Welcome to the roster! You&apos;ve successfully subscribed.
            </div>
          )}

          {subscribeStatus === "error" && (
            <div className="mt-6 text-sm text-rose-400 font-semibold uppercase tracking-wider animate-fade-in">
              ✕ {errorMessage}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-950 bg-[#030306] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-zinc-600 text-xs font-bold tracking-widest uppercase">
            &copy; 2026 BRENK ESPORTS. ALL RIGHTS RESERVED.
          </div>
          <div className="flex gap-6 text-xs font-bold tracking-wider text-zinc-500 uppercase">
            <a href="#" className="hover:text-rose-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-rose-500 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-rose-500 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
