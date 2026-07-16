import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ShieldAlert } from 'lucide-react';
import { authService } from '../utils/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [operatorId, setOperatorId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Operator verification state
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [isLookupError, setIsLookupError] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const performLookup = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setFullName('');
      setDepartment('');
      setIsLookupError(false);
      return;
    }

    setLookupLoading(true);
    setIsLookupError(false);
    setError(null);
    try {
      const info = await authService.getOperatorInfo(cleanCode);
      setFullName(info.full_name);
      setDepartment(info.department || 'Tổ Vận Hành');
    } catch (err: any) {
      setFullName('');
      setDepartment('');
      setIsLookupError(true);
      setError(err.message || 'Mã nhân viên không tồn tại hoặc đã bị khóa.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleOperatorIdChange = (val: string) => {
    setOperatorId(val);
    setFullName('');
    setDepartment('');
    setIsLookupError(false);
    setError(null);
  };

  const handleOperatorIdBlur = () => {
    performLookup(operatorId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim() || !password) {
      setError('Vui lòng điền đầy đủ Mã nhân viên và Mật khẩu.');
      return;
    }

    if (isLookupError || !fullName) {
      setError('Mã nhân viên không hợp lệ. Không thể đăng nhập.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.login({
        operator_id: operatorId.trim().toUpperCase(),
        password: password
      });
      
      // Load user profile to check role permissions for redirection
      const user = await authService.me();
      const perms = new Set(user.role_rel?.permissions?.map((p: any) => p.permission_key) || []);
      const isAdmin = perms.has('admin:all') || user.role_rel?.role_name === 'ADMIN';

      if (isAdmin || perms.has('dashboard:view')) {
        navigate('/dashboard');
      } else if (perms.has('operation:log')) {
        navigate('/operations');
      } else if (perms.has('repair:write')) {
        navigate('/repairs');
      } else {
        navigate('/vehicles');
      }
    } catch (err: any) {
      setError(err.message || 'Mã nhân viên hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100/10 glow-blue">
        {/* Card Header Banner */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-8 text-center text-white relative">
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent)]" />
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-xl mb-3 backdrop-blur-md">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold uppercase tracking-wider">Hệ thống Quản lý Đội xe</h2>
          <p className="text-xs text-primary-100 mt-1">Ghi nhận hoạt động, sự cố & bảo trì phương tiện</p>
        </div>

        {/* Card Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start space-x-3 text-red-700 text-sm">
              <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Đăng nhập thất bại</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Mã nhân viên
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="VD: OP01, ADMIN..."
                  value={operatorId}
                  onChange={(e) => handleOperatorIdChange(e.target.value)}
                  onBlur={handleOperatorIdBlur}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder:text-gray-400 text-sm font-semibold uppercase ${
                    isLookupError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {lookupLoading && (
                  <div className="absolute right-3 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                )}
              </div>
            </div>

            {fullName && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200/60 rounded-xl animate-in fade-in duration-200">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Họ tên nhân viên</label>
                  <input
                    type="text"
                    value={fullName}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Đội / Tổ công tác</label>
                  <input
                    type="text"
                    value={department}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder:text-gray-400 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                disabled={loading || lookupLoading || isLookupError || !fullName}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || lookupLoading || isLookupError || !fullName}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>ĐĂNG NHẬP</span>
              )}
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-400">
          Phòng Thiết Bị Kỹ Thuật & Vận Hành © 2026
        </div>
      </div>
    </div>
  );
};
export default Login;
