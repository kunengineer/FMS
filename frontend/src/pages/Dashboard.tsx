import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, ClipboardList, 
  Settings, Truck, Wrench, ShieldAlert 
} from 'lucide-react';
import { dashboardService } from '../utils/api';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, LineChart, Line, AreaChart, Area 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await dashboardService.summary();
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải dữ liệu tổng quan');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        setChartKey(prev => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
        <h3 className="font-semibold text-lg">Đã xảy ra lỗi</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const { cards, status_breakdown, weekly_failures, daily_shifts, red_alerts, yellow_alerts } = data;

  // Pie chart colors
  const COLORS = {
    active: '#10b981', // green
    repairing: '#ef4444', // red
    stopped_repair: '#f59e0b', // amber
    inactive: '#6b7280', // grey
  };

  const getStatusColor = (code: string) => {
    if (code === 'active') return COLORS.active;
    if (code === 'repairing') return COLORS.repairing;
    if (code === 'stopped_repair') return COLORS.stopped_repair;
    return COLORS.inactive;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo Tổng quan</h1>
        <p className="text-sm text-gray-500 mt-1">Dữ liệu vận hành và sửa chữa đội xe thời gian thực</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng số xe</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">{cards.total_vehicles}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Đang hoạt động</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">{cards.active_vehicles}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Đang sửa chữa</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">{cards.repairing_vehicles}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Số ca chạy hôm nay</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">{cards.today_shifts}</h3>
          </div>
        </div>
      </div>

      {/* WARNINGS & NOTIFICATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Red Alert Card (Vehicles with Outstanding Unresolved Failures) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-4">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">Xe sự cố chưa khắc phục</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {red_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-xs font-semibold">Tất cả phương tiện đều an toàn!</p>
              </div>
            ) : (
              red_alerts.map((alert: any) => (
                <div key={alert.vehicle_id} className="p-3 bg-red-50/50 rounded-xl border border-red-100 flex items-start justify-between space-x-3 text-xs">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded-md">
                      {alert.vehicle_code}
                    </span>
                    <span className="font-semibold text-gray-700 ml-2">{alert.vehicle_name}</span>
                    <p className="text-red-700 font-medium mt-1">
                      <strong className="font-semibold">{alert.latest_failure_category}:</strong> {alert.latest_failure_desc}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{alert.latest_failure_time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Yellow Alert Card (Vehicles nearing Maintenance Interval) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-4">
            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">Xe sắp đến hạn bảo trì định kỳ</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {yellow_alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-xs font-semibold">Chưa có xe nào đến lịch bảo trì.</p>
              </div>
            ) : (
              yellow_alerts.map((alert: any) => (
                <div key={alert.vehicle_id} className="p-3 bg-yellow-50/60 rounded-xl border border-yellow-100 flex flex-col space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 font-bold rounded-md">
                        {alert.vehicle_code}
                      </span>
                      <span className="font-semibold text-gray-700 ml-2">{alert.vehicle_name}</span>
                    </div>
                    <span className="text-[10px] text-red-600 font-bold bg-red-100/50 px-1.5 py-0.5 rounded">
                      Chạy quá: {Math.max(0, Math.round(alert.run_hours - alert.threshold))} giờ máy
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-yellow-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.min(100, (alert.run_hours / alert.threshold) * 100)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Số giờ chạy ca hiện tại: <strong>{alert.run_hours}h</strong></span>
                    <span>Hạn mức: <strong>{alert.threshold}h</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Donut Chart: Vehicle Status */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
          <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide mb-1">Trạng thái đội xe</h3>
          <div className="flex-1 flex flex-row items-center justify-between min-h-0">
            <div className="w-[50%] h-[180px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" key={`status-pie-${chartKey}`}>
                <PieChart>
                  <Pie
                    data={status_breakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                  >
                    {status_breakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={getStatusColor(entry.code)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-[50%] flex flex-col justify-center space-y-3.5 text-xs font-semibold text-gray-600 pl-4 border-l border-gray-150">
              {status_breakdown.map((entry: any) => (
                <div key={entry.code} className="flex items-start space-x-2">
                  <span 
                    className="h-3 w-3 rounded-full shrink-0 mt-0.5" 
                    style={{ backgroundColor: getStatusColor(entry.code) }} 
                  />
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium leading-none">{entry.status}</span>
                    <span className="text-[10px] text-gray-400 font-bold mt-0.5">{entry.count} xe</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart: Failure Categories */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 col-span-1 md:col-span-2 flex flex-col h-[320px]">
          <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide mb-4">Sự cố theo hạng mục (7 ngày qua)</h3>
          <div className="flex-1">
            {weekly_failures.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">Không có sự cố nào được báo cáo trong tuần.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" key={`failures-bar-${chartKey}`}>
                <BarChart data={weekly_failures} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="failuresBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                  <Tooltip />
                  <Bar dataKey="count" fill="url(#failuresBarGradient)" radius={[6, 6, 0, 0]} name="Số sự cố" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Area Chart (Upgraded from Line Chart): Operation logs count */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[300px]">
        <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide mb-4">Tần suất chạy ca (30 ngày qua)</h3>
        <div className="flex-1">
          {daily_shifts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">Chưa ghi nhận ca chạy nào.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" key={`shifts-area-${chartKey}`}>
              <AreaChart data={daily_shifts} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="shiftsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#shiftsAreaGradient)" name="Số ca" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
