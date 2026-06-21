import type { LucideIcon } from "lucide-react";
import {
  CalendarX,
  FileWarning,
  Wallet,
  MessagesSquare,
  Calendar,
  FileText,
  BarChart3,
  Sparkles,
  Clock,
  TrendingUp,
  HeartHandshake,
  ShieldCheck,
  UserPlus,
  Settings2,
  Rocket,
} from "lucide-react";

export type Segment = "odonto" | "medico" | "fisio" | "estetica";

export interface LandingContent {
  segment: Segment;
  audienceLabel: string;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
  };
  problems: { icon: LucideIcon; title: string; desc: string }[];
  solution: {
    title: string;
    desc: string;
    pillars: { icon: LucideIcon; title: string; desc: string }[];
  };
  benefits: { icon: LucideIcon; title: string; desc: string }[];
  howItWorks: { icon: LucideIcon; title: string; desc: string }[];
  social: {
    metrics: { value: string; label: string }[];
    testimonials: { quote: string; name: string; role: string }[];
    partners: string[];
  };
  faq: { q: string; a: string }[];
  finalCta: { title: string; desc: string; cta: string };
}

const commonHowItWorks = [
  { icon: UserPlus, title: "Cadastre-se", desc: "Crie sua conta em menos de 2 minutos, sem cartão de crédito." },
  { icon: Settings2, title: "Configure sua operação", desc: "Importe pacientes, ajuste agenda, equipe e preferências." },
  { icon: Rocket, title: "Comece a atender", desc: "Use o Iaclin no dia a dia e veja sua clínica organizada." },
];

const commonFaq = [
  {
    q: "Preciso instalar algo?",
    a: "Não. O Iaclin roda 100% no navegador, em qualquer dispositivo — computador, tablet ou celular.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Usamos criptografia de ponta, isolamento por clínica e seguimos as diretrizes da LGPD.",
  },
  {
    q: "Consigo migrar meus pacientes atuais?",
    a: "Sim. Importamos sua base existente e ajudamos no onboarding da equipe.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade. Você cancela a qualquer momento direto pelo painel.",
  },
];

