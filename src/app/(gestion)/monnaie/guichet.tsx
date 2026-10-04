"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { enregistrerOperation, ouvrirGuichet } from "@/modules/monnaie/actions";
import {
  commissionIndicative,
  effetSurEspeces,
  effetSurFloat,
  NOM_RESEAU,
  refusOperation,
  RESEAUX,
  SEUIL_FLOAT_BAS,
  type Soldes,
} from "@/modules/monnaie/calcul";
import type { Reseau, TypeOperationGuichet } from "@/modules/monnaie/schema";

const TYPES: { id: TypeOperationGuichet; libelle: string; aide: string }[] = [
  { id: "depot", libelle: "Dépôt", aide: "Le client remet des espèces, vous envoyez la valeur sur son compte" },
  { id: "retrait", libelle: "Retrait", aide: "Le client vous envoie la valeur, vous lui remettez des espèces" },
  { id: "credit", libelle: "Crédit", aide: "Vente de crédit d'appel, payée en espèces" },
  { id: "approvisionnement", libelle: "Appro.", aide: "Vous achetez du float avec vos espèces (super-agent, banque)" },
  { id: "destockage", libelle: "Déstockage", aide: "Vous revendez du float contre des espèces" },
];

const CHAMP_MONTANT =
  "chiffres h-touche w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-xl font-bold outline-none focus:border-marque-500";

const entier = (v: string) => Math.max(0, Math.round(Number(v.replace(/[\s  ]/g, "")) || 0));

/**
 * Ouverture du guichet : l'agent compte son tiroir et relève le solde de
 * chaque réseau dans l'application de l'opérateur. Les chiffres de la
 * dernière clôture sont proposés.
 */
