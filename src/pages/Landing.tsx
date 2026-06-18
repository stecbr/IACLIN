import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  FileText,
  Users,
  History,
  HeartHandshake,
  BarChart3,
  Building2,
  ShieldCheck,
  Check,
  Rocket,
  Sparkles,
  Stethoscope,
  Brain,
  Scissors,
  Activity,
  Apple,
  Bluetooth,
  Menu,
  ArrowRight,
  Instagram,
  Linkedin,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SYSTEM_URL, SIGNUP_URL } from "@/config/landing";
import { Input } from "@/components/ui/input";
import type { DoctorData } from "@/components/marketplace/DoctorCard";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin } from "lucide-react";
import { MarketplaceSection } from "@/components/landing/MarketplaceSection";
import { addDays, format } from "date-fns";
import logoLight from "@/assets/logo-light.png";
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
      <img src={logoLight} alt="Iaclin" className="h-8 object-contain" />
      <span className="text-xl font-bold tracking-tight leading-none">
        <span style={{ color: "#033563" }}>IA</span>
        <span style={{ color: "#5b6887" }}>CLIN</span>
      </span>
    </Link>
  );
}

function Navbar() {
  const links = [
    { href: "#sobre", label: "Sobre" },
    { href: "#recursos", label: "Recursos" },
    { href: "#diferenciais", label: "Diferenciais" },
    { href: "#profissionais", label: "Para quem é" },
    { href: "#marketplace", label: "Rede Médica" },
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
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <a href={SYSTEM_URL}>Entrar</a>
          </Button>
          <Button asChild size="sm" className="shadow-card">
            <a href={SYSTEM_URL}>Acessar o Iaclin</a>
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
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild variant="outline">
                  <a href={SYSTEM_URL}>Entrar</a>
                </Button>
                <Button asChild>
                  <a href={SYSTEM_URL}>Acessar o Iaclin</a>
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

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
      <div className="container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Plataforma clínica inteligente
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Gestão clínica inteligente, moderna e humanizada.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            O Iaclin foi criado para simplificar atendimentos, prontuários, agenda e gestão clínica
            em uma única plataforma.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="shadow-card-hover">
              <a href={SYSTEM_URL}>
                <Rocket className="h-4 w-4" />
                Acessar o Iaclin
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#recursos">
                Ver recursos
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Para clínicas odontológicas, médicas, estética, psicologia, fisioterapia e nutrição.
          </p>
        </motion.div>
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

function About() {
  const chips = ["Agenda", "Prontuário", "Atendimento", "Gestão"];
  return (
    <section id="sobre" className="container py-20">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sobre o sistema</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Tudo o que sua clínica precisa, em um só lugar.
        </h2>
        <p className="mt-4 text-muted-foreground">
          O Iaclin é uma plataforma completa de gestão clínica que conecta agenda, prontuários,
          pacientes e financeiro em um fluxo simples — pensada para profissionais que valorizam
          produtividade, segurança e uma experiência elegante no dia a dia.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-card"
            >
              {c}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

const FEATURES = [
  { icon: Calendar, title: "Agenda Inteligente", desc: "Encaixes, bloqueios e lembretes automáticos por WhatsApp." },
  { icon: FileText, title: "Prontuário Digital", desc: "Fichas clínicas completas, organizadas e seguras." },
  { icon: Users, title: "Gestão de Pacientes", desc: "Cadastro, anamnese e histórico em um só perfil." },
  { icon: History, title: "Histórico Clínico", desc: "Linha do tempo completa de cada paciente." },
  { icon: HeartHandshake, title: "Atendimento Humanizado", desc: "Fluxos pensados para acolher e otimizar tempo." },
  { icon: BarChart3, title: "Relatórios e Organização", desc: "Indicadores claros para decisões melhores." },
  { icon: Building2, title: "Controle da Clínica", desc: "Times, salas, especialidades e operação centralizadas." },
  { icon: ShieldCheck, title: "Segurança de Dados", desc: "Criptografia, RLS e conformidade com LGPD." },
];

function Features() {
  return (
    <section id="recursos" className="bg-secondary/40 py-20">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Funcionalidades</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Recursos pensados para a rotina clínica.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tudo o que você precisa para atender melhor, com menos esforço.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Differentials() {
  const items = [
    "Interface simples e intuitiva",
    "Visual moderno e elegante",
    "Fácil de usar por toda a equipe",
    "Totalmente responsivo",
    "Segurança e conformidade LGPD",
    "Organização profissional",
    "Experiência premium do início ao fim",
  ];
  return (
    <section id="diferenciais" className="container py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Diferenciais</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Feito com cuidado em cada detalhe.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cada decisão de design e tecnologia foi tomada para entregar uma experiência clínica
            premium, fluida e confiável.
          </p>
          <ul className="mt-6 space-y-3">
            {items.map((it) => (
              <li key={it} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm text-foreground">{it}</span>
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "99.9%", v: "Uptime" },
                { k: "<200ms", v: "Resposta" },
                { k: "LGPD", v: "Compliance" },
                { k: "24/7", v: "Disponibilidade" },
              ].map((s) => (
                <div key={s.v} className="rounded-xl border border-border bg-background/60 p-5">
                  <p className="text-2xl font-semibold text-foreground">{s.k}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const SPECIALTIES = [
  { icon: Bluetooth, label: "Dentistas" },
  { icon: Stethoscope, label: "Clínicos" },
  { icon: Brain, label: "Psicólogos" },
  { icon: Scissors, label: "Estética" },
  { icon: Activity, label: "Fisioterapia" },
  { icon: Apple, label: "Nutrição" },
];

function Professionals() {
  return (
    <section id="profissionais" className="bg-secondary/40 py-20">
      <div className="container">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Para profissionais</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Feito para médicos, dentistas, clínicas e profissionais da saúde.
          </h2>
        </motion.div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SPECIALTIES.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 text-center shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-foreground">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PREVIEW_SPECIALTIES = [
  "Clínico Geral",
  "Ortodontia",
  "Implantodontia",
  "Endodontia",
  "Periodontia",
  "Estética",
];

function buildPreviewShifts() {
  const today = new Date();
  return [0, 1, 2, 3].flatMap((d) => {
    const date = format(addDays(today, d), "yyyy-MM-dd");
    return [
      { date, start: "09:00:00", end: "12:00:00" },
      { date, start: "14:00:00", end: "17:00:00" },
    ];
  });
}

const PREVIEW_DOCTORS = ([
  {
    userId: "preview-1",
    specialty: "Ortodontia",
    fullName: "Dra. Camila Ribeiro",
    avatarUrl: null,
    clinicId: "preview-clinic-1",
    clinicName: "Clínica Sorria+",
    clinicCity: "São Paulo",
    clinicState: "SP",
    clinicPhone: "(11) 99999-0001",
    clinicAddress: null,
    clinicZipCode: null,
    shifts: buildPreviewShifts(),
    appointments: [],
  },
  {
    userId: "preview-2",
    specialty: "Implantodontia",
    fullName: "Dr. Rafael Almeida",
    avatarUrl: null,
    clinicId: "preview-clinic-2",
    clinicName: "Instituto OdontoVida",
    clinicCity: "Rio de Janeiro",
    clinicState: "RJ",
    clinicPhone: "(21) 98888-0002",
    clinicAddress: null,
    clinicZipCode: null,
    shifts: buildPreviewShifts(),
    appointments: [],
  },
] as unknown) as DoctorData[];

function MarketplacePreview() {
  return <MarketplaceSection />;
}

function FinalCTA() {
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
          Transforme sua rotina clínica com o Iaclin.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Entre na plataforma e descubra como organizar atendimentos, prontuários e gestão em
          poucos cliques.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="shadow-card-hover">
            <a href={SYSTEM_URL}>
              <Rocket className="h-4 w-4" />
              Acessar o Iaclin
            </a>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href={SIGNUP_URL}>Criar Conta</a>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a href={SYSTEM_URL}>Entrar no Sistema</a>
          </Button>
        </div>
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
  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Features />
        <Differentials />
        <Professionals />
        <MarketplacePreview />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}