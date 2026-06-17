import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const isRealSupabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  username: string;
  pin: string;
  is_admin: boolean;
}

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff: string; // ISO String
  status: "scheduled" | "live" | "completed";
  group_stage: string;
}

export interface Prediction {
  id: string;
  profile_id: string;
  match_id: string;
  home_prediction: number;
  away_prediction: number;
  points_awarded: number | null;
}

// Fallback seed profiles
const SEED_PROFILES: Profile[] = [
  { id: "prof-admin", username: "Nathan (Admin)", pin: "1234", is_admin: true },
  { id: "prof-user1", username: "Alex", pin: "1111", is_admin: false },
  { id: "prof-user2", username: "Jordan", pin: "2222", is_admin: false },
  { id: "prof-user3", username: "Taylor", pin: "3333", is_admin: false }
];

// Fallback seed predictions
const SEED_PREDICTIONS: Prediction[] = [
  { id: "pred-1", profile_id: "prof-user1", match_id: "match-2026-1", home_prediction: 1, away_prediction: 1, points_awarded: null }
];

// Seed matches backup (in case the network fetch is offline)
const BACKUP_SEED_MATCHES: Match[] = [
  {
    id: "match-2026-1",
    home_team: "Mexico",
    away_team: "South Africa",
    home_score: null,
    away_score: null,
    kickoff: "2026-06-11T19:00:00Z",
    status: "scheduled",
    group_stage: "Group A"
  },
  {
    id: "match-2026-2",
    home_team: "Canada",
    away_team: "Bosnia and Herzegovina",
    home_score: null,
    away_score: null,
    kickoff: "2026-06-12T19:00:00Z",
    status: "scheduled",
    group_stage: "Group B"
  },
  {
    id: "match-2026-3",
    home_team: "United States",
    away_team: "Paraguay",
    home_score: null,
    away_score: null,
    kickoff: "2026-06-13T01:00:00Z",
    status: "scheduled",
    group_stage: "Group D"
  }
];

const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
};

const setLocalStorage = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Auto fetch World Cup 2026 matches list from public fixtures JSON API
const fetchAndSeedMatches = async (): Promise<Match[]> => {
  try {
    const res = await fetch("https://thestatsapi.com/world-cup/data/fixtures.json");
    if (!res.ok) throw new Error("Failed to load schedule from Open API");
    const data = await res.json();
    if (data && Array.isArray(data.fixtures)) {
      // Filter for group-stage matches of World Cup 2026
      const groupFixtures = data.fixtures.filter(
        (f: any) => f.stage === "group-stage" || f.stage === "group"
      );

      const mappedMatches: Match[] = groupFixtures.map((f: any) => ({
        id: `match-2026-${f.matchNumber}`,
        home_team: f.homeTeam,
        away_team: f.awayTeam,
        home_score: null,
        away_score: null,
        kickoff: f.kickoffUtc,
        status: "scheduled",
        group_stage: f.group ? `Group ${f.group}` : "Group Stage"
      }));

      if (mappedMatches.length > 0) {
        setLocalStorage("wc_matches", mappedMatches);
        return mappedMatches;
      }
    }
  } catch (error) {
    console.error("Auto fetch fixtures failed, using backup seed schedule.", error);
  }
  return BACKUP_SEED_MATCHES;
};

