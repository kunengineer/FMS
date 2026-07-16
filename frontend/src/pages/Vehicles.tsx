import React, { useEffect, useState } from 'react';
import { 
  Truck, Plus, Edit, Trash2, ShieldAlert, CheckCircle, 
  HelpCircle, Settings, Eye, Clock, AlertTriangle, Info, Calendar, X, Wrench
} from 'lucide-react';
import { vehicleService, authService, failureService } from '../utils/api';

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

export const Vehicles: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  
  // Lists
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'types'>('vehicles');

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);

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

  // Form: Vehicle
  const [vehicleCode, setVehicleCode] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [manufactureYear, setManufactureYear] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('active');
  const [currentHourmeter, setCurrentHourmeter] = useState('');
  const [lastMaintenanceHourmeter, setLastMaintenanceHourmeter] = useState('');

  // Form: Vehicle Type
  const [typeName, setTypeName] = useState('');

  useEffect(() => {
    const initData = async () => {
      try {
        const [me, types] = await Promise.all([
          authService.me(),
          vehicleService.listTypes()
        ]);
        setUser(me);
        setVehicleTypes(types);
        await reloadVehicles();
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải thông tin khởi tạo');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const reloadVehicles = async () => {
    try {
      const list = await vehicleService.list();
      setVehicles(list);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách phương tiện');
    }
  };

  const handleOpenVehicleModal = (veh: any = null) => {
    setSelectedVehicle(veh);
    if (veh) {
      setVehicleCode(veh.vehicle_code);
      setVehicleName(veh.vehicle_name);
      setSelectedTypeId(veh.vehicle_type_id.toString());
      setVehicleModel(veh.model || '');
      setManufactureYear(veh.manufacture_year?.toString() || '');
      setVehicleStatus(veh.status);
      setCurrentHourmeter(veh.current_hourmeter.toString());
      setLastMaintenanceHourmeter(veh.last_maintenance_hourmeter.toString());
    } else {
      setVehicleCode('');
      setVehicleName('');
      setSelectedTypeId('');
      setVehicleModel('');
      setManufactureYear('');
      setVehicleStatus('active');
      setCurrentHourmeter('0');
      setLastMaintenanceHourmeter('0');
    }
    setShowVehicleModal(true);
  };

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleCode.trim() || !vehicleName.trim() || !selectedTypeId) {
      alert('Vui lòng nhập đầy đủ các trường bắt buộc.');
      return;
    }

    const payload = {
      vehicle_code: vehicleCode.trim().toUpperCase(),
      vehicle_name: vehicleName.trim(),
      vehicle_type_id: parseInt(selectedTypeId),
      model: vehicleModel.trim() || null,
      manufacture_year: manufactureYear ? parseInt(manufactureYear) : null,
      status: vehicleStatus,
      current_hourmeter: parseFloat(currentHourmeter || '0'),
      last_maintenance_hourmeter: parseFloat(lastMaintenanceHourmeter || '0'),
      active: true
    };

    try {
      if (selectedVehicle) {
        await vehicleService.update(selectedVehicle.vehicle_id, payload);
      } else {
        await vehicleService.create(payload);
      }
      setShowVehicleModal(false);
      await reloadVehicles();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phương tiện này?')) return;
    try {
      await vehicleService.delete(id);
      await reloadVehicles();
    } catch (err: any) {
      alert('Không thể xóa: ' + err.message);
    }
  };

  const handleOpenTypeModal = () => {
    setTypeName('');
    setShowTypeModal(true);
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;
    try {
      await vehicleService.createType({ type_name: typeName.trim() });
      const types = await vehicleService.listTypes();
      setVehicleTypes(types);
      setShowTypeModal(false);
    } catch (err: any) {
      alert('Lỗi khi thêm loại xe: ' + err.message);
    }
  };

  const handleDeleteType = async (id: number) => {
    if (!window.confirm('Xóa loại xe này? Hàng loạt xe thuộc loại này sẽ bị ảnh hưởng.')) return;
    try {
      await vehicleService.deleteType(id);
      const types = await vehicleService.listTypes();
      setVehicleTypes(types);
    } catch (err: any) {
      alert('Không thể xóa loại xe: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const permissionKeys = new Set(user?.role_rel?.permissions?.map((p: any) => p.permission_key) || []);
  const isAdmin = permissionKeys.has('admin:all') || user?.role_rel?.role_name === 'ADMIN';
  const canEdit = isAdmin || permissionKeys.has('vehicle:write');

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[10px] font-bold rounded-lg border border-green-200">Hoạt động</span>;
    }
    if (status === 'repairing') {
      return <span className="px-2.5 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded-lg border border-red-200">Có sự cố (Đang sửa)</span>;
    }
    if (status === 'stopped_repair') {
      return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200">Có sự cố (Ngưng sửa chữa)</span>;
    }
    return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold rounded-lg border border-gray-200">Ngưng chạy</span>;
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between space-y-3 xs:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh mục Phương tiện</h1>
          <p className="text-sm text-gray-500 mt-1">Danh sách đội phương tiện cần cẩu, xe nâng, xe cuốc, xe đào</p>
        </div>
        {canEdit && (
          <div className="flex space-x-2 shrink-0">
            {isAdmin && (
              <button
                onClick={handleOpenTypeModal}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs border border-gray-200 transition"
              >
                + Thêm Loại Xe
              </button>
            )}
            <button
              onClick={() => handleOpenVehicleModal()}
              className="px-5 py-2.5 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white rounded-xl font-bold shadow-md text-xs transition"
            >
              + Đăng Ký Phương Tiện
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'vehicles' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Đội xe ({vehicles.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('types')}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === 'types' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
              }`}
            >
              Phân loại xe ({vehicleTypes.length})
            </button>
          )}
        </nav>
      </div>

      {/* TABS CONTAINER */}
      {activeTab === 'vehicles' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Mã phương tiện</th>
                  <th className="px-6 py-4">Tên phương tiện</th>
                  <th className="px-6 py-4">Phân loại</th>
                  <th className="px-6 py-4">Giờ máy hiện tại</th>
                  <th className="px-6 py-4">Lần bảo trì cuối</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  {canEdit && <th className="px-6 py-4 text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      Chưa đăng ký phương tiện nào.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr 
                      key={v.vehicle_id} 
                      className="hover:bg-gray-50/70 transition cursor-pointer"
                      onClick={() => handleOpenDetail(v)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 uppercase">
                        {v.vehicle_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{v.vehicle_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{v.vehicle_type?.type_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">{v.current_hourmeter}h</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{v.last_maintenance_hourmeter}h</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(v.status)}</td>
                      {canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenVehicleModal(v)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                            title="Sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteVehicle(v.vehicle_id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // TYPES TABS
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Tên loại xe</th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                {vehicleTypes.map((vt) => (
                  <tr key={vt.vehicle_type_id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">{vt.vehicle_type_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold">{vt.type_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleDeleteType(vt.vehicle_type_id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      {/* ================================================================= */}
      {/* 1. MODAL: ĐĂNG KÝ / SỬA PHƯƠNG TIỆN */}
      {/* ================================================================= */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase">
                {selectedVehicle ? 'Cập nhật Phương tiện' : 'Đăng ký Phương tiện mới'}
              </h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-white/80 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleVehicleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mã phương tiện *</label>
                  <input
                    type="text"
                    placeholder="CNC-01, XN-02..."
                    value={vehicleCode}
                    onChange={(e) => setVehicleCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold uppercase"
                    required
                    disabled={!!selectedVehicle} // code is unique and immutable
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tên phương tiện *</label>
                  <input
                    type="text"
                    placeholder="Liebherr 50T..."
                    value={vehicleName}
                    onChange={(e) => setVehicleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Phân loại thiết bị *</label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                  required
                >
                  <option value="">-- Chọn loại --</option>
                  {vehicleTypes.map(t => (
                    <option key={t.vehicle_type_id} value={t.vehicle_type_id}>{t.type_name}</option>
                  ))}
                </select>
              </div>



              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giờ máy hiện tại *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentHourmeter}
                    onChange={(e) => setCurrentHourmeter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giờ bảo trì cuối cùng *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lastMaintenanceHourmeter}
                    onChange={(e) => setLastMaintenanceHourmeter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              {selectedVehicle && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Trạng thái vận hành *</label>
                  <select
                    value={vehicleStatus}
                    onChange={(e) => setVehicleStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                    required
                  >
                    <option value="active">Hoạt động</option>
                    <option value="repairing">Có sự cố (Đang sửa) (Lock không cho mở ca)</option>
                    <option value="stopped_repair">Có sự cố (Ngưng sửa chữa) (Lock không cho mở ca)</option>
                    <option value="inactive">Ngưng hoạt động (Bảo dưỡng bảo quản)</option>
                  </select>
                </div>
              )}

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl transition"
                >
                  XÁC NHẬN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. MODAL: THÊM LOẠI XE */}
      {/* ================================================================= */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm uppercase">Thêm phân loại xe mới</h3>
              <button onClick={() => setShowTypeModal(false)} className="text-white/80 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleTypeSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tên phân loại xe *</label>
                <input
                  type="text"
                  placeholder="VD: Cần cẩu nổi, Xe tải gắn cẩu..."
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl transition"
                >
                  LƯU LẠI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. MODAL: CHI TIẾT PHƯƠNG TIỆN */}
      {/* ================================================================= */}
      {showDetailModal && activeVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <h3 className="font-bold text-sm uppercase">Chi tiết phương tiện: {activeVehicle.vehicle_code}</h3>
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
                    <span className="block mt-1">{getStatusBadge(activeVehicle.status)}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Giờ chạy máy hiện tại</span>
                    <span className="font-bold text-primary-700 text-[11px] block mt-0.5">{activeVehicle.current_hourmeter} giờ</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-150/50 col-span-2 sm:col-span-1">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase">Lần bảo trì cuối</span>
                    <span className="font-bold text-gray-600 text-[11px] block mt-0.5">{activeVehicle.last_maintenance_hourmeter} giờ</span>
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
                                         <div className="grid grid-cols-2 gap-2 bg-white/55 p-2 rounded-lg border border-red-100/35 text-[10px]">
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
                        <div className="divide-y divide-gray-150 border border-gray-150 rounded-xl overflow-hidden bg-white text-[10.5px]">
                          {vehicleFailures.filter(f => f.is_repaired).slice(0, 5).map((fail: any) => {
                            const doneRep = fail.repairs?.find((r: any) => r.repair_status === 'done');
                            return (
                              <div key={fail.failure_id} className="p-3.5 hover:bg-gray-50/30 transition space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-gray-800">Sự cố: {fail.category?.category_name || "Chưa phân loại"}</span>
                                  <span className="text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded border border-green-200/50">✓ Đã khắc phục</span>
                                </div>
                                 {(() => {
                                   const parsed = parseDescription(fail.description);
                                   return (
                                     <div className="space-y-1.5 font-semibold text-xs text-gray-750">
                                       <p className="text-gray-700 italic">Mô tả: "{parsed.mainDesc}"</p>
                                       {Object.keys(parsed.details).length > 0 && (
                                         <div className="grid grid-cols-2 gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-150 text-[10px]">
                                           {parsed.details['TG dừng'] && (
                                             <div>
                                               <span className="font-bold block text-gray-400 uppercase text-[8px]">Thời gian dừng / sửa chữa</span>
                                               <span className="text-red-650 font-bold">{parsed.details['TG dừng']}</span>
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
                                               <span className="text-gray-750 font-bold">{parsed.details['Chi tiết']}</span>
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
                                {doneRep && (
                                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-gray-50/55 p-2 rounded-lg border border-gray-100">
                                    <div>Người sửa: <span className="font-bold text-gray-700">{doneRep.mechanic?.full_name || doneRep.mechanic_id}</span></div>
                                    <div>Ngày sửa xong: <span className="font-semibold text-gray-700">{doneRep.repair_end ? new Date(doneRep.repair_end).toLocaleDateString('vi-VN') : '---'}</span></div>
                                    {doneRep.parts_used && <div className="col-span-2">Vật tư: <span className="font-semibold text-gray-750">{doneRep.parts_used}</span></div>}
                                    {doneRep.note && <div className="col-span-2 text-gray-600">Ghi chú sửa: <span className="font-semibold">{doneRep.note}</span></div>}
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
    </>
  );
};
export default Vehicles;
