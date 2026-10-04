import type { Metadata } from "next";
import Link from "next/link";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { baremeDe } from "@/modules/paie/creation";

import { EditeurBareme } from "./editeur";

export const metadata: Metadata = { title: "Barème de paie" };

export default async function PageBareme() {
  const session = await exigerEntreprise();
  if (!(await peut("personnes.paie.valider"))) return <AccesRefuse droit="personnes.paie.valider" />;
  const { bareme, verifie, verifieLe } = await baremeDe(session.organizationId);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/rh/paie" className="text-marque-600 hover:underline">
          ← Paie
        </Link>
      </p>
      <EnTetePage
        titre="Barème de paie"
        sousTitre={verifie && verifieLe ? `Attesté vérifié le ${verifieLe.toLocaleDateString("fr-FR")}` : "Non vérifié : aucune paie ne peut être validée"}
      />
      <EditeurBareme initial={bareme} />
    </>
  );
}
