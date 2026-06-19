import { defineApp } from "convex/server";
import autumn from "@useautumn/convex/convex.config";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(autumn);

export default app;
