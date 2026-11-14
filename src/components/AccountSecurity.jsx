import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

export function AccountSecurity({ email, api, notify, refreshSession }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!newEmail.trim() && !newPassword) { setError('Enter a new email or password.'); return; }
    if (newPassword && newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('account', 'POST', { currentPassword, email: newEmail.trim(), password: newPassword });
      setCurrentPassword(''); setNewEmail(''); setNewPassword(''); setConfirmPassword('');
      const refreshed = await refreshSession();
      notify(refreshed ? 'Login details updated.' : 'Details updated. Sign in again if prompted.');
    } catch (err) { setError(err.message || 'Could not update login details.'); }
    finally { setBusy(false); }
  }
  return <section className="panel account-panel"><div className="panel-heading"><div><div className="section-index">ACCOUNT SECURITY</div><h3>Change login details</h3><p>Current account: {email || 'Admin'}</p></div><div className="section-icon"><KeyRound size={19}/></div></div>
    <form onSubmit={submit} className="account-form"><label className="studio-label">Current password<input className="text-input" type="password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} autoComplete="current-password" required maxLength={256}/></label>
      <label className="studio-label">New email <span>(optional)</span><input className="text-input" type="email" value={newEmail} onChange={event=>setNewEmail(event.target.value)} autoComplete="email" maxLength={254} placeholder="Leave blank to keep current email"/></label>
      <label className="studio-label">New password <span>(optional)</span><input className="text-input" type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} placeholder="At least 8 characters"/></label>
      <label className="studio-label">Confirm new password<input className="text-input" type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} autoComplete="new-password" required={Boolean(newPassword)} maxLength={72}/></label>
      {error && <div role="alert" className="account-error">{error}</div>}
      <div className="account-footer"><span><ShieldCheck size={15}/> Your current password is required.</span><button className="button button-primary" disabled={busy}>{busy ? 'Updating…' : 'Update login details'}</button></div>
    </form></section>;
}
