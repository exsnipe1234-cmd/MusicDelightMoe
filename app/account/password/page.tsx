'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await createClient().auth.getSession();
      if (!data.session) setMessage('Open this page while signed in, or use a valid password reset link.');
      setLoading(false);
    };
    void checkSession();
  }, []);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (password.length < 8) { setMessage('Your new password must be at least 8 characters.'); return; }
    if (password !== confirmation) { setMessage('The passwords do not match.'); return; }

    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Password updated. You can now return to your portal.');
    setPassword('');
    setConfirmation('');
  };

  return <main className="shell"><section className="card"><div className="icon"><KeyRound size={26}/></div><p>ACCOUNT SECURITY</p><h1>Change password</h1><span>Choose a new password with at least 8 characters.</span>{loading ? <div className="loading"><Loader2 className="spin" size={19}/> Checking session...</div> : <form onSubmit={savePassword}><label>New password<div><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required/><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="Show or hide password">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label><label>Confirm new password<div><input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required/></div></label>{message && <div className="message">{message}</div>}<button className="save" disabled={saving}>{saving ? <><Loader2 className="spin" size={17}/> Updating...</> : 'Update password'}</button><button type="button" className="cancel" onClick={() => router.back()}>Cancel</button></form>}</section><style jsx>{`.shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,rgba(94,76,220,.2),transparent 34%),#080d1a;color:#f4f6fb}.card{width:min(430px,100%);padding:34px;border:1px solid rgba(148,163,184,.15);border-radius:24px;background:linear-gradient(145deg,rgba(20,27,48,.96),rgba(10,15,29,.96));box-shadow:0 28px 80px rgba(0,0,0,.35)}.icon{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#7562ee,#4c3abc);margin-bottom:21px}.card>p{margin:0 0 7px;color:#8b7cff;font-size:11px;font-weight:800;letter-spacing:.17em}.card h1{margin:0;font-size:29px}.card>span{display:block;margin:9px 0 25px;color:#8d99af;line-height:1.5}.card form{display:grid;gap:16px}.card label{display:grid;gap:8px;color:#b8c1d2;font-size:13px;font-weight:700}.card label>div{display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid rgba(148,163,184,.15);border-radius:12px;background:#0a1120}.card input{width:100%;border:0;outline:0;background:transparent;color:#fff;padding:13px 0;font:inherit}.card label button{border:0;background:transparent;color:#8390a8;cursor:pointer}.message{padding:11px 12px;border-radius:10px;background:rgba(148,163,184,.12);color:#cbd5e1;font-size:13px}.save,.cancel{border:0;border-radius:12px;padding:13px 16px;font-weight:800;cursor:pointer}.save{display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#715be8,#5140c6);color:#fff}.save:disabled{opacity:.7;cursor:wait}.cancel{background:#111a2e;color:#aeb9cd}.loading{display:flex;align-items:center;gap:9px;color:#aeb9cd}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style></main>;
}
