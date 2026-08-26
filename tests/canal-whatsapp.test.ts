import { describe, expect, it } from "vitest";

import {
  adresseEnvoi,
  corpsMessage,
  type ConfigWhatsApp,
} from "@/lib/auth/canaux/whatsapp";

/**
 * Charge utile WhatsApp.
 *
 * Testée parce qu'elle est invérifiable autrement : l'éprouver pour de bon
 * demande un compte Meta vérifié et un gabarit approuvé, et le jour où l'un
 * des deux existe, une erreur ici se manifeste par un refus dont le message ne
 * nomme pas le composant fautif. Le test fige la forme documentée ; s'il faut
 * la corriger un jour, on saura exactement ce qu'on change.
 */

const CONFIG: ConfigWhatsApp = {
  version: "v25.0",
  phoneId: "123456789",
  template: "fiessou_code",
  langue: "fr",
};

describe("message d'authentification WhatsApp", () => {
  const corps = corpsMessage("+2250708123456", "042173", CONFIG);

  it("porte le code dans le texte ET dans le bouton", () => {
    // Meta traite les deux comme des composants distincts. N'en fournir qu'un
    // fait échouer l'envoi, et c'est l'erreur qu'on refait à chaque fois.
    expect(JSON.stringify(corps).match(/042173/g)).toHaveLength(2);
  });

  it("déclare le bouton en sub_type url, contre-intuitif mais documenté", () => {
    const composants = (
      corps.template as { components: { type: string; sub_type?: string }[] }
    ).components;
    const bouton = composants.find((c) => c.type === "button");

    expect(bouton?.sub_type).toBe("url");
  });

  it("garde le numéro au format E.164, tel que la normalisation le rend", () => {
    expect(corps.to).toBe("+2250708123456");
  });

  it("épingle la version de l'API dans l'adresse", () => {
    expect(adresseEnvoi(CONFIG)).toBe(
      "https://graph.facebook.com/v25.0/123456789/messages",
    );
  });

  it("nomme le gabarit et sa langue, qui doivent être ceux approuvés", () => {
    const gabarit = corps.template as {
      name: string;
      language: { code: string };
    };

    expect(gabarit.name).toBe("fiessou_code");
    expect(gabarit.language.code).toBe("fr");
  });
});
