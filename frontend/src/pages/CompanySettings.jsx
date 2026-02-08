/**
 * Company Settings Page
 * Permite al admin editar todos los datos de la empresa
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  Building2, Save, Loader2, CheckCircle, AlertCircle, RefreshCw,
  MapPin, Phone, Mail, Globe, Image, Clock, Facebook, Twitter,
  Linkedin, Instagram, Youtube, FileText, Shield, CreditCard, Hash
} from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP'
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix', 'America/Puerto_Rico'
];

const tabs = [
  { id: 'general', label: 'Información General', icon: Building2 },
  { id: 'contact', label: 'Contacto & Dirección', icon: MapPin },
  { id: 'social', label: 'Redes Sociales', icon: Globe },
  { id: 'operations', label: 'Operaciones', icon: Clock },
];

export default function CompanySettings() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    company_name: '',
    legal_name: '',
    tax_id: '',
    description: '',
    industry: 'Credit Repair Services',
    business_license: '',
    founded_date: '',
    logo_url: '',
    address_street: '',
    address_suite: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    address_country: 'US',
    phone: '',
    fax: '',
    email: '',
    website: '',
    support_email: '',
    support_phone: '',
    billing_email: '',
    social_facebook: '',
    social_twitter: '',
    social_linkedin: '',
    social_instagram: '',
    social_youtube: '',
    business_hours: 'Mon-Fri 9:00 AM - 5:00 PM',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    loadCompanyProfile();
  }, []);

  const loadCompanyProfile = async () => {
    try {
      const response = await api.get('/company');
      const profile = response.data?.profile || response.data?.data?.profile || {};
      setFormData(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(profile).filter(([k, v]) => v !== null && k in prev)
        )
      }));
    } catch (err) {
      console.error('Error loading company profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/company', formData);
      setSuccess('Datos de empresa guardados correctamente');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-slate-300 mt-2">Solo administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Cargando datos de empresa...</p>
        </div>
      </div>
    );
  }

  const InputField = ({ label, field, icon: Icon, type = 'text', placeholder, helpText }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        <span className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-slate-400" />}
          {label}
        </span>
      </label>
      <input
        type={type}
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-slate-700/30 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500"
      />
      {helpText && <p className="text-xs text-slate-500 mt-1">{helpText}</p>}
    </div>
  );

  const SelectField = ({ label, field, icon: Icon, options }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        <span className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-slate-400" />}
          {label}
        </span>
      </label>
      <select
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full px-4 py-3 bg-slate-700/30 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
      >
        {options.map(opt => (
          <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value} className="bg-slate-800">
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const TextAreaField = ({ label, field, icon: Icon, placeholder, rows = 3 }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        <span className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-slate-400" />}
          {label}
        </span>
      </label>
      <textarea
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-slate-700/30 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500 resize-none"
      />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl text-white">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Datos de Empresa</h1>
            <p className="text-slate-400">Información general, contacto y configuración de la empresa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadCompanyProfile}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-slate-300"
          >
            <RefreshCw size={18} />
            Recargar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
                isActive
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/25'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white border border-slate-700/50'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-6">
        {/* General Info Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={20} className="text-teal-400" />
              <h2 className="text-xl font-semibold text-white">Información General</h2>
            </div>

            {/* Logo Preview */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {formData.logo_url ? (
                  <img
                    src={formData.logo_url}
                    alt="Logo de empresa"
                    className="w-24 h-24 rounded-2xl border-2 border-slate-600 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Image size={32} className="text-slate-500" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <InputField label="URL del Logo" field="logo_url" icon={Image} placeholder="https://tudominio.com/logo.png" helpText="URL pública de la imagen del logo (PNG, JPG, SVG)" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField label="Nombre Comercial" field="company_name" icon={Building2} placeholder="Credit Repair Pro" />
              <InputField label="Razón Social / Legal Name" field="legal_name" icon={FileText} placeholder="Credit Repair Pro LLC" />
              <InputField label="Tax ID (EIN)" field="tax_id" icon={Hash} placeholder="XX-XXXXXXX" helpText="Employer Identification Number" />
              <InputField label="Licencia de Negocio" field="business_license" icon={Shield} placeholder="Número de licencia" />
              <InputField label="Industria" field="industry" icon={CreditCard} placeholder="Credit Repair Services" />
              <InputField label="Fecha de Fundación" field="founded_date" icon={Clock} type="date" />
            </div>

            <TextAreaField 
              label="Descripción de la Empresa" 
              field="description" 
              icon={FileText}
              placeholder="Describa brevemente los servicios que ofrece su empresa..."
              rows={4}
            />
          </div>
        )}

        {/* Contact & Address Tab */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={20} className="text-teal-400" />
              <h2 className="text-xl font-semibold text-white">Contacto & Dirección</h2>
            </div>

            {/* Address Section */}
            <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Dirección Principal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <InputField label="Calle / Dirección" field="address_street" icon={MapPin} placeholder="123 Main Street" />
                </div>
                <InputField label="Suite / Oficina" field="address_suite" placeholder="Suite 100" />
                <InputField label="Ciudad" field="address_city" placeholder="Miami" />
                <SelectField 
                  label="Estado" 
                  field="address_state" 
                  icon={MapPin}
                  options={[{ value: '', label: 'Seleccionar estado...' }, ...US_STATES.map(s => ({ value: s, label: s }))]}
                />
                <InputField label="Código Postal" field="address_zip" placeholder="33101" />
                <InputField label="País" field="address_country" placeholder="US" />
              </div>
            </div>

            {/* Contact Info Section */}
            <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Información de Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Teléfono Principal" field="phone" icon={Phone} type="tel" placeholder="(305) 555-0100" />
                <InputField label="Fax" field="fax" icon={Phone} type="tel" placeholder="(305) 555-0101" />
                <InputField label="Email Principal" field="email" icon={Mail} type="email" placeholder="info@tuempresa.com" />
                <InputField label="Website" field="website" icon={Globe} type="url" placeholder="https://www.tuempresa.com" />
              </div>
            </div>

            {/* Support & Billing */}
            <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Soporte & Facturación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Email de Soporte" field="support_email" icon={Mail} type="email" placeholder="soporte@tuempresa.com" />
                <InputField label="Teléfono de Soporte" field="support_phone" icon={Phone} type="tel" placeholder="(305) 555-0102" />
                <InputField label="Email de Facturación" field="billing_email" icon={CreditCard} type="email" placeholder="facturacion@tuempresa.com" />
              </div>
            </div>
          </div>
        )}

        {/* Social Media Tab */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={20} className="text-teal-400" />
              <h2 className="text-xl font-semibold text-white">Redes Sociales</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <InputField label="Facebook" field="social_facebook" icon={Facebook} placeholder="https://facebook.com/tuempresa" />
              <InputField label="Twitter / X" field="social_twitter" icon={Twitter} placeholder="https://twitter.com/tuempresa" />
              <InputField label="LinkedIn" field="social_linkedin" icon={Linkedin} placeholder="https://linkedin.com/company/tuempresa" />
              <InputField label="Instagram" field="social_instagram" icon={Instagram} placeholder="https://instagram.com/tuempresa" />
              <InputField label="YouTube" field="social_youtube" icon={Youtube} placeholder="https://youtube.com/@tuempresa" />
            </div>

            <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl">
              <p className="text-sm text-sky-300">
                Las redes sociales se mostrarán en el footer de la aplicación y en los correos 
                electrónicos enviados a clientes.
              </p>
            </div>
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} className="text-teal-400" />
              <h2 className="text-xl font-semibold text-white">Operaciones</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="Horario de Atención" 
                field="business_hours" 
                icon={Clock} 
                placeholder="Mon-Fri 9:00 AM - 5:00 PM" 
                helpText="Formato libre: Lun-Vie 9am-5pm, etc."
              />
              <SelectField 
                label="Zona Horaria" 
                field="timezone" 
                icon={Clock}
                options={TIMEZONES.map(tz => ({ value: tz, label: tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ') + ` (${tz})` }))}
              />
            </div>

            {/* Company Preview Card */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Vista Previa</h3>
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-600/50">
                <div className="flex items-start gap-4">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                      <Building2 size={28} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-white">{formData.company_name || 'Nombre de Empresa'}</h3>
                    {formData.legal_name && (
                      <p className="text-sm text-slate-400">{formData.legal_name}</p>
                    )}
                    <p className="text-sm text-slate-400 mt-1">{formData.industry || 'Credit Repair Services'}</p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-400">
                  {formData.address_street && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} />
                      <span>
                        {formData.address_street}
                        {formData.address_suite ? `, ${formData.address_suite}` : ''}
                        {formData.address_city ? `, ${formData.address_city}` : ''}
                        {formData.address_state ? ` ${formData.address_state}` : ''}
                        {formData.address_zip ? ` ${formData.address_zip}` : ''}
                      </span>
                    </div>
                  )}
                  {formData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} />
                      <span>{formData.phone}</span>
                    </div>
                  )}
                  {formData.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} />
                      <span>{formData.email}</span>
                    </div>
                  )}
                  {formData.website && (
                    <div className="flex items-center gap-2">
                      <Globe size={14} />
                      <span>{formData.website}</span>
                    </div>
                  )}
                  {formData.business_hours && (
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span>{formData.business_hours}</span>
                    </div>
                  )}
                </div>

                {formData.description && (
                  <p className="mt-4 text-sm text-slate-400 border-t border-slate-700/50 pt-4">
                    {formData.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Save Button (sticky on mobile) */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50 shadow-xl"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          Guardar Todos los Cambios
        </button>
      </div>
    </div>
  );
}
