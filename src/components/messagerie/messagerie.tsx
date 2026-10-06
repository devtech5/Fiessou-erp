"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CLASSE_CHAMP, Champ } from "@/components/ui/primitives";
import {
  actualiser,
  ajouterAuGroupe,
  ecrireA,
  envoyer,
  nouveauGroupe,
  ouvrirPieceJointe,
  renommer,
  retirerDuGroupe,
  supprimerMessage,
} from "@/modules/messagerie/actions";
import type { DetailConversation, MembreEchangeable, MessageAffiche, ResumeConversation } from "@/modules/messagerie/conversations";

/** Conversation ouverte : toutes les 3 secondes ; sinon la liste toutes les 15. */
const PAS_OUVERTE_MS = 3_000;
const PAS_LISTE_MS = 15_000;

const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function ecranVerrouille(): boolean {
  try {
    return localStorage.getItem("fiessou-verrou") === "1";
  } catch {
    return false;
  }
}

function quand(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const aujourdhui = new Date();
  return d.toDateString() === aujourdhui.toDateString() ? HEURE.format(d) : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/**
 * Messagerie interne : liste des conversations à gauche, fil à droite (l'un ou
 * l'autre sur téléphone). Le fil se rafraîchit par interrogation régulière —
 * quasi instantané à l'écran, sans connexion tenue ouverte derrière le pooler.
 */
export function Messagerie({
  moi,
  initiales,
  ouverteInitiale,
  membres,
  gereLesGroupes,
}: {
  moi: string;
  initiales: ResumeConversation[];
  ouverteInitiale: DetailConversation | null;
  membres: MembreEchangeable[];
  gereLesGroupes: boolean;
}) {
  const [liste, setListe] = useState(initiales);
  const [ouverte, setOuverte] = useState<DetailConversation | null>(ouverteInitiale);
  const [panneau, setPanneau] = useState<"nouvelle" | "groupe" | "membres" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const routeur = useRouter();
  const ouverteId = ouverte?.id ?? null;
  const dernierLe = ouverte?.messages.at(-1)?.le ?? null;

  const rafraichir = useCallback(
    async (complet = false) => {
      if (document.visibilityState !== "visible" || ecranVerrouille()) return;
      const r = await actualiser(ouverteId, complet ? null : dernierLe).catch(() => null);
      if (!r) return;
      setListe(r.conversations);
      if (r.detail && r.detail.id === ouverteId) {
        setOuverte((avant) => {
          if (!avant || complet) return r.detail;
          // Ajoute les nouveaux messages ; met à jour les accusés de lecture des anciens.
          const connus = new Set(avant.messages.map((m) => m.id));
          const nouveaux = r.detail!.messages.filter((m) => !connus.has(m.id));
          return { ...r.detail!, messages: [...avant.messages, ...nouveaux] };
        });
      }
    },
    [ouverteId, dernierLe],
  );

  useEffect(() => {
    const minuterie = window.setInterval(() => void rafraichir(), ouverteId ? PAS_OUVERTE_MS : PAS_LISTE_MS);
    const surVisibilite = () => void rafraichir();
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [rafraichir, ouverteId]);

  // Accusés de lecture des anciens messages : un relevé complet de temps en temps.
  useEffect(() => {
    if (!ouverteId) return;
    const minuterie = window.setInterval(() => void rafraichir(true), 20_000);
    return () => window.clearInterval(minuterie);
  }, [ouverteId, rafraichir]);

  async function ouvrir(id: string) {
    setErreur(null);
    setPanneau(null);
    const r = await actualiser(id, null);
    if (r?.detail) {
      setOuverte(r.detail);
      setListe(r.conversations);
      window.history.replaceState(null, "", `/messagerie?c=${id}`);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[28rem] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      {/* Liste */}
      <aside className={`flex w-full flex-col border-r border-[var(--filet)] md:w-80 md:shrink-0 ${ouverte ? "max-md:hidden" : ""}`}>
        <div className="flex items-center gap-2 border-b border-[var(--filet)] p-2">
          <button type="button" onClick={() => setPanneau(panneau === "nouvelle" ? null : "nouvelle")} className="h-9 flex-1 rounded-lg bg-marque-500 px-3 text-sm font-semibold text-white hover:bg-marque-600">
            Nouvelle discussion
          </button>
          {gereLesGroupes && (
            <button type="button" onClick={() => setPanneau(panneau === "groupe" ? null : "groupe")} className="h-9 rounded-lg border border-[var(--filet)] px-3 text-sm hover:bg-[var(--surface-creuse)]">
              Groupe
            </button>
          )}
        </div>

        {panneau === "nouvelle" && (
          <ul className="max-h-64 overflow-y-auto border-b border-[var(--filet)]">
            {membres.length === 0 && <li className="p-3 text-sm text-[var(--encre-faible)]">Personne d&apos;autre n&apos;a accès à la messagerie.</li>}
            {membres.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  onClick={() =>
                    demarrer(async () => {
                      const r = await ecrireA(m.userId);
                      if (r.ok && r.id) await ouvrir(r.id);
                      else setErreur(r.message);
                    })
                  }
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-creuse)]"
                >
                  {m.nom}
                </button>
              </li>
            ))}
          </ul>
        )}

        {panneau === "groupe" && (
          <FormulaireGroupe
            membres={membres}
            onCree={async (id) => {
              setPanneau(null);
              await ouvrir(id);
              routeur.refresh();
            }}
          />
        )}

        {erreur && <p className="m-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{erreur}</p>}

        <ul className="flex-1 overflow-y-auto">
          {liste.length === 0 && <li className="p-4 text-center text-sm text-[var(--encre-faible)]">Aucune conversation. Écrivez à un collègue.</li>}
          {liste.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void ouvrir(c.id)}
                className={`flex w-full items-start gap-3 border-b border-[var(--filet)] px-3 py-2.5 text-left hover:bg-[var(--surface-creuse)] ${c.id === ouverteId ? "bg-[var(--surface-creuse)]" : ""}`}
              >
                <Pastille nom={c.nom} groupe={c.type === "groupe"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.nonLus > 0 ? "font-semibold" : "font-medium"}`}>{c.nom}</span>
                    <span className="chiffres shrink-0 text-[11px] text-[var(--encre-faible)]">{quand(c.dernierLe)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--encre-douce)]">{c.retire ? "Vous avez quitté ce groupe" : (c.apercu ?? (c.type === "groupe" ? `${c.membres} membres` : "Nouvelle conversation"))}</span>
                    {c.nonLus > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-marque-500 px-1.5 text-[11px] font-bold text-white">{c.nonLus}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Fil */}
      <section className={`flex min-w-0 flex-1 flex-col ${ouverte ? "" : "max-md:hidden"}`}>
        {!ouverte ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--encre-faible)]">Choisissez une conversation, ou écrivez à un collègue.</div>
        ) : (
          <Fil
            key={ouverte.id}
            moi={moi}
            conversation={ouverte}
            membres={membres}
            gereLesGroupes={gereLesGroupes}
            panneauMembres={panneau === "membres"}
            basculerMembres={() => setPanneau(panneau === "membres" ? null : "membres")}
            fermer={() => {
              setOuverte(null);
              window.history.replaceState(null, "", "/messagerie");
            }}
            apresEnvoi={() => void rafraichir()}
            recharger={() => void rafraichir(true)}
          />
        )}
      </section>
    </div>
  );
}

function Pastille({ nom, groupe }: { nom: string; groupe: boolean }) {
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${groupe ? "bg-alerte-50 text-alerte-600" : "bg-marque-50 text-marque-600"}`}>
      {groupe ? "#" : initiales || "?"}
    </span>
  );
}

