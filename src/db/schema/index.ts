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
export * from "@/modules/comptabilite/schema";
