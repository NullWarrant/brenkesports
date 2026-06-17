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

// Seed matches
const SEED_MATCHES: Match[] = [
  {
    id: "match-1",
    home_team: "Argentina",
    away_team: "Saudi Arabia",
    home_score: 1,
    away_score: 2,
    kickoff: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    status: "completed",
    group_stage: "Group C"
  },
  {
    id: "match-2",
    home_team: "France",
    away_team: "Australia",
    home_score: 4,
    away_score: 1,
    kickoff: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    status: "completed",
    group_stage: "Group D"
  },
  {
    id: "match-3",
    home_team: "Germany",
    away_team: "Japan",
    home_score: 1,
    away_score: 2,
    kickoff: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    status: "completed",
    group_stage: "Group E"
  },
  {
    id: "match-4",
    home_team: "Spain",
    away_team: "Costa Rica",
    home_score: 3,
    away_score: 0,
    kickoff: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Live: started 15 mins ago
    status: "live",
    group_stage: "Group E"
  },
  {
    id: "match-5",
    home_team: "Brazil",
    away_team: "Serbia",
    home_score: null,
    away_score: null,
    kickoff: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // Upcoming: starts in 45 mins (LOCKED soon)
    status: "scheduled",
    group_stage: "Group G"
  },
  {
    id: "match-6",
    home_team: "Portugal",
    away_team: "Ghana",
    home_score: null,
    away_score: null,
    kickoff: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Upcoming: starts in 2 hours
    status: "scheduled",
    group_stage: "Group H"
  },
  {
    id: "match-7",
    home_team: "England",
    away_team: "USA",
    home_score: null,
    away_score: null,
    kickoff: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow
    status: "scheduled",
    group_stage: "Group B"
  },
  {
    id: "match-8",
    home_team: "Poland",
    away_team: "Mexico",
    home_score: null,
    away_score: null,
    kickoff: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(), // Tomorrow
    status: "scheduled",
    group_stage: "Group C"
  }
];

// Seed profiles
const SEED_PROFILES: Profile[] = [
  { id: "prof-admin", username: "Nathan (Admin)", pin: "1234", is_admin: true },
  { id: "prof-user1", username: "Alex", pin: "1111", is_admin: false },
  { id: "prof-user2", username: "Jordan", pin: "2222", is_admin: false },
  { id: "prof-user3", username: "Taylor", pin: "3333", is_admin: false }
];

// Seed predictions
const SEED_PREDICTIONS: Prediction[] = [
  // Alex predictions
  { id: "pred-1", profile_id: "prof-user1", match_id: "match-1", home_prediction: 2, away_prediction: 1, points_awarded: 0 }, // Wrong winner
  { id: "pred-2", profile_id: "prof-user1", match_id: "match-2", home_prediction: 3, away_prediction: 1, points_awarded: 2 }, // Correct winner + goal difference (diff +2)
  { id: "pred-3", profile_id: "prof-user1", match_id: "match-3", home_prediction: 1, away_prediction: 2, points_awarded: 3 }, // Exact match
  
  // Jordan predictions
  { id: "pred-4", profile_id: "prof-user2", match_id: "match-1", home_prediction: 1, away_prediction: 2, points_awarded: 3 }, // Exact match
  { id: "pred-5", profile_id: "prof-user2", match_id: "match-2", home_prediction: 2, away_prediction: 1, points_awarded: 1 }, // Correct winner, wrong diff
  { id: "pred-6", profile_id: "prof-user2", match_id: "match-3", home_prediction: 2, away_prediction: 0, points_awarded: 0 }  // Wrong winner
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

export const db = {
  // Check if we are using localStorage
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

  // Get Matches
  getMatches: async (): Promise<Match[]> => {
    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.from("matches").select("*").order("kickoff", { ascending: true });
        if (error) throw error;
        return data as Match[];
      } catch (e) {
        console.error("Supabase failed, falling back to localStorage", e);
      }
    }
    return getLocalStorage("wc_matches", SEED_MATCHES);
  },

  // Save/Update Match (Admin)
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

    const matches = getLocalStorage("wc_matches", SEED_MATCHES);
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

    const matches = getLocalStorage("wc_matches", SEED_MATCHES);
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

  // Recalculate all points for predictions based on current match scores (Admin)
  recalculatePoints: async (matchesList: Match[]): Promise<Prediction[]> => {
    const predictions = getLocalStorage("wc_predictions", SEED_PREDICTIONS);

    const updatedPredictions = predictions.map((pred) => {
      const match = matchesList.find((m) => m.id === pred.match_id);
      if (!match || match.home_score === null || match.away_score === null) {
        return { ...pred, points_awarded: null };
      }

      // Compute points based on the rules:
      const homePred = pred.home_prediction;
      const awayPred = pred.away_prediction;
      const homeAct = match.home_score;
      const awayAct = match.away_score;

      // Rule 1: Exact Score -> 3 points
      if (homePred === homeAct && awayPred === awayAct) {
        return { ...pred, points_awarded: 3 };
      }

      const predDiff = homePred - awayPred;
      const actDiff = homeAct - awayAct;

      const predWinner = Math.sign(predDiff);
      const actWinner = Math.sign(actDiff);

      // Rule 4: Incorrect Outcome -> 0 points
      if (predWinner !== actWinner) {
        return { ...pred, points_awarded: 0 };
      }

      // Rule 2: Correct Outcome + Correct Goal Difference -> 2 points
      if (predDiff === actDiff) {
        return { ...pred, points_awarded: 2 };
      }

      // Rule 3: Correct Outcome + Wrong Goal Difference -> 1 point
      return { ...pred, points_awarded: 1 };
    });

    if (isRealSupabase) {
      try {
        // Upsert all updated predictions
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
