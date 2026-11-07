import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
});
type Form = z.infer<typeof schema>;

const features = [
  { icon: '▣', title: 'Processos', caption: 'Acompanhamento e organização do acervo' },
  { icon: '▤', title: 'Documentos e modelos', caption: 'Biblioteca jurídica e geração de peças' },
  { icon: '⚖', title: 'PJe-Calc', caption: 'Fluxos de cálculos trabalhistas' },
  { icon: '◈', title: 'Integrações', caption: 'Fontes oficiais e rastreabilidade' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async credentials => {
    setError('');
    try {
      await login(credentials.email, credentials.password);
      navigate('/');
    } catch {
      setError('Usuário ou senha inválidos.');
    }
  });

  return <main className="login-page login-page-ds">
    <section className="login-hero login-hero-ds" aria-label="Apresentação SysADV">
      <div className="login-justice-scene" aria-hidden="true" />
      <div className="login-hero-content">
        <div className="login-hero-brand">
          <img src="/brand/ds-logo.webp" alt="DS Advocacia Especializada" width="94" height="94" />
          <div><strong>Sys<span>ADV</span></strong><small>Plataforma de gestão jurídica</small></div>
        </div>
        <span className="login-hero-eyebrow">Tecnologia aplicada ao Direito</span>
        <h1>Gestão jurídica <em>mais inteligente.</em></h1>
        <p>Organize processos, documentos, cálculos e informações do escritório em uma plataforma integrada.</p>
        <div className="login-features">
          {features.map(feature => <div className="login-feature" key={feature.title}>
            <span className="login-feature-icon" aria-hidden="true">{feature.icon}</span>
            <div><strong>{feature.title}</strong><small>{feature.caption}</small></div>
          </div>)}
        </div>
      </div>
    </section>
    <section className="login-panel login-panel-ds" aria-label="Acesso ao sistema">
      <svg className="justice-watermark" aria-hidden="true" viewBox="0 0 240 260" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 28v168M72 58h96M52 88h136M72 58 38 118M72 58l34 60M168 58l-34 60M168 58l34 60"/>
          <path d="M24 118h56c0 25-12 40-28 40s-28-15-28-40ZM160 118h56c0 25-12 40-28 40s-28-15-28-40ZM82 214h76M64 236h112"/>
        </g>
      </svg>
      <form className="login-card login-card-ds" onSubmit={submit}>
        <div className="login-card-identity">
          <img src="/brand/ds-logo.webp" alt="DS Advocacia Especializada" width="82" height="82" />
          <strong>Sys<span>ADV</span></strong>
          <small>Acesso à plataforma jurídica</small>
        </div>
        <div className="login-form-title"><span className="eyebrow">Bem-vindo(a)</span><h2>Entre na sua conta</h2><p>Utilize as credenciais fornecidas pelo administrador.</p></div>
        <label>E-mail
          <input autoComplete="username" type="email" placeholder="seu@email.com" {...register('email')}/>
          {errors.email?.message && <small className="form-error">{errors.email.message}</small>}
        </label>
        <label>Senha
          <div className="password-row">
            <input autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" {...register('password')}/>
            <button className="ghost" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          {errors.password?.message && <small className="form-error">{errors.password.message}</small>}
        </label>
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="login-actions login-actions-ds"><span>Solicite recuperação de acesso ao administrador.</span></div>
        <button className="primary login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando...' : 'Entrar'}</button>
        <p className="privacy">Acesso protegido. As atividades podem ser registradas para segurança e auditoria.</p>
      </form>
      <p className="login-copyright">DS Advocacia Especializada · SysADV</p>
    </section>
  </main>;
}