export function OuvertureGuichet({
  proposition,
  autorise,
}: {
  proposition: { fondCaisse: number; floats: Record<Reseau, number> } | null;
  autorise: boolean;
}) {
  const op = useOperation();
  const [fond, setFond] = useState(String(proposition?.fondCaisse ?? ""));
  const [floats, setFloats] = useState<Record<Reseau, string>>(
    Object.fromEntries(RESEAUX.map((r) => [r, String(proposition?.floats[r] ?? "")])) as Record<Reseau, string>,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        op.lancer(() =>
          ouvrirGuichet({
            fondCaisse: entier(fond),
            floats: Object.fromEntries(RESEAUX.map((r) => [r, entier(floats[r])])),
          }),
        );
      }}
      className="max-w-2xl rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
    >
      <h2 className="text-base font-semibold">Ouvrir le guichet</h2>
      <p className="mt-0.5 text-sm text-[var(--encre-douce)]">
        Comptez le tiroir et relevez le solde de chaque réseau dans l&apos;application de l&apos;opérateur.
        {proposition && " Les chiffres de la dernière clôture sont proposés."}
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Espèces dans le tiroir</span>
        <input value={fond} onChange={(e) => setFond(e.target.value)} inputMode="numeric" required className={CHAMP_MONTANT} />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {RESEAUX.map((r) => (
          <label key={r} className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Float {NOM_RESEAU[r]}</span>
            <input
              value={floats[r]}
              onChange={(e) => setFloats((f) => ({ ...f, [r]: e.target.value }))}
              inputMode="numeric"
              className={`${CLASSE_CHAMP} chiffres text-right`}
            />
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={!autorise || op.enCours || fond.trim() === ""}
        className="sans-selection mt-4 h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
      >
        {autorise ? "Ouvrir la session" : "Votre rôle ne permet pas de tenir le guichet"}
      </button>
      {op.resultat && <Retour resultat={op.resultat} />}
    </form>
  );
}

/**
 * Guichet.
 *
 * L'écran affiche l'effet de l'opération sur les deux réserves — float et
 * espèces — avant validation, et refuse ce que l'une ou l'autre ne couvre
 * pas. Le serveur refait le même contrôle, session verrouillée.
 */
export function Guichet({ soldes, autorise }: { soldes: Soldes; autorise: boolean }) {
  const [type, setType] = useState<TypeOperationGuichet>("depot");
  const [reseau, setReseau] = useState<Reseau>("wave");
  const [telephone, setTelephone] = useState("");
  const [reference, setReference] = useState("");
  const [montant, setMontant] = useState(0);
  const [commissionSaisie, setCommissionSaisie] = useState<string | null>(null);
  const op = useOperation();

  const commission = commissionSaisie === null ? commissionIndicative(type, montant) : entier(commissionSaisie);
  const floatAvant = soldes.floats[reseau];
  const floatApres = floatAvant + effetSurFloat(type, montant);
  const especesApres = soldes.especes + effetSurEspeces(type, montant);
  const refus = montant > 0 ? refusOperation(soldes, { type, reseau, montant }) : null;
  const clientRequis = type === "depot" || type === "retrait" || type === "credit";
  const valide = autorise && montant > 0 && !refus && (!clientRequis || telephone.trim().length > 0);

  function valider() {
    op.lancer(
      () =>
        enregistrerOperation({
          type,
          reseau,
          montant,
          commission,
          telephone: telephone || undefined,
          referenceOperateur: reference || undefined,
        }),
      () => {
        setMontant(0);
        setTelephone("");
        setReference("");
        setCommissionSaisie(null);
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">Opération</legend>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => {
                  setType(t.id);
                  setCommissionSaisie(null);
                }}
                className={`sans-selection h-touche rounded-lg border text-sm font-semibold ${
                  type === t.id
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {t.libelle}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--encre-faible)]">{TYPES.find((t) => t.id === type)!.aide}</p>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">Réseau</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {RESEAUX.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reseau === r}
                onClick={() => setReseau(r)}
                className={`sans-selection h-cible rounded-lg border px-1 text-xs font-semibold ${
                  reseau === r
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {NOM_RESEAU[r]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Numéro du client{clientRequis ? "" : " (facultatif)"}
            </span>
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              inputMode="tel"
              placeholder="07 00 00 00 00"
              className={`${CLASSE_CHAMP} chiffres`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Référence opérateur</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Identifiant du SMS de confirmation"
              className={`${CLASSE_CHAMP} chiffres`}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Montant</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={montant || ""}
              onChange={(e) => setMontant(entier(e.target.value))}
              placeholder="0"
              className={CHAMP_MONTANT}
            />
            <span className="shrink-0 text-sm text-[var(--encre-faible)]">FCFA</span>
          </div>
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[1_000, 2_000, 5_000, 10_000, 25_000, 50_000].map((valeur) => (
            <button
              key={valeur}
              type="button"
              onClick={() => setMontant(valeur)}
              className="sans-selection chiffres h-cible rounded-lg border border-[var(--filet)] px-3 text-sm hover:bg-[var(--surface-creuse)]"
            >
              {fmt(valeur)}
            </button>
          ))}
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Effet de l&apos;opération</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Montant</dt>
            <dd className="chiffres font-semibold">{fmt(montant)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Commission due par l&apos;opérateur</dt>
            <dd>
              <input
                value={commissionSaisie ?? String(commission)}
                onChange={(e) => setCommissionSaisie(e.target.value)}
                inputMode="numeric"
                aria-label="Commission"
                className="chiffres h-8 w-24 rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2 text-right text-sm font-semibold text-valide-600"
              />
            </dd>
          </div>
        </dl>

        <div className="mt-3 space-y-2 border-t border-[var(--filet)] pt-3">
          <div className="rounded-lg bg-[var(--surface-creuse)] p-3">
            <p className="text-xs text-[var(--encre-faible)]">Float {NOM_RESEAU[reseau]}</p>
            <p className="chiffres text-sm">
              {fmt(floatAvant)}
              <span className="mx-1.5 text-[var(--encre-faible)]">→</span>
              <span
                className={`font-bold ${
                  floatApres < 0 ? "text-danger-600" : floatApres < SEUIL_FLOAT_BAS ? "text-alerte-600" : ""
                }`}
              >
                {fmt(floatApres)}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-[var(--surface-creuse)] p-3">
            <p className="text-xs text-[var(--encre-faible)]">Espèces en caisse</p>
            <p className="chiffres text-sm">
              {fmt(soldes.especes)}
              <span className="mx-1.5 text-[var(--encre-faible)]">→</span>
              <span className={`font-bold ${especesApres < 0 ? "text-danger-600" : ""}`}>{fmt(especesApres)}</span>
            </p>
          </div>
        </div>

        {refus && (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2.5 text-xs font-medium text-danger-600">
            {refus} {floatApres < 0 && "Rechargez avant de valider : l'opération échouerait chez l'opérateur après avoir encaissé le client."}
          </p>
        )}
        {!refus && montant > 0 && floatApres < SEUIL_FLOAT_BAS && (
          <p className="mt-3 rounded-lg bg-alerte-50 px-3 py-2.5 text-xs font-medium text-alerte-600">
            Float bas après cette opération. Prévoyez un approvisionnement.
          </p>
        )}

        <button
          type="button"
          disabled={!valide || op.enCours}
          onClick={valider}
          className="sans-selection mt-4 h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
        >
          {op.enCours ? "Enregistrement…" : "Valider l'opération"}
        </button>
        {op.resultat && <Retour resultat={op.resultat} />}
      </aside>
    </div>
  );
}

/** Bandeau des floats et du tiroir, en tête du guichet. */
export function BandeauFloat({ soldes, ouvertures, fondCaisse }: { soldes: Soldes; ouvertures: Record<Reseau, number>; fondCaisse: number }) {
  const cartes = [
    ...RESEAUX.map((r) => ({ cle: r, nom: NOM_RESEAU[r], valeur: soldes.floats[r], ouverture: ouvertures[r], bas: soldes.floats[r] < SEUIL_FLOAT_BAS })),
    { cle: "especes", nom: "Espèces", valeur: soldes.especes, ouverture: fondCaisse, bas: false },
  ];
  return (
    <ul className="mb-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cartes.map((c) => {
        const variation = c.valeur - c.ouverture;
        return (
          <li key={c.cle} className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{c.nom}</p>
              {c.bas && <Pastille ton="alerte">Bas</Pastille>}
            </div>
            <p className={`chiffres mt-1 text-xl font-bold ${c.bas ? "text-alerte-600" : ""}`}>{fmt(c.valeur)}</p>
            <p className="chiffres mt-0.5 text-xs text-[var(--encre-faible)]">
              {variation >= 0 ? "+" : "−"} {fmt(Math.abs(variation))} depuis l&apos;ouverture
            </p>
          </li>
        );
      })}
    </ul>
  );
}
