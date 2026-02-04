import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { 
  Save, User, Mail, Phone, MapPin, Shield, Key, Bell, 
  Camera, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await authService.getProfile();
      setProfile(res.data.user);
      setFormData(res.data.user);
    } catch (err) {
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await authService.updateProfile(formData);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const first = formData.first_name?.[0] || '';
    const last = formData.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
          <User size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your personal information and preferences</p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        
        <div className="relative z-10 flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg">
              {getInitials()}
            </div>
            <button className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl text-gray-700 shadow-lg hover:bg-gray-50 transition-colors">
              <Camera size={16} />
            </button>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{formData.first_name} {formData.last_name}</h2>
            <p className="text-indigo-200">{formData.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm capitalize">{user?.role || 'Client'}</span>
              <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 rounded-full text-sm flex items-center gap-1">
                <CheckCircle size={14} />
                Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'personal', label: 'Personal Info', icon: User },
            { id: 'address', label: 'Address', icon: MapPin },
            { id: 'security', label: 'Security', icon: Shield },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <TabIcon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <User size={16} />
                    First Name
                  </label>
                  <input 
                    type="text" 
                    value={formData.first_name || ''} 
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <User size={16} />
                    Last Name
                  </label>
                  <input 
                    type="text" 
                    value={formData.last_name || ''} 
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <input 
                  type="email" 
                  value={formData.email || ''} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" 
                  disabled 
                />
                <p className="text-sm text-gray-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone size={16} />
                  Phone Number
                </label>
                <input 
                  type="tel" 
                  value={formData.phone || ''} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MapPin size={16} />
                  Street Address
                </label>
                <input 
                  type="text" 
                  value={formData.address_line1 || ''} 
                  onChange={(e) => setFormData({...formData, address_line1: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Apt/Suite (Optional)</label>
                <input 
                  type="text" 
                  value={formData.address_line2 || ''} 
                  onChange={(e) => setFormData({...formData, address_line2: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                  placeholder="Apt 4B"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">City</label>
                  <input 
                    type="text" 
                    value={formData.city || ''} 
                    onChange={(e) => setFormData({...formData, city: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">State</label>
                  <input 
                    type="text" 
                    value={formData.state || ''} 
                    onChange={(e) => setFormData({...formData, state: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    maxLength={2}
                    placeholder="NY"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">ZIP Code</label>
                  <input 
                    type="text" 
                    value={formData.zip_code || ''} 
                    onChange={(e) => setFormData({...formData, zip_code: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Key size={20} className="text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Password</p>
                    <p className="text-sm text-yellow-600">Last changed 30 days ago</p>
                  </div>
                  <button 
                    type="button"
                    className="ml-auto px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                  >
                    Change Password
                  </button>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield size={20} className="text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Two-Factor Authentication</p>
                    <p className="text-sm text-green-600">Add extra security to your account</p>
                  </div>
                  <button 
                    type="button"
                    className="ml-auto px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                  >
                    Enable 2FA
                  </button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Notifications</p>
                    <p className="text-sm text-blue-600">Email notifications are enabled</p>
                  </div>
                  <button 
                    type="button"
                    className="ml-auto px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {activeTab !== 'security' && (
            <div className="flex justify-end pt-6 mt-6 border-t border-gray-100">
              <button 
                type="submit" 
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
