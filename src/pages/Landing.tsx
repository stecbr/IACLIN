import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Rocket,
  Sparkles,
  Menu,
  ArrowRight,
  Instagram,
  Linkedin,
  Mail,
  Search,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SYSTEM_URL, SIGNUP_URL } from "@/config/landing";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LANDING_CONTENT,
  resolveSegment,
  type LandingContent,
  type Segment,
} from "@/config/landingContent";
import iaclinLogoAsset from '@/assets/iaclin-logo.png.asset.json';
const logoLight = iaclinLogoAsset.url;
import landingDashboard from "@/assets/landing-dashboard.png";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <img src={logoLight} alt="IACLIN" className="h-8 object-contain" />
      <span
        className="text-2xl leading-none"
        style={{ fontFamily: "'Jura', sans-serif", letterSpacing: '0.12em', fontWeight: 600 }}
      >
        <span style={{ color: '#033563' }}>IA</span>
        <span style={{ color: '#5b6887' }}>CLIN</span>
      </span>
    </Link>
  );
}

function Navbar() {
  const links = [
    { href: "#problema", label: "Problema" },
    { href: "#solucao", label: "Solução" },
    { href: "#beneficios", label: "Benefícios" },
    { href: "#como-funciona", label: "Como funciona" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/marketplace"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sou paciente
          </Link>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <a href={SYSTEM_URL}>Entrar</a>
          </Button>
          <Button asChild size="sm" className="shadow-card">
            <a href={SIGNUP_URL}>Começar grátis</a>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/marketplace"
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Sou paciente
              </Link>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild variant="outline">
                  <a href={SYSTEM_URL}>Entrar</a>
                </Button>
                <Button asChild>
                  <a href={SIGNUP_URL}>Começar grátis</a>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card-hover">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">iaclin.app/dashboard</span>
          <div className="h-6 w-6 rounded-full bg-primary/10" />
        </div>
        <img
          src={landingDashboard}
          alt="Painel do Iaclin"
          loading="lazy"
          className="mt-4 w-full rounded-lg border border-border"
        />
      </div>
    </div>
  );
}

function Hero({ content }: { content: LandingContent }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
      <div className="container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {content.hero.eyebrow}
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            {content.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            {content.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="shadow-card-hover">
              <a href={SIGNUP_URL}>
                <Rocket className="h-4 w-4" />
                {content.hero.cta}
              </a>
            </Button>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver como funciona
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Sem cartão de crédito. Cancele quando quiser.
          </p>
        </motion.div>
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

function Problem({ content }: { content: LandingContent }) {
  return (
    <section id="problema" className="bg-secondary/40 py-20">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">O problema</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            A rotina da clínica não deveria ser tão difícil.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Os principais gargalos que travam o crescimento de quem atende todos os dias.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Solution({ content }: { content: LandingContent }) {
  return (
    <section id="solucao" className="container py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">A solução</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {content.solution.title}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {content.solution.desc}
          </p>
          <ul className="mt-6 space-y-3">
            {content.solution.pillars.map((it) => (
              <li key={it.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <it.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{it.title}</p>
                  <p className="text-sm text-muted-foreground">{it.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

function Benefits({ content }: { content: LandingContent }) {
  return (
    <section id="beneficios" className="bg-secondary/40 py-20">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Benefícios</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Resultados reais para sua clínica.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Mais que funcionalidades — uma operação mais leve, lucrativa e previsível.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ content }: { content: LandingContent }) {
  return (
    <section id="como-funciona" className="container py-20">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Como funciona</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Em 3 passos simples.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Do cadastro ao primeiro atendimento — em minutos.
        </p>
      </motion.div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {content.howItWorks.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="relative rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <span className="absolute -top-3 left-6 inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SocialProof({ content }: { content: LandingContent }) {
  return (
    <section id="prova-social" className="bg-secondary/40 py-20">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Prova social</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Clínicas que confiam no Iaclin.
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {content.social.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-card"
            >
              <p className="text-3xl font-semibold text-foreground">{m.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {content.social.testimonials.map((t) => (
            <motion.figure
              key={t.name}
              {...fadeUp}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <blockquote className="text-sm text-foreground md:text-base">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {t.name
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {content.social.partners.map((p) => (
            <span
              key={p}
              className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ content }: { content: LandingContent }) {
  return (
    <section id="faq" className="container py-20">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Perguntas frequentes.
        </h2>
      </motion.div>
      <div className="mx-auto mt-10 max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          {content.faq.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-medium text-foreground">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function FinalCTA({ content }: { content: LandingContent }) {
  return (
    <section className="container py-20">
      <motion.div
        {...fadeUp}
        className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-card-hover md:p-16"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)]" />
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Comece em minutos
        </span>
        <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {content.finalCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {content.finalCta.desc}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="shadow-card-hover">
            <a href={SIGNUP_URL}>
              <Rocket className="h-4 w-4" />
              {content.finalCta.cta}
            </a>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a href={SYSTEM_URL}>Já tenho conta</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Sem cartão de crédito · Cancele quando quiser
        </p>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Gestão clínica inteligente, moderna e humanizada — em uma única plataforma.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Produto</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#recursos" className="hover:text-foreground">Recursos</a></li>
              <li><a href="#diferenciais" className="hover:text-foreground">Diferenciais</a></li>
              <li><a href={SYSTEM_URL} className="hover:text-foreground">Acessar</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Empresa</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#sobre" className="hover:text-foreground">Sobre</a></li>
              <li><a href="#profissionais" className="hover:text-foreground">Para quem é</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Contato</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contato@iaclin.com</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Iaclin. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">Privacidade</a>
            <a href="#" className="hover:text-foreground">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  const [params] = useSearchParams();
  const content = useMemo<LandingContent>(() => {
    const seg = resolveSegment(params.get("segmento") || params.get("segment"));
    return LANDING_CONTENT[seg];
  }, [params]);

  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <Navbar />
      <main>
        <Hero content={content} />
        <Problem content={content} />
        <Solution content={content} />
        <Benefits content={content} />
        <HowItWorks content={content} />
        <SocialProof content={content} />
        <FAQSection content={content} />
        <FinalCTA content={content} />
      </main>
      <Footer />
    </div>
  );
}