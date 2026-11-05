import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres.mnnecoyqofhrivxufhqm:Face%4020269970@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  },
});
