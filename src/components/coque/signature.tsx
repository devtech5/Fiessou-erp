/**
 * Signature de la plateforme. Volontairement effacée : l'écran appartient à
 * l'entreprise cliente, dont le nom est en tête ; Fiessou signe en pied, comme
 * un imprimeur au bas d'une page.
 */
export function SignatureFiessou({ className = "" }: { className?: string }) {
  return (
    <p className={`select-none text-[11px] tracking-wide text-[var(--encre-faible)] opacity-70 ${className}`}>
      Fiessou <span className="font-semibold">ERP</span>
    </p>
  );
}
