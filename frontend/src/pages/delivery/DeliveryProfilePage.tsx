import React, { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryPartnerProfile } from '../../types/user';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

export const DeliveryProfilePage: React.FC = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true);
    try { setProfile(await deliveryService.getProfile()); setError(''); }
    catch { setError('Your profile could not be loaded. Please retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true); setNotice('');
    try {
      setProfile(await deliveryService.updateProfile({ name: profile.name, phone: profile.phone || '', vehicle_info: profile.vehicle_info || '', is_available: profile.is_available }));
      setError(''); setNotice('Profile saved.');
    } catch { setError('Your changes could not be saved. Please retry.'); }
    finally { setSaving(false); }
  };
  if (loading) return <Spinner label="Loading partner profile..." />;
  return <div className="max-w-2xl space-y-6"><header><h1 className="text-2xl font-bold">Partner account</h1><p className="mt-2 text-sm text-slate-500">Your contact details, vehicle, and availability.</p></header>
    {error && <Alert variant="error">{error}<button className="ml-2 underline" onClick={() => void load()}>Retry</button></Alert>}
    {notice && <Alert variant="success">{notice}</Alert>}
    {profile && <form onSubmit={save} className="space-y-5 border-y border-slate-200 py-6">
      {([{ key: 'name', label: 'Full name', required: true }, { key: 'phone', label: 'Phone number' }, { key: 'vehicle_info', label: 'Vehicle details' }] as const).map(field => <label key={field.key} className="block text-sm font-semibold">{field.label}<input required={field.key === 'name'} type={field.key === 'phone' ? 'tel' : 'text'} value={profile[field.key] || ''} onChange={event => setProfile({ ...profile, [field.key]: event.target.value })} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>)}
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={profile.is_available} onChange={event => setProfile({ ...profile, is_available: event.target.checked })} className="h-5 w-5 accent-blue-700" />Available for delivery requests</label>
      {profile.current_lat != null && profile.current_lng != null && <p className="text-xs text-slate-500">Last reported location: {profile.current_lat.toFixed(4)}, {profile.current_lng.toFixed(4)}</p>}
      <Button type="submit" isLoading={saving}>Save changes</Button>
    </form>}
    <Button variant="outline" onClick={logout}>Sign out</Button>
  </div>;
};
