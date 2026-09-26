import React, { useEffect, useState } from 'react';
import { User, Phone, MapPin, Save, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { CustomerProfile } from '../../types/user';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    delivery_address: '',
    lat: '',
    lng: ''
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await customerService.getProfile();
        setProfile(data);
        setForm({
          name: data.name,
          phone: data.phone || '',
          delivery_address: data.delivery_address || '',
          lat: data.lat?.toString() || '',
          lng: data.lng?.toString() || ''
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      const latNum = form.lat ? parseFloat(form.lat) : undefined;
      const lngNum = form.lng ? parseFloat(form.lng) : undefined;
      
      const updated = await customerService.updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        delivery_address: form.delivery_address.trim() || undefined,
        lat: latNum,
        lng: lngNum,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading profile…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Your Profile</h1>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess(false)}>Profile updated successfully.</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-2xl font-bold">
              {profile?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{profile?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="block w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="block w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Default Delivery Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={form.delivery_address}
                  onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                  className="block w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Saved Latitude</label>
                <input
                  type="number"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Saved Longitude</label>
                <input
                  type="number"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          className="border-rose-200 text-rose-600 hover:bg-rose-50"
          onClick={handleLogout}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};
