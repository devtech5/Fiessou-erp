"use client";

import { useState, useTransition } from "react";

import { Retour, type Resultat } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { enregistrerReponseTerrain, repondreEnLigne } from "@/modules/enquetes/actions";
import type { QuestionEnquete } from "@/modules/enquetes/calcul";

type Mode = { canal: "terrain"; enqueteId: string } | { canal: "lien"; jeton: string };

/**
 * Questionnaire à remplir, le même pour l'enquêteur et pour le répondant.
 *
 * Gros boutons pour les notes et les oui/non : la réponse se donne au pouce,
 * sur un téléphone, souvent en plein soleil. Après l'envoi, l'enquêteur
 * enchaîne sur un nouveau répondant ; le répondant en ligne voit un merci.
 */
export function FormulaireReponse({ questions, mode }: { questions: QuestionEnquete[]; mode: Mode }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [repondant, setRepondant] = useState("");
  const [position, setPosition] = useState<{ latitudeMicro: number; longitudeMicro: number } | null>(null);
  const [piege, setPiege] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [termine, setTermine] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [identifiant, setIdentifiant] = useState(() => crypto.randomUUID());

  const poser = (cle: string, valeur: string) => setValeurs((v) => ({ ...v, [cle]: valeur }));

  function localiser() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setPosition({ latitudeMicro: Math.round(p.coords.latitude * 1e6), longitudeMicro: Math.round(p.coords.longitude * 1e6) }),
      () => setResultat({ ok: false, message: "Position indisponible : autorisez la localisation, ou envoyez sans." }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function envoyer() {
    setResultat(null);
    demarrer(async () => {
      const r =
        mode.canal === "terrain"
          ? await enregistrerReponseTerrain({
              id: identifiant,
              enqueteId: mode.enqueteId,
              valeurs,
              repondant: repondant || null,
              ...(position ?? {}),
              priseLe: new Date().toISOString(),
            })
          : await repondreEnLigne(mode.jeton, identifiant, valeurs, piege);
      setResultat(r);
      if (!r.ok) return;
      if (mode.canal === "lien") {
        setTermine(true);
        return;
      }
      // Répondant suivant : un nouvel identifiant, un questionnaire vierge.
      setValeurs({});
      setRepondant("");
      setIdentifiant(crypto.randomUUID());
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (termine) {
    return (
      <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-6 text-center">
        <p className="text-lg font-semibold">Merci !</p>
        <p className="mt-1 text-sm text-[var(--encre-douce)]">Votre réponse a bien été enregistrée.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        envoyer();
      }}
      className="space-y-4"
    >
      {questions.map((q, index) => (
        <fieldset key={q.cle} className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
          <legend className="sr-only">{q.libelle}</legend>
          <p className="mb-3 text-sm font-semibold">
            {index + 1}. {q.libelle}
            {q.obligatoire && <span className="text-danger-600"> *</span>}
          </p>

          {(q.type === "note" || q.type === "nps") && (
            <div className="flex flex-wrap gap-1.5">
              {(q.type === "note" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={valeurs[q.cle] === String(n)}
                  onClick={() => poser(q.cle, String(n))}
                  className={`chiffres h-touche min-w-11 flex-1 rounded-lg border text-base font-semibold ${
                    valeurs[q.cle] === String(n) ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
                  }`}
                >
                  {n}
                </button>
              ))}
              <p className="w-full text-xs text-[var(--encre-faible)]">
                {q.type === "note" ? "1 : pas du tout satisfait · 5 : très satisfait" : "0 : pas du tout probable · 10 : très probable"}
              </p>
            </div>
          )}

          {q.type === "oui_non" && (
            <div className="flex gap-2">
              {[
                ["oui", "Oui"],
                ["non", "Non"],
              ].map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={valeurs[q.cle] === valeur}
                  onClick={() => poser(q.cle, valeur)}
                  className={`h-touche flex-1 rounded-lg border text-base font-semibold ${
                    valeurs[q.cle] === valeur ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}

          {q.type === "choix" && (
            <div className="flex flex-col gap-1.5">
              {q.options?.map((option) => (
                <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--filet)] px-3 text-sm has-[:checked]:border-marque-600">
                  <input type="radio" name={q.cle} value={option} checked={valeurs[q.cle] === option} onChange={() => poser(q.cle, option)} />
                  {option}
                </label>
              ))}
            </div>
          )}

          {q.type === "texte" && (
            <textarea
              value={valeurs[q.cle] ?? ""}
              onChange={(e) => poser(q.cle, e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3.5 py-2 text-sm outline-none focus:border-marque-500"
            />
          )}

          {q.type === "nombre" && (
            <input value={valeurs[q.cle] ?? ""} onChange={(e) => poser(q.cle, e.target.value)} inputMode="decimal" className={`${CLASSE_CHAMP} chiffres`} />
          )}
        </fieldset>
      ))}

      {mode.canal === "terrain" && (
        <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Répondant (facultatif)</span>
            <input value={repondant} onChange={(e) => setRepondant(e.target.value)} maxLength={120} placeholder="Nom ou téléphone, s'il accepte" className={CLASSE_CHAMP} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={localiser} className="h-cible rounded-lg border border-[var(--filet)] px-3 font-medium hover:bg-[var(--surface-creuse)]">
              {position ? "Position relevée ✓" : "Relever la position"}
            </button>
            <span className="text-xs text-[var(--encre-faible)]">Facultatif : situe la réponse sur le terrain.</span>
          </div>
        </div>
      )}

      {mode.canal === "lien" && (
        // Champ piège : invisible et hors tabulation pour un humain, rempli par un robot.
        <input value={piege} onChange={(e) => setPiege(e.target.value)} name="site_web" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      )}

      <Retour resultat={resultat} />
      <button
        type="submit"
        disabled={enCours}
        className="h-touche w-full rounded-xl bg-marque-600 text-base font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Envoi…" : mode.canal === "terrain" ? "Enregistrer et passer au suivant" : "Envoyer ma réponse"}
      </button>
    </form>
  );
}
