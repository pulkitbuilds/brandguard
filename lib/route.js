import { NextResponse } from "next/server";
import { authUser } from "./auth";

export const json = (d, status = 200) => NextResponse.json(d, { status });
// Wraps a handler: requires sign-in, optionally restricts to roles, turns thrown errors into JSON.
export const guard = (roles, fn) => async (req, ctx) => {
  try {
    const u = await authUser(req);
    if (!u) return json({ error: "Not signed in" }, 401);
    if (roles && !roles.includes(u.role)) return json({ error: "Your role cannot do this" }, 403);
    return await fn(req, u, ctx ? { id: (await ctx.params)?.id } : {});
  } catch (e) {
    return json({ error: e.message || "Server error" }, e.status || 500);
  }
};
