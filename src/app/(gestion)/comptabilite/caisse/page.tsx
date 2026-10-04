import { redirect } from "next/navigation";

/** La caisse de dépenses vit désormais dans la Trésorerie, avec ses vrais bons. */
export default function AncienneCaisse() {
  redirect("/tresorerie/caisse");
}
