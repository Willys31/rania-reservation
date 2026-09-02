/* Atelier Graphite — page éditoriale noir/ivoire, composition asymétrique et interactions précises. */
import { FormEvent, useMemo, useState } from "react";
import { ArrowUpRight, CalendarCheck, Clock3, MapPin, Phone, Sparkles } from "lucide-react";
import { services, timeSlots, validateBooking } from "@shared/booking";

const logo = "/images/rania-logo.png";
const heroImage = "/images/rania-hero.jpg";
const detailImage = "/images/rania-detail.jpg";

type BookingConfirmation = { service: string; date: string; slot: string };

export default function Home() {
  const [selectedService, setSelectedService] = useState(services[0].name);
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const selected = useMemo(() => services.find((service) => service.name === selectedService) ?? services[0], [selectedService]);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    /* Même validation que côté serveur : la cliente voit l'erreur sans aller-retour réseau. */
    const check = validateBooking(data);
    if (!check.ok) {
      setFormError(check.error);
      return;
    }

    setFormError("");
    setStatus("sending");
    try {
      const response = await fetch("/api/reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: BookingConfirmation };
      if (!response.ok) {
        setFormError(payload.error ?? "Impossible d'enregistrer le rendez-vous. Merci de réessayer.");
        setStatus("idle");
        return;
      }
      setConfirmation(payload.summary ?? null);
      setStatus("success");
      form.reset();
      setSelectedService(services[0].name);
    } catch {
      setFormError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
      setStatus("idle");
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#accueil" aria-label="RANIA — accueil">
          <img src={logo} alt="RANIA — La beauté du regard" />
        </a>
        <nav className="topnav" aria-label="Navigation principale">
          <a href="#prestations">Prestations</a>
          <a href="#reservation">Réserver</a>
        </nav>
        <a className="topbar-phone" href="tel:+2250700888451"><Phone size={15} /> <span>07 00 88 84 51</span></a>
      </header>

      <section id="accueil" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Rania La beauté du regard</p>
          <h1>Le regard,<br /><em>travaillé</em><br />avec précision.</h1>
          <p className="hero-intro">Des poses pensées pour révéler votre expression, avec la finesse et l’exigence de RANIA.</p>
          <a href="#reservation" className="button button-dark">Prendre rendez-vous <ArrowUpRight size={17} /></a>
          <div className="hero-meta"><span>01 — RANIA</span><span>Abidjan · Côte d’Ivoire</span></div>
        </div>
        <div className="hero-visual">
          <img src={heroImage} alt="Regard mis en valeur par une pose de cils RANIA" />
          <div className="hero-visual-caption"><span>La beauté</span><strong>du regard</strong></div>
          <div className="vertical-label">RANIA - La beauté du regard</div>
        </div>
      </section>

      <section className="statement-section">
        <div className="section-index">02 <span /></div>
        <div className="statement-content"><p className="eyebrow">L’expérience RANIA</p><h2>Une signature<br /><em>pour chaque regard.</em></h2></div>
        <div className="statement-aside"><p>Du naturel au volume le plus affirmé, chaque prestation est choisie selon votre regard, votre style et l’effet que vous souhaitez porter.</p><a href="#prestations" className="text-link">Découvrir les prestations <ArrowUpRight size={16} /></a></div>
      </section>

      <section id="prestations" className="services-section">
        <div className="services-heading"><div className="section-index">03 <span /></div><p className="eyebrow">La grille tarifaire</p><h2>Choisissez<br /><em>votre signature.</em></h2><p className="heading-note">Tous les tarifs sont indiqués en FCFA.</p></div>
        <div className="service-list">{services.map((service, index) => <button type="button" className={`service-row ${selectedService === service.name ? "is-selected" : ""}`} key={service.name} onClick={() => { setSelectedService(service.name); document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth" }); }}><span className="service-media"><img src={service.image} alt={`Pose de cils ${service.name} par RANIA`} loading="lazy" /></span><span className="service-body"><span className="service-number">0{index + 1}</span><span className="service-name"><strong>{service.name}</strong><small>{service.note}</small></span><span className="service-price">{service.price}<small> FCFA</small></span></span><ArrowUpRight className="service-arrow" size={18} /></button>)}</div>
        <div className="service-image"><img src={detailImage} alt="Détail d’un œil avec extensions de cils" /><span>Le détail fait<br /><em>la différence.</em></span></div>
      </section>

      <section id="reservation" className="booking-section">
        <div className="booking-intro"><div className="section-index light-index">04 <span /></div><p className="eyebrow">Votre rendez-vous</p><h2>Réserver<br /><em>votre moment.</em></h2><p>Renseignez vos coordonnées et la prestation souhaitée. Votre créneau est inscrit immédiatement dans l’agenda de RANIA.</p><div className="booking-info"><div><Clock3 size={18} /><span>Lundi — Vendredi<br /><strong>09:00 — 12:00</strong><br /><strong>14:00 — 17:00</strong></span></div><div><MapPin size={18} /><span>Immeuble Vanda<br /><strong>Cocody 2 Plateaux Vallons - 3e Etage</strong></span></div></div></div>
        <form className="booking-form" onSubmit={handleSubmit}>
          <div className="form-heading"><span>FORMULAIRE DE RÉSERVATION</span><span>RANIA / 04</span></div>
          <label>Nom et prénoms<input required name="name" placeholder="Votre nom complet" /></label>
          <label>Numéro de téléphone<input required name="phone" type="tel" placeholder="07 00 00 00 00" /></label>
          <label>Type de service<select required name="service" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>{services.map((service) => <option key={service.name} value={service.name}>{service.name} — {service.price} FCFA</option>)}</select></label>
          <div className="form-grid"><label>Date souhaitée<input required name="appointmentDate" type="date" min={minDate} onChange={() => setFormError("")} /><small className="field-hint">Du lundi au vendredi</small></label><label>Créneau souhaité<select required name="appointmentTime" defaultValue="" onChange={() => setFormError("")}><option value="" disabled>Choisir un créneau</option>{timeSlots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label></div>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <div className="selection-summary"><span>Votre sélection</span><strong>{selected.name}</strong><b>{selected.price} <small>FCFA</small></b></div>
          <button className="button button-light submit-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "Enregistrement…" : status === "success" ? <><CalendarCheck size={17} /> Rendez-vous enregistré</> : <>Confirmer ma demande <ArrowUpRight size={17} /></>}</button>
          <p className="form-footnote">Votre créneau est ajouté directement à l’agenda de RANIA. Vous serez rappelée au numéro indiqué pour confirmer les derniers détails.</p>
          {status === "success" && <div className="success-message" role="status"><Sparkles size={16} /> {confirmation ? `C’est noté : ${confirmation.service} — ${confirmation.date}, ${confirmation.slot}.` : "Merci, votre rendez-vous est enregistré."}</div>}
        </form>
      </section>

      <section className="contact-strip"><div className="contact-text"><p className="eyebrow">Besoin d’un renseignement ?</p><h2>Parlons de votre<br /><em>prochain regard.</em></h2></div><a className="contact-link" href="https://wa.me/2250700888451" target="_blank" rel="noreferrer"><span>WhatsApp</span><strong>07 00 88 84 51</strong><ArrowUpRight size={20} /></a><div className="contact-texture" aria-hidden="true"><span>RANIA</span><i /><i /><i /></div></section>
      <footer className="footer"><div className="footer-brand"><img src={logo} alt="RANIA" /></div><span>© {new Date().getFullYear()} RANIA — La beauté du regard</span><span>Abidjan, Côte d’Ivoire</span></footer>
    </main>
  );
}
