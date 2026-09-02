/* Données de réservation partagées entre le formulaire client et la fonction serverless. */

export type Service = { name: string; price: string; note: string; image: string };

export const services: Service[] = [
  { name: "Classique", price: "15 000", note: "Ligne naturelle", image: "/images/services/classique.jpg" },
  { name: "Hybride", price: "20 000", note: "Mixte & texturé", image: "/images/services/hybrid.jpg" },
  { name: "Volume russe", price: "25 000", note: "Intensité élégante", image: "/images/services/volume-russe.jpg" },
  { name: "Volume russe mega", price: "30 000", note: "Effet signature", image: "/images/services/volume-russe-mega.jpg" },
  { name: "Wet set", price: "35 000", note: "Brillance graphique", image: "/images/services/wet-set.jpg" },
  { name: "Wispy", price: "35 000", note: "Effet aérien", image: "/images/services/wispy.jpg" },
  { name: "Open eye", price: "35 000", note: "Regard ouvert", image: "/images/services/open-eye.jpg" },
  { name: "Clusters", price: "6 000", note: "Pose express", image: "/images/services/clusters.jpg" },
  { name: "Dépose + entretien", price: "10 000", note: "Soin & retouche", image: "/images/services/depose-entretien.jpg" },
];

export type TimeSlot = { value: string; label: string; start: string; end: string };

export const timeSlots: TimeSlot[] = [
  { value: "09:00 — 12:00", label: "Matin · 09:00 — 12:00", start: "09:00", end: "12:00" },
  { value: "14:00 — 17:00", label: "Après-midi · 14:00 — 17:00", start: "14:00", end: "17:00" },
];

/* Abidjan est à UTC+00:00 toute l'année : pas de passage heure d'été à gérer. */
export const SALON_TIME_ZONE = "Africa/Abidjan";
export const SALON_UTC_OFFSET = "+00:00";
export const SALON_ADDRESS = "Immeuble Vanda, Cocody 2 Plateaux Vallons — 3e étage, Abidjan, Côte d'Ivoire";

export type BookingInput = {
  name: string;
  phone: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
};

export type BookingValidation =
  | { ok: true; name: string; phone: string; service: Service; slot: TimeSlot; startsAt: Date; endsAt: Date }
  | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* Instant absolu correspondant à `HH:MM` le jour `YYYY-MM-DD` dans le fuseau du salon. */
export function salonInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${SALON_UTC_OFFSET}`);
}

export function formatReadableDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SALON_TIME_ZONE,
  }).format(salonInstant(date, "12:00"));
}

/* Validation appliquée des deux côtés : le client voit l'erreur tout de suite,
   le serveur ne fait jamais confiance à ce qui lui arrive. */
export function validateBooking(input: Partial<BookingInput>, now: Date = new Date()): BookingValidation {
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "Merci d'indiquer votre nom et prénoms." };
  }

  const phone = String(input.phone ?? "").trim();
  if (phone.length < 8 || phone.length > 25 || !/^[\d\s+().-]+$/.test(phone)) {
    return { ok: false, error: "Merci d'indiquer un numéro de téléphone valide." };
  }

  const service = services.find((item) => item.name === String(input.service ?? "").trim());
  if (!service) {
    return { ok: false, error: "Merci de choisir une prestation dans la liste." };
  }

  const slot = timeSlots.find((item) => item.value === String(input.appointmentTime ?? "").trim());
  if (!slot) {
    return { ok: false, error: "Merci de choisir un créneau dans la liste." };
  }

  const appointmentDate = String(input.appointmentDate ?? "").trim();
  if (!DATE_PATTERN.test(appointmentDate)) {
    return { ok: false, error: "Merci de choisir une date valide." };
  }

  const startsAt = salonInstant(appointmentDate, slot.start);
  const endsAt = salonInstant(appointmentDate, slot.end);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Merci de choisir une date valide." };
  }

  /* getUTCDay() est le bon jour de la semaine ici puisque le salon est à UTC+00:00. */
  const weekday = startsAt.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return { ok: false, error: "Veuillez choisir un jour du lundi au vendredi." };
  }

  if (startsAt.getTime() <= now.getTime()) {
    return { ok: false, error: "Ce créneau est déjà passé. Merci de choisir une date à venir." };
  }

  return { ok: true, name, phone, service, slot, startsAt, endsAt };
}
