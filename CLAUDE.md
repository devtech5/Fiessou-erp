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

## Commandes

```bash
docker compose up -d          # PostgreSQL local
pnpm dev                      # serveur de développement
pnpm db:generate              # génère la migration depuis le schéma
pnpm db:migrate               # applique les migrations
pnpm db:studio                # inspecteur de base
```

Copier `.env.example` vers `.env.local` avant le premier démarrage.
