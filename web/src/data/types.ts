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

/**
 * Event / schedule stop — time + linked site (+ option branching).
 * All place/visit attributes live on Site.
 */
export interface ItineraryStop {
  id: string;
  time: string;
  /** Linked guide / site (required after migration). */
  siteId: string | null;
  optionGroup: string | null;
  optionLabel: string | null;
  primary: boolean;
  /** Timed entry ticket / dinner reservation — call out in the timeline. */
  timedEntry?: boolean;
}

/** Day-level Google Maps (or similar) route link — multiple allowed per day. */
export interface DayMapLink {
  id: string;
  label: string;
  url: string;
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
  /** Multi-stop day walking / driving maps. */
  mapsUrls?: DayMapLink[];
  /** Display order of option labels for this day (overrides first-appearance order). */
  optionOrder?: string[];
  highlights: DayHighlight[];
  stops: ItineraryStop[];
}

export interface Itinerary {
  title: string;
  days: ItineraryDay[];
}

/** Guide (formerly "site") — owns all visit attributes; events only schedule them. */
export interface Site {
  id: string;
  name: string;
  kind: StopKind;
  /**
   * Optional duration override — editable only for transit (flights, long rail).
   * Timeline always shows override if set, else the span to the next event.
   */
  duration: string;
  /** Opening hours; UI for meal + attraction. */
  hours: string | null;
  cost: string | null;
  /** Short description / blurb (rich text). */
  summary: string | null;
  mapsUrl: string | null;
  bookingRef: string | null;
  bags: string[];
  transit: string | null;
  /** Meal-only: atmosphere / vibe lines. */
  vibe?: string[];
  /** Meal-only: dishes / must-try lines. */
  mustTry?: string[];
  /** Labeled ticket sets (PDF pages converted to JPEG). */
  tickets?: TicketSet[];
  /** Venue map image pages. */
  mapPages?: string[];
  /** Freeform note bullets; drag into logistics / proTips / etc. */
  notes: string[];
  logistics: string[];
  proTips: string[];
  history: string[];
  route: string[];
  attachments?: GuideAttachment[];
}

export type Sites = Site[];

export interface SiteAssets {
  photo?: string;
  /** @deprecated prefer site.mapPages */
  map?: string[];
}

export interface Assets {
  sites: Record<string, SiteAssets>;
  /** @deprecated prefer site.tickets — kept for pack migration fallback */
  tickets?: Record<string, string[]>;
  /** @deprecated prefer site.mapPages — kept for pack migration fallback */
  maps?: Record<string, string[]>;
}
