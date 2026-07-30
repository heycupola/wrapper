import { GET as getInstaller } from "../install/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return getInstaller();
}
