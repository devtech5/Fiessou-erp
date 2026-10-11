/**
 * Calculette : évaluation exacte d'une expression saisie au clavier.
 *
 * Une calculette en virgule flottante affiche 0,1 + 0,2 = 0,30000000000000004
 * et 1 999 × 0,18 = 359,82000000000005. Sur un écran de gestion, l'utilisateur
 * en conclut que le logiciel compte faux. Ici chaque nombre est une fraction
 * exacte (numérateur et dénominateur entiers, BigInt) ; seul l'affichage
 * arrondit, et il le dit.
 *
 * Le pourcentage suit l'usage des calculettes de comptoir :
 *   200 + 10 %  → 220    (10 % de 200, ajoutés)
 *   200 − 10 %  → 180
 *   200 × 10 %  → 20
 *   10 %        → 0,1
 *
 * Pur, sans dépendance : utilisable au navigateur comme en test.
 */

const ZERO = BigInt(0);
const UN = BigInt(1);
const DIX = BigInt(10);
const CENT = BigInt(100);

export interface Fraction {
  n: bigint;
  d: bigint;
}

function pgcd(a: bigint, b: bigint): bigint {
  let x = a < ZERO ? -a : a;
  let y = b < ZERO ? -b : b;
  while (y !== ZERO) [x, y] = [y, x % y];
  return x === ZERO ? UN : x;
}

function fraction(n: bigint, d: bigint = UN): Fraction {
  if (d === ZERO) throw new ErreurCalcul("Division par zéro.");
  if (d < ZERO) [n, d] = [-n, -d];
  const g = pgcd(n, d);
  return { n: n / g, d: d / g };
}

const plus = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const moins = (a: Fraction, b: Fraction) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const fois = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const divise = (a: Fraction, b: Fraction) => {
  if (b.n === ZERO) throw new ErreurCalcul("Division par zéro.");
  return fraction(a.n * b.d, a.d * b.n);
};
const pourCent = (a: Fraction) => fraction(a.n, a.d * CENT);

export class ErreurCalcul extends Error {}

// ------------------------------------------------------------ lecture

type Jeton =
  | { type: "nombre"; valeur: Fraction }
  | { type: "op"; valeur: "+" | "-" | "*" | "/" }
  | { type: "%" }
  | { type: "(" }
  | { type: ")" };

/** « 1 250,5 » ou « 1250.5 » : la virgule et le point sont des séparateurs décimaux, l'espace un séparateur de milliers. */
function lireNombre(texte: string): Fraction {
  const [entiere, decimale = ""] = texte.replace(",", ".").split(".");
  const chiffres = `${entiere || "0"}${decimale}`;
  return fraction(BigInt(chiffres), DIX ** BigInt(decimale.length));
}

const OPERATEURS: Record<string, "+" | "-" | "*" | "/"> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "–": "-",
  "*": "*",
  "×": "*",
  x: "*",
  X: "*",
  "/": "/",
  "÷": "/",
  ":": "/",
};

export function decouper(expression: string): Jeton[] {
  const jetons: Jeton[] = [];
  let i = 0;
  const s = expression;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let fin = i;
      let separateurs = 0;
      // Un nombre peut contenir des espaces de milliers : « 1 250 000 ».
      while (fin < s.length && (/[0-9.,]/.test(s[fin]) || (/\s/.test(s[fin]) && /[0-9]/.test(s[fin + 1] ?? "")))) {
        if (s[fin] === "." || s[fin] === ",") separateurs++;
        fin++;
      }
      const brut = s.slice(i, fin).replace(/\s/g, "");
      if (separateurs > 1 || brut === "." || brut === ",") throw new ErreurCalcul(`Nombre illisible : « ${brut} ».`);
      jetons.push({ type: "nombre", valeur: lireNombre(brut) });
      i = fin;
      continue;
    }
    if (OPERATEURS[c]) {
      jetons.push({ type: "op", valeur: OPERATEURS[c] });
      i++;
      continue;
    }
    if (c === "%" || c === "(" || c === ")") {
      jetons.push({ type: c });
      i++;
      continue;
    }
    throw new ErreurCalcul(`Caractère inattendu : « ${c} ».`);
  }
  return jetons;
}

