import { z } from "zod";

/**
 * Configuration lue depuis l'environnement.
 *
 * La validation est PARESSEUSE, déclenchée au premier accès et non au
 * chargement du module. C'est délibéré : `next build` évalue les modules pour
 * collecter les routes, sans que les variables d'exécution soient forcément
 * présentes. Valider au chargement ferait échouer la compilation d'un
 * déploiement par ailleurs correct.
 *
 * Au premier accès réel — donc à la première requête — une configuration
 * incomplète échoue bruyamment, avec le détail de ce qui manque.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  DEFAULT_COUNTRY: z.string().length(2).default("CI"),
  OTP_CHANNEL: z.enum(["console", "sms", "whatsapp"]).default("console"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

function resolve(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  · ${issue.path.join(".")} — ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuration invalide.\n${details}\n\n` +
        "En local : copiez .env.example vers .env.local et complétez.\n" +
        "En déploiement : renseignez ces variables dans les réglages du projet.",
    );
  }

  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as Env, {
  get: (_target, key: string) => resolve()[key as keyof Env],
  has: (_target, key: string) => key in resolve(),
  ownKeys: () => Reflect.ownKeys(resolve()),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
