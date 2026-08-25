import { z } from "zod";

/**
 * Configuration lue depuis l'environnement, validée au démarrage.
 * Un démarrage doit échouer bruyamment plutôt que fonctionner à moitié.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  DEFAULT_COUNTRY: z.string().length(2).default("CI"),
  OTP_CHANNEL: z.enum(["console", "sms", "whatsapp"]).default("console"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")} — ${issue.message}`)
    .join("\n");
  throw new Error(
    `Configuration invalide. Copiez .env.example vers .env.local et complétez :\n${details}`,
  );
}

export const env = parsed.data;
