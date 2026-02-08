/**
 * Client Onboarding Page - Legal Compliance Version
 * Recopila toda la información necesaria para servicios de reparación de crédito
 * 
 * Información requerida por ley:
 * - Identificación completa
 * - SSN completo (encriptado)
 * - Dirección actual y anteriores
 * - Autorización firmada
 * - Consentimiento FCRA
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth0Context';
import api from '../services/api';
import {
  User, MapPin, FileText, Shield, CheckCircle, ChevronRight, ChevronLeft,
  AlertCircle, Loader2, Upload, Calendar, Phone, Mail, Home, Lock,
  FileCheck, PenTool, CreditCard, Building, Clock
} from 'lucide-react';

const steps = [
  { id: 1, name: 'Información Personal', icon: User, description: 'Datos de identificación' },
  { id: 2, name: 'Dirección Actual', icon: Home, description: 'Residencia principal' },
  { id: 3, name: 'Historial de Direcciones', icon: MapPin, description: 'Últimos 2 años' },
  { id: 4, name: 'Información de Empleo', icon: Building, description: 'Empleador actual' },
  { id: 5, name: 'Documentos de Identidad', icon: FileText, description: 'ID y comprobantes' },
  { id: 6, name: 'Autorizaciones Legales', icon: Shield, description: 'Consentimientos' },
  { id: 7, name: 'Revisión y Firma', icon: PenTool, description: 'Confirmar y firmar' },
];

const usStates = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'
];

export default function ClientOnboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasSubscription, setHasSubscription] = useState(false);

  // Form data for all steps
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    dateOfBirth: '',
    ssn: '',
    phone: '',
    alternatePhone: '',
    email: '',

    // Step 2: Current Address
    currentAddress: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      moveInDate: '',
      residenceType: 'rent', // rent, own, other
      monthlyPayment: '',
    },

    // Step 3: Previous Addresses (last 2 years)
    previousAddresses: [],

    // Step 4: Employment Information
    employment: {
      status: 'employed', // employed, self-employed, unemployed, retired, student
      employerName: '',
      jobTitle: '',
      employerPhone: '',
      employerAddress: '',
      startDate: '',
      monthlyIncome: '',
    },

    // Step 5: Documents
    documents: {
      governmentId: null,
      governmentIdType: 'drivers_license', // drivers_license, passport, state_id, military_id
      proofOfAddress: null,
      proofOfSsn: null,
    },

    // Step 6: Authorizations
    authorizations: {
      fcraConsent: false,
      creditPullConsent: false,
      communicationConsent: false,
      electronicSignatureConsent: false,
      termsOfService: false,
      privacyPolicy: false,
      limitedPoa: false,
    },

    // Step 7: Signature
    signature: '',
    signatureDate: new Date().toISOString().split('T')[0],
    ipAddress: '',
  });

  useEffect(() => {
    loadExistingData();
    getIpAddress();
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/current');
      setHasSubscription(response.data?.hasSubscription || false);
    } catch (err) {
      setHasSubscription(false);
    }
  };

  const loadExistingData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/onboarding/data');
      if (response.data) {
        setFormData(prev => ({ ...prev, ...response.data }));
      }
    } catch (err) {
      // No existing data, use defaults
      if (user) {
        setFormData(prev => ({
          ...prev,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.phone || '',
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const getIpAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setFormData(prev => ({ ...prev, ipAddress: data.ip }));
    } catch (err) {
      console.error('Could not get IP address');
    }
  };

  const handleChange = (field, value, nested = null) => {
    if (nested) {
      setFormData(prev => ({
        ...prev,
        [nested]: { ...prev[nested], [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAuthorizationChange = (field) => {
    setFormData(prev => ({
      ...prev,
      authorizations: { ...prev.authorizations, [field]: !prev.authorizations[field] }
    }));
  };

  const addPreviousAddress = () => {
    setFormData(prev => ({
      ...prev,
      previousAddresses: [
        ...prev.previousAddresses,
        { street1: '', street2: '', city: '', state: '', zipCode: '', fromDate: '', toDate: '' }
      ]
    }));
  };

  const updatePreviousAddress = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      previousAddresses: prev.previousAddresses.map((addr, i) =>
        i === index ? { ...addr, [field]: value } : addr
      )
    }));
  };

  const removePreviousAddress = (index) => {
    setFormData(prev => ({
      ...prev,
      previousAddresses: prev.previousAddresses.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('document', file);
    formDataUpload.append('documentType', field);

    try {
      const response = await api.post('/documents/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFormData(prev => ({
        ...prev,
        documents: { ...prev.documents, [field]: response.data.document }
      }));
      setSuccess(`${file.name} subido correctamente`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al subir el documento');
    }
  };

  const validateStep = (step) => {
    setError('');

    switch (step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.ssn || !formData.phone) {
          setError('Por favor complete todos los campos obligatorios');
          return false;
        }
        if (formData.ssn.replace(/\D/g, '').length !== 9) {
          setError('El SSN debe tener 9 dígitos');
          return false;
        }
        break;

      case 2:
        if (!formData.currentAddress.street1 || !formData.currentAddress.city ||
            !formData.currentAddress.state || !formData.currentAddress.zipCode) {
          setError('Por favor complete la dirección actual');
          return false;
        }
        break;

      case 4:
        if (formData.employment.status === 'employed' && !formData.employment.employerName) {
          setError('Por favor ingrese el nombre del empleador');
          return false;
        }
        break;

      case 5:
        if (!formData.documents.governmentId) {
          setError('Por favor suba su identificación gubernamental');
          return false;
        }
        break;

      case 6:
        const requiredAuths = ['fcraConsent', 'creditPullConsent', 'termsOfService', 'privacyPolicy'];
        const missingAuth = requiredAuths.find(auth => !formData.authorizations[auth]);
        if (missingAuth) {
          setError('Debe aceptar todas las autorizaciones requeridas');
          return false;
        }
        break;

      case 7:
        if (!formData.signature) {
          setError('Por favor firme para completar el proceso');
          return false;
        }
        break;
    }

    return true;
  };

  const saveProgress = async () => {
    setSaving(true);
    try {
      await api.post('/onboarding/save-progress', {
        step: currentStep,
        data: formData
      });
    } catch (err) {
      console.error('Error saving progress:', err);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (!validateStep(currentStep)) return;

    await saveProgress();

    // After step 6 (authorizations), check for subscription before proceeding to step 7
    if (currentStep === 6) {
      // Re-check subscription status
      try {
        const response = await api.get('/subscriptions/current');
        const hasSub = response.data?.hasSubscription || false;
        setHasSubscription(hasSub);
        
        if (!hasSub) {
          // Redirect to pricing page to select and pay for a plan
          setError('');
          navigate('/pricing?from=onboarding');
          return;
        }
      } catch (err) {
        navigate('/pricing?from=onboarding');
        return;
      }
    }

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const submitOnboarding = async () => {
    if (!validateStep(currentStep)) return;

    setSaving(true);
    setError('');

    try {
      await api.post('/onboarding/complete', formData);
      setSuccess('¡Registro completado exitosamente!');
      
      // Refresh user data
      await refreshUser();
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al completar el registro');
    } finally {
      setSaving(false);
    }
  };

  const formatSSN = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 9)}`;
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Registro de Cliente</h1>
          <p className="text-slate-300">Complete la información requerida para comenzar su proceso de reparación de crédito</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute left-0 right-0 top-6 h-1 bg-slate-700 -z-10">
              <div 
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              ></div>
            </div>

            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-200'
                        : 'bg-slate-700 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={24} /> : <Icon size={20} />}
                  </div>
                  <div className="mt-2 text-center hidden md:block">
                    <p className={`text-xs font-medium ${isCurrent ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {step.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Mobile Step Indicator */}
          <div className="md:hidden mt-4 text-center">
            <p className="text-sm font-medium text-indigo-400">
              Paso {currentStep} de {steps.length}: {steps[currentStep - 1].name}
            </p>
            <p className="text-xs text-slate-400">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/30 overflow-hidden">
          {/* Step Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = steps[currentStep - 1].icon;
                return <Icon size={28} />;
              })()}
              <div>
                <h2 className="text-xl font-bold">{steps[currentStep - 1].name}</h2>
                <p className="text-white/80 text-sm">{steps[currentStep - 1].description}</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 md:p-8">
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Primer Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Segundo Nombre
                    </label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => handleChange('middleName', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Antonio"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="García"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Sufijo
                    </label>
                    <select
                      value={formData.suffix}
                      onChange={(e) => handleChange('suffix', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Ninguno</option>
                      <option value="Jr.">Jr.</option>
                      <option value="Sr.">Sr.</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      <Calendar size={16} className="inline mr-1" />
                      Fecha de Nacimiento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      <Lock size={16} className="inline mr-1" />
                      Número de Seguro Social (SSN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.ssn}
                      onChange={(e) => handleChange('ssn', formatSSN(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                      placeholder="XXX-XX-XXXX"
                      maxLength={11}
                    />
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Shield size={12} />
                      Su SSN está encriptado y protegido
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      <Phone size={16} className="inline mr-1" />
                      Teléfono Principal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      <Phone size={16} className="inline mr-1" />
                      Teléfono Alternativo
                    </label>
                    <input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => handleChange('alternatePhone', formatPhone(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    <Mail size={16} className="inline mr-1" />
                    Correo Electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Current Address */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Dirección (Línea 1) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentAddress.street1}
                    onChange={(e) => handleChange('street1', e.target.value, 'currentAddress')}
                    className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Dirección (Línea 2)
                  </label>
                  <input
                    type="text"
                    value={formData.currentAddress.street2}
                    onChange={(e) => handleChange('street2', e.target.value, 'currentAddress')}
                    className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Apt 4B, Suite 100, etc."
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Ciudad <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.currentAddress.city}
                      onChange={(e) => handleChange('city', e.target.value, 'currentAddress')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Miami"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Estado <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.currentAddress.state}
                      onChange={(e) => handleChange('state', e.target.value, 'currentAddress')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Seleccione</option>
                      {usStates.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Código Postal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.currentAddress.zipCode}
                      onChange={(e) => handleChange('zipCode', e.target.value.replace(/\D/g, '').slice(0, 5), 'currentAddress')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="33101"
                      maxLength={5}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Fecha de Mudanza
                    </label>
                    <input
                      type="date"
                      value={formData.currentAddress.moveInDate}
                      onChange={(e) => handleChange('moveInDate', e.target.value, 'currentAddress')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Tipo de Residencia
                    </label>
                    <select
                      value={formData.currentAddress.residenceType}
                      onChange={(e) => handleChange('residenceType', e.target.value, 'currentAddress')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="rent">Alquiler</option>
                      <option value="own">Propia</option>
                      <option value="family">Con Familia</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Pago Mensual
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        value={formData.currentAddress.monthlyPayment}
                        onChange={(e) => handleChange('monthlyPayment', e.target.value, 'currentAddress')}
                        className="w-full pl-8 pr-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="1500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Previous Addresses */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-sky-400">
                    <AlertCircle size={16} className="inline mr-2" />
                    Por favor agregue todas las direcciones donde ha vivido en los últimos 2 años.
                    Esto es necesario para verificar su historial crediticio.
                  </p>
                </div>

                {formData.previousAddresses.map((address, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-xl p-6 relative">
                    <button
                      onClick={() => removePreviousAddress(index)}
                      className="absolute top-4 right-4 text-red-500 hover:text-rose-400"
                    >
                      ×
                    </button>
                    <h4 className="font-semibold text-slate-300 mb-4">Dirección Anterior #{index + 1}</h4>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={address.street1}
                        onChange={(e) => updatePreviousAddress(index, 'street1', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                        placeholder="Dirección"
                      />
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => updatePreviousAddress(index, 'city', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                        placeholder="Ciudad"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-4 gap-4">
                      <select
                        value={address.state}
                        onChange={(e) => updatePreviousAddress(index, 'state', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                      >
                        <option value="">Estado</option>
                        {usStates.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={address.zipCode}
                        onChange={(e) => updatePreviousAddress(index, 'zipCode', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                        placeholder="ZIP"
                        maxLength={5}
                      />
                      <input
                        type="date"
                        value={address.fromDate}
                        onChange={(e) => updatePreviousAddress(index, 'fromDate', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                        placeholder="Desde"
                      />
                      <input
                        type="date"
                        value={address.toDate}
                        onChange={(e) => updatePreviousAddress(index, 'toDate', e.target.value)}
                        className="px-4 py-3 border border-slate-700/50 rounded-xl"
                        placeholder="Hasta"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addPreviousAddress}
                  className="w-full py-4 border-2 border-dashed border-slate-600/50 rounded-xl text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                >
                  + Agregar Dirección Anterior
                </button>

                {formData.previousAddresses.length === 0 && (
                  <p className="text-center text-slate-400 text-sm">
                    Si ha vivido en su dirección actual por más de 2 años, puede continuar sin agregar direcciones anteriores.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Employment */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Estado de Empleo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.employment.status}
                    onChange={(e) => handleChange('status', e.target.value, 'employment')}
                    className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="employed">Empleado</option>
                    <option value="self-employed">Trabajador Independiente</option>
                    <option value="unemployed">Desempleado</option>
                    <option value="retired">Jubilado</option>
                    <option value="student">Estudiante</option>
                  </select>
                </div>

                {(formData.employment.status === 'employed' || formData.employment.status === 'self-employed') && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                          Nombre del Empleador/Negocio <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.employment.employerName}
                          onChange={(e) => handleChange('employerName', e.target.value, 'employment')}
                          className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="Nombre de la empresa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                          Cargo/Posición
                        </label>
                        <input
                          type="text"
                          value={formData.employment.jobTitle}
                          onChange={(e) => handleChange('jobTitle', e.target.value, 'employment')}
                          className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="Su título o posición"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                          Teléfono del Empleador
                        </label>
                        <input
                          type="tel"
                          value={formData.employment.employerPhone}
                          onChange={(e) => handleChange('employerPhone', formatPhone(e.target.value), 'employment')}
                          className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                          Fecha de Inicio
                        </label>
                        <input
                          type="date"
                          value={formData.employment.startDate}
                          onChange={(e) => handleChange('startDate', e.target.value, 'employment')}
                          className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Dirección del Empleador
                      </label>
                      <input
                        type="text"
                        value={formData.employment.employerAddress}
                        onChange={(e) => handleChange('employerAddress', e.target.value, 'employment')}
                        className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Dirección completa"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Ingreso Mensual Aproximado
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.employment.monthlyIncome}
                      onChange={(e) => handleChange('monthlyIncome', e.target.value, 'employment')}
                      className="w-full pl-8 pr-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="5000"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Esta información es confidencial y solo se usa para evaluar su caso.</p>
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-amber-400">
                    <Shield size={16} className="inline mr-2" />
                    Sus documentos están protegidos con encriptación de nivel bancario y solo son accesibles por personal autorizado.
                  </p>
                </div>

                {/* Government ID */}
                <div className="border border-slate-700/50 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <CreditCard size={20} />
                    Identificación Gubernamental <span className="text-red-500">*</span>
                  </h4>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de ID</label>
                    <select
                      value={formData.documents.governmentIdType}
                      onChange={(e) => handleChange('governmentIdType', e.target.value, 'documents')}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="drivers_license">Licencia de Conducir</option>
                      <option value="passport">Pasaporte</option>
                      <option value="state_id">ID Estatal</option>
                      <option value="military_id">ID Militar</option>
                    </select>
                  </div>

                  <div className="border-2 border-dashed border-slate-600/50 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                    <input
                      type="file"
                      id="governmentId"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('governmentId', e.target.files[0])}
                      className="hidden"
                    />
                    <label htmlFor="governmentId" className="cursor-pointer">
                      {formData.documents.governmentId ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <CheckCircle size={24} />
                          <span>Documento subido</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                          <p className="text-slate-300">Haga clic para subir o arrastre el archivo</p>
                          <p className="text-xs text-slate-500 mt-1">JPG, PNG o PDF (máx. 10MB)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Proof of Address */}
                <div className="border border-slate-700/50 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Home size={20} />
                    Comprobante de Domicilio
                  </h4>
                  <p className="text-sm text-slate-400 mb-4">
                    Factura de servicios, estado de cuenta bancario, o contrato de arrendamiento (últimos 60 días)
                  </p>

                  <div className="border-2 border-dashed border-slate-600/50 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                    <input
                      type="file"
                      id="proofOfAddress"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('proofOfAddress', e.target.files[0])}
                      className="hidden"
                    />
                    <label htmlFor="proofOfAddress" className="cursor-pointer">
                      {formData.documents.proofOfAddress ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <CheckCircle size={24} />
                          <span>Documento subido</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                          <p className="text-slate-300">Subir comprobante de domicilio</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Social Security Card */}
                <div className="border border-slate-700/50 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock size={20} />
                    Tarjeta de Seguro Social
                  </h4>
                  <p className="text-sm text-slate-400 mb-4">
                    Opcional pero recomendado para verificación adicional
                  </p>

                  <div className="border-2 border-dashed border-slate-600/50 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
                    <input
                      type="file"
                      id="proofOfSsn"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('proofOfSsn', e.target.files[0])}
                      className="hidden"
                    />
                    <label htmlFor="proofOfSsn" className="cursor-pointer">
                      {formData.documents.proofOfSsn ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <CheckCircle size={24} />
                          <span>Documento subido</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                          <p className="text-slate-300">Subir tarjeta de SSN (opcional)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Authorizations */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-sky-400">
                    <FileCheck size={16} className="inline mr-2" />
                    Por favor lea y acepte las siguientes autorizaciones requeridas para proceder con nuestros servicios.
                  </p>
                </div>

                {/* Required Authorizations */}
                <div className="space-y-4">
                  {/* FCRA Consent */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.fcraConsent ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.fcraConsent}
                        onChange={() => handleAuthorizationChange('fcraConsent')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Consentimiento FCRA <span className="text-red-500">*</span>
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          Autorizo a TriExpert Credit Repair a actuar en mi nombre bajo la Ley de Informes Crediticios Justos (FCRA) 
                          para disputar información inexacta, incompleta o no verificable en mis reportes de crédito.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Credit Pull Consent */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.creditPullConsent ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.creditPullConsent}
                        onChange={() => handleAuthorizationChange('creditPullConsent')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Autorización para Obtener Reportes de Crédito <span className="text-red-500">*</span>
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          Autorizo a obtener mis reportes de crédito de Experian, Equifax y TransUnion con el propósito 
                          de analizar y disputar información incorrecta.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Communication Consent */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.communicationConsent ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.communicationConsent}
                        onChange={() => handleAuthorizationChange('communicationConsent')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Consentimiento de Comunicación
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          Autorizo recibir comunicaciones por email, teléfono y SMS relacionadas con mi caso y servicios.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Electronic Signature Consent */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.electronicSignatureConsent ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.electronicSignatureConsent}
                        onChange={() => handleAuthorizationChange('electronicSignatureConsent')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Consentimiento de Firma Electrónica
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          Acepto que mi firma electrónica tiene la misma validez legal que una firma manuscrita.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Terms of Service */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.termsOfService ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.termsOfService}
                        onChange={() => handleAuthorizationChange('termsOfService')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Términos de Servicio <span className="text-red-500">*</span>
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          He leído y acepto los{' '}
                          <a href="/terms" target="_blank" className="text-indigo-400 hover:underline">
                            Términos de Servicio
                          </a>
                          {' '}de TriExpert Credit Repair.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Privacy Policy */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.privacyPolicy ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.privacyPolicy}
                        onChange={() => handleAuthorizationChange('privacyPolicy')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Política de Privacidad <span className="text-red-500">*</span>
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          He leído y acepto la{' '}
                          <a href="/privacy" target="_blank" className="text-indigo-400 hover:underline">
                            Política de Privacidad
                          </a>
                          {' '}que describe cómo se maneja mi información personal.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Limited POA */}
                  <div className={`border rounded-xl p-4 transition-colors ${formData.authorizations.limitedPoa ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.authorizations.limitedPoa}
                        onChange={() => handleAuthorizationChange('limitedPoa')}
                        className="mt-1 w-5 h-5 rounded border-slate-600/50 text-indigo-400 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-white">
                          Poder Limitado (POA)
                        </span>
                        <p className="text-sm text-slate-300 mt-1">
                          Otorgo poder limitado a TriExpert Credit Repair para comunicarse con las agencias de crédito 
                          y acreedores en mi nombre exclusivamente para asuntos relacionados con la reparación de mi crédito.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Review & Signature */}
            {currentStep === 7 && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-slate-700/30 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4">Resumen de Información</h4>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Nombre Completo</p>
                      <p className="font-medium">{formData.firstName} {formData.middleName} {formData.lastName} {formData.suffix}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Fecha de Nacimiento</p>
                      <p className="font-medium">{formData.dateOfBirth}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">SSN</p>
                      <p className="font-medium">***-**-{formData.ssn.slice(-4)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Teléfono</p>
                      <p className="font-medium">{formData.phone}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-slate-400">Dirección</p>
                      <p className="font-medium">
                        {formData.currentAddress.street1}, {formData.currentAddress.city}, {formData.currentAddress.state} {formData.currentAddress.zipCode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="border border-slate-700/50 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <PenTool size={20} />
                    Firma Electrónica <span className="text-red-500">*</span>
                  </h4>
                  
                  <p className="text-sm text-slate-300 mb-4">
                    Al firmar a continuación, confirmo que toda la información proporcionada es verdadera y correcta, 
                    y que he leído y aceptado todos los términos y autorizaciones.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Escriba su nombre completo como firma
                    </label>
                    <input
                      type="text"
                      value={formData.signature}
                      onChange={(e) => handleChange('signature', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-signature text-xl"
                      placeholder="Su nombre completo"
                      style={{ fontFamily: 'cursive' }}
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>Fecha: {formData.signatureDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>IP: {formData.ipAddress || 'Obteniendo...'}</span>
                    </div>
                  </div>
                </div>

                {/* Legal Notice */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-sm text-amber-400">
                    <AlertCircle size={16} className="inline mr-2" />
                    <strong>Aviso Legal:</strong> La firma electrónica proporcionada tiene la misma validez legal 
                    que una firma manuscrita según la Ley E-SIGN (15 U.S.C. § 7001 et seq.) y la Ley UETA.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="px-6 md:px-8 py-4 bg-slate-700/30 border-t border-slate-700/50 flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                currentStep === 1
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              <ChevronLeft size={20} />
              Anterior
            </button>

            {currentStep < steps.length ? (
              <button
                onClick={nextStep}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Siguiente
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={submitOnboarding}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Completar Registro
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
