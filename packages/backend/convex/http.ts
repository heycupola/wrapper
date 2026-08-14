import { httpRouter } from "convex/server";
import { receive as receiveAppleNotification } from "./appleNotificationsHttp.ts";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

http.route({
  path: "/api/auth/apple/notifications",
  method: "POST",
  handler: receiveAppleNotification,
});
authComponent.registerRoutes(http, createAuth);

export default http;
