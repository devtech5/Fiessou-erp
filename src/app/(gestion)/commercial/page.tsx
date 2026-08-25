import type { Metadata } from "next";

import { BoutonPrincipal, BoutonSecondaire, EnTetePage } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { CLIENTS } from "@/lib/fixtures/gestion";
import { ListeClients } from "./liste-clients";

export const metadata: Metadata = { title: "Clients" };

export default function PageClients() {
  const encoursTotal = CLIENTS.reduce((somme, client) => somme + client.encours, 0);

  return (
    <>
      <EnTetePage
        titre="Clients"
        sousTitre={`${CLIENTS.length} clients · ${fmt(encoursTotal)} FCFA d'encours`}
        actions={
          <>
            <BoutonSecondaire>Importer</BoutonSecondaire>
            <BoutonPrincipal>Nouveau client</BoutonPrincipal>
          </>
        }
      />
      <ListeClients />
    </>
  );
}
