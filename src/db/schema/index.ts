/**
 * Schéma de fondation de Fiessou.
 *
 * Ce dossier ne contient que le socle transverse : entreprises, comptes,
 * droits, numérotation, journal d'audit et synchronisation. Les tables métier
 * (articles, ventes, écritures, employés…) vivent dans leur module respectif,
 * sous src/modules, et sont réexportées ici.
 */
export * from "./_shared";
export * from "./auth";
export * from "./rbac";
export * from "./tenancy";
export * from "./sequences";
export * from "./codes";
export * from "./audit";
export * from "./sync";

// ------------------------------------------------------------- modules métier
// L'ordre suit les dépendances : un article pointe vers son fournisseur.
export * from "@/modules/tiers/schema";
export * from "@/modules/catalogue/schema";
export * from "@/modules/stock/schema";
export * from "@/modules/ventes/schema";
export * from "@/modules/ventes/schema-session";
export * from "@/modules/comptabilite/schema";
export * from "@/modules/personnes/schema";
export * from "@/modules/actifs/schema";
export * from "@/modules/documents/schema";
export * from "@/modules/missions/schema";
export * from "@/modules/facturation/schema";
