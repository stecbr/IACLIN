import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, Users, Shield, FileHeart, Stethoscope, Building2, UserCheck, ArrowLeft, ChevronRight } from 'lucide-react';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

type UserType = null | 'profissional' | 'operadora' | 'cliente';
type ProfessionalSubType = null | 'medico' | 'dentista';

const features = [
  { icon: Calendar, text: 'Agenda inteligente com visualização dia, semana e mês' },
  { icon: Users, text: 'Gestão completa de pacientes e prontuários' },
  { icon: FileHeart, text: 'Odontograma interativo com planos de tratamento' },
  { icon: Shield, text: 'Segurança e privacidade dos dados clínicos' },
];

export default function Auth() {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signup flow state
  const [userType, setUserType] = useState<UserType>(null);
  const [profSubType, setProfSubType] = useState<ProfessionalSubType>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      } else {
        const clinicCategory = profSubType === 'dentista' ? 'odonto' : profSubType === 'medico' ? 'medico' : 'outro';
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              user_type: userType,
              professional_subtype: profSubType,
              clinic_category: clinicCategory,
            },
          },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu e-mail para confirmar.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetSignupFlow = () => {
    setIsLogin(false);
    setUserType(null);
    setProfSubType(null);
  };

  // Determine if signup form should show
  const signupReady = isLogin || (userType !== null && (userType !== 'profissional' || profSubType !== null));

  const typeCards = [
    {
      key: 'profissional' as const,
      icon: Stethoscope,
      label: 'Profissional de Saúde',
      desc: 'Médico, Dentista ou outro profissional',
      color: 'from-blue-500/10 to-cyan-500/10 border-blue-200 dark:border-blue-800',
      activeColor: 'from-blue-500/20 to-cyan-500/20 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'operadora' as const,
      icon: Building2,
      label: 'Operadora',
      desc: 'Operadora de saúde ou convênio',
      color: 'from-violet-500/10 to-purple-500/10 border-violet-200 dark:border-violet-800',
      activeColor: 'from-violet-500/20 to-purple-500/20 border-violet-400 dark:border-violet-600 ring-2 ring-violet-400/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      key: 'cliente' as const,
      icon: UserCheck,
      label: 'Paciente',
      desc: 'Buscar profissionais e agendar',
      color: 'from-emerald-500/10 to-green-500/10 border-emerald-200 dark:border-emerald-800',
      activeColor: 'from-emerald-500/20 to-green-500/20 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  const profSubCards = [
    {
      key: 'medico' as const,
      icon: Stethoscope,
      label: 'Médico',
      desc: 'Clínica médica geral ou especializada',
    },
    {
      key: 'dentista' as const,
      icon: FileHeart,
      label: 'Dentista',
      desc: 'Clínica odontológica',
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/90 to-primary flex-col justify-between p-12 text-primary-foreground">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img src={logoDark} alt="IACLIN" className="h-10" />
          </div>
          <p className="text-sm text-primary-foreground/70">Gestão Clínica Inteligente</p>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-semibold leading-tight">
            Sua clínica organizada,<br />do agendamento ao financeiro.
          </h2>
          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="h-4 w-4" />
                </div>
                <p className="text-sm text-primary-foreground/80 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-primary-foreground/40">© 2026 IACLIN. Todos os direitos reservados.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center mb-4">
              <img src={logoLight} alt="IACLIN" className="h-10" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? 'Acesse sua clínica' : 'Cadastre-se para começar'}
            </p>
          </div>

          {/* Signup type selection */}
          {!isLogin && userType === null && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">Como você vai usar o IACLIN?</p>
              <div className="space-y-3">
                {typeCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setUserType(card.key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-gradient-to-r transition-all duration-200 text-left hover:scale-[1.01] active:scale-[0.99] ${card.color}`}
                    >
                      <div className={`h-11 w-11 rounded-xl bg-background/80 flex items-center justify-center flex-shrink-0 ${card.iconColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Já tem conta? Entrar
                </button>
              </div>
            </div>
          )}

          {/* Professional sub-type selection */}
          {!isLogin && userType === 'profissional' && profSubType === null && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setUserType(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
              <p className="text-sm font-medium text-foreground">Qual sua especialidade?</p>
              <div className="space-y-3">
                {profSubCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setProfSubType(card.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-gradient-to-r from-muted/30 to-muted/10 transition-all duration-200 text-left hover:border-primary/40 hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actual signup/login form */}
          {(isLogin || signupReady) && (isLogin || (userType !== null && (userType !== 'profissional' || profSubType !== null))) && (
            <>
              {!isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    if (userType === 'profissional' && profSubType) {
                      setProfSubType(null);
                    } else {
                      setUserType(null);
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
              )}

              {!isLogin && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-muted/50 border border-border flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Cadastro como:</span>
                  <span className="text-xs font-medium text-primary">
                    {userType === 'profissional' 
                      ? profSubType === 'dentista' ? '🦷 Dentista' : '🩺 Médico'
                      : userType === 'operadora' ? '🏢 Operadora' : '👤 Paciente'
                    }
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={userType === 'profissional' ? 'Dr. João Silva' : userType === 'operadora' ? 'Nome da empresa' : 'Seu nome completo'}
                      required={!isLogin}
                      className="h-10"
                      autoFocus
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@clinica.com"
                    required
                    className="h-10"
                    autoFocus={isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {isLogin && (
                      <button type="button" className="text-xs text-primary hover:underline">
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="w-full h-10" disabled={submitting}>
                  {submitting ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isLogin) {
                      resetSignupFlow();
                    } else {
                      setIsLogin(true);
                    }
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
