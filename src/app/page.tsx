import { redirect } from "next/navigation";

export default function Accueil() {
  // Provisoire : l'accueil deviendra le tableau de bord de l'entreprise une
  // fois l'authentification en place.
  redirect("/stock");
}