// ---------------------------------------------------------- évaluation

/** Valeur d'un terme, et s'il s'agit d'un pourcentage nu (« 10 % ») que l'addition applique à sa gauche. */
interface Terme {
  valeur: Fraction;
  pourcentage: boolean;
}

class Analyseur {
  private i = 0;
  constructor(private readonly jetons: Jeton[]) {}

  evaluer(): Fraction {
    if (this.jetons.length === 0) return fraction(ZERO);
    const v = this.somme();
    if (this.i < this.jetons.length) throw new ErreurCalcul("Expression incomplète ou parenthèse en trop.");
    return v;
  }

  private voir() {
    return this.jetons[this.i];
  }

  private somme(): Fraction {
    let gauche = this.produit().valeur;
    for (let j = this.voir(); j?.type === "op" && (j.valeur === "+" || j.valeur === "-"); j = this.voir()) {
      this.i++;
      const droite = this.produit();
      const montant = droite.pourcentage ? fois(gauche, droite.valeur) : droite.valeur;
      gauche = j.valeur === "+" ? plus(gauche, montant) : moins(gauche, montant);
    }
    return gauche;
  }

  private produit(): Terme {
    let gauche = this.facteur();
    for (let j = this.voir(); j?.type === "op" && (j.valeur === "*" || j.valeur === "/"); j = this.voir()) {
      this.i++;
      const droite = this.facteur();
      gauche = { valeur: j.valeur === "*" ? fois(gauche.valeur, droite.valeur) : divise(gauche.valeur, droite.valeur), pourcentage: false };
    }
    return gauche;
  }

  private facteur(): Terme {
    let valeur = this.unaire();
    let pourcentage = false;
    while (this.voir()?.type === "%") {
      this.i++;
      valeur = pourCent(valeur);
      pourcentage = true;
    }
    return { valeur, pourcentage };
  }

  private unaire(): Fraction {
    const j = this.voir();
    if (j?.type === "op" && (j.valeur === "-" || j.valeur === "+")) {
      this.i++;
      const v = this.unaire();
      return j.valeur === "-" ? fraction(-v.n, v.d) : v;
    }
    return this.primaire();
  }

  private primaire(): Fraction {
    const j = this.voir();
    if (!j) throw new ErreurCalcul("Expression incomplète.");
    if (j.type === "nombre") {
      this.i++;
      return j.valeur;
    }
    if (j.type === "(") {
      this.i++;
      const v = this.somme();
      // Parenthèse non refermée en fin de saisie : on la referme, comme une calculette.
      if (this.voir()?.type === ")") this.i++;
      else if (this.i < this.jetons.length) throw new ErreurCalcul("Parenthèse non refermée.");
      return v;
    }
    throw new ErreurCalcul("Expression incomplète.");
  }
}

export function evaluer(expression: string): Fraction {
  return new Analyseur(decouper(expression)).evaluer();
}

// ----------------------------------------------------------- affichage

/** Arrondi au plus proche, demi loin de zéro, à `decimales` chiffres. Rend un entier mis à l'échelle. */
function arrondiEchelle(f: Fraction, decimales: number): bigint {
  const echelle = DIX ** BigInt(decimales);
  const negatif = f.n < ZERO;
  const n = negatif ? -f.n : f.n;
  const q = (n * echelle * BigInt(2) + f.d) / (f.d * BigInt(2));
  return negatif ? -q : q;
}

/** Espace fine insécable, comme les montants de l'application. */
const GROUPE = " ";

function grouper(entier: string): string {
  return entier.replace(/\B(?=(\d{3})+(?!\d))/g, GROUPE);
}

