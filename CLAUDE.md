@AGENTS.md

# Fiessou v2 — conventions

ERP pour l'Afrique de l'Ouest francophone. Marché prioritaire : **Côte d'Ivoire**.
Next.js (App Router) · TypeScript · PostgreSQL · Drizzle. La caisse fonctionne
hors connexion.

## Règles non négociables

### L'argent est un entier

Un montant est un entier, dans la plus petite unité de sa devise. Le franc CFA
n'a pas de subdivision : 2 900 XOF se stocke `2900`.

Jamais de flottant, y compris pour un total intermédiaire ou une moyenne.
Toute division passe par `divideMoney`, toute ventilation par `allocate` ou
`allocateByWeights` (`src/lib/money.ts`), qui garantissent que la somme des
parts retombe exactement sur le total.

### Rien n'existe hors d'une entreprise

Toute table métier porte `organization_id`. Aucune requête ne s'écrit sans
filtrer dessus. C'est la frontière d'isolation entre clients.

### Un utilisateur n'est pas une personne

Trois natures distinctes, jamais fusionnées :

| Table | Qui | Ce qu'elle porte |
|---|---|---|
| `users` | Celui qui ouvre le logiciel | Compte, rôle, permissions |
| `employees` | Salarié déclaré | Contrat, bulletin, CNPS, ITS |
| `workers` | Intervenant | Pointage, taux, bon de paiement |

Un maçon, un manœuvre, un tâcheron, un chauffeur occasionnel, un serveur extra
ou un coach n'ouvre jamais l'application et n'a pas de bulletin de paie. Il est
payé à la journée, à la tâche ou à l'unité d'œuvre. Le régime intervenant sert
au BTP, à la livraison, au maquis, au garage, au salon et à l'agriculture.

### Le hors-ligne se décide maintenant

Les identifiants sont produits par le client (`newId()`, UUID v7). Une vente
encaissée sans réseau porte déjà son identifiant définitif au moment où le
ticket s'imprime.

