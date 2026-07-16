import React, { useEffect, useState } from 'react';
import { 
  BarChart3, FileSpreadsheet, Calendar, Search, 
  HelpCircle, ShieldCheck, Wrench, ShieldAlert,
  Activity, CheckCircle2, AlertTriangle, AlertCircle, Clock, Info,
  Truck, X, CheckCircle, Eye, Users
} from 'lucide-react';
import { reportsService, failureService } from '../utils/api';

export const parseDescription = (desc: string) => {
  if (!desc) return { mainDesc: '', details: {} as Record<string, string> };

  const lastOpenParen = desc.lastIndexOf('(');
  const lastCloseParen = desc.lastIndexOf(')');
  
  if (lastOpenParen !== -1 && lastCloseParen !== -1 && lastCloseParen > lastOpenParen) {
    const mainDesc = desc.substring(0, lastOpenParen).trim();
    const metaStr = desc.substring(lastOpenParen + 1, lastCloseParen);
    
    if (metaStr.includes(':') || metaStr.includes('|')) {
      const parts = metaStr.split('|');
      const details: Record<string, string> = {};
      parts.forEach(part => {
        const colonIdx = part.indexOf(':');
        if (colonIdx !== -1) {
          const key = part.substring(0, colonIdx).trim();
          const val = part.substring(colonIdx + 1).trim();
          details[key] = val;
        }
      });
      return { mainDesc, details };
    }
  }
  
  return { mainDesc: desc, details: {} as Record<string, string> };
};
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, LineChart, Line 
} from 'recharts';

