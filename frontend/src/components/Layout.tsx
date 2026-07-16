import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Truck, ClipboardList, BarChart3, 
  Settings, LogOut, Menu, X, ShieldAlert, Wrench, CheckCircle, Bell
} from 'lucide-react';
import { authService, failureService } from '../utils/api';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const isInitialized = React.useRef(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await authService.me();
        setUser(u);
      } catch (err) {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  // Auto dismiss notification toast
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Real-time failure & repair updates poll (Only notifies the relevant operator, not everyone)
  useEffect(() => {
    if (!user) return;

    const checkNotifications = async () => {
      try {
        const failures = await failureService.list();
        
        failures.forEach((fail: any) => {
          // Check if this failure is from a weekly report import
          const isWeeklyReport = fail.operation?.notes && (
            fail.operation.notes.includes("Weekly Report") || 
            fail.operation.notes.includes("báo cáo tuần")
          );

          if (isWeeklyReport) {
            const keyRep = `notified_repaired_${user.operator_id}_${fail.failure_id}`;
            const keyStart = `notified_started_${user.operator_id}_${fail.failure_id}`;
            localStorage.setItem(keyRep, 'true');
            localStorage.setItem(keyStart, 'true');
            return;
          }

          // Check if failure is relevant to current user
          const isReportedByMe = fail.created_by === user.operator_id;
          const isMyActiveVehicle = fail.operation && 
            fail.operation.operator_id === user.operator_id && 
            fail.operation.hourmeter_end === null;

          if (isReportedByMe || isMyActiveVehicle) {
            // Find done repair
            const doneRepair = fail.repairs?.find((r: any) => r.repair_status === 'done');
            // Find in-progress repair
            const inProgressRepair = fail.repairs?.find((r: any) => r.repair_status === 'in_progress');

            // Calculate age of failure to avoid alert popups for imported/historical data
            const failureDate = new Date(fail.failure_time);
            const now = new Date();
            const diffMinutes = (now.getTime() - failureDate.getTime()) / (1000 * 60);

            if (fail.is_repaired && doneRepair) {
              const key = `notified_repaired_${user.operator_id}_${fail.failure_id}`;
              const alreadyNotified = localStorage.getItem(key);
              if (!alreadyNotified) {
                localStorage.setItem(key, 'true'); // mark as processed
                // Only trigger visual alert if it's a recent failure (within 30 minutes)
                if (isInitialized.current && diffMinutes >= 0 && diffMinutes <= 30 && doneRepair.mechanic_id !== user.operator_id) {
                  setNotification({
                    show: true,
                    title: `🔧 Đã sửa xong xe ${fail.vehicle?.vehicle_code}`,
                    message: `Sự cố #${fail.failure_id} (${fail.category?.category_name}) đã được khắc phục xong bởi ${doneRepair.mechanic?.full_name || doneRepair.mechanic_id}. Khắc phục: "${doneRepair.note || 'Không ghi nhận'}"`,
                    type: 'success'
                  });
                }
              }
            } else if (!fail.is_repaired && inProgressRepair) {
              const key = `notified_started_${user.operator_id}_${fail.failure_id}`;
              const alreadyNotified = localStorage.getItem(key);
              if (!alreadyNotified) {
                localStorage.setItem(key, 'true'); // mark as processed
                // Only trigger visual alert if it's a recent failure (within 30 minutes)
                if (isInitialized.current && diffMinutes >= 0 && diffMinutes <= 30 && inProgressRepair.mechanic_id !== user.operator_id) {
                  setNotification({
                    show: true,
                    title: `⚡ Đang sửa chữa xe ${fail.vehicle?.vehicle_code}`,
                    message: `Kỹ thuật viên ${inProgressRepair.mechanic?.full_name || inProgressRepair.mechanic_id} đã tiếp nhận và đang xử lý sự cố #${fail.failure_id} (${fail.category?.category_name}).`,
                    type: 'info'
                  });
                }
              }
            }
          }
        });

        if (!isInitialized.current) {
          isInitialized.current = true;
        }
      } catch (err) {
        console.error('Error checking notifications:', err);
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Route protection redirect guard
  useEffect(() => {
    if (loading || !user) return;
    
    const permissionKeys = new Set(user.role_rel?.permissions?.map((p: any) => p.permission_key) || []);
    const isAdmin = permissionKeys.has('admin:all') || user.role_rel?.role_name === 'ADMIN';
    const hasPermission = (keys: string[]) => {
      if (isAdmin) return true;
      return keys.some(k => permissionKeys.has(k));
    };

    const allowedItems = [
      { path: '/dashboard', show: hasPermission(['dashboard:view']) },
      { path: '/operations', show: hasPermission(['operation:log']) },
      { path: '/vehicles', show: hasPermission(['vehicle:read']) },
      { path: '/repairs', show: hasPermission(['repair:write']) },
      { path: '/reports', show: hasPermission(['reports:view']) },
      { path: '/admin', show: isAdmin },
    ].filter(item => item.show);

    const currentPath = location.pathname;
    const isAllowed = allowedItems.some(item => item.path === currentPath);
    const mainTabs = ['/dashboard', '/operations', '/vehicles', '/repairs', '/reports', '/admin'];

    if (mainTabs.includes(currentPath) && !isAllowed) {
      if (allowedItems.length > 0) {
        navigate(allowedItems[0].path, { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [loading, user, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
          <p className="text-gray-500 font-medium text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Extract keys to check authorization
  const permissionKeys = new Set(user.role_rel?.permissions?.map((p: any) => p.permission_key) || []);
  const isAdmin = permissionKeys.has('admin:all') || user.role_rel?.role_name === 'ADMIN';
  const hasPermission = (keys: string[]) => {
    if (isAdmin) return true;
    return keys.some(k => permissionKeys.has(k));
  };

  const navItems = [
    { 
      label: 'Tổng quan', 
      path: '/dashboard', 
      icon: LayoutDashboard,
      show: hasPermission(['dashboard:view']) 
    },
    { 
      label: 'Nhật ký ca', 
      path: '/operations', 
      icon: ClipboardList,
      show: hasPermission(['operation:log']) 
    },
    { 
      label: 'Đội xe', 
      path: '/vehicles', 
      icon: Truck,
      show: hasPermission(['vehicle:read']) 
    },
    { 
      label: 'Sửa chữa', 
      path: '/repairs', 
      icon: Wrench,
      show: hasPermission(['repair:write']) 
    },
    { 
      label: 'Báo cáo', 
      path: '/reports', 
      icon: BarChart3,
      show: hasPermission(['reports:view']) 
    },
    { 
      label: 'Quản trị', 
      path: '/admin', 
      icon: Settings,
      show: isAdmin 
    },
  ].filter(item => item.show);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* DESKTOP SIDEBAR (hidden on mobile layout <= 480px, responsive md) */}
      <aside className="hidden sm:flex flex-col w-64 bg-white border-r border-gray-200 shrink-0">
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
          <Truck className="h-6 w-6 mr-3 text-white" />
          <span className="font-bold text-lg tracking-wide uppercase">FLEET MANAGER</span>
        </div>
        
        {/* User Info Card */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
              {user.full_name?.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-semibold text-sm text-gray-800 truncate">{user.full_name}</h4>
              <p className="text-xs text-gray-500 truncate">{user.role_rel?.role_name} • {user.department || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary-50 text-primary-700 font-semibold' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary-700' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3 text-gray-400 hover:text-red-700" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER DIALOG */}
      {isMobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white pt-5 pb-4 shadow-xl animate-in slide-in-from-left duration-200">
            <div className="absolute top-2 right-2">
              <button
                type="button"
                className="flex items-center justify-center h-10 w-10 rounded-full focus:outline-none bg-gray-100 text-gray-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* User Info Card inside drawer */}
            <div className="px-4 border-b border-gray-150 pb-4 mb-4 mt-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {user.full_name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{user.full_name}</h4>
                  <p className="text-xs text-gray-500 truncate">{user.role_rel?.role_name} • {user.department || 'N/A'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Mã NV: {user.operator_id}</p>
                </div>
              </div>
            </div>
            
            {/* Links */}
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary-50 text-primary-700 font-bold' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary-700' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            
            {/* Drawer footer logout */}
            <div className="p-4 border-t border-gray-150">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3 text-red-600" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-20">
        {/* GLOBAL HEADER */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-10 shadow-sm shrink-0">
          <div className="flex items-center sm:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1 text-gray-500 hover:text-gray-700 mr-2 focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-bold text-sm tracking-wide text-primary-700 uppercase">FLEET LOGS</span>
          </div>
          <div className="hidden sm:flex items-center text-sm text-gray-500 font-medium">
            Mã nhân viên: <span className="text-gray-800 font-semibold ml-1">{user.operator_id}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden xs:block text-right text-xs">
              <p className="font-semibold text-gray-800">{user.full_name}</p>
              <p className="text-gray-400">{user.department}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {user.full_name?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* WORK AREA */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 pb-6">
          {children}
        </main>
      </div>

      {/* Real-time personal notification toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[9999] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 max-w-sm flex items-start space-x-3 animate-in slide-in-from-right duration-300">
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
            notification.type === 'success' ? 'bg-green-50 text-green-600' :
            notification.type === 'warning' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : notification.type === 'warning' ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <Bell className="h-5 w-5 animate-bounce" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-xs text-gray-900">{notification.title}</h4>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{notification.message}</p>
          </div>
          <button 
            onClick={() => setNotification({ ...notification, show: false })}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm shrink-0"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
export default Layout;
