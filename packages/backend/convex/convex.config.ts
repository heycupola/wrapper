import { defineApp } from "convex/server";
import autumn from "@useautumn/convex/convex.config";
import resend from "@convex-dev/resend/convex.config.js";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(autumn);
app.use(resend);

export default app;
