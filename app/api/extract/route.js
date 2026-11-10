import { guard, json } from "@/lib/route";
import { extractFile } from "@/lib/extract";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = guard(null, async (req) => json(await extractFile((await req.formData()).get("file"))));