export const db = {
  isFallback: () => !isRealSupabase,

  // Get Profiles
  getProfiles: async (): Promise<Profile[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("profiles").select("*");
        if (error) throw error;
        return data as Profile[];
      } catch (e) {
        console.error("Supabase failed, falling back to localStorage", e);
      }
    }
    return getLocalStorage("wc_profiles", SEED_PROFILES);
  },

  // Create Profile
  createProfile: async (username: string, pin: string, is_admin: boolean = false): Promise<Profile> => {
    const newProfile: Profile = {
      id: "prof-" + Math.random().toString(36).substring(2, 9),
      username,
      pin,
      is_admin
    };

    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("profiles").insert([newProfile]).select();
        if (error) throw error;
        return data[0] as Profile;
      } catch (e) {
        console.error("Supabase insert failed, falling back to localStorage", e);
      }
    }

    const profiles = getLocalStorage("wc_profiles", SEED_PROFILES);
    profiles.push(newProfile);
    setLocalStorage("wc_profiles", profiles);
    return newProfile;
  },

  // Update Profile
  updateProfile: async (profile: Profile): Promise<Profile> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("profiles").upsert([profile]).select();
        if (error) throw error;
        return data[0] as Profile;
      } catch (e) {
        console.error("Supabase update profile failed", e);
      }
    }

    const profiles = getLocalStorage("wc_profiles", SEED_PROFILES);
    const index = profiles.findIndex((p) => p.id === profile.id);
    if (index > -1) {
      profiles[index] = profile;
    }
    setLocalStorage("wc_profiles", profiles);
    return profile;
  },

  // Delete Profile
  deleteProfile: async (id: string): Promise<boolean> => {
    if (isRealSupabase) {
      try {
        const { error } = await supabase.from("profiles").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (e) {
        console.error("Supabase delete profile failed", e);
      }
    }

    const profiles = getLocalStorage("wc_profiles", SEED_PROFILES);
    const updated = profiles.filter((p) => p.id !== id);
    setLocalStorage("wc_profiles", updated);
    
    // Clean up predictions
    const predictions = getLocalStorage("wc_predictions", SEED_PREDICTIONS);
    const updatedPreds = predictions.filter((p) => p.profile_id !== id);
    setLocalStorage("wc_predictions", updatedPreds);

    return true;
  },

  // Get Matches (Loads from StatsAPI if local matches are empty)
  getMatches: async (): Promise<Match[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("matches").select("*").order("kickoff", { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          return data as Match[];
        }
      } catch (e) {
        console.error("Supabase failed, falling back to localStorage", e);
      }
    }

    // Local Storage check
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wc_matches");
      if (!stored) {
        const seeded = await fetchAndSeedMatches();
        return seeded;
      }
    }
    return getLocalStorage("wc_matches", BACKUP_SEED_MATCHES);
  },

  // Save/Update Match
  saveMatch: async (match: Match): Promise<Match> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("matches").upsert([match]).select();
        if (error) throw error;
        return data[0] as Match;
      } catch (e) {
        console.error("Supabase save match failed, falling back to localStorage", e);
      }
    }

    const matches = getLocalStorage("wc_matches", BACKUP_SEED_MATCHES);
    const index = matches.findIndex((m) => m.id === match.id);
    if (index > -1) {
      matches[index] = match;
    } else {
      matches.push(match);
    }
    setLocalStorage("wc_matches", matches);
    return match;
  },

  // Add a new match
  createMatch: async (home_team: string, away_team: string, kickoff: string, group_stage: string): Promise<Match> => {
    const newMatch: Match = {
      id: "match-" + Math.random().toString(36).substring(2, 9),
      home_team,
      away_team,
      home_score: null,
      away_score: null,
      kickoff,
      status: "scheduled",
      group_stage
    };

    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("matches").insert([newMatch]).select();
        if (error) throw error;
        return data[0] as Match;
      } catch (e) {
        console.error("Supabase insert match failed, falling back to localStorage", e);
      }
    }

    const matches = getLocalStorage("wc_matches", BACKUP_SEED_MATCHES);
    matches.push(newMatch);
    setLocalStorage("wc_matches", matches);
    return newMatch;
  },

  // Get Predictions
  getPredictions: async (): Promise<Prediction[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("predictions").select("*");
        if (error) throw error;
        return data as Prediction[];
      } catch (e) {
        console.error("Supabase failed, falling back to localStorage", e);
      }
    }
    return getLocalStorage("wc_predictions", SEED_PREDICTIONS);
  },

  // Save/Update Prediction
  savePrediction: async (profile_id: string, match_id: string, home_prediction: number, away_prediction: number): Promise<Prediction> => {
    const existingPredictions = getLocalStorage("wc_predictions", SEED_PREDICTIONS);
    const existing = existingPredictions.find((p) => p.profile_id === profile_id && p.match_id === match_id);

    const newPrediction: Prediction = {
      id: existing ? existing.id : "pred-" + Math.random().toString(36).substring(2, 9),
      profile_id,
      match_id,
      home_prediction,
      away_prediction,
      points_awarded: existing ? existing.points_awarded : null
    };

    if (isRealSupabase) {
      try {
        const { data, error } = await supabase
          .from("predictions")
          .upsert([
            {
              profile_id,
              match_id,
              home_prediction,
              away_prediction,
              points_awarded: newPrediction.points_awarded
            }
          ])
          .select();
        if (error) throw error;
        return data[0] as Prediction;
      } catch (e) {
        console.error("Supabase save prediction failed, falling back to localStorage", e);
      }
    }

    const index = existingPredictions.findIndex((p) => p.profile_id === profile_id && p.match_id === match_id);
    if (index > -1) {
      existingPredictions[index] = newPrediction;
    } else {
      existingPredictions.push(newPrediction);
    }
    setLocalStorage("wc_predictions", existingPredictions);
    return newPrediction;
  },

  // Recalculate points
  recalculatePoints: async (matchesList: Match[]): Promise<Prediction[]> => {
    const predictions = getLocalStorage("wc_predictions", SEED_PREDICTIONS);

    const updatedPredictions = predictions.map((pred) => {
      const match = matchesList.find((m) => m.id === pred.match_id);
      if (!match || match.home_score === null || match.away_score === null) {
        return { ...pred, points_awarded: null };
      }

      const homePred = pred.home_prediction;
      const awayPred = pred.away_prediction;
      const homeAct = match.home_score;
      const awayAct = match.away_score;

      if (homePred === homeAct && awayPred === awayAct) {
        return { ...pred, points_awarded: 3 };
      }

      const predDiff = homePred - awayPred;
      const actDiff = homeAct - awayAct;

      const predWinner = Math.sign(predDiff);
      const actWinner = Math.sign(actDiff);

      if (predWinner !== actWinner) {
        return { ...pred, points_awarded: 0 };
      }

      if (predDiff === actDiff) {
        return { ...pred, points_awarded: 2 };
      }

      return { ...pred, points_awarded: 1 };
    });

    if (isRealSupabase) {
      try {
        const { error } = await supabase.from("predictions").upsert(
          updatedPredictions.map((up) => ({
            id: up.id,
            profile_id: up.profile_id,
            match_id: up.match_id,
            home_prediction: up.home_prediction,
            away_prediction: up.away_prediction,
            points_awarded: up.points_awarded
          }))
        );
        if (error) throw error;
      } catch (e) {
        console.error("Supabase bulk recalculation failed, falling back to localStorage", e);
      }
    }

    setLocalStorage("wc_predictions", updatedPredictions);
    return updatedPredictions;
  }
};
