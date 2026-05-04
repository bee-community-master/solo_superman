import { z } from "zod";

export const IdStringSchema = z.string().min(1);
export const StateVersionSchema = z.number().int().nonnegative();
export const ProjectionVersionSchema = z.number().int().nonnegative();
export const SchemaVersionSchema = z.string().min(1);
