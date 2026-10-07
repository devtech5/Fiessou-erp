/**
 * Cadenas fermé : verrouiller la session.
 *
 * Trait et non aplat, à la manière des icônes système de Windows 11, pour que
 * le bouton du menu et l'écran de verrouillage parlent la même langue.
 */
export function IconeCadenas({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
