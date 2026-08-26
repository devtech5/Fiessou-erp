# Fiessou

ERP et point de vente pour l'Afrique de l'Ouest francophone. Marché prioritaire :
la Côte d'Ivoire.

La caisse encaisse sans connexion et se synchronise au retour du réseau. Les
référentiels fiscaux et sociaux sont ceux du pays de l'entreprise, pas d'un
pays voisin.

## Démarrer

Prérequis : Node 22+ et pnpm. La base est hébergée sur Supabase — il n'y a rien
à installer localement.

```bash
pnpm install
```

Copier `.env.example` vers `.env.local`, puis y renseigner les deux chaînes de
connexion Supabase (`Settings → Database → Connection string`) et une clé de
signature :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Les deux chaînes ne diffèrent que par le port : **6543** pour l'application,
**5432** pour les migrations. Elles ne sont pas interchangeables — un pooler en
mode transaction rend la connexion après chaque requête, alors qu'une migration
exige une session stable.

Appliquer le schéma, contrôler, démarrer :

```bash
pnpm db:migrate
pnpm db:check
pnpm dev
```

`db:check` vérifie la connexion, la présence des quinze tables du socle et
l'activation de la sécurité au niveau ligne sur chacune.

Un `docker-compose.yml` reste fourni pour un PostgreSQL local, mais ce n'est pas
la voie normale du projet.

## Architecture

Trois couches, décrites dans `src/modules/registry.ts` :

- **Socle** — commun à tout métier : tiers et commercial, catalogue et stock,
  ventes et encaissement, comptabilité, personnes et rémunération, documents.
- **Moteurs** — construits une fois, servis à plusieurs métiers : actifs et
  maintenance, réservation de ressource, missions et terrain, billetterie,
  valeur électronique.
- **Métiers** — préréglages posés sur le socle et les moteurs : boutique,
  maquis, kiosque mobile money, garage, BTP, hôtellerie, location, transport,
  livraison, flotte, fitness, projet, collecte terrain.

Le schéma sous `src/db/schema` ne contient que le socle transverse :
entreprises, comptes, droits, numérotation des pièces, journal d'audit et
synchronisation hors connexion. Les tables métier vivent dans leur module.

Les conventions de code et les règles de modélisation sont dans
[CLAUDE.md](./CLAUDE.md) — notamment le traitement des montants, la séparation
entre comptes de connexion et personnes métier, et le fonctionnement hors
connexion.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm lint` | Analyse statique |
| `pnpm typecheck` | Vérification des types |
| `pnpm db:generate` | Génère une migration à partir du schéma |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:studio` | Inspecteur de base |

## Quand ça casse en production

Toute erreur serveur part sur la sortie d'erreur, en une ligne JSON portant
`"evenement":"erreur_requete"`. Render conserve ce flux : c'est le journal, et
il se filtre sur ce champ.

L'écran d'erreur affiche un `digest` — dix chiffres. C'est la même valeur que
la ligne de journal. Quelqu'un le lit au téléphone, on cherche ce nombre dans
les journaux, et on tombe sur la pile d'appels exacte plutôt que sur une heure
approximative.

Les en-têtes de requête ne sont **jamais** journalisés : ils portent le cookie
de session, donc un jeton valide.

Trois frontières, parce que la question posée n'est pas la même selon l'écran :

| Fichier | Ce qui a échoué | Ce qu'il répond |
|---|---|---|
| `src/app/(gestion)/error.tsx` | un module | le reste du logiciel fonctionne |
| `src/app/caisse/error.tsx` | la caisse | aucune vente n'est perdue |
| `src/app/global-error.tsx` | la coque racine | le service, pas vos données |

Pour vérifier la chaîne de bout en bout, il faut un build de production —
`digest` n'existe pas en développement, et l'overlay de Next masque la
frontière.
