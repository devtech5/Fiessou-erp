"use client";

import { useEffect, useState } from "react";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { comptesDisponibles } from "@/modules/tresorerie/actions";

type Moyen = "especes" | "mobile_money" | "banque";

const NATURE: Record<Moyen, "caisse" | "mobile_money" | "banque"> = {
  especes: "caisse",
  mobile_money: "mobile_money",
  banque: "banque",
};

/**
 * Choix du compte de trésorerie qui reçoit ou qui paie.
 *
 * Seuls les comptes de la nature du moyen sont proposés : des espèces entrent
 * dans une caisse, pas dans une banque. Sans choix, le compte par défaut du
 * moyen s'applique, comme avant l'arrivée de la trésorerie. Sans compte
 * déclaré, le champ ne s'affiche pas du tout.
 */
export function ChoixCompteTresorerie({
  moyen,
  name = "compteTresorerieId",
  valeur,
  onChange,
  className,
  libelle = "Compte",
}: {
  moyen: Moyen;
  name?: string;
  valeur?: string;
  onChange?: (id: string) => void;
  className?: string;
  libelle?: string;
}) {
  const [comptes, setComptes] = useState<{ id: string; nom: string; nature: string }[] | null>(null);

  useEffect(() => {
    let actif = true;
    comptesDisponibles()
      .then((liste) => actif && setComptes(liste))
      .catch(() => actif && setComptes([]));
    return () => {
      actif = false;
    };
  }, []);

  const proposes = (comptes ?? []).filter((c) => c.nature === NATURE[moyen]);
  // Un compte choisi qui ne correspond plus au moyen est oublié.
  useEffect(() => {
    if (valeur && onChange && comptes && !proposes.some((c) => c.id === valeur)) onChange("");
  }, [moyen, comptes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (proposes.length === 0) return null;
  return (
    <select
      name={name}
      aria-label={libelle}
      {...(onChange ? { value: valeur ?? "", onChange: (e) => onChange(e.target.value) } : { defaultValue: "" })}
      className={className ?? CLASSE_CHAMP}
    >
      <option value="">Compte par défaut du moyen</option>
      {proposes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nom}
        </option>
      ))}
    </select>
  );
}
