# Déployer Fiessou sur un VPS

Une seule machine porte tout : l'application (Node, image Docker), PostgreSQL,
Caddy pour le HTTPS automatique, et un service de sauvegarde. Rien d'autre à
louer.

## Ce qu'il faut

- Un VPS Linux (Ubuntu 24.04 ou Debian 12), **2 Go de RAM minimum**, 4 Go
  conseillés, 40 Go de disque. La construction de l'image est le moment le
  plus gourmand.
- Un nom de domaine dont l'enregistrement **A** pointe vers l'IP du VPS
  (ex. `app.fiessou.ci`). Caddy obtient le certificat tout seul, à condition
  que le DNS réponde déjà.
- Les ports **80 et 443** ouverts. Le port 22 pour SSH. Rien d'autre :
  PostgreSQL n'est publié sur aucun port.

## Première installation

```bash
# 1. Docker (script officiel)
curl -fsSL https://get.docker.com | sh

# 2. Le code
git clone https://github.com/devtech5/Fiessou-erp.git fiessou
cd fiessou

# 3. La configuration
cp deploiement/env.production.exemple .env.production
nano .env.production        # DOMAINE, POSTGRES_PASSWORD, AUTH_SECRET au minimum

# 4. Démarrage
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Au démarrage, l'application applique elle-même les migrations et recopie le
catalogue des droits (`MIGRATIONS_AU_DEMARRAGE=1`). Un déploiement ne peut donc
plus tourner sur un schéma en retard.

Vérifier :

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
curl https://app.exemple.ci/api/health
```

Puis ouvrir le domaine, cliquer sur « Créer votre espace » : le premier compte
crée la première entreprise.

## Variables de `.env.production`

| Variable | Rôle |
|---|---|
| `DOMAINE` | Domaine servi en HTTPS |
| `POSTGRES_PASSWORD` | Mot de passe de la base (`openssl rand -base64 32 \| tr -d '/+='`) |
| `AUTH_SECRET` | Signature des sessions, 48 octets aléatoires au moins |
| `URL_PUBLIQUE` | `https://` + domaine, pour les liens envoyés par e-mail |
| `COURRIEL_FOURNISSEUR`, `COURRIEL_CLE`, `COURRIEL_EXPEDITEUR` | Envoi des e-mails : `brevo` ou `resend` |
| `ADMINS_PLATEFORME` | Adresses des administrateurs Fiessou (console `/plateforme`) |
| `ABONNEMENT_PAIEMENT` | Instructions de paiement affichées aux entreprises |
| `INSTANCE_DEMO` / `MODULES_APERCU` | `0` et vide sur une vraie instance |

### E-mails

Sans fournisseur, le mot de passe oublié ne peut pas fonctionner : rien ne
part. Brevo (ex-Sendinblue) a une offre gratuite de 300 e-mails par jour ;
Resend, 3 000 par mois. Dans les deux cas, il faut **vérifier le domaine
d'envoi** (enregistrements SPF et DKIM fournis par le service), sinon les
messages partent en indésirables.

## Sauvegardes

Le service `sauvegarde` fait, toutes les 24 h, un `pg_dump` de la base et une
archive des pièces jointes dans `./sauvegardes` sur le VPS, et garde 14 jours.

**Une sauvegarde qui reste sur le VPS ne protège pas d'une panne du VPS.**
Copier le dossier ailleurs chaque nuit, par exemple avec rclone vers un
stockage objet (Backblaze B2, Wasabi, ou un autre serveur) :

```bash
# crontab -e
30 3 * * * rclone sync /root/fiessou/sauvegardes distant:fiessou-sauvegardes
```

### Restaurer

```bash
# Base : remplace le contenu actuel par celui de la sauvegarde
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U fiessou -d fiessou --clean --if-exists --no-owner \
  < sauvegardes/base-AAAAMMJJ-HHMM.dump

# Pièces jointes
docker compose -f docker-compose.prod.yml run --rm -v "$PWD/sauvegardes:/s" app \
  sh -c "tar -xzf /s/fichiers-AAAAMMJJ-HHMM.tar.gz -C /donnees"
```

Tester une restauration une fois, sur une autre machine, avant d'en avoir
besoin.

## Mettre à jour

```bash
cd fiessou
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app
```

Les migrations s'appliquent au redémarrage. L'interruption dure le temps du
redémarrage du conteneur, quelques secondes.

## Abonnements

Les administrateurs listés dans `ADMINS_PLATEFORME` voient `/plateforme` :
toutes les entreprises, leur état (essai, actif, grâce, lecture seule), et le
bouton « Paiement reçu » qui prolonge l'abonnement. Une nouvelle entreprise a
14 jours d'essai. Une échéance passée laisse 7 jours de grâce, puis
l'entreprise passe en **lecture seule** : elle voit tout, ne crée plus rien.
Les tickets de caisse encaissés hors ligne avant la bascule se synchronisent
quand même.

## Garder Supabase pour la base

La pile embarque PostgreSQL. Pour rester sur Supabase, retirer le service
`postgres` et `sauvegarde` du fichier compose, et remplacer dans `app` :

```yaml
DATABASE_URL: <chaîne du pooler, port 6543>
DATABASE_URL_MIGRATION: <chaîne de session, port 5432>
```

Les sauvegardes relèvent alors du plan Supabase (7 jours sur le gratuit, sans
retour à un instant précis).
