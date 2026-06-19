import { createAuth } from "../auth";

type StaticAuthCtx = Parameters<typeof createAuth>[0];

const staticAuth = createAuth({} as StaticAuthCtx);

export const auth = staticAuth;
export const authOptions = staticAuth.options;
