"use client";

import { useRouter } from "next/navigation";

import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";

/** Date de reprise : les soldes antérieurs sont datés de ce jour. */
export function ChoixDate({ date, max }: { date: string; max: string }) {
  const routeur = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--encre-douce)]">Reprise au</span>
      <input type="date" value={date} max={max} onChange={(e) => e.target.value && routeur.replace(`/demarrage?date=${e.target.value}`)} className={`${CLASSE_CHAMP_COMPACT} h-cible`} />
    </label>
  );
}
