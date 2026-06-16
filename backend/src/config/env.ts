import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from the .env file in the backend root directory
dotenv.config({ path: path.join(__dirname, "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
