import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import { Activity, CreditCard, ChevronLeft, Calendar, User, Package, Clock } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export default function AdminLogs() {
  const [activeTab, setActiveTab] = useState('activity');

  const { data: activityLogs, isLoading: loadingActivity } = useQuery({
    queryKey: ['admin_activity_logs'],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/activity');
      return res.data.data;
    },
    enabled: activeTab === 'activity',
  });

  const { data: paymentLogs, isLoading: loadingPayment } = useQuery({
    queryKey: ['admin_payment_logs'],
    queryFn: async () => {
      const res = await axios.get('/admin/logs/payment');
      return res.data.data;
    },
    enabled: activeTab === 'payment',
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="pb-24 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 text-white shadow-lg rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/dashboard" className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-bold">Log Sistem</h1>
        </div>
        <p className="text-green-50 text-sm">Pemantauan aktivitas dan transaksi secara *real-time*.</p>
        
        {/* Tabs */}
        <div className="flex bg-black/20 p-1 rounded-xl mt-6 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'activity' 
                ? 'bg-white text-green-700 shadow-sm' 
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Activity className="w-4 h-4" />
            Aktivitas
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'payment' 
                ? 'bg-white text-green-700 shadow-sm' 
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Keuangan
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 -mt-2">
        {/* Activity Logs */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {loadingActivity ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>)}
              </div>
            ) : activityLogs?.length > 0 ? (
              <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 dark:before:via-gray-700 before:to-transparent">
                {activityLogs.map((log) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-900 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{log.user?.name || 'Sistem'}</span>
                        <span className="text-[10px] text-gray-500 font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full uppercase">{log.action}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{log.description}</p>
                      <time className="text-[10px] text-gray-400 mt-2 block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(log.created_at)}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-10">Belum ada catatan aktivitas.</p>
            )}
          </div>
        )}

        {/* Payment Logs */}
        {activeTab === 'payment' && (
          <div className="space-y-4">
            {loadingPayment ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>)}
              </div>
            ) : paymentLogs?.length > 0 ? (
              paymentLogs.map((log) => (
                <div key={log.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex gap-4 items-start">
                  <div className={`p-3 rounded-xl shrink-0 ${
                    log.type === 'withdraw' ? 'bg-amber-100 text-amber-600' :
                    log.type === 'courier_fee' ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{log.description}</h4>
                      <span className={`font-bold text-sm whitespace-nowrap ml-2 ${
                        log.type === 'withdraw' ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        Rp {parseFloat(log.amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {log.user?.name || '-'}</span>
                      {log.order && (
                        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Order #{log.order.id}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(log.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-10">Belum ada catatan keuangan.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
