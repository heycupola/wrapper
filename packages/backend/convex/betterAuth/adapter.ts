import { createApi } from "@convex-dev/better-auth";
import { createAuth } from "../auth";
import schema from "./schema";

const createAuthOptions = (ctx: unknown) => createAuth(ctx as never).options;

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, createAuthOptions);
