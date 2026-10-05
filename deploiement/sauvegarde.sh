#!/bin/sh
# Sauvegarde périodique : base (pg_dump, format custom) et pièces jointes.
#
# Les fichiers atterrissent dans ./sauvegardes sur le VPS. Une copie HORS du
# VPS reste indispensable (voir DEPLOIEMENT.md) : un disque qui meurt emporte
# la base et ses sauvegardes ensemble.
set -eu

INTERVALLE=$((${SAUVEGARDE_INTERVALLE_HEURES:-24} * 3600))
JOURS=${SAUVEGARDE_JOURS:-14}
CIBLE=/sauvegardes

mkdir -p "$CIBLE"

while true; do
  HORODATAGE=$(date -u +%Y%m%d-%H%M)

  # Écriture dans un .partiel puis renommage : une sauvegarde interrompue ne
  # se fait jamais passer pour une sauvegarde complète.
  if pg_dump --format=custom --no-owner --file="$CIBLE/base-$HORODATAGE.dump.partiel"; then
    mv "$CIBLE/base-$HORODATAGE.dump.partiel" "$CIBLE/base-$HORODATAGE.dump"
    echo "{\"evenement\":\"sauvegarde_base\",\"fichier\":\"base-$HORODATAGE.dump\"}"
  else
    rm -f "$CIBLE/base-$HORODATAGE.dump.partiel"
    echo "{\"evenement\":\"sauvegarde_echec\",\"horodatage\":\"$HORODATAGE\"}" >&2
  fi

  if [ -d /donnees/fichiers ]; then
    tar -czf "$CIBLE/fichiers-$HORODATAGE.tar.gz.partiel" -C /donnees fichiers \
      && mv "$CIBLE/fichiers-$HORODATAGE.tar.gz.partiel" "$CIBLE/fichiers-$HORODATAGE.tar.gz"
  fi

  find "$CIBLE" -name 'base-*.dump' -mtime +"$JOURS" -delete
  find "$CIBLE" -name 'fichiers-*.tar.gz' -mtime +"$JOURS" -delete
  find "$CIBLE" -name '*.partiel' -mmin +180 -delete

  sleep "$INTERVALLE"
done
