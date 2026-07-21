'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).single();
      router.replace(profile?.role === 'teacher' ? '/teacher' : '/');
    };
    void checkSession();
  }, [router]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, active').eq('id', data.user.id).single();
    if (profileError || !profile?.active) {
      await supabase.auth.signOut();
      setMessage('This account is not active. Please contact the administrator.');
      setLoading(false);
      return;
    }
    router.replace(profile.role === 'teacher' ? '/teacher' : '/');
    router.refresh();
  };

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="logo"><CalendarDays size={29} /></div>
        <p className="eyebrow">MUSIC DELIGHT</p>
        <h1>MOE Calendar Login</h1>
        <p className="intro">Sign in with the account created for you by the administrator.</p>

        <form onSubmit={signIn}>
          <label>Email address<div className="inputWrap"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></div></label>
          <label>Password<div className="inputWrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required /><button type="button" className="showButton" onClick={() => setShowPassword((current) => !current)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {message && <div className="message">{message}</div>}
          <button className="loginButton" type="submit" disabled={loading}>{loading ? <><Loader2 className="spin" size={18} /> Signing in...</> : 'Sign in'}</button>
        </form>
        <small>Teacher accounts only show the timetable assigned to that teacher.</small>
      </section>

      <style jsx>{`
        .loginShell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,rgba(94,76,220,.2),transparent 34%),#080d1a;color:#f4f6fb}.loginCard{width:min(430px,100%);padding:34px;border:1px solid rgba(148,163,184,.15);border-radius:24px;background:linear-gradient(145deg,rgba(20,27,48,.96),rgba(10,15,29,.96));box-shadow:0 28px 80px rgba(0,0,0,.35)}.logo{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#7562ee,#4c3abc);box-shadow:0 12px 30px rgba(105,83,225,.3);margin-bottom:22px}.eyebrow{margin:0 0 7px;color:#8b7cff;font-size:11px;font-weight:800;letter-spacing:.17em}.loginCard h1{margin:0;font-size:30px}.intro{margin:10px 0 26px;color:#8d99af;line-height:1.5}.loginCard form{display:grid;gap:17px}.loginCard label{display:grid;gap:8px;color:#b8c1d2;font-size:13px;font-weight:700}.inputWrap{display:flex;align-items:center;gap:10px;border:1px solid rgba(148,163,184,.15);background:#0a1120;border-radius:12px;padding:0 13px;color:#78859c}.inputWrap:focus-within{border-color:#7562ee;box-shadow:0 0 0 3px rgba(117,98,238,.1)}.inputWrap input{width:100%;border:0;outline:0;background:transparent;color:white;padding:13px 0;font:inherit}.showButton{border:0;background:transparent;color:#8390a8;cursor:pointer;padding:3px}.message{padding:11px 12px;border-radius:10px;background:rgba(251,113,133,.1);color:#fb7185;font-size:13px}.loginButton{border:0;border-radius:12px;padding:13px 16px;background:linear-gradient(135deg,#715be8,#5140c6);color:white;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}.loginButton:disabled{opacity:.7;cursor:wait}.loginCard small{display:block;margin-top:20px;color:#718097;line-height:1.5}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </main>
  );
}
