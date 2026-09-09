/** Landing scene that hosts the FAQ and the release-notes signup. */
export const QUESTIONS_SECTION_ID = "questions";

export type SubscribeResponse =
  | { status: "check_inbox" }
  | { status: "error"; code: "invalid" | "rate_limited" | "unavailable"; message: string };
