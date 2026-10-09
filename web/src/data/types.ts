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

export interface TicketSet {
  id: string;
  label: string;
  pages: string[];
}

export interface GuideAttachment {
  id: string;
  label: string;
  pages: string[];
}

/** Event / schedule stop. Only time + title are required for admin creates. */
export interface ItineraryStop {
  id: string;
  time: string;
  title: string;
  /** Stored duration; UI only for transit. */
  duration: string;
  cost: string | null;
  notes: string | null;
  mapsUrl: string | null;
  bookingRef: string | null;
  bags: string | null;
  transit: string | null;
  /** Primary guide id (legacy); prefer guideIds when present. */
  siteId: string | null;
  /** One or more guides linked to this stop. */
  guideIds?: string[];
  /** Labeled ticket sets (PDF pages converted to JPEG). */
  tickets?: TicketSet[];
  /** Venue map image pages. */
  mapPages?: string[];
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
  /** Hidden in UI when null or name empty. */
  food: FoodFocus | null;
  highlights: DayHighlight[];
  stops: ItineraryStop[];
}

export interface Itinerary {
  title: string;
  days: ItineraryDay[];
}

/** Guide (formerly "site") — multi-guide per stop supported via guideIds. */
export interface Site {
  id: string;
  name: string;
  aliases: string[];
  logistics: string[];
  proTips: string[];
  history: string[];
  route: string[];
  attachments?: GuideAttachment[];
}

export type Sites = Site[];

export interface SiteAssets {
  photo?: string;
  /** @deprecated prefer stop.mapPages */
  map?: string[];
}

export interface Assets {
  sites: Record<string, SiteAssets>;
  /** @deprecated prefer stop.tickets — kept for pack migration fallback */
  tickets?: Record<string, string[]>;
  /** @deprecated prefer stop.mapPages — kept for pack migration fallback */
  maps?: Record<string, string[]>;
}
