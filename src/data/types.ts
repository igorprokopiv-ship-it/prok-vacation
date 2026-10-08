/** Types for Offline EU2026 Trip Companion data files. */

export type DayType = "transit" | "activity";

export type StopKind =
  | "attraction"
  | "transit"
  | "meal"
  | "hotel"
  | "show"
  | "photo"
  | "shopping"
  | "rest";

export interface FoodFocus {
  name: string;
  vibe: string;
  mustTry: string;
  hours: string | null;
  cost: string | null;
}

export interface DayHighlight {
  stopId: string;
  title: string;
  time: string;
  duration: string;
  summary: string;
}

export interface ItineraryStop {
  id: string;
  time: string;
  title: string;
  duration: string;
  hours: string | null;
  cost: string | null;
  notes: string | null;
  mapsUrl: string | null;
  bookingRef: string | null;
  bags: string | null;
  transit: string | null;
  siteId: string | null;
  optionGroup: string | null;
  optionLabel: string | null;
  primary: boolean;
  kind: StopKind;
}

export interface ItineraryDay {
  id: string;
  date: string;
  dateLabel: string;
  navLabel: string;
  city: string;
  type: DayType;
  headline: string;
  briefing: string;
  weather: string | null;
  sunrise: string | null;
  sunset: string | null;
  heroImage: string | null;
  food: FoodFocus;
  highlights: DayHighlight[];
  stops: ItineraryStop[];
}

export interface Itinerary {
  title: string;
  days: ItineraryDay[];
}

export interface Site {
  id: string;
  name: string;
  aliases: string[];
  logistics: string[];
  proTips: string[];
  history: string[];
  route: string[];
}

export type Sites = Site[];

export interface SiteAssets {
  photo?: string;
  map?: string[];
}

export interface Assets {
  sites: Record<string, SiteAssets>;
  tickets: Record<string, string[]>;
  maps: Record<string, string[]>;
}
