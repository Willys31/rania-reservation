/* Enregistre une réservation du site directement dans le Google Agenda de RANIA.
   Auth service account signée à la main : évite d'embarquer `googleapis` (~50 Mo)
   pour les deux appels REST dont on a besoin. */
import { createSign } from "node:crypto";
import {
  SALON_ADDRESS,
  SALON_TIME_ZONE,
  formatReadableDate,
  validateBooking,
} from "../shared/booking.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

type MinimalRequest = { method?: string; body?: unknown };
type MinimalResponse = {
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Les clés collées dans un dashboard arrivent avec des \n littéraux, et parfois
   entourées de guillemets. On normalise les deux cas. */
function normalizePrivateKey(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").replace(/\n/g, "\n");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  /* Marge de 60 s pour ne pas présenter un jeton qui expire pendant l'appel. */
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Authentification Google refusée : ${payload.error_description ?? response.status}`);
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function slotIsTaken(calendarId: string, token: string, startsAt: Date, endsAt: Date): Promise<boolean> {
  const query = new URLSearchParams({
    timeMin: startsAt.toISOString(),
    timeMax: endsAt.toISOString(),
    singleEvents: "true",
    maxResults: "1",
  });
  const response = await fetch(`${CALENDAR_API}/${encodeURIComponent(calendarId)}/events?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Lecture de l'agenda impossible (${response.status}) : ${await response.text()}`);
  }
  const payload = (await response.json()) as { items?: unknown[] };
  return (payload.items ?? []).length > 0;
}

export default async function handler(req: MinimalRequest, res: MinimalResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!clientEmail || !rawPrivateKey || !calendarId) {
    console.error("Variables d'environnement Google Calendar manquantes.");
    res.status(500).json({ error: "La réservation en ligne est momentanément indisponible." });
    return;
  }

  const booking = validateBooking((req.body ?? {}) as Record<string, string>);
  if (!booking.ok) {
    res.status(400).json({ error: booking.error });
    return;
  }

  const { name, phone, service, slot, startsAt, endsAt } = booking;

  try {
    const token = await getAccessToken(clientEmail, normalizePrivateKey(rawPrivateKey));

    if (await slotIsTaken(calendarId, token, startsAt, endsAt)) {
      res.status(409).json({ error: "Ce créneau vient d'être réservé. Merci d'en choisir un autre." });
      return;
    }

    const response = await fetch(`${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${service.name} — ${name}`,
        location: SALON_ADDRESS,
        description: [
          `Cliente : ${name}`,
          `Téléphone : ${phone}`,
          `Prestation : ${service.name} (${service.note})`,
          `Tarif indicatif : ${service.price} FCFA`,
          `Créneau : ${slot.value}`,
          "",
          "Réservation enregistrée depuis le site RANIA.",
        ].join("\n"),
        start: { dateTime: startsAt.toISOString(), timeZone: SALON_TIME_ZONE },
        end: { dateTime: endsAt.toISOString(), timeZone: SALON_TIME_ZONE },
        reminders: { useDefault: true },
      }),
    });

    if (!response.ok) {
      throw new Error(`Création de l'événement refusée (${response.status}) : ${await response.text()}`);
    }

    res.status(201).json({
      message: "Votre rendez-vous est enregistré.",
      summary: {
        service: service.name,
        date: formatReadableDate(String((req.body as Record<string, string>).appointmentDate)),
        slot: slot.value,
      },
    });
  } catch (error) {
    console.error("Échec de l'enregistrement de la réservation", error);
    res.status(502).json({
      error: "Impossible d'enregistrer le rendez-vous pour le moment. Merci de réessayer ou de nous appeler.",
    });
  }
}
