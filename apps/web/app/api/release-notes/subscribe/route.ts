import {
  clampString,
  convexClient,
  failureResponse,
  intakeContext,
  intakeFailure,
  readJsonBody,
  subscribeRef,
} from "../../../../lib/intake-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body) {
    return failureResponse({ code: "invalid", message: "Malformed request.", status: 400 });
  }

  const client = convexClient();
  if (!client) {
    return failureResponse({
      code: "unavailable",
      message: "Signups are not configured on this deployment.",
      status: 503,
    });
  }

  try {
    const result = await client.mutation(subscribeRef, {
      ...intakeContext(request, body),
      email: clampString(body.email, 320),
    });
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(intakeFailure(error));
  }
}
