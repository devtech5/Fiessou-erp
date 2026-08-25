/**
 * Remplaçant du paquet `server-only` sous Vitest.
 *
 * Le vrai paquet lève une exception dès qu'il est chargé hors d'un bundler
 * React, ce qui rend intestable tout module qui le déclare — y compris ses
 * fonctions purement arithmétiques. L'alias est posé dans `vitest.config.ts` et
 * ne s'applique qu'aux tests : la protection reste entière ailleurs.
 */
export {};
