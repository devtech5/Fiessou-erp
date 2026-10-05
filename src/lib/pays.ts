/**
 * Libellés administratifs selon le pays de l'entreprise. Rien n'est écrit en
 * dur sur les documents : une quincaillerie d'Abidjan imprime « NCC », une de
 * Dakar « NINEA ». Afficher l'un chez l'autre, c'est l'erreur du concurrent.
 */
export interface ReferentielPays {
  /** Sigle de l'identifiant fiscal. */
  identifiantFiscal: string;
  /** Intitulé long, pour un formulaire. */
  identifiantFiscalLong: string;
  /** Registre du commerce. */
  registre: string;
}

const PAR_DEFAUT: ReferentielPays = { identifiantFiscal: "N° contribuable", identifiantFiscalLong: "Numéro de contribuable", registre: "RCCM" };

const REFERENTIELS: Record<string, ReferentielPays> = {
  CI: { identifiantFiscal: "NCC", identifiantFiscalLong: "Numéro de compte contribuable (NCC)", registre: "RCCM" },
  SN: { identifiantFiscal: "NINEA", identifiantFiscalLong: "NINEA", registre: "RCCM" },
  BF: { identifiantFiscal: "IFU", identifiantFiscalLong: "Identifiant financier unique (IFU)", registre: "RCCM" },
  BJ: { identifiantFiscal: "IFU", identifiantFiscalLong: "Identifiant fiscal unique (IFU)", registre: "RCCM" },
  ML: { identifiantFiscal: "NIF", identifiantFiscalLong: "Numéro d'identification fiscale (NIF)", registre: "RCCM" },
  TG: { identifiantFiscal: "NIF", identifiantFiscalLong: "Numéro d'identification fiscale (NIF)", registre: "RCCM" },
  NE: { identifiantFiscal: "NIF", identifiantFiscalLong: "Numéro d'identification fiscale (NIF)", registre: "RCCM" },
  CM: { identifiantFiscal: "NIU", identifiantFiscalLong: "Numéro d'identifiant unique (NIU)", registre: "RCCM" },
  GN: { identifiantFiscal: "NIF", identifiantFiscalLong: "Numéro d'identification fiscale (NIF)", registre: "RCCM" },
};

export function referentielPays(code: string | null | undefined): ReferentielPays {
  return (code && REFERENTIELS[code.toUpperCase()]) || PAR_DEFAUT;
}
