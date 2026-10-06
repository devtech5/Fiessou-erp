"use client";

import { useState, useTransition } from "react";

import { confirmerDesinscription } from "@/modules/communication/actions";

export function BoutonDesinscription({ jeton }: { jeton: string }) {
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  if (message?.ok) return <p className="mt-5 rounded-lg bg-valide-50 px-3 py-2.5 text-sm font-medium text-valide-600">{message.texte}</p>;

  return (
    <>
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await confirmerDesinscription(jeton);
            setMessage({ ok: r.ok, texte: r.message });
          })
        }
        className="mt-5 h-touche w-full rounded-xl bg-marque-500 text-base font-semibold text-white disabled:opacity-50"
      >
        {enCours ? "Un instant…" : "Confirmer la désinscription"}
      </button>
      {message && !message.ok && <p className="mt-3 text-sm text-danger-600">{message.texte}</p>}
    </>
  );
}
