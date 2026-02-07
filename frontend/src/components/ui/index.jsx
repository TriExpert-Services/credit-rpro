/**
 * Reusable UI Components
 * Common components used throughout the application
 */

import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

// Loading Spinner
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Loader2 className={`animate-spin text-indigo-600 ${sizes[size]} ${className}`} />
  );
}

// Full Page Loading
export function PageLoading({ message = 'Cargando...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <LoadingSpinner size="xl" />
      <p className="mt-4 text-gray-600 font-medium">{message}</p>
    </div>
  );
}

// Section Loading
export function SectionLoading({ message = 'Cargando datos...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  );
}

// Alert Component
export function Alert({ type = 'info', title, message, onClose, className = '' }) {
  const types = {
    success: {
      bg: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-800',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
    },
    error: {
      bg: 'bg-red-50 border-red-100',
      text: 'text-red-800',
      icon: XCircle,
      iconColor: 'text-red-500',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    info: {
      bg: 'bg-blue-50 border-blue-100',
      text: 'text-blue-800',
      icon: Info,
      iconColor: 'text-blue-500',
    },
  };

  const config = types[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl p-4 border ${config.bg} ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1">
          {title && <h4 className={`font-semibold ${config.text}`}>{title}</h4>}
          {message && <p className={`text-sm ${config.text} ${title ? 'mt-1' : ''}`}>{message}</p>}
        </div>
        {onClose && (
          <button onClick={onClose} className={`${config.text} hover:opacity-70 transition-opacity`}>
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Empty State Component
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  actionText,
  className = '' 
}) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {Icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>}
      {action && actionText && (
        <button onClick={action} className="btn-primary">
          {actionText}
        </button>
      )}
    </div>
  );
}

// Stat Card Component
export function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  gradient = 'from-indigo-500 to-purple-600',
  className = '' 
}) {
  const changeColors = {
    positive: 'text-emerald-600 bg-emerald-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-br ${gradient} rounded-xl`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <span className={`text-sm font-medium px-2 py-1 rounded-lg ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// Badge Component
export function Badge({ children, variant = 'default', size = 'md', className = '' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}

// Confirmation Modal
export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger' 
}) {
  if (!isOpen) return null;

  const buttonVariants = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    primary: 'bg-indigo-600 hover:bg-indigo-700',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-xl transition-colors font-medium ${buttonVariants[variant]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Progress Bar
export function ProgressBar({ value, max = 100, color = 'indigo', showLabel = true, className = '' }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colors = {
    indigo: 'bg-indigo-600',
    green: 'bg-emerald-600',
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    red: 'bg-red-600',
    amber: 'bg-amber-600',
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        {showLabel && (
          <>
            <span className="text-sm font-medium text-gray-700">Progreso</span>
            <span className="text-sm font-medium text-gray-500">{Math.round(percentage)}%</span>
          </>
        )}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Tooltip Component
export function Tooltip({ children, text, position = 'top' }) {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div className={`absolute ${positions[position]} hidden group-hover:block z-50`}>
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
          {text}
        </div>
      </div>
    </div>
  );
}