function Fil({
  moi,
  conversation,
  membres,
  gereLesGroupes,
  panneauMembres,
  basculerMembres,
  fermer,
  apresEnvoi,
  recharger,
}: {
  moi: string;
  conversation: DetailConversation;
  membres: MembreEchangeable[];
  gereLesGroupes: boolean;
  panneauMembres: boolean;
  basculerMembres: () => void;
  fermer: () => void;
  apresEnvoi: () => void;
  recharger: () => void;
}) {
  const fond = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const nombre = conversation.messages.length;

  useEffect(() => {
    fond.current?.scrollTo({ top: fond.current.scrollHeight });
  }, [nombre]);

  const peutAdministrer = conversation.type === "groupe" && (conversation.estAdmin || gereLesGroupes);

  function partir() {
    if (!texte.trim() && !piece) return;
    const donnees = new FormData();
    donnees.set("corps", texte);
    if (piece) donnees.set("fichier", piece);
    setErreur(null);
    demarrer(async () => {
      const r = await envoyer(conversation.id, donnees);
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      setTexte("");
      setPiece(null);
      if (fichier.current) fichier.current.value = "";
      apresEnvoi();
      champ.current?.focus();
    });
  }

  const parJour = useMemo(() => {
    const groupes: { jour: string; messages: MessageAffiche[] }[] = [];
    for (const m of conversation.messages) {
      const jour = JOUR.format(new Date(m.le));
      const dernier = groupes.at(-1);
      if (dernier?.jour === jour) dernier.messages.push(m);
      else groupes.push({ jour, messages: [m] });
    }
    return groupes;
  }, [conversation.messages]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-[var(--filet)] px-3 py-2">
        <button type="button" onClick={fermer} className="text-sm text-[var(--encre-douce)] md:hidden" aria-label="Retour à la liste">
          ←
        </button>
        <Pastille nom={conversation.nom} groupe={conversation.type === "groupe"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{conversation.nom}</p>
          <p className="truncate text-xs text-[var(--encre-faible)]">
            {conversation.type === "groupe" ? conversation.membres.map((m) => (m.userId === moi ? "vous" : m.nom.split(" ")[0])).join(", ") : "Conversation privée"}
          </p>
        </div>
        {conversation.type === "groupe" && (
          <button type="button" onClick={basculerMembres} className="h-8 rounded-lg border border-[var(--filet)] px-2.5 text-xs hover:bg-[var(--surface-creuse)]">
            Membres
          </button>
        )}
      </header>

      {panneauMembres && conversation.type === "groupe" && (
        <GestionGroupe moi={moi} conversation={conversation} membres={membres} peutAdministrer={peutAdministrer} recharger={recharger} />
      )}

      <div ref={fond} className="flex-1 space-y-4 overflow-y-auto bg-[var(--fond)] px-3 py-4">
        {parJour.length === 0 && <p className="text-center text-sm text-[var(--encre-faible)]">Aucun message. Écrivez le premier.</p>}
        {parJour.map((g) => (
          <div key={g.jour} className="space-y-1.5">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-[var(--encre-faible)]">{g.jour}</p>
            {g.messages.map((m) => (
              <Bulle key={m.id} message={m} mien={m.auteurId === moi} groupe={conversation.type === "groupe"} />
            ))}
          </div>
        ))}
      </div>

      {conversation.retire ? (
        <p className="border-t border-[var(--filet)] p-3 text-center text-sm text-[var(--encre-faible)]">Vous ne faites plus partie de ce groupe.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            partir();
          }}
          className="border-t border-[var(--filet)] p-2"
        >
          {erreur && <p className="mb-2 rounded-lg bg-danger-50 px-3 py-1.5 text-xs text-danger-600">{erreur}</p>}
          {piece && (
            <p className="mb-2 flex items-center justify-between rounded-lg bg-[var(--surface-creuse)] px-3 py-1.5 text-xs">
              📎 {piece.name}
              <button type="button" onClick={() => setPiece(null)} className="text-danger-600">
                Retirer
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <input ref={fichier} type="file" className="sr-only" aria-label="Joindre un fichier" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setPiece(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fichier.current?.click()} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]" aria-label="Joindre un fichier" title="Joindre un fichier">
              📎
            </button>
            <textarea
              ref={champ}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                // Entrée envoie, Maj+Entrée revient à la ligne — comme partout ailleurs.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  partir();
                }
              }}
              rows={1}
              placeholder="Votre message…"
              aria-label="Votre message"
              className={`${CLASSE_CHAMP} h-auto max-h-40 min-h-10 resize-none py-2`}
            />
            <button type="submit" disabled={enCours || (!texte.trim() && !piece)} className="h-10 shrink-0 rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Envoyer
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function Bulle({ message, mien, groupe }: { message: MessageAffiche; mien: boolean; groupe: boolean }) {
  const [, demarrer] = useTransition();
  const [efface, setEfface] = useState(message.efface);
  const vu = message.autres > 0 && message.luPar >= message.autres;

  if (efface) {
    return (
      <div className={`flex ${mien ? "justify-end" : "justify-start"}`}>
        <p className="rounded-2xl border border-dashed border-[var(--filet)] px-3 py-1.5 text-xs italic text-[var(--encre-faible)]">Message supprimé</p>
      </div>
    );
  }

  return (
    <div className={`group flex ${mien ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mien ? "rounded-br-sm bg-marque-500 text-white" : "rounded-bl-sm bg-[var(--surface)]"}`}>
        {groupe && !mien && <p className="mb-0.5 text-xs font-semibold text-marque-600">{message.auteur}</p>}
        {message.piece && (
          <button
            type="button"
            onClick={async () => {
              const fenetre = window.open("about:blank", "_blank");
              const url = await ouvrirPieceJointe(message.id);
              if (url && fenetre) {
                fenetre.opener = null;
                fenetre.location.href = url;
              } else fenetre?.close();
            }}
            className={`mb-1 block underline ${mien ? "text-white" : "text-marque-600"}`}
          >
            📎 {message.piece.nom}
          </button>
        )}
        {message.corps && <p className="whitespace-pre-wrap break-words">{message.corps}</p>}
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mien ? "text-white/80" : "text-[var(--encre-faible)]"}`}>
          {mien && (
            <button
              type="button"
              onClick={() =>
                window.confirm("Supprimer ce message ?") &&
                demarrer(async () => {
                  const r = await supprimerMessage(message.id);
                  if (r.ok) setEfface(true);
                })
              }
              className="mr-1 hidden underline group-hover:inline"
            >
              supprimer
            </button>
          )}
          {HEURE.format(new Date(message.le))}
          {mien && <span title={vu ? "Lu" : "Envoyé"}>{vu ? "✓✓" : "✓"}</span>}
        </p>
      </div>
    </div>
  );
}

function FormulaireGroupe({ membres, onCree }: { membres: MembreEchangeable[]; onCree: (id: string) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        demarrer(async () => {
          const r = await nouveauGroupe(donnees);
          if (r.ok && r.id) onCree(r.id);
          else setErreur(r.message);
        });
      }}
      className="space-y-2 border-b border-[var(--filet)] p-3"
    >
      <Champ libelle="Nom du groupe">
        <input name="nom" required placeholder="Équipe magasin" className={CLASSE_CHAMP} />
      </Champ>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Membres</legend>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {membres.map((m) => (
            <label key={m.userId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="membres" value={m.userId} className="size-4" />
              {m.nom}
            </label>
          ))}
        </div>
      </fieldset>
      {erreur && <p className="text-xs text-danger-600">{erreur}</p>}
      <button type="submit" disabled={enCours} className="h-9 w-full rounded-lg bg-marque-500 text-sm font-semibold text-white disabled:opacity-50">
        Créer le groupe
      </button>
    </form>
  );
}

function GestionGroupe({
  moi,
  conversation,
  membres,
  peutAdministrer,
  recharger,
}: {
  moi: string;
  conversation: DetailConversation;
  membres: MembreEchangeable[];
  peutAdministrer: boolean;
  recharger: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ajout, setAjout] = useState("");
  const [nom, setNom] = useState(conversation.nom);
  const presents = new Set(conversation.membres.map((m) => m.userId));
  const ajoutables = membres.filter((m) => !presents.has(m.userId));
  const agir = (op: () => Promise<{ ok: boolean; message: string }>) =>
    demarrer(async () => {
      const r = await op();
      setMessage(r.message);
      if (r.ok) recharger();
    });

  return (
    <div className="space-y-3 border-b border-[var(--filet)] bg-[var(--surface-creuse)] p-3 text-sm">
      {peutAdministrer && (
        <div className="flex flex-wrap gap-2">
          <input value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom du groupe" className={`${CLASSE_CHAMP} h-9 flex-1`} />
          <button type="button" disabled={enCours} onClick={() => agir(() => renommer(conversation.id, nom))} className="h-9 rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3">
            Renommer
          </button>
        </div>
      )}
      <ul className="space-y-1">
        {conversation.membres.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2">
            <span>
              {m.userId === moi ? "Vous" : m.nom}
              {m.role === "admin" && <span className="ml-1.5 text-xs text-[var(--encre-faible)]">administrateur</span>}
            </span>
            {m.userId === moi ? (
              <button type="button" disabled={enCours} onClick={() => window.confirm("Quitter ce groupe ?") && agir(() => retirerDuGroupe(conversation.id, moi))} className="text-xs text-danger-600 hover:underline">
                Quitter
              </button>
            ) : (
              peutAdministrer && (
                <button type="button" disabled={enCours} onClick={() => agir(() => retirerDuGroupe(conversation.id, m.userId))} className="text-xs text-danger-600 hover:underline">
                  Retirer
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {peutAdministrer && ajoutables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select value={ajout} onChange={(e) => setAjout(e.target.value)} aria-label="Membre à ajouter" className={`${CLASSE_CHAMP} h-9 flex-1`}>
            <option value="">Ajouter un membre…</option>
            {ajoutables.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.nom}
              </option>
            ))}
          </select>
          <button type="button" disabled={enCours || !ajout} onClick={() => agir(() => ajouterAuGroupe(conversation.id, [ajout]))} className="h-9 rounded-lg bg-marque-500 px-3 font-semibold text-white disabled:opacity-50">
            Ajouter
          </button>
        </div>
      )}
      {message && <p className="text-xs text-[var(--encre-douce)]">{message}</p>}
    </div>
  );
}
