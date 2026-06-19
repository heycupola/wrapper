import { z } from "zod";

export const SessionIdSchema = z.string().min(1).max(64);
export type SessionId = z.infer<typeof SessionIdSchema>;

export const SessionStatusSchema = z.enum(["idle", "running", "exiting", "closed"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const TerminalSizeSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export type TerminalSize = z.infer<typeof TerminalSizeSchema>;
