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
  /**
   * Acheminement des codes de connexion.
   *
   * `demo` affiche le code À L'ÉCRAN au lieu de l'envoyer. C'est ce qui rend une
   * instance de démonstration utilisable sans opérateur SMS — et c'est aussi ce
   * qui l'ouvre à quiconque connaît un numéro. Réservé aux instances sans
   * données réelles.
   */
  OTP_CHANNEL: z.enum(["console", "demo", "sms", "whatsapp"]).default("console"),

  /**
   * Identifiants WhatsApp Cloud API, requis quand `OTP_CHANNEL=whatsapp`.
   *
   * Facultatifs dans le schéma, exigés par `verifierCanal` : une instance de
   * démonstration n'a pas de compte Meta, et lui imposer ces variables la
   * rendrait indémarrable.
   *
   * `WHATSAPP_TOKEN` est un jeton permanent d'utilisateur système, pas le
   * jeton de test de la console — ce dernier expire au bout de vingt-quatre
   * heures, et la connexion tomberait un matin sans que rien n'ait changé.
   */
  WHATSAPP_TOKEN: z.string().optional(),
  /** Identifiant du numéro expéditeur, pas le numéro lui-même. */
  WHATSAPP_PHONE_ID: z.string().optional(),
  /** Nom du gabarit d'authentification approuvé par Meta. */
  WHATSAPP_TEMPLATE: z.string().default("fiessou_code"),
  /** Langue du gabarit. Doit correspondre EXACTEMENT à celle approuvée. */
  WHATSAPP_LANGUE: z.string().default("fr"),
  /**
   * Version de l'API Graph. Épinglée : Meta retire les anciennes versions au
   * bout de deux ans, et une montée de version doit être un geste, pas une
   * surprise un lundi matin.
   */
  WHATSAPP_VERSION: z.string().default("v25.0"),

  /**
   * Dépôt de fichiers — Supabase Storage.
   *
   * Facultatifs : sans eux, la bibliothèque de documents se lit toujours, et
   * seul l'ajout de fichier refuse en disant pourquoi. Une variable oubliée ne
   * doit pas fermer un module entier.
   *
   * `SUPABASE_SERVICE_ROLE_KEY` CONTOURNE RLS sur tout le projet. Aucun
   * préfixe `NEXT_PUBLIC_`, aucune lecture hors d'un module `server-only` : une
   * clé de ce niveau dans le navigateur donne l'écriture sur toutes les
   * entreprises.
   */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Bucket PRIVÉ. Public, il rendrait tout contrat lisible par qui devine l'URL. */
  SUPABASE_BUCKET: z.string().default("documents"),

  /**
   * Modules à ouvrir malgré leurs écrans sur jeu d'essai.
   *
   * Clés du registre séparées par des virgules, ou `*` pour toutes. Renseignée,
   * elle fait foi partout — c'est ainsi qu'on voit en développement ce que le
   * client verra. Vide, le développement ouvre tout et la production ne s'ouvre
   * à rien, quoi qu'en dise le rôle.
   *
   * Sert à l'instance de démonstration, où montrer la suite du périmètre est
   * l'objet même de la visite — et nulle part ailleurs. Sur une instance qui
   * porte de vraies recettes, cette variable reste vide.
   */
  MODULES_APERCU: z.string().default(""),
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
