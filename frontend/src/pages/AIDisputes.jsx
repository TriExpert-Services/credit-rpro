import React, { useState } from 'react';
import { Zap, Sparkles, FileText, Clock, CheckCircle, ArrowRight, Info, Shield } from 'lucide-react';
import DisputeLetterGenerator from '../components/DisputeLetterGenerator';
import DisputeLettersList from '../components/DisputeLettersList';

export default function AIDisputes() {
  const [activeTab, setActiveTab] = useState('generator');

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white relative">
              <Zap size={24} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">AI Dispute Letters</h1>
              <p className="text-slate-400">Generate professional dispute letters powered by GPT-4</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-xl">
          <Sparkles size={18} className="text-indigo-400" />
          <span className="text-sm font-medium text-indigo-700">Powered by OpenAI GPT-4</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 overflow-hidden">
        <div className="flex border-b border-slate-700/30">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 ${
              activeTab === 'generator'
                ? 'border-indigo-600 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
            }`}
          >
            <Sparkles size={18} />
            Generate Letter
          </button>
          <button
            onClick={() => setActiveTab('disputes')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 ${
              activeTab === 'disputes'
                ? 'border-indigo-600 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
            }`}
          >
            <FileText size={18} />
            My Dispute Letters
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'generator' && <DisputeLetterGenerator />}
          {activeTab === 'disputes' && <DisputeLettersList />}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-500 rounded-xl text-white">
            <Info size={20} />
          </div>
          <h3 className="font-semibold text-indigo-400 text-lg">How AI Dispute Letters Work</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { step: 1, title: 'Select Item', desc: 'Choose a credit item from your report to dispute', icon: FileText },
            { step: 2, title: 'Choose Type', desc: 'Select the dispute reason (fraud, inaccurate, etc.)', icon: Shield },
            { step: 3, title: 'Select Bureau', desc: 'Pick Equifax, Experian, or TransUnion', icon: FileText },
            { step: 4, title: 'AI Generation', desc: 'Our AI creates an FCRA-compliant letter', icon: Sparkles },
            { step: 5, title: 'Review & Send', desc: 'Edit if needed, save and send when ready', icon: CheckCircle },
          ].map((item, index) => (
            <div key={item.step} className="relative">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 h-full border border-indigo-500/30 hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <item.icon size={16} className="text-indigo-500" />
                </div>
                <h4 className="font-medium text-white mb-1">{item.title}</h4>
                <p className="text-sm text-slate-300">{item.desc}</p>
              </div>
              {index < 4 && (
                <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                  <ArrowRight size={16} className="text-indigo-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Shield size={20} className="text-emerald-400" />
            </div>
            <h4 className="font-semibold text-white">FCRA Compliant</h4>
          </div>
          <p className="text-sm text-slate-300">All letters reference Sections 609, 611, and 623 of the Fair Credit Reporting Act</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <h4 className="font-semibold text-white">Personalized Letters</h4>
          </div>
          <p className="text-sm text-slate-300">Each letter includes your full name, address, DOB, and SSN for maximum effectiveness</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-700/50 p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-sky-500/20 rounded-xl">
              <Clock size={20} className="text-sky-400" />
            </div>
            <h4 className="font-semibold text-white">Quick Generation</h4>
          </div>
          <p className="text-sm text-slate-300">Generate professional dispute letters in seconds, not hours</p>
        </div>
      </div>
    </div>
  );
}