export const Reports: React.FC = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'kpi' | 'analytics' | 'operators'>('analytics');

  // KPI States
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Analytics States
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'quarter' | 'year'>('week');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [vehicleSearchText, setVehicleSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'repairing' | 'stopped_repair' | 'inactive'>('all');
  const [chartKey, setChartKey] = useState(0);

  // Vehicle details popup modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeVehicle, setActiveVehicle] = useState<any>(null);
  const [vehicleFailures, setVehicleFailures] = useState<any[]>([]);
  const [loadingFailures, setLoadingFailures] = useState(false);

  const handleOpenDetail = async (veh: any) => {
    setActiveVehicle(veh);
    setShowDetailModal(true);
    setLoadingFailures(true);
    try {
      const data = await failureService.list({ vehicle_id: veh.vehicle_id });
      setVehicleFailures(data);
    } catch (err: any) {
      console.error('Error fetching failures:', err);
    } finally {
      setLoadingFailures(false);
    }
  };

  useEffect(() => {
    if (analyticsData) {
      const timer = setTimeout(() => {
        setChartKey(prev => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [analyticsData]);

  // Custom Toast State
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showToast = (title: string, message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setNotification({ show: true, title, message, type });
  };



  useEffect(() => {
    if (activeTab === 'kpi') {
      fetchMetrics();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, timeframe]);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.metrics(startDate || undefined, endDate || undefined);
      setMetrics(data.mttr_mtbf);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải thông số báo cáo KPI');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await reportsService.analytics(timeframe);
      setAnalyticsData(data);
    } catch (err: any) {
      setAnalyticsError(err.message || 'Lỗi khi tải dữ liệu phân tích thống kê');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      await reportsService.exportExcel(startDate || undefined, endDate || undefined);
      showToast('Xuất báo cáo', 'Xuất tập tin báo cáo KPI thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất báo cáo', 'Lỗi xuất báo cáo Excel: ' + err.message, 'warning');
    }
  };

  // Status Colors Mapping
  const STATUS_COLORS = {
    active: '#10B981',          // xanh lá (Đảm bảo sản xuất)
    repairing: '#EF4444',       // đỏ (Hư hỏng / Đang sửa)
    stopped_repair: '#F59E0B',  // cam (Ngưng sửa chữa)
    inactive: '#6B7280',        // xám (Ngưng hoạt động)
  };

  const getFilteredVehicles = () => {
    if (!analyticsData?.status_summary) return [];
    
    let list: any[] = [];
    const summary = analyticsData.status_summary;
    
    if (statusFilter === 'all' || statusFilter === 'active') {
      list = [...list, ...summary.active_list.map((v: any) => ({ ...v, status: 'active', statusText: v.status_text || 'Đạt an toàn' }))];
    }
    if (statusFilter === 'all' || statusFilter === 'repairing') {
      list = [...list, ...summary.repairing_list.map((v: any) => ({ ...v, status: 'repairing', statusText: v.status_text || 'Có sự cố (Đang sửa)' }))];
    }
    if (statusFilter === 'all' || statusFilter === 'stopped_repair') {
      list = [...list, ...(summary.stopped_repair_list || []).map((v: any) => ({ ...v, status: 'stopped_repair', statusText: v.status_text || 'Ngưng sửa chữa' }))];
    }
    if (statusFilter === 'all' || statusFilter === 'inactive') {
      list = [...list, ...summary.inactive_list.map((v: any) => ({ ...v, status: 'inactive', statusText: v.status_text || 'Không đạt an toàn' }))];
    }

    if (vehicleSearchText.trim()) {
      const q = vehicleSearchText.toLowerCase();
      list = list.filter(v => 
        v.vehicle_code.toLowerCase().includes(q) || 
        v.vehicle_name.toLowerCase().includes(q)
      );
    }

    return list;
  };

  // Recharts colors palette
  const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between space-y-3 xs:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Phân tích Đội xe</h1>
          <p className="text-sm text-gray-500 mt-1">
            Thống kê chi tiết trạng thái hoạt động, sự cố hư hỏng, sửa chữa định kỳ và KPI vận hành.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'kpi' && (
            <button
              onClick={handleExportExcel}
              className="xs:self-end px-5 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-bold shadow-md flex items-center justify-center space-x-2 text-xs focus:outline-none transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>XUẤT BÁO CÁO EXCEL (6 SHEETS)</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white p-1 rounded-xl flex space-x-1.5 shadow-sm max-w-3xl overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-2 px-4 text-center rounded-lg font-bold text-xs transition flex items-center justify-center space-x-1.5 shrink-0 ${
            activeTab === 'analytics'
              ? 'bg-primary-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Thống kê & Biểu đồ sự cố</span>
        </button>
        <button
          onClick={() => setActiveTab('kpi')}
          className={`flex-1 py-2 px-4 text-center rounded-lg font-bold text-xs transition flex items-center justify-center space-x-1.5 shrink-0 ${
            activeTab === 'kpi'
              ? 'bg-primary-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Chỉ số độ tin cậy MTTR/MTBF</span>
        </button>
        <button
          onClick={() => setActiveTab('operators')}
          className={`flex-1 py-2 px-4 text-center rounded-lg font-bold text-xs transition flex items-center justify-center space-x-1.5 shrink-0 ${
            activeTab === 'operators'
              ? 'bg-primary-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Đánh giá Người vận hành</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: ANALYTICS DASHBOARD                 */}
      {/* ========================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Timeframe selector header */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4.5 w-4.5 text-primary-600" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Thời gian thống kê:</span>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl space-x-1 self-start sm:self-auto overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
              <button
                onClick={() => setTimeframe('day')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  timeframe === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Hàng Ngày (24h)
              </button>
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  timeframe === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Hàng Tuần
              </button>
              <button
                onClick={() => setTimeframe('quarter')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  timeframe === 'quarter' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Hàng Quý (90 ngày)
              </button>
              <button
                onClick={() => setTimeframe('year')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  timeframe === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Hàng Năm (365 ngày)
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : analyticsError || !analyticsData ? (
            <div className="p-6 text-center text-red-600 font-bold bg-white rounded-2xl shadow-sm border border-red-100">
              {analyticsError || 'Không thể tải dữ liệu thống kê.'}
            </div>
          ) : (
            <>
              {/* STATUS OVERVIEW CARD (READY VS BROKEN PRODUCTION STATS) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng phương tiện</p>
                    <h3 className="text-xl font-black text-gray-800 mt-1">
                      {analyticsData.status_summary.total_count}
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Đảm bảo sản xuất</p>
                    <h3 className="text-xl font-black text-green-700 mt-1">
                      {analyticsData.status_summary.active_count}
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Đang hư hỏng/sửa</p>
                    <h3 className="text-xl font-black text-red-700 mt-1">
                      {analyticsData.status_summary.repairing_count}
                    </h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 text-gray-500 rounded-xl">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tỷ lệ khả dụng</p>
                    <h3 className="text-xl font-black text-gray-800 mt-1">
                      {analyticsData.status_summary.total_count > 0 
                        ? `${Math.round((analyticsData.status_summary.active_count / analyticsData.status_summary.total_count) * 100)}%`
                        : '0%'
                      }
                    </h3>
                  </div>
                </div>
              </div>

              {/* TIMEFRAME SPECIFIC STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary-50 p-4 rounded-xl border border-primary-100/60 text-xs">
                  <span className="block text-[10px] text-primary-500 uppercase font-black tracking-wider mb-1">
                    Số vụ sự cố trong kỳ
                  </span>
                  <p className="text-2xl font-black text-primary-900">{analyticsData.total_failures} lần</p>
                  <p className="text-gray-500 mt-1.5 font-medium">Tổng số trường hợp báo hỏng từ đầu kỳ.</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-xl border border-green-100/60 text-xs">
                  <span className="block text-[10px] text-green-600 uppercase font-black tracking-wider mb-1">
                    Đã hoàn thành sửa chữa
                  </span>
                  <p className="text-2xl font-black text-green-900">{analyticsData.total_repairs} vụ</p>
                  <p className="text-gray-500 mt-1.5 font-medium">
                    Tỷ lệ khắc phục xong: {' '}
                    <strong>
                      {analyticsData.total_failures > 0 
                        ? `${Math.round((analyticsData.total_repairs / analyticsData.total_failures) * 100)}%`
                        : '0%'
                      }
                    </strong>
                  </p>
                </div>

                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100/60 text-xs">
                  <span className="block text-[10px] text-orange-600 uppercase font-black tracking-wider mb-1">
                    Sự cố chưa giải quyết
                  </span>
                  <p className="text-2xl font-black text-orange-900">{analyticsData.total_unresolved} vụ</p>
                  <p className="text-gray-500 mt-1.5 font-medium">Hiện đang trong hàng đợi chờ xử lý bảo trì.</p>
                </div>
              </div>

              {/* CHARTS CONTAINER */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Failure Timeline trend */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col h-[320px]">
                  <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider mb-4 flex items-center space-x-1.5">
                    <Activity className="h-4.5 w-4.5 text-primary-600" />
                    <span>Tần suất sự cố hư hỏng phát sinh theo thời gian</span>
                  </h3>
                  <div className="flex-1 min-h-0">
                    {analyticsData.timeline_data.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs text-gray-400 italic">
                        Không có biến động sự cố ghi nhận.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.timeline_data}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#3B82F6" 
                            strokeWidth={3} 
                            dot={{ r: 4, stroke: '#3B82F6', strokeWidth: 2, fill: '#FFFFFF' }} 
                            activeDot={{ r: 6 }} 
                            name="Số sự cố" 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Chart 2: Category Breakdown */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[320px]">
                  <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider mb-4 flex items-center space-x-1.5">
                    <Info className="h-4.5 w-4.5 text-primary-600" />
                    <span>Hạng mục sửa chữa & hư hỏng</span>
                  </h3>
                  <div className="flex-1 min-h-0 relative flex items-center justify-center">
                    {analyticsData.category_freq.length === 0 ? (
                      <div className="text-xs text-gray-400 italic">Không có dữ liệu sự cố.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" key={`reports-pie-${chartKey}`}>
                        <PieChart>
                          <Pie
                            data={analyticsData.category_freq}
                            dataKey="count"
                            nameKey="category_name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                          >
                            {analyticsData.category_freq.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="max-h-24 overflow-y-auto mt-2 space-y-1 text-[10px] font-semibold text-gray-500">
                    {analyticsData.category_freq.map((entry: any, index: number) => (
                      <div key={entry.category_name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span 
                            className="h-2 w-2 rounded-full shrink-0" 
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                          />
                          <span className="truncate">{entry.category_name}</span>
                        </div>
                        <span>{entry.count} lần</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIST OF VEHICLES BY STATUS SECTION */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">
                      Danh sách tình trạng phương tiện
                    </h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                      Kiểm tra nhanh tình trạng khả dụng/hư hỏng thực tế của từng phương tiện.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status tab selectors */}
                    <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Tất cả ({analyticsData.status_summary.total_count})
                      </button>
                      <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Đạt an toàn ({analyticsData.status_summary.active_count})
                      </button>
                      <button
                        onClick={() => setStatusFilter('repairing')}
                        className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'repairing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Có sự cố ({analyticsData.status_summary.repairing_count})
                      </button>
                      <button
                        onClick={() => setStatusFilter('stopped_repair')}
                        className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'stopped_repair' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Có sự cố (Ngưng sửa chữa) ({analyticsData.status_summary.stopped_repair_count || 0})
                      </button>
                      <button
                        onClick={() => setStatusFilter('inactive')}
                        className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'inactive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        Không đạt an toàn ({analyticsData.status_summary.inactive_count})
                      </button>
                    </div>
 
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Tìm xe..."
                        value={vehicleSearchText}
                        onChange={(e) => setVehicleSearchText(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-[10px] font-semibold focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
 
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 uppercase tracking-wider text-gray-500 font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Mã thiết bị</th>
                        <th className="px-4 py-2.5">Tên thiết bị</th>
                        <th className="px-4 py-2.5">Số giờ máy hiện tại</th>
                        <th className="px-4 py-2.5">Tình trạng phục vụ sản xuất</th>
                        <th className="px-4 py-2.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                      {getFilteredVehicles().length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">
                            Không tìm thấy phương tiện nào khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        getFilteredVehicles().map((v: any) => (
                          <tr 
                            key={v.vehicle_id} 
                            className="hover:bg-gray-50/70 transition cursor-pointer"
                            onClick={() => handleOpenDetail(v)}
                          >
                            <td className="px-4 py-2.5 font-bold text-gray-900 uppercase">{v.vehicle_code}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-600">{v.vehicle_name}</td>
                            <td className="px-4 py-2.5">{v.current_hourmeter} giờ máy</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span 
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  v.statusText.includes('Đang sửa') 
                                    ? 'bg-orange-100 text-orange-800 border-orange-200' 
                                    : v.statusText.includes('Ngưng sửa') 
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : v.statusText.includes('Đã sửa') 
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : v.statusText.includes('Đạt an toàn') 
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                }`}
                              >
                                {v.statusText}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(v);
                                }}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                                title="Xem chi tiết"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FREQUENCY ANALYSIS TABLES (RECURRING FAILURES) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle breakdown recurrence frequency */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  <div>
                    <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                      Tần suất lặp lại hư hỏng theo thiết bị
                    </h3>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                      Xếp hạng phương tiện báo hỏng nhiều lần nhất trong kỳ thống kê.
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[9px] font-bold">
                        <tr>
                          <th className="px-3 py-2">Thiết bị</th>
                          <th className="px-3 py-2 text-right">Số lần báo hỏng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {analyticsData.vehicle_freq.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-4 text-center text-gray-400 italic">
                              Chưa ghi nhận sự cố.
                            </td>
                          </tr>
                        ) : (
                          analyticsData.vehicle_freq.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition">
                              <td className="px-3 py-2">
                                <span className="font-bold text-gray-900 uppercase block">{item.vehicle_code}</span>
                                <span className="text-[9px] text-gray-400 block">{item.vehicle_name}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-red-600">
                                {item.count} lần
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category breakdown recurrence frequency */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  <div>
                    <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                      Tần suất hỏng hóc theo linh kiện/hạng mục
                    </h3>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                      Bộ phận/hệ thống hay gặp sự cố lặp lại nhất trong kỳ thống kê.
                    </p>
                  </div>

                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[9px] font-bold">
                        <tr>
                          <th className="px-3 py-2">Bộ phận sự cố</th>
                          <th className="px-3 py-2 text-right">Số lần báo hỏng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {analyticsData.category_freq.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-4 text-center text-gray-400 italic">
                              Chưa ghi nhận sự cố.
                            </td>
                          </tr>
                        ) : (
                          analyticsData.category_freq.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition">
                              <td className="px-3 py-2 font-bold text-gray-800">{item.category_name}</td>
                              <td className="px-3 py-2 text-right font-bold text-orange-600">
                                {item.count} lần
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: OPERATOR PERFORMANCE EVALUATION    */}
      {/* ========================================== */}
      {activeTab === 'operators' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">
                Đánh giá Vận hành & Tuân thủ An toàn
              </h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                Theo dõi tần suất vận hành, điểm tuân thủ quy trình kiểm tra xe và số lần phát hiện sự cố.
              </p>
            </div>

            {analyticsLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
              </div>
            ) : !analyticsData || !analyticsData.operator_analytics || analyticsData.operator_analytics.length === 0 ? (
              <div className="py-8 text-center text-gray-400 italic text-xs bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                Chưa ghi nhận ca vận hành nào để phân tích chỉ số người vận hành.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Operator Compliance Chart */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[280px]">
                  <h4 className="font-bold text-xs text-gray-800 uppercase tracking-wider mb-4">
                    Điểm tuân thủ an toàn theo nhân sự
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.operator_analytics} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="full_name" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                        <Tooltip />
                        <Bar dataKey="compliance_score" radius={[4, 4, 0, 0]} name="Điểm tuân thủ">
                          {analyticsData.operator_analytics.map((op: any, index: number) => {
                            let fill = '#10B981'; // Green
                            if (op.compliance_score < 70) fill = '#EF4444'; // Red
                            else if (op.compliance_score < 90) fill = '#F59E0B'; // Orange
                            return <Cell key={`cell-${index}`} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Họ và tên</th>
                        <th className="px-4 py-3">Tổ đội</th>
                        <th className="px-4 py-3 text-center">Số ca chạy</th>
                        <th className="px-4 py-3 text-center">Tổng giờ vận hành</th>
                        <th className="px-4 py-3 text-center">Phát hiện sự cố (Đầu ca / Trong ca)</th>
                        <th className="px-4 py-3 text-center">Mở ca không an toàn</th>
                        <th className="px-4 py-3 text-center">Điểm tuân thủ</th>
                        <th className="px-4 py-3 text-center">Xếp loại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                      {analyticsData.operator_analytics.map((op: any) => (
                        <tr key={op.operator_id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3 font-bold text-gray-900">{op.full_name}</td>
                          <td className="px-4 py-3 text-gray-500">{op.department}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800">{op.shift_count} ca</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-650">{op.total_hours}h</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-green-600 font-bold">{op.before_shift_failures}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-red-500 font-bold">{op.during_shift_failures}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {op.safety_violations > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                {op.safety_violations} lần vi phạm
                              </span>
                            ) : (
                              <span className="text-green-600 font-bold">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-primary-700 text-xs">
                            {op.compliance_score}/100
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span 
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                op.compliance_score >= 90
                                  ? 'bg-green-100 text-green-800 border-green-200' 
                                  : op.compliance_score >= 70
                                  ? 'bg-orange-100 text-orange-800 border-orange-200'
                                  : 'bg-red-100 text-red-800 border-red-200'
                              }`}
                            >
                              {op.rank}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: KPI & RELIABILITY METRICS (MTTR/MTBF) */}
      {/* ========================================== */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          {/* FILTER BAR */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Từ ngày:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
            />
            
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Đến ngày:</span>
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
            />

            <button
              onClick={fetchMetrics}
              className="px-5 py-2.5 bg-primary-700 hover:bg-primary-850 text-white rounded-xl font-bold text-xs transition md:ml-auto shadow-sm"
            >
              Áp dụng bộ lọc
            </button>
          </div>

          {/* DETAILED MATH DESCRIPTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl border border-primary-200 text-xs text-primary-950 font-medium">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-primary-800 font-bold text-xs uppercase">
                <Wrench className="h-4.5 w-4.5" />
                <span>Chỉ số MTTR (Mean Time To Repair)</span>
              </div>
              <p>Công thức: <strong>MTTR = Tổng giờ sửa chữa thực tế / Số lần sửa chữa hoàn tất</strong></p>
              <p className="text-gray-600">Đại diện cho tốc độ khắc phục sự cố trung bình của kỹ thuật viên bảo dưỡng. Chỉ số càng thấp phản ánh năng lực xử lý càng tối ưu.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-primary-800 font-bold text-xs uppercase">
                <ShieldAlert className="h-4.5 w-4.5" />
                <span>Chỉ số MTBF (Mean Time Between Failures)</span>
              </div>
              <p>Công thức: <strong>MTBF = Tổng khoảng cách thời gian giữa 2 sự cố liên tiếp / Số lần xảy ra</strong></p>
              <p className="text-gray-600">Thể hiện độ tin cậy của máy móc trong quá trình sản xuất. Chỉ số càng cao phản ánh chất lượng xe tốt, bảo trì định kỳ hiệu quả.</p>
            </div>
          </div>

          {!loading && !error && metrics.length > 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 h-[320px]">
              <h4 className="font-bold text-xs text-gray-800 uppercase tracking-wider mb-4">
                So sánh Giờ hoạt động & Thời gian dừng máy (Downtime) theo xe
              </h4>
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="vehicle_code" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="active_hours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Giờ hoạt động (h)" />
                    <Bar dataKey="downtime_hours" fill="#EF4444" radius={[4, 4, 0, 0]} name="Thời gian dừng máy (h)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* METRICS TABLE VIEW */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider">Xem trước chỉ số độ tin cậy đội xe</h3>
              <span className="text-[10px] text-gray-400 font-semibold">Tự động tính dựa trên lịch sử hư hỏng & sửa chữa</span>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-600 font-bold">{error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Mã Phương Tiện</th>
                      <th className="px-6 py-4">Tên Phương Tiện</th>
                      <th className="px-6 py-4 text-center">Tổng Giờ Hoạt Động</th>
                      <th className="px-6 py-4 text-center">Số Lần Sửa Chữa</th>
                      <th className="px-6 py-4 text-center">Thời Gian Hư Hỏng</th>
                      <th className="px-6 py-4 text-center">Tỉ Lệ Hư/Hoạt Động</th>
                      <th className="px-6 py-4 text-center">MTTR (Sửa TB)</th>
                      <th className="px-6 py-4 text-center">MTBF (An toàn TB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                    {metrics.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                          Chưa ghi nhận dữ liệu để lập báo cáo.
                        </td>
                      </tr>
                    ) : (
                      metrics.map((m) => (
                        <tr key={m.vehicle_code} className="hover:bg-gray-50/50 transition">
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 uppercase">
                            {m.vehicle_code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold">{m.vehicle_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-blue-650">
                            {m.active_hours || 0}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-orange-600">
                            {m.repair_count || 0} lần
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-red-650">
                            {m.downtime_hours || 0}h
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-center font-bold ${
                            (m.efficiency_rate || 0) > 50 ? 'text-red-700 font-extrabold' : 'text-gray-600'
                          }`}>
                            {m.efficiency_rate || 0}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-primary-700">
                            {m.mttr}h / lần
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-green-700">
                            {m.mtbf === 'N/A' ? 'N/A' : `${m.mtbf}h`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: THÔNG BÁO HỆ THỐNG (CUSTOM TOAST / NOTIFICATION DIALOG) */}
      {/* ========================================== */}
      {notification.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : notification.type === 'warning' ? (
                <AlertTriangle className="h-6 w-6 text-orange-600 animate-pulse" />
              ) : (
                <AlertCircle className="h-6 w-6 text-blue-600" />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-bold text-gray-900">{notification.title}</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">{notification.message}</p>
            </div>
            
            <button
              type="button"
              onClick={() => setNotification({ ...notification, show: false })}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs transition active:scale-[0.98]"
            >
              ĐỒNG Ý
            </button>
          </div>
        </div>
      )}
      {/* ================================================================= */}
      {/* 3. MODAL: CHI TIẾT PHƯƠNG TIỆN */}
      {/* ================================================================= */}
      {showDetailModal && activeVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <h3 className="font-bold text-sm uppercase">Chi tiết phương tiện: {activeVehicle.vehicle_name} ({activeVehicle.vehicle_code})</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-gray-700">
              {/* Thông số kỹ thuật */}
              <div className="space-y-3">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Thông số kỹ thuật</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Tên thiết bị</span>
                    <span className="font-bold text-gray-800 text-[11px] block mt-0.5">{activeVehicle.vehicle_name}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Phân loại</span>
                    <span className="font-bold text-gray-800 text-[11px] block mt-0.5">{activeVehicle.vehicle_type?.type_name || "N/A"}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Trạng thái hiện tại</span>
                    <span className="block mt-1">
                      <span 
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          activeVehicle.statusText?.includes('Đang sửa') 
                            ? 'bg-orange-100 text-orange-800 border-orange-200' 
                            : activeVehicle.statusText?.includes('Ngưng sửa') 
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : activeVehicle.statusText?.includes('Đã sửa') 
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : activeVehicle.statusText?.includes('Đạt an toàn') 
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}
                      >
                        {activeVehicle.statusText}
                      </span>
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50 col-span-2 sm:col-span-2">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Thông số kỹ thuật</span>
                    <span className="font-bold text-gray-800 text-[11px] block mt-0.5">{activeVehicle.vehicle_name}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Giờ chạy máy hiện tại</span>
                    <span className="font-bold text-primary-700 text-[11px] block mt-0.5">{activeVehicle.current_hourmeter} giờ</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50 col-span-2 sm:col-span-1">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Lần bảo trì cuối</span>
                    <span className="font-bold text-gray-600 text-[11px] block mt-0.5">{activeVehicle.last_maintenance_hourmeter || "0"} giờ</span>
                  </div>
                </div>
              </div>

              {/* Tình trạng sự cố và sửa chữa */}
              <div className="space-y-3">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Sự cố & Khắc phục bảo trì</h4>
                
                {loadingFailures ? (
                  <div className="flex justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Active Failures */}
                    <div>
                      <h5 className="font-bold text-[10px] text-red-600 uppercase mb-2">Sự cố tồn đọng hiện tại</h5>
                      {vehicleFailures.filter(f => !f.is_repaired).length === 0 ? (
                        <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200/50 flex items-center space-x-2 font-medium">
                          <CheckCircle className="h-4.5 w-4.5 text-green-600" />
                          <span>Phương tiện hoạt động tốt, không có sự cố tồn đọng nào được ghi nhận.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {vehicleFailures.filter(f => !f.is_repaired).map((fail: any) => {
                            const activeRep = fail.repairs?.find((r: any) => r.repair_status !== 'done' && r.repair_status !== 'cancelled');
                            return (
                              <div key={fail.failure_id} className="p-4 bg-red-50/40 border border-red-100 rounded-xl space-y-2">
                                <div className="flex justify-between items-start">
                                  <div className="font-bold text-red-900 text-[11px] flex items-center space-x-1.5">
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[9px]">Yêu cầu #{fail.failure_id}</span>
                                    <span>Bộ phận: {fail.category?.category_name || "Chưa phân loại"}</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    fail.severity === 'dangerous' ? 'bg-red-600 text-white animate-pulse' : fail.severity === 'heavy' ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-gray-800'
                                  }`}>
                                    {fail.severity === 'dangerous' ? 'Nguy hiểm (Dừng máy)' : fail.severity === 'heavy' ? 'Nặng (Vào bãi sửa)' : 'Nhẹ (Theo dõi)'}
                                  </span>
                                </div>
                                {(() => {
                                  const parsed = parseDescription(fail.description);
                                  return (
                                    <div className="space-y-1.5 font-semibold text-xs text-gray-750">
                                      <p className="text-gray-700 italic">Mô tả: "{parsed.mainDesc}"</p>
                                      {Object.keys(parsed.details).length > 0 && (
                                        <div className="grid grid-cols-2 gap-2 bg-white/50 p-2 rounded-lg border border-red-100/35 text-[10px]">
                                          {parsed.details['TG dừng'] && (
                                            <div>
                                              <span className="font-bold block text-gray-400 uppercase text-[8px]">Thời gian dừng / sửa chữa</span>
                                              <span className="text-red-600 font-bold">{parsed.details['TG dừng']}</span>
                                            </div>
                                          )}
                                           {parsed.details['Tồn đọng từ'] && (
                                            <div>
                                              <span className="font-bold block text-gray-400 uppercase text-[8px]">Tồn đọng từ ngày</span>
                                              <span className="text-orange-600 font-bold">{parsed.details['Tồn đọng từ']}</span>
                                            </div>
                                          )}
                                          {parsed.details['Chi tiết'] && (
                                            <div className="col-span-2">
                                              <span className="font-bold block text-gray-400 uppercase text-[8px]">Mô tả chi tiết</span>
                                              <span className="text-gray-700 font-bold">{parsed.details['Chi tiết']}</span>
                                            </div>
                                          )}
                                          {parsed.details['Ghi chú'] && (
                                            <div className="col-span-2">
                                              <span className="font-bold block text-gray-400 uppercase text-[8px]">Ghi chú</span>
                                              <span className="text-gray-700 font-bold">{parsed.details['Ghi chú']}</span>
                                            </div>
                                          )}
                                          {parsed.details['Đề nghị'] && (
                                            <div className="col-span-2">
                                              <span className="font-bold block text-gray-400 uppercase text-[8px]">Đề nghị</span>
                                              <span className="text-primary-700 font-bold">{parsed.details['Đề nghị']}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                                <div className="text-[10px] text-gray-500 grid grid-cols-2 gap-2 pt-1.5 border-t border-red-100/40">
                                  <div>Thời điểm báo: <span className="font-semibold text-gray-700">{new Date(fail.failure_time).toLocaleString('vi-VN')}</span></div>
                                  <div>Người báo: <span className="font-semibold text-gray-700">{fail.creator?.full_name || fail.created_by}</span></div>
                                </div>
                                
                                {/* Repair tracking and Pending explanation */}
                                <div className="mt-2 p-2.5 bg-white/70 rounded-lg border border-red-200/30 text-[10px] space-y-1">
                                  <div className="flex justify-between font-bold">
                                    <span className="text-gray-500">Tiến trình sửa chữa:</span>
                                    <span className={activeRep?.repair_status === 'in_progress' ? 'text-blue-600' : 'text-amber-600'}>
                                      {activeRep?.repair_status === 'in_progress' ? '⚡ Đang sửa chữa' : '⏳ Chờ tiếp nhận'}
                                    </span>
                                  </div>
                                  {activeRep && (
                                    <>
                                      <div>Người đảm nhận: <span className="font-semibold text-gray-850">{activeRep.mechanic?.full_name || activeRep.mechanic_id}</span></div>
                                      {activeRep.repair_start && (
                                        <div>Bắt đầu lúc: <span className="font-semibold text-gray-850">{new Date(activeRep.repair_start).toLocaleString('vi-VN')}</span></div>
                                      )}
                                    </>
                                  )}
                                  {/* PENDING REASON / NOTES */}
                                  <div className="text-red-750 font-medium bg-red-100/30 p-1.5 rounded mt-1.5 border-l-2 border-red-500 text-left">
                                    <span className="font-bold block text-[9px] uppercase tracking-wide">Lý do tồn đọng / Ghi chú kỹ thuật:</span>
                                    <p className="mt-0.5">{activeRep?.note || fail.notes || "Chưa ghi nhận ghi chú bảo trì cụ thể (Đang chờ thợ cập nhật)."}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Resolved Failures History */}
                    <div>
                      <h5 className="font-bold text-[10px] text-green-700 uppercase mb-2">Lịch sử sự cố đã khắc phục gần nhất (tối đa 5 lần)</h5>
                      {vehicleFailures.filter(f => f.is_repaired).length === 0 ? (
                        <div className="text-center py-4 text-gray-400 italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                          Chưa có lịch sử sự cố được ghi nhận khắc phục.
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {vehicleFailures.filter(f => f.is_repaired).slice(0, 5).map((fail: any) => {
                            const doneRep = fail.repairs?.find((r: any) => r.repair_status === 'done');
                            const parsed = parseDescription(fail.description);
                            return (
                              <div key={fail.failure_id} className="p-4 bg-gradient-to-br from-white to-green-50/10 border-l-4 border-l-green-500 border border-gray-200/80 rounded-2xl space-y-3 shadow-sm hover:shadow transition duration-200 text-left">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <div className="flex items-center space-x-2">
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px]">Yêu cầu #{fail.failure_id}</span>
                                    <span className="text-gray-800">Sự cố: {fail.category?.category_name || "Chưa phân loại"}</span>
                                  </div>
                                  <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded border border-green-200/50 flex items-center space-x-1">
                                    <span>✓</span> <span>Đã khắc phục</span>
                                  </span>
                                </div>
                                <div className="text-gray-700 font-bold text-xs bg-white p-2.5 rounded-lg border border-gray-150/60 leading-relaxed shadow-sm">
                                  <span className="text-[8px] text-gray-400 block font-semibold uppercase mb-0.5">Sự cố ghi nhận</span>
                                  {parsed.mainDesc}
                                </div>
                                {Object.keys(parsed.details).length > 0 && (
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-500 pt-1">
                                    {parsed.details['TG dừng'] && (
                                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="block text-[8px] text-gray-400 uppercase">Thời gian dừng / sửa chữa</span>
                                        <span className="text-red-600 font-bold">{parsed.details['TG dừng']}</span>
                                      </div>
                                    )}
                                    {parsed.details['Tồn đọng từ'] && (
                                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="block text-[8px] text-gray-400 uppercase">Tồn đọng từ</span>
                                        <span className="text-orange-600 font-bold">{parsed.details['Tồn đọng từ']}</span>
                                      </div>
                                    )}
                                    {parsed.details['Chi tiết'] && (
                                      <div className="col-span-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="block text-[8px] text-gray-400 uppercase">Mô tả chi tiết</span>
                                        <span className="text-gray-700 font-bold">{parsed.details['Chi tiết']}</span>
                                      </div>
                                    )}
                                    {parsed.details['Ghi chú'] && (
                                      <div className="col-span-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="block text-[8px] text-gray-400 uppercase">Ghi chú kỹ thuật</span>
                                        <span className="text-gray-700 font-bold">{parsed.details['Ghi chú']}</span>
                                      </div>
                                    )}
                                    {parsed.details['Đề nghị'] && (
                                      <div className="col-span-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="block text-[8px] text-gray-400 uppercase">Kiến nghị / Đề xuất</span>
                                        <span className="text-primary-700 font-bold">{parsed.details['Đề nghị']}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {doneRep && (
                                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-green-50/20 p-2.5 rounded-lg border border-green-100/60 font-semibold mt-2">
                                    <div>
                                      <span className="block text-[8px] text-gray-400 uppercase">Thợ khắc phục</span>
                                      <span className="font-bold text-gray-700">{doneRep.mechanic?.full_name || doneRep.mechanic_id}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[8px] text-gray-400 uppercase">Ngày hoàn thành</span>
                                      <span className="font-bold text-gray-700">{doneRep.repair_end ? new Date(doneRep.repair_end).toLocaleDateString('vi-VN') : '---'}</span>
                                    </div>
                                    {doneRep.parts_used && (
                                      <div className="col-span-2">
                                        <span className="block text-[8px] text-gray-400 uppercase">Vật tư thay thế</span>
                                        <span className="font-bold text-blue-700">{doneRep.parts_used}</span>
                                      </div>
                                    )}
                                    {doneRep.note && (
                                      <div className="col-span-2">
                                        <span className="block text-[8px] text-gray-400 uppercase">Ghi chú khắc phục</span>
                                        <span className="font-bold text-gray-750 block mt-0.5 leading-snug">
                                          {parseDescription(doneRep.note).mainDesc}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition shadow shadow-yellow-100 text-xs uppercase"
              >
                ĐÓNG CỬA SỔ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Reports;