Toute table réplicable porte `version`, `updated_at` et `deleted_at` — une
suppression se réplique, donc elle est logique. Les écritures passent par
`sync_mutations` (idempotent, l'identifiant vient du client) et alimentent
`change_log` (ordonné, sert au rattrapage et à l'historique).

### Aucun référentiel étranger en dur

Le concurrent vend en Côte d'Ivoire des écrans calibrés pour le Sénégal :
NINEA, DGID, IPRES, CSS, TRIMF. Chez nous, l'identifiant fiscal, les organismes
sociaux, les taux et les déclarations viennent du pays de l'entreprise.
En Côte d'Ivoire : NCC, DGI, CNPS, ITS, IGR, TVA 18 %.

### Toute pièce est numérotée

Ticket, facture, devis, bon de transfert, contrat : numéro séquentiel, sans
trou ni doublon, via `document_sequences`. L'attribution se fait dans la
transaction qui crée la pièce, par `UPDATE ... RETURNING` — jamais un `SELECT`
suivi d'un `UPDATE`, sinon deux caisses simultanées produisent le même numéro.

Format issu du terrain (ticket SOCOCE, Yopougon) : `05-00066854/G` —
préfixe, compteur sur 8 chiffres, suffixe. D'où `prefix` / `padding` / `suffix`
plutôt qu'un format figé.

## Règles de modélisation

### Une ligne de vente peut en porter d'autres

Cas type : un magasin de pièces détachées vend une pièce, et le client demande
qu'elle soit montée. Le montage est facturé en plus.

Ce n'est pas un module. Une ligne de vente porte `parent_line_id` et un
`line_kind` parmi `article`, `prestation`, `frais`. La prestation est une ligne
fille rattachée à la pièce vendue.

Conséquences à respecter :

- La prestation pointe vers un article de **type service**, avec son propre prix
  et son propre compte comptable. Vente de marchandise et vente de service ne se
  ventilent pas sur le même compte SYSCOHADA, et leur régime de TVA peut différer.
- La prestation peut porter un exécutant (`worker_id`) et un coût de
  main-d'œuvre, sans quoi la marge réelle de l'opération est fausse.
- Supprimer la ligne mère supprime ses filles. Un montage sans pièce n'a pas de sens.
- Le ticket imprime la prestation sous sa pièce, en retrait.

Le même mécanisme sert au-delà des pièces détachées : meuble et assemblage,
climatiseur et installation, pneu et équilibrage, tissu et couture, matériaux
et transport sur chantier, bouteille de gaz et consigne.

### Tout objet créé peut porter un code scannable

Article, engin, ordinateur du parc, plat de la carte, modèle d'atelier,
employé, ticket, contrat, chambre, colis : chacun peut recevoir un ou plusieurs
codes via `entity_codes`.

- Plusieurs codes par entité, jamais une colonne unique. Un article porte l'EAN
  du fabricant **et** notre code interne ; les deux doivent répondre au scan.
- Le type suit l'usage : QR pour un badge ou un ticket, EAN-13 pour un produit
  du commerce, Code 128 pour une étiquette de rayon, NFC pour un accès.
- `token` est la clé de résolution universelle : un scan retrouve l'entité sans
  savoir d'avance de quel type d'objet il s'agit.
- La résolution doit marcher **sans réseau** quand l'appareil détient la donnée.
  `target_url` ne sert qu'au scan par un téléphone tiers — un client qui vérifie
  un reçu, un agent qui contrôle un badge.
- Un code se remplace sans toucher l'entité : étiquette abîmée, badge perdu.

C'est ce qui alimente les étiquettes de rayon, le code-barres en pied de ticket
et les cartes professionnelles personnalisées des employés.

## Structure

```
src/
  app/                 routes Next
  db/
    index.ts           connexion, pool mis en cache en développement
    schema/            socle transverse uniquement
  lib/                 money, ids — utilitaires sans dépendance métier
  modules/
    registry.ts        les 28 modules en 3 couches : socle, moteur, métier
```

Le schéma sous `db/schema` ne contient que le socle : entreprises, comptes,
droits, numérotation, audit, synchronisation. Les tables métier vivent dans
leur module et sont réexportées depuis `db/schema/index.ts`.

## Avant chaque commit

`pnpm lint`, `pnpm typecheck` **et** `pnpm test` doivent passer. Les trois, pas
l'un ou l'autre : le build Next réussit malgré des erreurs ESLint, et une
erreur est ainsi restée plusieurs jours dans le dépôt — `registry.ts`
assignait la variable réservée `module`.

Attention en vérifiant à la main : `pnpm verify | tail` renvoie le code de
`tail`, pas celui de pnpm. Un échec de lint y passe pour un succès. Rediriger
vers un fichier et lire `$?`.

`lint` tourne avec `--max-warnings 0` : un avertissement fait échouer le
commit. Sans cela le hook ne bloquait rien, puisque ESLint sort en code 0 tant
qu'il n'y a que des avertissements. L'arbre est à zéro aujourd'hui, il y reste.

C'est automatisé, pas laissé à la discipline. Le hook `.githooks/pre-commit`
lance les trois ; `pnpm install` configure `core.hooksPath` tout seul via le
script `prepare`. En cas d'urgence, `git commit --no-verify` passe outre.

Pour lancer les trois à la main : `pnpm verify`.

### Ce que les tests couvrent

Le **calcul**, et lui seul : l'argent, les quantités, la numérotation, le
réapprovisionnement. Une erreur d'affichage se voit ; un franc perdu par ligne,
non — il se découvre à la déclaration de TVA, six mois plus tard.

Les tests vivent dans `tests/`, tournent sous Vitest et ne touchent jamais la
base. Ce qui passe par PostgreSQL se vérifie contre une vraie base, avec ses
contraintes et sa numérotation : un test à double simulerait justement la
partie qui casse.

`vitest.config.mts` neutralise `server-only` — le paquet lève une exception
hors d'un bundler React, ce qui rendrait intestable un module serveur, y
compris ses fonctions purement arithmétiques. Même piège en ligne de commande :
un script `tsx` qui importe un tel module se lance avec
`npx tsx --conditions=react-server`.

## Commandes

```bash
pnpm dev                      # serveur de développement
pnpm dev:local                # idem, sur une base locale PGlite (.pglite/), sans PostgreSQL installé
pnpm verify                   # analyse statique + types + tests
pnpm test                     # tests unitaires seuls
pnpm test:watch               # les mêmes, en continu
pnpm db:generate              # génère la migration depuis le schéma
pnpm db:migrate               # applique les migrations
pnpm db:check                 # connexion, tables, RLS
pnpm db:studio                # inspecteur de base
```

Copier `.env.example` vers `.env.local` avant le premier démarrage.

## Les fichiers vivent dans un dépôt, pas dans la base

Le module Documents joint des pièces aux entités métier. Le fichier ne va pas
en base : il part dans Supabase Storage, et seule sa clé est stockée.

Tout passe par `src/lib/stockage/` — une interface, un adaptateur derrière,
comme `src/lib/auth/canaux/` pour l'envoi des codes. Le reste de l'application
ne connaît que l'interface. C'est ce qui garde la base portable vers n'importe
quel PostgreSQL malgré l'arrivée d'un SDK d'hébergeur.

**La clé employée contourne RLS sur tout le projet.** `SUPABASE_SERVICE_ROLE_KEY`
ne prend jamais de préfixe `NEXT_PUBLIC_` et ne se lit que dans un module
marqué `import "server-only"`. Dans le navigateur, elle donnerait l'écriture
sur toutes les entreprises.

**Le bucket est PRIVÉ.** Aucun lien direct ne fonctionne : chaque ouverture
passe par une URL signée valable cinq minutes, demandée au clic et jamais
rendue dans le HTML — une adresse posée dans une page en cache resterait
valable pour qui la retrouve.

Le chemin d'un fichier commence par l'identifiant de l'entreprise
(`<org>/<document>.<ext>`), pour qu'une policy de stockage puisse isoler sur le
préfixe comme `organization_id` isole les lignes.

Sans ces variables, le module reste utilisable : les fiches se créent, les
échéances se suivent, et seul l'ajout de pièce refuse en disant pourquoi.

## Base locale sans serveur : PGlite

`pnpm dev:local` démarre l'application sur PGlite, un vrai PostgreSQL compilé
en WebAssembly qui tourne dans le processus Node. Les données vivent dans
`.pglite/` (ignoré par git). Au démarrage, `instrumentation.ts` ouvre la base,
applique les migrations et recopie le catalogue des droits.

Deux limites à connaître : un seul processus ouvre le dossier (les scripts
`db:*` ne peuvent pas y accéder pendant que le serveur tourne), et
`db.execute` y rend `{ rows }` — `src/db/pglite.ts` le ramène au tableau que
rend postgres-js. Jamais en production.

Les pièces jointes (photos de projet, preuves de paiement, documents) vont
alors dans `.pglite/fichiers/` : `STOCKAGE_LOCAL` active un adaptateur disque
(`src/lib/stockage/local.ts`) servi par `/fichiers/…` avec une URL signée HMAC
qui expire, comme celle de Supabase. Ignoré en production.

Après un arrêt brutal pendant une installation, Turbopack peut servir des
404 sur toutes les routes : supprimer `.next/dev` et relancer.

## La base est sur Supabase

Le projet travaille directement sur Supabase, pas sur un PostgreSQL local. Le
`docker-compose.yml` reste fourni mais n'est pas la voie normale.

Deux conséquences à ne pas perdre de vue :

**Deux chaînes de connexion**, qui ne diffèrent que par le port. `DATABASE_URL`
sur **6543** pour l'application — pooler en mode transaction, d'où requêtes
préparées désactivées et pool ramené à 1. `DATABASE_URL_MIGRATION` sur **5432**
pour drizzle-kit, qui exige une session stable.

**RLS est actif sur les quinze tables** (migration 0001) et doit le rester.
Supabase expose une API REST sur le schéma `public`, lisible avec la clé
publiable — laquelle est publique par conception. Une table sans RLS y est
lisible par n'importe qui. Aucune policy n'est définie : Fiessou se connecte
directement avec un rôle propriétaire, qui contourne RLS, et l'isolation entre
entreprises reste assurée par le filtre `organization_id`.
