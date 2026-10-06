"use client";

import { useRef, useState } from "react";

/**
 * Photo d'identité, réduite dans le navigateur avant de partir.
 *
 * 360 px de côté au plus, JPEG : assez pour un badge imprimé, assez léger
 * (30 à 60 Ko) pour vivre en base et suivre la carte professionnelle hors
 * ligne. Le serveur ne reçoit jamais la photo de 4 Mo prise au téléphone.
 */
const COTE = 360;
const BORNE = 131_072;

export async function reduirePhoto(fichier: File): Promise<string> {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, COTE / Math.max(image.width, image.height));
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(image.width * echelle));
  toile.height = Math.max(1, Math.round(image.height * echelle));
  const ctx = toile.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.drawImage(image, 0, 0, toile.width, toile.height);
  for (const qualite of [0.85, 0.75, 0.6, 0.45]) {
    const url = toile.toDataURL("image/jpeg", qualite);
    if (url.length <= BORNE) return url;
  }
  throw new Error("Photo trop détaillée, même réduite.");
}

/** Vignette ronde : la photo, ou les initiales à défaut. */
export function Portrait({ photo, nom, taille = "moyenne" }: { photo: string | null; nom: string; taille?: "petite" | "moyenne" | "grande" }) {
  const dimension = taille === "grande" ? "size-24 text-2xl" : taille === "petite" ? "size-8 text-xs" : "size-14 text-base";
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
  return photo ? (
    // Data URL en base : rien à optimiser, et pas d'URL externe à autoriser.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={`Photo de ${nom}`} className={`${dimension} shrink-0 rounded-full border border-[var(--filet)] object-cover`} />
  ) : (
    <span aria-hidden className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-marque-50 font-semibold text-marque-600`}>
      {initiales || "?"}
    </span>
  );
}

/**
 * Choix d'une photo pour un formulaire : la data URL réduite part dans un
 * champ caché `name`, le fichier d'origine ne part pas.
 */
export function ChoixPhoto({ name = "photo", nom = "" }: { name?: string; nom?: string }) {
  const champ = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Photo</span>
      <input type="hidden" name={name} value={photo ?? ""} />
      <input
        ref={champ}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choisir une photo"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setErreur(null);
          try {
            setPhoto(await reduirePhoto(f));
          } catch (err) {
            setErreur(err instanceof Error ? err.message : "Photo illisible.");
          }
        }}
      />
      <div className="flex items-center gap-3">
        <Portrait photo={photo} nom={nom || "?"} />
        <button
          type="button"
          onClick={() => champ.current?.click()}
          className="h-9 rounded-lg border border-[var(--filet)] px-3 text-sm hover:bg-[var(--surface-creuse)]"
        >
          {photo ? "Changer" : "Choisir"}
        </button>
        {photo && (
          <button type="button" onClick={() => setPhoto(null)} className="text-sm text-danger-600 hover:underline">
            Retirer
          </button>
        )}
      </div>
      {erreur && <p className="mt-1 text-xs text-danger-600">{erreur}</p>}
    </div>
  );
}