export const LANDING_CONTENT: Record<Segment, LandingContent> = {
  odonto: {
    segment: "odonto",
    audienceLabel: "Clínicas odontológicas",
    hero: {
      eyebrow: "Para clínicas odontológicas",
      title: "Sua clínica odontológica organizada em uma única plataforma.",
      subtitle:
        "Agenda, prontuário, odontograma e financeiro conectados — para você atender mais pacientes com menos esforço.",
      cta: "Começar grátis agora",
    },
    problems: [
      { icon: CalendarX, title: "Agenda confusa e furos no dia", desc: "Encaixes perdidos, faltas sem aviso e horários ociosos." },
      { icon: FileWarning, title: "Prontuários espalhados", desc: "Fichas em papel, planilhas e WhatsApp — sem padrão." },
      { icon: Wallet, title: "Financeiro no escuro", desc: "Você não sabe ao certo quanto entra, sai e quanto cada dentista produz." },
      { icon: MessagesSquare, title: "Confirmação manual cansa", desc: "Sua secretária gasta horas confirmando consultas no WhatsApp." },
    ],
    solution: {
      title: "Tudo o que falta na sua clínica, em um só lugar.",
      desc: "O Iaclin centraliza atendimento clínico, gestão e relacionamento com paciente — pensado para a rotina odontológica.",
      pillars: [
        { icon: Calendar, title: "Agenda + confirmação automática", desc: "Lembretes por WhatsApp e bloqueio inteligente de horários." },
        { icon: FileText, title: "Prontuário + odontograma digital", desc: "Histórico completo, evolução visual e anexos seguros." },
        { icon: BarChart3, title: "Financeiro e produção por dentista", desc: "Comissões, recebíveis e indicadores claros em tempo real." },
      ],
    },
    benefits: [
      { icon: Clock, title: "Ganhe 2h por dia", desc: "Menos tempo em papelada, mais tempo atendendo." },
      { icon: TrendingUp, title: "Aumente a ocupação da agenda", desc: "Reduza faltas com confirmações automáticas." },
      { icon: Wallet, title: "Tenha clareza financeira", desc: "Acompanhe receita, despesas e comissões em tempo real." },
      { icon: HeartHandshake, title: "Fidelize seus pacientes", desc: "Relacionamento ativo e atendimento humanizado." },
      { icon: ShieldCheck, title: "Conformidade com a LGPD", desc: "Dados clínicos protegidos e isolados por clínica." },
      { icon: Sparkles, title: "Experiência premium", desc: "Uma interface elegante que sua equipe adora usar." },
    ],
    howItWorks: commonHowItWorks,
    social: {
      metrics: [
        { value: "+30%", label: "ocupação de agenda" },
        { value: "-40%", label: "tempo em tarefas administrativas" },
        { value: "99.9%", label: "uptime garantido" },
      ],
      testimonials: [
        {
          quote:
            "O Iaclin trouxe organização para a clínica. A equipe ganhou tempo e os pacientes percebem a diferença no atendimento.",
          name: "Dra. Camila Ribeiro",
          role: "Ortodontista — Clínica Sorria+",
        },
        {
          quote:
            "O odontograma digital e o financeiro juntos mudaram a forma como acompanho a clínica todos os dias.",
          name: "Dr. Rafael Almeida",
          role: "Implantodontista — Instituto OdontoVida",
        },
      ],
      partners: ["Sorria+", "OdontoVida", "OdontoPrime", "DentalCare", "OrthoLab"],
    },
    faq: commonFaq,
    finalCta: {
      title: "Pronto para transformar sua clínica odontológica?",
      desc: "Comece grátis e veja em poucos dias a diferença na rotina da sua equipe.",
      cta: "Criar minha conta grátis",
    },
  },
  medico: {
    segment: "medico",
    audienceLabel: "Clínicas médicas",
    hero: {
      eyebrow: "Para clínicas médicas",
      title: "Mais tempo com seus pacientes, menos tempo em planilhas.",
      subtitle:
        "Agenda, prontuário eletrônico e gestão financeira em uma plataforma simples, segura e pronta para sua clínica.",
      cta: "Começar grátis agora",
    },
    problems: [
      { icon: CalendarX, title: "Agenda desorganizada", desc: "Encaixes manuais, faltas e horários vazios sem controle." },
      { icon: FileWarning, title: "Prontuário lento", desc: "Sistemas pesados que travam no meio da consulta." },
      { icon: Wallet, title: "Falta visão financeira", desc: "Difícil saber faturamento por médico, convênio ou procedimento." },
      { icon: MessagesSquare, title: "Comunicação fragmentada", desc: "Equipe perdida entre WhatsApp, telefone e e-mail." },
    ],
    solution: {
      title: "Uma plataforma feita para a rotina médica.",
      desc: "Centralize agenda, prontuário e financeiro com uma experiência rápida, moderna e segura.",
      pillars: [
        { icon: Calendar, title: "Agenda inteligente", desc: "Multi-profissional, com confirmação automática por WhatsApp." },
        { icon: FileText, title: "Prontuário eletrônico ágil", desc: "Modelos prontos, prescrição e exames em poucos cliques." },
        { icon: BarChart3, title: "Gestão clínica completa", desc: "Indicadores por médico, convênio e especialidade." },
      ],
    },
    benefits: [
      { icon: Clock, title: "Atendimentos mais rápidos", desc: "Prontuário fluido sem travar entre telas." },
      { icon: TrendingUp, title: "Mais pacientes atendidos", desc: "Otimize a agenda e reduza a ociosidade." },
      { icon: Wallet, title: "Controle financeiro real", desc: "Acompanhe entradas, despesas e repasses por médico." },
      { icon: HeartHandshake, title: "Relacionamento humanizado", desc: "Comunicação ativa e profissional com o paciente." },
      { icon: ShieldCheck, title: "Segurança e LGPD", desc: "Dados protegidos e isolados por clínica." },
      { icon: Sparkles, title: "Equipe satisfeita", desc: "Interface que reduz o atrito do dia a dia." },
    ],
    howItWorks: commonHowItWorks,
    social: {
      metrics: [
        { value: "+25%", label: "produtividade da equipe" },
        { value: "-50%", label: "tempo em tarefas repetitivas" },
        { value: "100%", label: "compliance LGPD" },
      ],
      testimonials: [
        {
          quote:
            "Conseguimos padronizar atendimentos e ter visão real do faturamento por médico. Mudou nossa operação.",
          name: "Dr. Pedro Lima",
          role: "Clínico Geral — Clínica Vita+",
        },
        {
          quote:
            "Interface limpa, rápida e fácil de adotar. Minha equipe aprendeu em um dia.",
          name: "Dra. Helena Souza",
          role: "Diretora — Núcleo Médico Bem-Estar",
        },
      ],
      partners: ["Vita+", "Núcleo Médico", "Clínica Saúde", "MedPrime", "VivaCare"],
    },
    faq: commonFaq,
    finalCta: {
      title: "Eleve o padrão da sua clínica médica.",
      desc: "Comece grátis e descubra uma gestão clínica realmente moderna.",
      cta: "Criar minha conta grátis",
    },
  },
  fisio: {
    segment: "fisio",
    audienceLabel: "Fisioterapeutas",
    hero: {
      eyebrow: "Para clínicas de fisioterapia",
      title: "Organize sessões, evolução e financeiro em um só lugar.",
      subtitle:
        "Plataforma completa para fisioterapeutas que querem ganhar tempo, fidelizar pacientes e crescer com previsibilidade.",
      cta: "Começar grátis agora",
    },
    problems: [
      { icon: CalendarX, title: "Difícil controlar pacotes de sessões", desc: "Você perde a conta de quantas sessões cada paciente já fez." },
      { icon: FileWarning, title: "Evolução em papel", desc: "Anotações soltas dificultam o acompanhamento clínico." },
      { icon: Wallet, title: "Recebimentos confusos", desc: "Pacotes, particulares e convênios misturados." },
      { icon: MessagesSquare, title: "Faltas frequentes", desc: "Sessões perdidas impactam diretamente o seu faturamento." },
    ],
    solution: {
      title: "Sua clínica de fisioterapia, no controle.",
      desc: "Acompanhe pacotes, evolução clínica e financeiro com uma experiência leve e clara.",
      pillars: [
        { icon: Calendar, title: "Agenda + pacotes de sessões", desc: "Controle quantas sessões restam para cada paciente." },
        { icon: FileText, title: "Evolução clínica digital", desc: "Histórico de atendimentos e progresso terapêutico." },
        { icon: BarChart3, title: "Financeiro por paciente", desc: "Visão clara de pacotes, pagamentos e inadimplência." },
      ],
    },
    benefits: [
      { icon: Clock, title: "Mais tempo de qualidade", desc: "Menos burocracia, mais foco no paciente." },
      { icon: TrendingUp, title: "Reduza faltas e desistências", desc: "Confirmações automáticas mantêm sua agenda cheia." },
      { icon: Wallet, title: "Previsibilidade financeira", desc: "Saiba exatamente o que vai entrar no mês." },
      { icon: HeartHandshake, title: "Pacientes fiéis", desc: "Acompanhamento ativo entre sessões." },
      { icon: ShieldCheck, title: "Conformidade LGPD", desc: "Dados clínicos seguros e organizados." },
      { icon: Sparkles, title: "Experiência premium", desc: "Uma plataforma elegante para sua marca." },
    ],
    howItWorks: commonHowItWorks,
    social: {
      metrics: [
        { value: "+35%", label: "aderência aos pacotes" },
        { value: "-45%", label: "faltas em sessões" },
        { value: "99.9%", label: "disponibilidade" },
      ],
      testimonials: [
        {
          quote:
            "Controlar pacotes e evolução ficou simples. Hoje sei exatamente como cada paciente está progredindo.",
          name: "Dra. Marina Costa",
          role: "Fisioterapeuta — Movi Reabilitação",
        },
        {
          quote:
            "Diminuímos faltas e aumentamos a fidelização. O Iaclin virou peça-chave da clínica.",
          name: "Dr. Lucas Pereira",
          role: "Diretor — Studio Fisio Corpo",
        },
      ],
      partners: ["Movi", "Studio Fisio", "ReabCenter", "CorpoVivo", "FisioPrime"],
    },
    faq: commonFaq,
    finalCta: {
      title: "Profissionalize sua clínica de fisioterapia.",
      desc: "Comece grátis e veja a diferença já nas primeiras semanas.",
      cta: "Criar minha conta grátis",
    },
  },
  estetica: {
    segment: "estetica",
    audienceLabel: "Clínicas de estética",
    hero: {
      eyebrow: "Para clínicas de estética",
      title: "Encante seus clientes e organize sua clínica de estética.",
      subtitle:
        "Agenda, ficha do cliente, protocolos e financeiro em uma plataforma elegante como a sua marca.",
      cta: "Começar grátis agora",
    },
    problems: [
      { icon: CalendarX, title: "Agenda lotada e mal aproveitada", desc: "Encaixes mal feitos e horários vazios entre sessões." },
      { icon: FileWarning, title: "Fichas e protocolos espalhados", desc: "Difícil acompanhar evolução de cada cliente." },
      { icon: Wallet, title: "Pacotes e comissões manuais", desc: "Erros frequentes no fechamento da semana." },
      { icon: MessagesSquare, title: "Cliente esquece o retorno", desc: "Sem lembretes, você perde recorrência." },
    ],
    solution: {
      title: "Uma plataforma à altura da sua clínica.",
      desc: "Visual premium, ficha do cliente completa e gestão clara para você focar no que faz de melhor.",
      pillars: [
        { icon: Calendar, title: "Agenda visual e elegante", desc: "Multi-profissional com confirmação automática." },
        { icon: FileText, title: "Ficha + protocolos", desc: "Histórico, fotos antes/depois e evolução estética." },
        { icon: BarChart3, title: "Comissões e pacotes", desc: "Cálculo automático para cada profissional." },
      ],
    },
    benefits: [
      { icon: Clock, title: "Atendimento mais fluido", desc: "Menos atrito, mais experiência premium." },
      { icon: TrendingUp, title: "Mais retornos e recorrência", desc: "Lembretes ativos para protocolos contínuos." },
      { icon: Wallet, title: "Comissões sem dor de cabeça", desc: "Cálculo automático por procedimento." },
      { icon: HeartHandshake, title: "Clientes encantados", desc: "Comunicação cuidadosa e personalizada." },
      { icon: ShieldCheck, title: "Dados protegidos", desc: "Conformidade LGPD em todas as etapas." },
      { icon: Sparkles, title: "Visual à altura da sua marca", desc: "Interface bonita que reforça seu posicionamento." },
    ],
    howItWorks: commonHowItWorks,
    social: {
      metrics: [
        { value: "+40%", label: "recorrência de clientes" },
        { value: "-30%", label: "tempo em tarefas operacionais" },
        { value: "99.9%", label: "uptime garantido" },
      ],
      testimonials: [
        {
          quote:
            "Meus clientes percebem o cuidado desde o agendamento. O Iaclin combina com a estética da minha marca.",
          name: "Bianca Mendes",
          role: "Esteticista — Studio Glow",
        },
        {
          quote:
            "Os pacotes e comissões deixaram de ser uma dor de cabeça. Hoje fecho o mês em minutos.",
          name: "Renata Lopes",
          role: "Sócia — Clínica Beauté",
        },
      ],
      partners: ["Studio Glow", "Beauté", "Bella Pele", "Estetic Pro", "Lumi"],
    },
    faq: commonFaq,
    finalCta: {
      title: "Eleve a experiência da sua clínica de estética.",
      desc: "Comece grátis e veja sua marca em outro patamar.",
      cta: "Criar minha conta grátis",
    },
  },
};

export function resolveSegment(value?: string | null): Segment {
  if (!value) return "odonto";
  const v = value.toLowerCase();
  if (v in LANDING_CONTENT) return v as Segment;
  if (v.startsWith("odo") || v.startsWith("dent")) return "odonto";
  if (v.startsWith("med")) return "medico";
  if (v.startsWith("fis")) return "fisio";
  if (v.startsWith("est")) return "estetica";
  return "odonto";
}