import { fmtEntier } from "@/lib/format";
import { divideMoney } from "@/lib/money";
import { formaterCentiemes, type SyntheseQuestion } from "@/modules/enquetes/calcul";

/**
 * Résultat d'une question.
 *
 * Une seule couleur pour toutes les barres : elles mesurent une même chose,
 * une part des réponses. Le nombre et le pourcentage sont écrits à côté de
 * chaque barre — la couleur ne porte jamais seule l'information.
 */
export function SyntheseVue({ libelle, synthese }: { libelle: string; synthese: SyntheseQuestion }) {
  return (
    <article className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{libelle}</h3>
        <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
          {fmtEntier(synthese.reponses)} réponse{synthese.reponses > 1 ? "s" : ""}
        </span>
      </header>
      <Corps synthese={synthese} />
    </article>
  );
}

function Corps({ synthese }: { synthese: SyntheseQuestion }) {
  if (synthese.reponses === 0) return <p className="text-sm text-[var(--encre-faible)]">Pas encore de réponse.</p>;

  switch (synthese.type) {
    case "note":
      return (
        <>
          <p className="mb-3">
            <span className="chiffres text-2xl font-bold">{formaterCentiemes(synthese.moyenneCentiemes ?? 0)}</span>
            <span className="text-sm text-[var(--encre-faible)]"> / 5 en moyenne</span>
          </p>
          <Barres lignes={[5, 4, 3, 2, 1].map((n) => ({ libelle: `${n}`, nombre: synthese.repartition[n - 1] }))} total={synthese.reponses} />
        </>
      );
    case "nps":
      return (
        <>
          <p className="mb-3">
            <span className={`chiffres text-2xl font-bold ${(synthese.score ?? 0) >= 0 ? "text-valide-600" : "text-danger-600"}`}>
              {(synthese.score ?? 0) > 0 ? "+" : ""}
              {synthese.score}
            </span>
            <span className="text-sm text-[var(--encre-faible)]"> score de recommandation (−100 à +100)</span>
          </p>
          <Barres
            lignes={[
              { libelle: "Promoteurs (9-10)", nombre: synthese.promoteurs },
              { libelle: "Passifs (7-8)", nombre: synthese.passifs },
              { libelle: "Détracteurs (0-6)", nombre: synthese.detracteurs },
            ]}
            total={synthese.reponses}
          />
        </>
      );
    case "choix":
      return <Barres lignes={synthese.comptes.map((c) => ({ libelle: c.option, nombre: c.nombre }))} total={synthese.reponses} />;
    case "oui_non":
      return (
        <Barres
          lignes={[
            { libelle: "Oui", nombre: synthese.oui },
            { libelle: "Non", nombre: synthese.non },
          ]}
          total={synthese.reponses}
        />
      );
    case "nombre":
      return (
        <p>
          <span className="chiffres text-2xl font-bold">{formaterCentiemes(synthese.moyenneCentiemes ?? 0)}</span>
          <span className="text-sm text-[var(--encre-faible)]"> en moyenne</span>
        </p>
      );
    case "texte":
      return (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {synthese.derniers.map((t, i) => (
            <li key={i} className="rounded-lg bg-[var(--surface-creuse)] px-3 py-2 text-sm">
              {t}
            </li>
          ))}
        </ul>
      );
  }
}

function Barres({ lignes, total }: { lignes: { libelle: string; nombre: number }[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {lignes.map((l) => {
        const partBp = divideMoney(l.nombre * 10_000, total);
        return (
          <li key={l.libelle} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate text-[var(--encre-douce)]">{l.libelle}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-creuse)]">
              <span className="block h-full rounded-full bg-marque-600" style={{ width: `${partBp / 100}%` }} />
            </span>
            <span className="chiffres w-20 text-right text-xs text-[var(--encre-douce)]">
              {fmtEntier(l.nombre)} · {Math.round(partBp / 100)} %
            </span>
          </li>
        );
      })}
    </ul>
  );
}
