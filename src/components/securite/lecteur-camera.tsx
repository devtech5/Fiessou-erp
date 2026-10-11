"use client";

import { useEffect, useRef, useState } from "react";

import { ouvrirCamera } from "@/modules/securite/actions";

type Etat = { phase: "connexion" } | { phase: "direct" } | { phase: "indisponible"; message: string };

/** Attend la fin de la collecte ICE, sans dépasser `ms` : l'offre part complète, sans échange incrémental. */
function collecteTerminee(pc: RTCPeerConnection, ms: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resoudre) => {
    const fin = () => {
      pc.removeEventListener("icegatheringstatechange", verifier);
      resoudre();
    };
    const verifier = () => pc.iceGatheringState === "complete" && fin();
    pc.addEventListener("icegatheringstatechange", verifier);
    setTimeout(fin, ms);
  });
}

/**
 * Une caméra en direct, lue en WebRTC selon le protocole WHEP.
 *
 * L'adresse est demandée au serveur à chaque ouverture : elle porte un jeton
 * valable deux minutes, et chaque ouverture est inscrite au journal. Le son
 * est coupé — un mur de seize caméras qui parlent ensemble ne s'écoute pas.
 */
export function LecteurCamera({
  cameraId,
  qualite,
  nom,
  emplacement,
  onAgrandir,
}: {
  cameraId: string;
  qualite: "hd" | "sd";
  nom: string;
  emplacement: string | null;
  onAgrandir?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [etat, setEtat] = useState<Etat>({ phase: "connexion" });
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let annule = false;
    let pc: RTCPeerConnection | null = null;
    let session: string | null = null;

    async function demarrer() {
      setEtat({ phase: "connexion" });
      const ouverture = await ouvrirCamera(cameraId, qualite);
      if (annule) return;
      if (!ouverture.ok || !ouverture.url) {
        setEtat({ phase: "indisponible", message: ouverture.message || "Caméra indisponible." });
        return;
      }

      pc = new RTCPeerConnection();
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (e) => {
        if (video.current && e.streams[0]) video.current.srcObject = e.streams[0];
      };
      pc.onconnectionstatechange = () => {
        if (!pc || annule) return;
        if (pc.connectionState === "connected") setEtat({ phase: "direct" });
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setEtat({ phase: "indisponible", message: "Liaison perdue avec le site." });
        }
      };

      await pc.setLocalDescription(await pc.createOffer());
      await collecteTerminee(pc, 2_000);
      const reponse = await fetch(ouverture.url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      });
      if (annule) return;
      if (!reponse.ok) {
        setEtat({
          phase: "indisponible",
          message: reponse.status === 404 ? "Le relais du site ne publie pas cette caméra." : "Lecture refusée par le serveur vidéo.",
        });
        return;
      }
      session = reponse.headers.get("Location");
      await pc.setRemoteDescription({ type: "answer", sdp: await reponse.text() });
    }

    demarrer().catch(() => {
      if (!annule) setEtat({ phase: "indisponible", message: "Serveur vidéo injoignable." });
    });

    return () => {
      annule = true;
      pc?.close();
      // Libère la lecture côté serveur ; sans réponse, elle expirera seule.
      if (session) void fetch(new URL(session, location.href), { method: "DELETE" }).catch(() => undefined);
    };
  }, [cameraId, qualite, essai]);

  return (
    <figure className="group relative aspect-video min-w-0 overflow-hidden rounded-lg bg-black">
      <video ref={video} autoPlay muted playsInline className="h-full w-full object-contain" />
      <figcaption className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-1.5 text-xs text-white">
        <span className="truncate">
          <strong>{nom}</strong>
          {emplacement ? <span className="opacity-75"> · {emplacement}</span> : null}
        </span>
        {etat.phase === "direct" && (
          <span className="flex shrink-0 items-center gap-1 font-semibold">
            <span className="size-2 rounded-full bg-red-500" aria-hidden /> Direct
          </span>
        )}
      </figcaption>

      {etat.phase !== "direct" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-white/80">
          {etat.phase === "connexion" ? (
            <p>Connexion…</p>
          ) : (
            <>
              <p>{etat.message}</p>
              <button type="button" onClick={() => setEssai((n) => n + 1)} className="pointer-events-auto rounded border border-white/40 px-2 py-1 hover:bg-white/10">
                Réessayer
              </button>
            </>
          )}
        </div>
      )}

      {onAgrandir && (
        <button
          type="button"
          onClick={onAgrandir}
          className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
        >
          Plein écran
        </button>
      )}
    </figure>
  );
}
