import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, FileHeart, Building2, UserCheck, ArrowLeft, ChevronRight, Lock, Eye, EyeOff } from 'lucide-react';
import { formatCpf, isValidCpf, unmaskCpf } from '@/lib/cpf';
import logoLight from '@/assets/logo-light.png';

type UserType = null | 'profissional' | 'operadora' | 'cliente';
type ProfessionalSubType = null | 'medico' | 'dentista';

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export default function Auth() {
  const { user, loading, isPatient } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [profSubType, setProfSubType] = useState<ProfessionalSubType>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      </div>
    );
  }

  if (user) {
    if (returnUrl) return <Navigate to={returnUrl} replace />;
    if (isPatient) return <Navigate to="/paciente" replace />;
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      } else {
        // Validate patient-specific fields
        if (userType === 'cliente') {
          if (!isValidCpf(cpf)) {
            toast.error('CPF inválido');
            setSubmitting(false);
            return;
          }
        }

        const clinicCategory = profSubType === 'dentista' ? 'odonto' : profSubType === 'medico' ? 'medico' : 'outro';
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              user_type: userType,
              professional_subtype: profSubType,
              clinic_category: clinicCategory,
              ...(userType === 'cliente' && {
                cpf: unmaskCpf(cpf),
                phone,
                insurance_provider: insuranceProvider || null,
                insurance_number: insuranceNumber || null,
              }),
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

  const signupReady =
    userType !== null &&
    (userType !== 'profissional' || profSubType !== null);

  // Determine current step key for AnimatePresence
  const stepKey = isLogin
    ? 'login'
    : userType === null
      ? 'type-select'
      : userType === 'profissional' && profSubType === null
        ? 'prof-select'
        : 'signup-form';

  const typeCards = [
    { key: 'profissional' as const, icon: Stethoscope, label: 'Profissional de Saúde', desc: 'Médico, Dentista ou outro', locked: false },
    { key: 'operadora' as const, icon: Building2, label: 'Operadora', desc: 'Operadora de saúde ou convênio', locked: true },
    { key: 'cliente' as const, icon: UserCheck, label: 'Paciente', desc: 'Buscar profissionais e agendar', locked: false },
  ];

  const profSubCards = [
    { key: 'medico' as const, icon: Stethoscope, label: 'Médico', desc: 'Clínica médica geral ou especializada' },
    { key: 'dentista' as const, icon: FileHeart, label: 'Dentista', desc: 'Clínica odontológica' },
  ];

  const isPatientSignup = userType === 'cliente';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <img src={logoLight} alt="IACLIN" className="h-10" />
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ─── LOGIN ─── */}
          {stepKey === 'login' && (
            <motion.div key="login" {...fade}>
              <div className="text-center mb-6">
                <motion.h1
                  className="text-xl font-semibold tracking-tight text-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  Bem-vindo de volta
                </motion.h1>
                <motion.p
                  className="mt-1 text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Acesse sua conta
                </motion.p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-10" autoFocus />
                </motion.div>
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.25 }}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <button type="button" className="text-xs text-primary hover:underline">Esqueci minha senha</button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>
                <motion.div variants={item} initial="initial" animate="animate" transition={{ delay: 0.3 }}>
                  <Button type="submit" className="w-full h-10" disabled={submitting}>
                    {submitting ? 'Aguarde...' : 'Entrar'}
                  </Button>
                </motion.div>
              </form>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                <button type="button" onClick={() => { setIsLogin(false); setUserType(null); setProfSubType(null); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Não tem conta? Cadastre-se
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── TYPE SELECT ─── */}
          {stepKey === 'type-select' && (
            <motion.div key="type-select" {...fade}>
              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Crie sua conta</h1>
                <p className="mt-1 text-sm text-muted-foreground">Como você vai usar o IACLIN?</p>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="initial" animate="animate">
                {typeCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <motion.button
                      key={card.key}
                      variants={item}
                      type="button"
                      onClick={() => !card.locked && setUserType(card.key)}
                      disabled={card.locked}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-all duration-200 text-left ${card.locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40 hover:shadow-sm active:scale-[0.98]'}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      {card.locked ? (
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Em breve</span>
                        </div>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button type="button" onClick={() => setIsLogin(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Já tem conta? Entrar
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── PROFESSIONAL SUB-SELECT ─── */}
          {stepKey === 'prof-select' && (
            <motion.div key="prof-select" {...fade}>
              <button type="button" onClick={() => setUserType(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Qual sua especialidade?</h1>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="initial" animate="animate">
                {profSubCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <motion.button
                      key={card.key}
                      variants={item}
                      type="button"
                      onClick={() => setProfSubType(card.key)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-all duration-200 text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ─── SIGNUP FORM ─── */}
          {stepKey === 'signup-form' && signupReady && (
            <motion.div key="signup-form" {...fade}>
              <button
                type="button"
                onClick={() => {
                  if (userType === 'profissional' && profSubType) setProfSubType(null);
                  else setUserType(null);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>

              <div className="text-center mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Crie sua conta</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {userType === 'profissional'
                    ? profSubType === 'dentista' ? '🦷 Dentista' : '🩺 Médico'
                    : userType === 'operadora' ? '🏢 Operadora' : '👤 Paciente'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder={userType === 'profissional' ? 'Dr. João Silva' : userType === 'operadora' ? 'Nome da empresa' : 'Seu nome completo'}
                    required className="h-10" autoFocus
                  />
                </motion.div>

                {isPatientSignup && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.12 }}>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00" required className="h-10" inputMode="numeric"
                      />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.14 }}>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999" className="h-10" inputMode="tel"
                      />
                    </motion.div>
                  </>
                )}

                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.15 }}>
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isPatientSignup ? 'seu@email.com' : 'joao@clinica.com'} required className="h-10" />
                </motion.div>
                <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10 pr-10" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                {isPatientSignup && (
                  <>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.22 }}>
                      <Label htmlFor="insurance-provider" className="text-xs text-muted-foreground">Convênio (opcional)</Label>
                      <Input
                        id="insurance-provider" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)}
                        placeholder="Ex: Amil, Unimed..." className="h-10"
                      />
                    </motion.div>
                    <motion.div className="space-y-2" variants={item} initial="initial" animate="animate" transition={{ delay: 0.24 }}>
                      <Label htmlFor="insurance-number" className="text-xs text-muted-foreground">Nº carteirinha (opcional)</Label>
                      <Input
                        id="insurance-number" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)}
                        placeholder="000000000000" className="h-10"
                      />
                    </motion.div>
                  </>
                )}

                <motion.div variants={item} initial="initial" animate="animate" transition={{ delay: 0.28 }}>
                  <Button type="submit" className="w-full h-10" disabled={submitting}>
                    {submitting ? 'Aguarde...' : 'Criar conta'}
                  </Button>
                </motion.div>
              </form>

              <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <button type="button" onClick={() => setIsLogin(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Já tem conta? Entrar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