/**
 * Écrit un résultat à la française : milliers séparés, virgule décimale, au
 * plus `decimales` décimales sans zéros inutiles. `exact` dit si l'affichage
 * a dû arrondir (1 ÷ 3).
 */
export function formater(f: Fraction, decimales = 6): { texte: string; exact: boolean } {
  const q = arrondiEchelle(f, decimales);
  const negatif = q < ZERO;
  const absolu = (negatif ? -q : q).toString().padStart(decimales + 1, "0");
  const entiere = absolu.slice(0, absolu.length - decimales);
  const decimale = absolu.slice(absolu.length - decimales).replace(/0+$/, "");
  const texte = `${negatif ? "−" : ""}${grouper(entiere)}${decimale ? `,${decimale}` : ""}`;
  const exact = q * f.d === f.n * DIX ** BigInt(decimales);
  return { texte: texte === "−0" ? "0" : texte, exact };
}

/** Arrondi au franc, pour les outils qui produisent un montant. */
export function auFranc(f: Fraction): number {
  return Number(arrondiEchelle(f, 0));
}

/** Valeur décimale d'une saisie d'outil (« 25 000 », « 18 », « 12,5 »), ou null si vide ou illisible. */
export function lireSaisie(texte: string): Fraction | null {
  const t = texte.trim();
  if (!t) return null;
  try {
    return evaluer(t);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- outils

/** Hors taxes vers TTC : la taxe s'ajoute au franc près. */
export function versTtc(ht: Fraction, tauxPourcent: Fraction): { ht: number; tva: number; ttc: number } {
  const h = auFranc(ht);
  const tva = auFranc(fois(fraction(BigInt(h)), pourCent(tauxPourcent)));
  return { ht: h, tva, ttc: h + tva };
}

/**
 * TTC vers hors taxes : la taxe s'extrait du prix affiché, et les deux parts
 * retombent exactement sur le TTC — comme `decomposerTTC` en comptabilité.
 */
export function depuisTtc(ttc: Fraction, tauxPourcent: Fraction): { ht: number; tva: number; ttc: number } {
  const t = auFranc(ttc);
  const ht = auFranc(divise(fraction(BigInt(t)), plus(fraction(UN), pourCent(tauxPourcent))));
  return { ht, tva: t - ht, ttc: t };
}

/** Prix après remise. */
export function remise(prix: Fraction, tauxPourcent: Fraction): { remise: number; net: number } {
  const p = auFranc(prix);
  const r = auFranc(fois(fraction(BigInt(p)), pourCent(tauxPourcent)));
  return { remise: r, net: p - r };
}

/**
 * Marge d'une vente. Le taux de marge se calcule sur le prix d'achat, le taux
 * de marque sur le prix de vente : les confondre fait annoncer 25 % de marge
 * là où il n'y en a que 20.
 */
export function marge(achat: Fraction, vente: Fraction): { marge: number; tauxMarge: string | null; tauxMarque: string | null } {
  const m = moins(vente, achat);
  const taux = (base: Fraction) => (base.n === ZERO ? null : `${formater(fois(divise(m, base), fraction(CENT)), 2).texte} %`);
  return { marge: auFranc(m), tauxMarge: taux(achat), tauxMarque: taux(vente) };
}

/**
 * Parité fixe du franc CFA (UEMOA et CEMAC) : 1 € = 655,957 F. Ce n'est pas un
 * cours du jour, c'est la parité légale ; elle ne vaut pas pour les autres
 * monnaies de la région (cedi, naira, franc guinéen).
 */
export const PARITE_EURO = fraction(BigInt(655957), BigInt(1000));

export function euroVersCfa(euros: Fraction): number {
  return auFranc(fois(euros, PARITE_EURO));
}

export function cfaVersEuro(francs: Fraction): string {
  return formater(divise(francs, PARITE_EURO), 2).texte;
}
