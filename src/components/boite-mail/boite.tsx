"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import {
  deconnecterBoite,
  envoyerCourriel,
  listerDossiers,
  listerMessages,
  marquerNonLu,
  mettreCorbeille,
  ouvrirMessage,
  telechargerPiece,
} from "@/modules/boite-mail/actions";
import { documentCourriel } from "@/modules/boite-mail/fournisseurs";
import type { ApercuMessage, Dossier, MessageLu } from "@/modules/boite-mail/imap";

const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const COMPLET = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });

function quand(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? HEURE.format(d) : JOUR.format(d);
}

function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(Math.round(octets / 104_857.6) / 10).toString().replace(".", ",")} Mo`;
}

interface Brouillon {
  a: string;
  cc: string;
  objet: string;
  texte: string;
  enReponseA?: string | null;
  references?: string[];
}

/**
 * La boîte mail : dossiers, liste paginée, lecture, rédaction. Rien n'est
 * gardé en base ni dans le navigateur au-delà de l'écran ouvert.
 */
export function BoiteMail({ adresse, signature }: { adresse: string; signature: string | null }) {
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [dossier, setDossier] = useState("INBOX");
  const [liste, setListe] = useState<ApercuMessage[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [ouvert, setOuvert] = useState<MessageLu | null>(null);
  const [redaction, setRedaction] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  const charger = useCallback((d: string, p: number) => {
    demarrer(async () => {
      setErreur(null);
      const r = await listerMessages(d, p);
      if (!r.ok) return setErreur(r.message);
      setListe(r.messages);
      setTotal(r.total);
    });
  }, []);

  useEffect(() => {
    demarrer(async () => {
      const r = await listerDossiers();
      if (!r.ok) return setErreur(r.message);
      setDossiers(r.dossiers);
    });
  }, []);

  useEffect(() => {
    charger(dossier, page);
  }, [dossier, page, charger]);

  function lire(uid: number) {
    setErreur(null);
    setRedaction(null);
    demarrer(async () => {
      const r = await ouvrirMessage(dossier, uid);
      if (!r.ok) return setErreur(r.message);
      setOuvert(r.message);
      setListe((l) => l?.map((m) => (m.uid === uid ? { ...m, lu: true } : m)) ?? l);
    });
  }

  const pied = signature ? `\n\n--\n${signature}` : "";
  const citer = (m: MessageLu) =>
    `\n\n${pied}\n\nLe ${m.date ? COMPLET.format(new Date(m.date)) : ""}, ${m.de[0]?.nom ?? m.de[0]?.adresse ?? ""} a écrit :\n${m.texte
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n")}`;

  const parPage = 30;
  const pages = Math.max(1, Math.ceil(total / parPage));

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[30rem] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      {/* Dossiers */}
      <nav className="hidden w-52 shrink-0 flex-col border-r border-[var(--filet)] p-2 lg:flex">
        <button
          type="button"
          onClick={() => {
            setOuvert(null);
            setRedaction({ a: "", cc: "", objet: "", texte: pied });
          }}
          className="mb-2 h-9 rounded-lg bg-marque-500 text-sm font-semibold text-white hover:bg-marque-600"
        >
          Nouveau message
        </button>
        <ul className="flex-1 space-y-0.5 overflow-y-auto">
          {(dossiers ?? []).map((d) => (
            <li key={d.chemin}>
              <button
                type="button"
                onClick={() => {
                  setDossier(d.chemin);
                  setPage(0);
                  setOuvert(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${d.chemin === dossier ? "bg-[var(--surface-creuse)] font-semibold" : "hover:bg-[var(--surface-creuse)]"}`}
              >
                <span className="truncate">{d.libelle}</span>
                {d.nonLus > 0 && <span className="chiffres text-xs text-marque-600">{d.nonLus}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="truncate border-t border-[var(--filet)] pt-2 text-xs text-[var(--encre-faible)]" title={adresse}>
          {adresse}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Déconnecter cette boîte ? Le mot de passe enregistré sera effacé ; vos e-mails restent chez votre fournisseur.")) return;
            demarrer(async () => {
              await deconnecterBoite();
              routeur.refresh();
            });
          }}
          className="mt-1 text-left text-xs text-danger-600 hover:underline"
        >
          Déconnecter la boîte
        </button>
      </nav>

      {/* Liste */}
      <section className={`flex w-full flex-col border-r border-[var(--filet)] md:w-80 md:shrink-0 ${ouvert || redaction ? "max-md:hidden" : ""}`}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--filet)] px-3 py-2">
          <select
            value={dossier}
            onChange={(e) => {
              setDossier(e.target.value);
              setPage(0);
              setOuvert(null);
            }}
            aria-label="Dossier"
            className={`${CLASSE_CHAMP} h-8 w-auto lg:hidden`}
          >
            {(dossiers ?? [{ chemin: "INBOX", libelle: "Boîte de réception" } as Dossier]).map((d) => (
              <option key={d.chemin} value={d.chemin}>
                {d.libelle}
              </option>
            ))}
          </select>
          <span className="hidden text-sm font-semibold lg:inline">{dossiers?.find((d) => d.chemin === dossier)?.libelle ?? "Boîte de réception"}</span>
          <span className="flex items-center gap-1 text-xs text-[var(--encre-faible)]">
            <button type="button" disabled={page === 0 || enCours} onClick={() => setPage(page - 1)} className="px-1 disabled:opacity-30" aria-label="Plus récents">
              ‹
            </button>
            <span className="chiffres">
              {page + 1}/{pages}
            </span>
            <button type="button" disabled={page + 1 >= pages || enCours} onClick={() => setPage(page + 1)} className="px-1 disabled:opacity-30" aria-label="Plus anciens">
              ›
            </button>
            <button type="button" disabled={enCours} onClick={() => charger(dossier, page)} className="ml-1 px-1" aria-label="Actualiser" title="Actualiser">
              ↻
            </button>
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setOuvert(null);
            setRedaction({ a: "", cc: "", objet: "", texte: pied });
          }}
          className="m-2 h-9 rounded-lg bg-marque-500 text-sm font-semibold text-white lg:hidden"
        >
          Nouveau message
        </button>
        {erreur && <p className="m-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{erreur}</p>}
        <ul className="flex-1 overflow-y-auto">
          {liste === null && <li className="p-4 text-center text-sm text-[var(--encre-faible)]">{enCours ? "Connexion à la boîte…" : ""}</li>}
          {liste?.length === 0 && <li className="p-4 text-center text-sm text-[var(--encre-faible)]">Aucun message.</li>}
          {liste?.map((m) => (
            <li key={m.uid}>
              <button
                type="button"
                onClick={() => lire(m.uid)}
                className={`block w-full border-b border-[var(--filet)] px-3 py-2 text-left hover:bg-[var(--surface-creuse)] ${ouvert?.uid === m.uid ? "bg-[var(--surface-creuse)]" : ""}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${m.lu ? "" : "font-semibold"}`}>{m.de}</span>
                  <span className="chiffres shrink-0 text-[11px] text-[var(--encre-faible)]">{quand(m.date)}</span>
                </span>
                <span className={`block truncate text-xs ${m.lu ? "text-[var(--encre-douce)]" : "font-medium"}`}>
                  {!m.lu && <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-marque-500 align-middle" />}
                  {m.objet}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Lecture ou rédaction */}
      <section className={`flex min-w-0 flex-1 flex-col ${ouvert || redaction ? "" : "max-md:hidden"}`}>
        {redaction ? (
          <Redaction
            initial={redaction}
            fermer={() => setRedaction(null)}
            envoye={() => {
              setRedaction(null);
              charger(dossier, page);
            }}
          />
        ) : ouvert ? (
          <Lecture
            m={ouvert}
            dossier={dossier}
            fermer={() => setOuvert(null)}
            repondre={(tous) => {
              const de = ouvert.de[0]?.adresse ?? "";
              const cc = tous ? [...ouvert.a, ...ouvert.cc].map((x) => x.adresse).filter((x) => x.toLowerCase() !== adresse.toLowerCase() && x !== de) : [];
              setRedaction({
                a: de,
                cc: cc.join(", "),
                objet: /^re\s*:/i.test(ouvert.objet) ? ouvert.objet : `Re : ${ouvert.objet}`,
                texte: citer(ouvert),
                enReponseA: ouvert.messageId,
                references: [...ouvert.references, ...(ouvert.messageId ? [ouvert.messageId] : [])],
              });
            }}
            transferer={() =>
              setRedaction({
                a: "",
                cc: "",
                objet: /^(tr|fwd?)\s*:/i.test(ouvert.objet) ? ouvert.objet : `Tr : ${ouvert.objet}`,
                texte: `${pied}\n\n---------- Message transféré ----------\nDe : ${ouvert.de.map((x) => x.nom ?? x.adresse).join(", ")}\nObjet : ${ouvert.objet}\n\n${ouvert.texte}`,
              })
            }
            retire={(uid) => {
              setOuvert(null);
              setListe((l) => l?.filter((x) => x.uid !== uid) ?? l);
            }}
            nonLu={(uid) => {
              setOuvert(null);
              setListe((l) => l?.map((x) => (x.uid === uid ? { ...x, lu: false } : x)) ?? l);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--encre-faible)]">Choisissez un message.</div>
        )}
      </section>
    </div>
  );
}

function Lecture({
  m,
  dossier,
  fermer,
  repondre,
  transferer,
  retire,
  nonLu,
}: {
  m: MessageLu;
  dossier: string;
  fermer: () => void;
  repondre: (tous: boolean) => void;
  transferer: () => void;
  retire: (uid: number) => void;
  nonLu: (uid: number) => void;
}) {
  const [images, setImages] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const aDesImagesDistantes = Boolean(m.html && /<img[^>]+src=["']?https?:/i.test(m.html));
  const bouton = "h-8 rounded-lg border border-[var(--filet)] px-2.5 text-xs hover:bg-[var(--surface-creuse)] disabled:opacity-50";

  return (
    <>
      <header className="space-y-1 border-b border-[var(--filet)] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={fermer} className="text-sm text-[var(--encre-douce)] md:hidden" aria-label="Retour à la liste">
            ←
          </button>
          <h2 className="flex-1 text-base font-semibold">{m.objet}</h2>
        </div>
        <p className="text-sm">
          <span className="font-medium">{m.de.map((x) => x.nom ?? x.adresse).join(", ")}</span>
          <span className="text-[var(--encre-faible)]"> &lt;{m.de.map((x) => x.adresse).join(", ")}&gt;</span>
        </p>
        <p className="text-xs text-[var(--encre-douce)]">
          À : {m.a.map((x) => x.nom ?? x.adresse).join(", ") || "—"}
          {m.cc.length > 0 && ` · Cc : ${m.cc.map((x) => x.nom ?? x.adresse).join(", ")}`}
          {m.date && ` · ${COMPLET.format(new Date(m.date))}`}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button type="button" onClick={() => repondre(false)} className={bouton}>
            Répondre
          </button>
          {m.a.length + m.cc.length > 1 && (
            <button type="button" onClick={() => repondre(true)} className={bouton}>
              Répondre à tous
            </button>
          )}
          <button type="button" onClick={transferer} className={bouton}>
            Transférer
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await marquerNonLu(dossier, m.uid);
                if (r.ok) nonLu(m.uid);
                else setMessage(r.message);
              })
            }
            className={bouton}
          >
            Non lu
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await mettreCorbeille(dossier, m.uid);
                if (r.ok) retire(m.uid);
                else setMessage(r.message);
              })
            }
            className={`${bouton} text-danger-600`}
          >
            Corbeille
          </button>
        </div>
        {message && <p className="text-xs text-danger-600">{message}</p>}
      </header>
      {m.pieces.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-b border-[var(--filet)] px-4 py-2">
          {m.pieces.map((p) => (
            <li key={p.index}>
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  demarrer(async () => {
                    const r = await telechargerPiece(dossier, m.uid, p.index);
                    if (!r.ok) return setMessage(r.message);
                    const octets = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
                    const url = URL.createObjectURL(new Blob([octets], { type: r.type }));
                    const lien = document.createElement("a");
                    lien.href = url;
                    lien.download = r.nom;
                    lien.click();
                    setTimeout(() => URL.revokeObjectURL(url), 10_000);
                  })
                }
                className="rounded-lg border border-[var(--filet)] px-2.5 py-1 text-xs hover:bg-[var(--surface-creuse)]"
              >
                📎 {p.nom} <span className="text-[var(--encre-faible)]">({taille(p.taille)})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aDesImagesDistantes && !images && (
        <p className="border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-4 py-1.5 text-xs">
          Images distantes bloquées : elles signaleraient à l&apos;expéditeur que vous avez ouvert le message.{" "}
          <button type="button" onClick={() => setImages(true)} className="text-marque-600 hover:underline">
            Afficher les images
          </button>
        </p>
      )}
      <div className="min-h-0 flex-1 bg-white">
        {m.html ? (
          // Aucun script, aucune origine partagée : le message ne peut ni lire
          // la page de Fiessou, ni exécuter quoi que ce soit.
          <iframe title={m.objet} sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={documentCourriel(m.html, images)} className="size-full border-0" />
        ) : (
          <pre className="size-full overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-sm text-black">{m.texte}</pre>
        )}
      </div>
    </>
  );
}

function Redaction({ initial, fermer, envoye }: { initial: Brouillon; fermer: () => void; envoye: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const texte = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    texte.current?.focus();
    texte.current?.setSelectionRange(0, 0);
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        if (initial.enReponseA) d.set("enReponseA", initial.enReponseA);
        if (initial.references?.length) d.set("references", initial.references.join(" "));
        setErreur(null);
        demarrer(async () => {
          const r = await envoyerCourriel(d);
          if (r.ok) envoye();
          else setErreur(r.message);
        });
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="space-y-2 border-b border-[var(--filet)] p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nouveau message</h2>
          <button type="button" onClick={fermer} className="text-sm text-[var(--encre-faible)] hover:underline">
            Annuler
          </button>
        </div>
        <input name="a" defaultValue={initial.a} required placeholder="À (séparez par des virgules)" aria-label="Destinataires" className={`${CLASSE_CHAMP} h-9`} />
        <input name="cc" defaultValue={initial.cc} placeholder="Cc" aria-label="Copie" className={`${CLASSE_CHAMP} h-9`} />
        <input name="objet" defaultValue={initial.objet} placeholder="Objet" aria-label="Objet" className={`${CLASSE_CHAMP} h-9`} />
      </div>
      <textarea ref={texte} name="texte" defaultValue={initial.texte} aria-label="Message" className="min-h-0 flex-1 resize-none bg-[var(--fond)] p-3 text-sm outline-none" />
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--filet)] p-3">
        <input name="pieces" type="file" multiple aria-label="Pièces jointes" className="text-xs" />
        {erreur && <span className="text-xs text-danger-600">{erreur}</span>}
        <button type="submit" disabled={enCours} className="ml-auto h-9 rounded-lg bg-marque-500 px-5 text-sm font-semibold text-white disabled:opacity-50">
          {enCours ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
