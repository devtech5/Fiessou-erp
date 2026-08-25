# Fiessou

ERP et point de vente pour l'Afrique de l'Ouest francophone. Marché prioritaire :
la Côte d'Ivoire.

La caisse encaisse sans connexion et se synchronise au retour du réseau. Les
référentiels fiscaux et sociaux sont ceux du pays de l'entreprise, pas d'un
pays voisin.

## Démarrer

Prérequis : Node 22+, pnpm, Docker.

```bash
cp .env.example .env.local
```

Renseigner `AUTH_SECRET` dans `.env.local` :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Lancer la base, appliquer le schéma, démarrer :

```bash
docker compose up -d
pnpm db:migrate
pnpm dev
```

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
