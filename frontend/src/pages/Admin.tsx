import React, { useEffect, useState } from 'react';
import { 
  Settings, UserPlus, ClipboardList, AlertOctagon, 
  History, Sliders, Edit, Trash2, CheckCircle2, ShieldCheck, X,
  UploadCloud, FileSpreadsheet, AlertTriangle, Wrench, Clock
} from 'lucide-react';
import { adminService, settingsService, authService, vehicleService, operationService, importService } from '../utils/api';

const mapTableName = (tableName: string) => {
  const map: Record<string, string> = {
    'failure_logs': 'Nhật ký sự cố (Báo hỏng)',
    'repair_logs': 'Nhật ký sửa chữa',
    'operation_logs': 'Nhật ký ca chạy (Vận hành)',
    'operators': 'Thông tin nhân sự / Tài khoản',
    'vehicles': 'Danh mục thiết bị / Phương tiện',
    'shifts': 'Ca làm việc',
    'checklist_results': 'Kết quả checklist an toàn',
    'system_settings': 'Cấu hình tham số hệ thống',
  };
  return map[tableName] || tableName;
};

const mapFieldKey = (key: string) => {
  const map: Record<string, string> = {
    // Failure fields
    'failure_id': 'Mã sự cố',
    'operation_id': 'Mã ca chạy',
    'vehicle_id': 'Mã phương tiện',
    'category_id': 'Hạng mục sự cố',
    'description': 'Mô tả hư hỏng',
    'failure_time': 'Thời gian xảy ra',
    'severity': 'Mức độ nghiêm trọng',
    'phase': 'Giai đoạn phát hiện',
    'is_repaired': 'Đã khắc phục?',
    'transferred_to_next_shift': 'Chuyển ca sau?',
    'created_by': 'Người tạo',
    
    // Repair fields
    'repair_id': 'Mã sửa chữa',
    'mechanic_id': 'Thợ sửa chữa',
    'repair_start': 'Thời gian bắt đầu sửa',
    'repair_end': 'Thời gian kết thúc sửa',
    'repaired_in_shift': 'Sửa xong trong ca?',
    'parts_used': 'Vật tư sử dụng',
    'note': 'Ghi chú sửa chữa',
    'repair_status': 'Trạng thái sửa chữa',
    
    // Operation fields
    'work_date': 'Ngày làm việc',
    'shift_id': 'Ca làm việc',
    'operator_id': 'Người vận hành',
    'start_hour': 'Giờ mở ca',
    'end_hour': 'Giờ đóng ca',
    'hourmeter_start': 'Số giờ máy đầu',
    'hourmeter_end': 'Số giờ máy cuối',
    'condition_before_shift': 'Tình trạng đầu ca',
    'condition_after_shift': 'Tình trạng cuối ca',
    'is_safety_confirmed': 'Xác nhận an toàn?',
    'safety_reason': 'Lý do đảm bảo an toàn',
    'notes': 'Ghi chú ca chạy',
    'signature_data': 'Dữ liệu chữ ký',
    'signature_time': 'Thời gian ký xác nhận',
    'status': 'Trạng thái ca',

    // Operator fields
    'full_name': 'Họ và tên',
    'department': 'Phòng ban',
    'role_id': 'Vai trò',
    'phone': 'Số điện thoại',
    'active': 'Tài khoản hoạt động',
    'password': 'Mật khẩu',
    
    // Vehicle fields
    'vehicle_name': 'Tên phương tiện',
    'vehicle_code': 'Mã phương tiện',
    'vehicle_type_id': 'Loại phương tiện',
    'status_code': 'Mã trạng thái',
    
    // General
    'created_at': 'Thời gian tạo',
    'uploaded_at': 'Thời gian tải lên',
    'uploaded_by': 'Người tải lên',
    'file_path': 'Đường dẫn tệp',
  };
  return map[key] || key;
};



export const Admin: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'checklists' | 'failures' | 'settings' | 'audit' | 'imports'>('users');
  
  // Lists
  const [operators, setOperators] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [failureCats, setFailureCats] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  
  // Audit Trail filter and detail states
  const [auditOperatorFilter, setAuditOperatorFilter] = useState('');
  const [auditTableFilter, setAuditTableFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any>(null);
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  
  // States
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [selectedFailureCat, setSelectedFailureCat] = useState<any>(null);
  const [selectedSetting, setSelectedSetting] = useState<any>(null);

  // Form Users
  const [userId, setUserId] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState('');
  const [userActive, setUserActive] = useState(true);

  // Form Checklist
  const [checkName, setCheckName] = useState('');
  const [appliesTypes, setAppliesTypes] = useState<number[]>([]);
  const [checkSeverity, setCheckSeverity] = useState('light');
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);

  // Form Failure Category
  const [failCatName, setFailCatName] = useState('');
  const [failDefaultSeverity, setFailDefaultSeverity] = useState('light');

  // Form Settings
  const [settingVal, setSettingVal] = useState('');

  // Imports state
  const [activityFile, setActivityFile] = useState<File | null>(null);
  const [checklistFile, setChecklistFile] = useState<File | null>(null);
  const [weeklyFile, setWeeklyFile] = useState<File | null>(null);
  const [importingActivity, setImportingActivity] = useState(false);
  const [importingChecklist, setImportingChecklist] = useState(false);
  const [importingWeekly, setImportingWeekly] = useState(false);
  const [activityImportResult, setActivityImportResult] = useState<any>(null);
  const [checklistImportResult, setChecklistImportResult] = useState<any>(null);
  const [weeklyImportResult, setWeeklyImportResult] = useState<any>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Confirm Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger = true,
    confirmText = 'Xác nhận xóa',
    cancelText = 'Hủy'
  ) => {
    setConfirmConfig({ title, message, onConfirm, isDanger, confirmText, cancelText });
    setShowConfirmModal(true);
  };

  const mapFieldValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    if (value === true || value === 'true') return 'Có / Đã hoàn thành';
    if (value === false || value === 'false') return 'Không / Chưa';
    
    switch (key) {
      case 'phase':
        if (value === 'during_shift') return 'Trong ca chạy';
        if (value === 'before_shift') return 'Trước ca chạy';
        if (value === 'out_of_shift') return 'Ngoài ca chạy';
        break;
      case 'severity':
        if (value === 'light') return 'Nhẹ';
        if (value === 'heavy') return 'Nặng';
        if (value === 'dangerous') return 'Nguy hiểm';
        break;
      case 'repair_status':
        if (value === 'done') return 'Đã sửa xong';
        if (value === 'pending') return 'Chờ sửa chữa';
        if (value === 'in_progress') return 'Đang sửa chữa';
        if (value === 'cancelled') return 'Báo nhầm / Hủy bỏ';
        break;
      case 'condition_before_shift':
      case 'condition_after_shift':
        if (value === 'ok') return 'Đạt an toàn';
        if (value === 'broken') return 'Có lỗi / hư hỏng';
        break;
      case 'role_id':
        const role = roles.find((r: any) => String(r.role_id) === String(value));
        return role ? `${role.role_name} (${role.description || ''})` : String(value);
      case 'password':
        return '********';
      case 'created_by':
      case 'operator_id':
      case 'mechanic_id':
      case 'uploaded_by':
        const op = operators.find((o: any) => o.operator_id === String(value));
        return op ? `${op.full_name} (${value})` : String(value);
      case 'vehicle_id':
        const v = vehicles.find((x: any) => x.vehicle_id === String(value));
        return v ? `${v.vehicle_code} - ${v.vehicle_name}` : String(value);
      case 'category_id':
        const cat = failureCats.find((c: any) => String(c.category_id) === String(value));
        return cat ? cat.category_name : String(value);
      case 'failure_time':
      case 'repair_start':
      case 'repair_end':
      case 'signature_time':
      case 'created_at':
      case 'uploaded_at':
        try {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            return d.toLocaleString('vi-VN');
          }
        } catch (e) {}
        break;
      case 'signature_data':
        if (typeof value === 'string' && value.startsWith('data:image')) {
          return '[Hình ảnh chữ ký số]';
        }
        break;
    }
    
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    if (activeSubTab === 'imports') {
      setLoading(false);
      fetchWeeklyHistory();
      return;
    }
    setLoading(true);
    try {
      if (activeSubTab === 'users') {
        const [ops, rls] = await Promise.all([
          adminService.listOperators(),
          adminService.listRoles()
        ]);
        setOperators(ops);
        setRoles(rls);
      } else if (activeSubTab === 'checklists') {
        const [items, vts] = await Promise.all([
          operationService.listChecklists(),
          vehicleService.listTypes()
        ]);
        setChecklists(items);
        setVehicleTypes(vts);
      } else if (activeSubTab === 'failures') {
        const cats = await adminService.listFailureCategories();
        setFailureCats(cats);
      } else if (activeSubTab === 'settings') {
        const st = await settingsService.list();
        setSystemSettings(st);
      } else if (activeSubTab === 'audit') {
        const [logs, ops, cats, vehs, rls] = await Promise.all([
          adminService.listAuditLogs(),
          adminService.listOperators(),
          adminService.listFailureCategories(),
          vehicleService.list(),
          adminService.listRoles()
        ]);
        setAuditLogs(logs);
        setOperators(ops);
        setFailureCats(cats);
        setVehicles(vehs);
        setRoles(rls);
      }
    } catch (err: any) {
      alert('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityFile) return;
    setImportingActivity(true);
    setActivityImportResult(null);
    try {
      const res = await importService.importActivity(activityFile);
      setActivityImportResult(res);
      setActivityFile(null);
    } catch (err: any) {
      alert('Lỗi nhập dữ liệu hoạt động: ' + err.message);
    } finally {
      setImportingActivity(false);
    }
  };

  const handleImportChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistFile) return;
    setImportingChecklist(true);
    setChecklistImportResult(null);
    try {
      const res = await importService.importChecklist(checklistFile);
      setChecklistImportResult(res);
      setChecklistFile(null);
    } catch (err: any) {
      alert('Lỗi nhập dữ liệu checklist: ' + err.message);
    } finally {
      setImportingChecklist(false);
    }
  };

  const fetchWeeklyHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await importService.getWeeklyReportHistory();
      setWeeklyHistory(data);
    } catch (err: any) {
      alert('Không thể tải lịch sử import tuần: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleImportWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyFile) return;
    setImportingWeekly(true);
    setWeeklyImportResult(null);
    try {
      const res = await importService.importWeeklyReport(weeklyFile);
      setWeeklyImportResult(res);
      setWeeklyFile(null);
      // Suppressed alert() popup as success state is shown inline in the results card
      fetchWeeklyHistory();
    } catch (err: any) {
      alert('Lỗi nhập báo cáo tuần: ' + err.message);
    } finally {
      setImportingWeekly(false);
    }
  };

  const handleDeleteWeekly = (workDate: string) => {
    requestConfirm(
      'Xóa dữ liệu tuần',
      `Bạn có chắc chắn muốn xóa dữ liệu đã import cho tuần có ngày báo cáo ${workDate}? Hành động này cũng sẽ hoàn trả số giờ hoạt động tương ứng của các thiết bị.`,
      async () => {
        try {
          await importService.deleteWeeklyReport(workDate);
          fetchWeeklyHistory();
        } catch (err: any) {
          alert('Lỗi khi xóa dữ liệu tuần: ' + err.message);
        }
      },
      true,
      'XÁC NHẬN XÓA',
      'HỦY BỎ'
    );
  };

  // --- USER HANDLERS ---
  const handleOpenUserModal = (user: any = null) => {
    setSelectedUser(user);
    if (user) {
      setUserId(user.operator_id);
      setUserFullName(user.full_name);
      setUserDept(user.department || '');
      setUserPhone(user.phone || '');
      setUserPassword(''); // blank for no password change
      setUserRoleId(user.role_id.toString());
      setUserActive(user.active);
    } else {
      setUserId('');
      setUserFullName('');
      setUserDept('');
      setUserPhone('');
      setUserPassword('');
      setUserRoleId('');
      setUserActive(true);
    }
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !userFullName.trim() || !userRoleId) return;

    const payload: any = {
      operator_id: userId.trim().toUpperCase(),
      full_name: userFullName.trim(),
      department: userDept.trim() || null,
      role_id: parseInt(userRoleId),
      phone: userPhone.trim() || null,
      active: userActive
    };
    if (userPassword) {
      payload.password = userPassword;
    } else if (!selectedUser) {
      // create requires password
      payload.password = '123456'; // default
    }

    try {
      if (selectedUser) {
        await adminService.updateOperator(selectedUser.operator_id, payload);
      } else {
        await adminService.createOperator(payload);
      }
      setShowUserModal(false);
      await loadData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDeleteUser = async (operatorId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tài khoản này không?')) {
      try {
        await adminService.deleteOperator(operatorId);
        await loadData();
      } catch (err: any) {
        alert('Lỗi khi xóa tài khoản: ' + err.message);
      }
    }
  };

  // --- CHECKLIST HANDLERS ---
  const handleOpenChecklistModal = (check: any = null) => {
    setSelectedChecklist(check);
    if (check) {
      setCheckName(check.item_name);
      setAppliesTypes(check.applies_to_vehicle_types || []);
      setCheckSeverity(check.severity || 'light');
    } else {
      setCheckName('');
      setAppliesTypes([]);
      setCheckSeverity('light');
    }
    setShowChecklistModal(true);
  };

  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName.trim()) return;

    const payload = {
      item_name: checkName.trim(),
      applies_to_vehicle_types: appliesTypes.length > 0 ? appliesTypes : null,
      active: true,
      severity: checkSeverity
    };

    try {
      if (selectedChecklist) {
        await adminService.updateChecklistItem(selectedChecklist.checklist_id, payload);
      } else {
        await adminService.createChecklistItem(payload);
      }
      setShowChecklistModal(false);
      await loadData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDeleteChecklist = (id: number) => {
    requestConfirm(
      'Xóa câu hỏi checklist',
      'Bạn có chắc chắn muốn xóa câu hỏi checklist này? Hành động này sẽ loại bỏ câu hỏi kiểm tra an toàn này khỏi hệ thống.',
      async () => {
        try {
          await adminService.deleteChecklistItem(id);
          await loadData();
        } catch (err: any) {
          alert('Lỗi: ' + err.message);
        }
      }
    );
  };

  // --- FAILURE CAT HANDLERS ---
  const handleOpenFailureModal = (cat: any = null) => {
    setSelectedFailureCat(cat);
    if (cat) {
      setFailCatName(cat.category_name);
      setFailDefaultSeverity(cat.severity_default);
    } else {
      setFailCatName('');
      setFailDefaultSeverity('light');
    }
    setShowFailureModal(true);
  };

  const handleFailureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failCatName.trim()) return;

    const payload = {
      category_name: failCatName.trim(),
      severity_default: failDefaultSeverity
    };

    try {
      if (selectedFailureCat) {
        await adminService.updateFailureCategory(selectedFailureCat.category_id, payload);
      } else {
        await adminService.createFailureCategory(payload);
      }
      setShowFailureModal(false);
      await loadData();
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDeleteFailure = (id: number) => {
    requestConfirm(
      'Xóa danh mục sự cố',
      'Bạn có chắc chắn muốn xóa danh mục sự cố này? Các bản ghi liên quan có thể bị ảnh hưởng.',
      async () => {
        try {
          await adminService.deleteFailureCategory(id);
          await loadData();
        } catch (err: any) {
          alert('Lỗi: ' + err.message);
        }
      }
    );
  };

  // --- SETTINGS HANDLERS ---
  const handleOpenSettingsModal = (set: any) => {
    setSelectedSetting(set);
    setSettingVal(set.value);
    setShowSettingsModal(true);
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSetting) return;

    try {
      await settingsService.update(selectedSetting.setting_id, settingVal.trim());
      setShowSettingsModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản trị Hệ thống</h1>
        <p className="text-sm text-gray-500 mt-1">Cấu hình danh mục nghiệp vụ, phân quyền nhân sự, thông số kỹ thuật & Audit Logs</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'users' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Nhân sự / Vai trò
          </button>
          <button
            onClick={() => setActiveSubTab('checklists')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'checklists' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Mẫu Checklist an toàn
          </button>
          <button
            onClick={() => setActiveSubTab('failures')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'failures' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Danh mục sự cố hư hỏng
          </button>
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'settings' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Cấu hình tham số
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'audit' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Nhật ký Audit Logs
          </button>
          <button
            onClick={() => setActiveSubTab('imports')}
            className={`pb-3 border-b-2 transition-all ${
              activeSubTab === 'imports' ? 'border-primary-700 text-primary-700 font-bold' : 'border-transparent hover:text-gray-700'
            }`}
          >
            Nhập Dữ Liệu Excel
          </button>
        </nav>
      </div>

      {/* WORK CONTENT CONTAINER */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* TAB 1: USERS */}
          {activeSubTab === 'users' && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-800 uppercase">Danh sách Nhân sự vận hành</h3>
                <button
                  onClick={() => handleOpenUserModal()}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition"
                >
                  + Thêm Tài Khoản
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Mã nhân viên</th>
                      <th className="px-6 py-4">Họ và tên</th>
                      <th className="px-6 py-4">Tổ / Phòng ban</th>
                      <th className="px-6 py-4">Vai trò (Role)</th>
                      <th className="px-6 py-4">Điện thoại</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                    {operators.map((op) => (
                      <tr key={op.operator_id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 uppercase">{op.operator_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{op.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{op.department || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[9px] uppercase">
                            {op.role_rel?.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{op.phone || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${op.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {op.active ? 'Đang chạy' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                          <button
                            onClick={() => handleOpenUserModal(op)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                            title="Sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(op.operator_id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Xóa tài khoản"
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

          {/* TAB 2: CHECKLISTS */}
          {activeSubTab === 'checklists' && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-800 uppercase">Danh sách Câu hỏi Checklist trước ca</h3>
                <button
                  onClick={() => handleOpenChecklistModal()}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition"
                >
                  + Tạo Câu Hỏi
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Câu hỏi / Hạng mục kiểm tra</th>
                      <th className="px-6 py-4">Mức độ nghiêm trọng</th>
                      <th className="px-6 py-4">Áp dụng cho ID loại xe</th>
                      <th className="px-6 py-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                    {checklists.map((c) => (
                      <tr key={c.checklist_id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">{c.checklist_id}</td>
                        <td className="px-6 py-4 font-semibold text-gray-800">{c.item_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {c.severity === 'dangerous' ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded">
                              Nguy hiểm
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-800 rounded">
                              Nhẹ
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-semibold">
                          {c.applies_to_vehicle_types?.length > 0 ? c.applies_to_vehicle_types.join(', ') : 'Tất cả loại xe'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                          <button
                            onClick={() => handleOpenChecklistModal(c)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteChecklist(c.checklist_id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
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

          {/* TAB 3: FAILURES */}
          {activeSubTab === 'failures' && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 ">
                <h3 className="font-bold text-sm text-gray-800 uppercase">Mẫu danh mục hư hỏng hệ thống</h3>
                <button
                  onClick={() => handleOpenFailureModal()}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition"
                >
                  + Thêm Loại Sự Cố
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Tên sự cố hư hỏng</th>
                      <th className="px-6 py-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                    {failureCats.map((fc) => (
                      <tr key={fc.category_id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">{fc.category_id}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{fc.category_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                          <button
                            onClick={() => handleOpenFailureModal(fc)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFailure(fc.category_id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
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

          {/* TAB 4: SETTINGS */}
          {activeSubTab === 'settings' && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-800 uppercase">Cấu hình Tham số vận hành & Cảnh báo</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-4">Khóa cấu hình (Key)</th>
                      <th className="px-6 py-4">Mô tả chi tiết</th>
                      <th className="px-6 py-4">Giá trị cấu hình</th>
                      <th className="px-6 py-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                    {systemSettings.map((s) => (
                      <tr key={s.setting_id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 uppercase">{s.key}</td>
                        <td className="px-6 py-4 text-gray-500 font-semibold">{s.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-primary-700 text-sm">{s.value}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleOpenSettingsModal(s)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center space-x-1 mx-auto"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Sửa</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeSubTab === 'audit' && (() => {
            const getAuditLogSummary = (log: any) => {
              const table = log.table_name;
              const action = log.action;
              const oldVal = log.old_value || {};
              const newVal = log.new_value || {};

              if (table === 'operators') {
                if (action === 'create') return `Tạo tài khoản: ${newVal.full_name || ''} (${newVal.operator_id || ''})`;
                if (action === 'update') return `Cập nhật tài khoản: ${newVal.full_name || oldVal.full_name || ''}`;
                if (action === 'delete') return `Xóa tài khoản: ${oldVal.full_name || ''}`;
              }
              if (table === 'vehicles') {
                if (action === 'create') return `Thêm phương tiện mới: ${newVal.vehicle_code || ''} - ${newVal.vehicle_name || ''}`;
                if (action === 'update') {
                  const parts = [];
                  if (newVal.status && newVal.status !== oldVal.status) {
                    parts.push(`Trạng thái: ${oldVal.status} → ${newVal.status}`);
                  }
                  if (newVal.current_hourmeter && newVal.current_hourmeter !== oldVal.current_hourmeter) {
                    parts.push(`Số giờ máy: ${oldVal.current_hourmeter}h → ${newVal.current_hourmeter}h`);
                  }
                  return `Cập nhật xe ${newVal.vehicle_code || oldVal.vehicle_code || ''}: ${parts.join(', ') || 'Thông tin chung'}`;
                }
              }
              if (table === 'operation_logs') {
                if (action === 'create') return `Mở ca chạy xe (Bắt đầu ca) - Giờ máy: ${newVal.hourmeter_start || 0}h`;
                if (action === 'update') {
                  if (newVal.end_hour && !oldVal.end_hour) {
                    return `Kết thúc ca (Đóng ca) - Giờ máy cuối: ${newVal.hourmeter_end || 0}h`;
                  }
                  return `Cập nhật nhật ký ca chạy xe`;
                }
              }
              if (table === 'checklist_results') {
                return `Cập nhật checklist: Hạng mục #${newVal.checklist_id || oldVal.checklist_id || ''} (${newVal.result ? 'ĐẠT' : 'KHÔNG ĐẠT'})`;
              }
              if (table === 'failure_logs') {
                if (action === 'create') return `Báo hỏng xe: ${newVal.description || ''}`;
                if (action === 'update') {
                  if (newVal.is_repaired && !oldVal.is_repaired) return `Sự cố đã được khắc phục/sửa xong`;
                  return `Cập nhật thông tin sự cố hư hỏng`;
                }
              }
              if (table === 'repair_logs') {
                if (action === 'create') return `Khởi động phiếu sửa chữa bảo dưỡng`;
                if (action === 'update') return `Cập nhật tiến độ sửa chữa: ${newVal.repair_status || oldVal.repair_status || ''}`;
              }
              return `${action === 'create' ? 'Tạo mới' : action === 'update' ? 'Cập nhật' : 'Xóa'} trên bảng ${table}`;
            };

            const filteredLogs = auditLogs.filter(log => {
              if (auditOperatorFilter) {
                const opName = (log.operator?.full_name || '').toLowerCase();
                const opId = (log.operator_id || '').toLowerCase();
                const search = auditOperatorFilter.toLowerCase();
                if (!opName.includes(search) && !opId.includes(search)) return false;
              }
              if (auditTableFilter && log.table_name !== auditTableFilter) return false;
              if (auditActionFilter && log.action !== auditActionFilter) return false;
              return true;
            });

            return (
              <div className="space-y-4">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800 uppercase">Nhật ký Audit Trail toàn hệ thống</h3>
                    <span className="text-[10px] text-gray-400 font-medium">Lưu trữ hoạt động sửa đổi bảng nghiệp vụ</span>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Tìm theo tên/mã NV..."
                      value={auditOperatorFilter}
                      onChange={(e) => setAuditOperatorFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-350 rounded-lg text-xs w-44"
                    />
                    
                    <select
                      value={auditTableFilter}
                      onChange={(e) => setAuditTableFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-350 rounded-lg text-xs font-semibold text-gray-700 bg-white"
                    >
                      <option value="">-- Tất cả nhóm dữ liệu --</option>
                      <option value="operation_logs">Nhật ký ca chạy (Vận hành)</option>
                      <option value="checklist_results">Kết quả Checklist an toàn</option>
                      <option value="failure_logs">Nhật ký sự cố (Báo hỏng)</option>
                      <option value="repair_logs">Nhật ký khắc phục (Sửa chữa)</option>
                      <option value="operators">Thông tin nhân sự / Tài khoản</option>
                      <option value="vehicles">Danh mục thiết bị / Phương tiện</option>
                    </select>

                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-355 rounded-lg text-xs font-semibold text-gray-700 bg-white"
                    >
                      <option value="">-- Tất cả thao tác --</option>
                      <option value="create">Thêm mới</option>
                      <option value="update">Cập nhật</option>
                      <option value="delete">Xóa bỏ</option>
                    </select>

                    {(auditOperatorFilter || auditTableFilter || auditActionFilter) && (
                      <button
                        onClick={() => {
                          setAuditOperatorFilter('');
                          setAuditTableFilter('');
                          setAuditActionFilter('');
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                      >
                        Xóa lọc
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-[11px]">
                    <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
                      <tr>
                        <th className="px-6 py-4">Thời gian</th>
                        <th className="px-6 py-4">Nhân sự thực hiện</th>
                        <th className="px-6 py-4">Thao tác</th>
                        <th className="px-6 py-4">Hoạt động cụ thể (Tóm tắt)</th>
                        <th className="px-6 py-4 text-center">Xem chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                            Không tìm thấy nhật ký hoạt động nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.audit_id} className="hover:bg-gray-50/50 transition animate-fadeIn">
                            <td className="px-6 py-4 whitespace-nowrap font-semibold">
                              {new Date(log.created_at).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-bold text-gray-800">{log.operator?.full_name}</span>{' '}
                              <span className="text-gray-400">({log.operator_id})</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                log.action === 'create' ? 'bg-green-100 text-green-800' : log.action === 'update' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {log.action === 'create' ? 'THÊM MỚI' : log.action === 'update' ? 'CẬP NHẬT' : 'XÓA BỎ'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-800">
                              {getAuditLogSummary(log)}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedAuditLog(log);
                                  setShowAuditDetailModal(true);
                                }}
                                className="px-3 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-bold text-[10px] transition"
                              >
                                Xem biến động
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* TAB 6: IMPORTS */}
          {activeSubTab === 'imports' && (
            <div className="p-6 space-y-8">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="font-bold text-base text-gray-800 uppercase flex items-center space-x-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary-700 animate-pulse" />
                  <span>Trung tâm Nhập dữ liệu (Data Import Centre)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Nhập báo cáo hoạt động hàng tuần/tháng của đội xe hoặc bảng thống kê checklist đầu ca để đồng bộ vào cơ sở dữ liệu.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Activity Import Card */}
                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4 flex flex-col justify-between hover:shadow-md transition duration-300">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-800">
                      <div className="p-2 bg-blue-150 text-primary-700 rounded-lg">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-xs uppercase tracking-wider">Báo cáo Hoạt Động & Sự Cố</h4>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Nhập file Excel báo cáo hoạt động tuần/tháng (VD: <span className="font-mono bg-gray-200 px-1 rounded">T01_2026_...xlsx</span>). Hệ thống sẽ tự động bóc tách ngày chạy ca, tình trạng hỏng hóc, sửa chữa và cơ điện liên quan của từng mã phương tiện.
                    </p>
                  </div>

                  <form onSubmit={handleImportActivity} className="space-y-4 pt-2">
                    <div className="border-2 border-dashed border-gray-200 hover:border-primary-500 rounded-xl p-4 transition text-center cursor-pointer relative bg-white">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setActivityFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={importingActivity}
                      />
                      <div className="space-y-1">
                        <UploadCloud className="h-8 w-8 text-gray-400 mx-auto" />
                        <p className="text-xs font-semibold text-gray-700">
                          {activityFile ? activityFile.name : "Kéo thả hoặc Click để chọn file"}
                        </p>
                        <p className="text-[10px] text-gray-400">Chấp nhận file .xlsx hoặc .xls</p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!activityFile || importingActivity}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        activityFile && !importingActivity
                          ? 'bg-primary-700 hover:bg-primary-800 text-white shadow-sm'
                          : 'bg-gray-150 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {importingActivity ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                          <span>Đang xử lý import...</span>
                        </>
                      ) : (
                        <span>Bắt đầu Import Báo Cáo Hoạt Động</span>
                      )}
                    </button>
                  </form>

                  {/* Activity Results display */}
                  {activityImportResult && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 animate-fadeIn text-xs">
                      <div className="font-bold text-green-800 flex items-center space-x-1">
                        <span className="text-sm font-semibold">✓</span>
                        <span>{activityImportResult.message}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600 font-medium text-[11px] pt-1">
                        <div>Trang tính đã duyệt: <span className="font-bold text-gray-800">{activityImportResult.statistics.sheets_processed}</span></div>
                        <div>Dòng dữ liệu đã đọc: <span className="font-bold text-gray-800">{activityImportResult.statistics.rows_processed}</span></div>
                        <div>Xe mới được tạo: <span className="font-bold text-gray-800">{activityImportResult.statistics.vehicles_created}</span></div>
                        <div>Thợ sửa chữa mới tạo: <span className="font-bold text-gray-800">{activityImportResult.statistics.operators_created}</span></div>
                        <div>Mở ca (OperationLogs): <span className="font-bold text-gray-800">{activityImportResult.statistics.operation_logs_created}</span></div>
                        <div>Báo sự cố (FailureLogs): <span className="font-bold text-gray-800">{activityImportResult.statistics.failure_logs_created}</span></div>
                        <div>Sửa xong (RepairLogs): <span className="font-bold text-gray-800">{activityImportResult.statistics.repair_logs_created}</span></div>
                      </div>
                      {activityImportResult.statistics.errors && activityImportResult.statistics.errors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="font-bold text-orange-750 mb-1 uppercase tracking-wider text-[10px]">Cảnh báo / Dòng dữ liệu bị bỏ qua ({activityImportResult.statistics.errors.length}):</p>
                          <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[9px] text-gray-500">
                            {activityImportResult.statistics.errors.map((err: any, idx: number) => (
                              <div key={idx} className="bg-white p-1.5 rounded border border-gray-100">
                                {err.sheet ? `[Trang: ${err.sheet}] ` : ''}Dòng {err.row}: {err.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Checklist Import Card */}
                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4 flex flex-col justify-between hover:shadow-md transition duration-300">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-800">
                      <div className="p-2 bg-green-150 text-green-700 rounded-lg">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-xs uppercase tracking-wider">Bảng Khảo Sát Checklist Đầu Ca</h4>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Nhập file Excel kết quả khảo sát từ Google Forms (VD: <span className="font-mono bg-gray-200 px-1 rounded">Thống kê kết quả kiểm tra.xlsx</span>). Hệ thống sẽ tự động bóc tách checklist của người vận hành đầu ca để lưu vết kiểm tra an toàn.
                    </p>
                  </div>

                  <form onSubmit={handleImportChecklist} className="space-y-4 pt-2">
                    <div className="border-2 border-dashed border-gray-200 hover:border-primary-500 rounded-xl p-4 transition text-center cursor-pointer relative bg-white">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setChecklistFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={importingChecklist}
                      />
                      <div className="space-y-1">
                        <UploadCloud className="h-8 w-8 text-gray-400 mx-auto" />
                        <p className="text-xs font-semibold text-gray-700">
                          {checklistFile ? checklistFile.name : "Kéo thả hoặc Click để chọn file"}
                        </p>
                        <p className="text-[10px] text-gray-400">Chấp nhận file .xlsx hoặc .xls</p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!checklistFile || importingChecklist}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        checklistFile && !importingChecklist
                          ? 'bg-green-700 hover:bg-green-800 text-white shadow-sm'
                          : 'bg-gray-150 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {importingChecklist ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                          <span>Đang xử lý import...</span>
                        </>
                      ) : (
                        <span>Bắt đầu Import Báo Cáo Checklist</span>
                      )}
                    </button>
                  </form>

                  {/* Checklist Results display */}
                  {checklistImportResult && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 animate-fadeIn text-xs">
                      <div className="font-bold text-green-800 flex items-center space-x-1">
                        <span className="text-sm font-semibold">✓</span>
                        <span>{checklistImportResult.message}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600 font-medium text-[11px] pt-1">
                        <div>Dòng dữ liệu đã đọc: <span className="font-bold text-gray-800">{checklistImportResult.statistics.rows_processed}</span></div>
                        <div>Xe mới được tạo: <span className="font-bold text-gray-800">{checklistImportResult.statistics.vehicles_created}</span></div>
                        <div>Tài xế mới tạo: <span className="font-bold text-gray-800">{checklistImportResult.statistics.operators_created}</span></div>
                        <div>Hạng mục checklist tạo: <span className="font-bold text-gray-800">{checklistImportResult.statistics.checklist_items_created}</span></div>
                        <div>Mở ca (OperationLogs): <span className="font-bold text-gray-800">{checklistImportResult.statistics.operation_logs_created}</span></div>
                        <div>Kết quả checklist (Results): <span className="font-bold text-gray-800">{checklistImportResult.statistics.checklist_results_created}</span></div>
                      </div>
                      {checklistImportResult.statistics.errors && checklistImportResult.statistics.errors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="font-bold text-orange-750 mb-1 uppercase tracking-wider text-[10px]">Cảnh báo / Dòng dữ liệu bị bỏ qua ({checklistImportResult.statistics.errors.length}):</p>
                          <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[9px] text-gray-500">
                            {checklistImportResult.statistics.errors.map((err: any, idx: number) => (
                              <div key={idx} className="bg-white p-1.5 rounded border border-gray-100">
                                Dòng {err.row}: {err.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Weekly Status Report Import Card */}
                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4 flex flex-col justify-between hover:shadow-md transition duration-300">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-800">
                      <div className="p-2 bg-yellow-100 text-yellow-750 rounded-lg">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-xs uppercase tracking-wider">Báo cáo Tình trạng Tuần</h4>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Nhập file Excel tổng hợp tuần của đội Cơ Điện (VD: <span className="font-mono bg-gray-200 px-1 rounded">Báo cáo thiết bị Tuần...xlsx</span>). Hệ thống tự quét giờ hoạt động, hiện trạng sự cố và việc khắc phục của xe.
                    </p>
                  </div>

                  <form onSubmit={handleImportWeekly} className="space-y-4 pt-2">
                    <div className="border-2 border-dashed border-gray-200 hover:border-primary-500 rounded-xl p-4 transition text-center cursor-pointer relative bg-white">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setWeeklyFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={importingWeekly}
                      />
                      <div className="space-y-1">
                        <UploadCloud className="h-8 w-8 text-gray-400 mx-auto" />
                        <p className="text-xs font-semibold text-gray-700">
                          {weeklyFile ? weeklyFile.name : "Kéo thả hoặc Click để chọn file"}
                        </p>
                        <p className="text-[10px] text-gray-400">Chấp nhận file .xlsx hoặc .xls</p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!weeklyFile || importingWeekly}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        weeklyFile && !importingWeekly
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm'
                          : 'bg-gray-150 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {importingWeekly ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                          <span>Đang xử lý import...</span>
                        </>
                      ) : (
                        <span>Bắt đầu Import Báo Cáo Tuần</span>
                      )}
                    </button>
                  </form>

                  {/* Weekly Results display */}
                  {weeklyImportResult && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 animate-fadeIn text-xs">
                      <div className="font-bold text-green-800 flex items-center space-x-1">
                        <span className="text-sm font-semibold">✓</span>
                        <span>{weeklyImportResult.message}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600 font-medium text-[11px] pt-1">
                        <div>Dòng dữ liệu đã đọc: <span className="font-bold text-gray-800">{weeklyImportResult.statistics.rows_processed}</span></div>
                        <div>Xe mới được tạo: <span className="font-bold text-gray-800">{weeklyImportResult.statistics.vehicles_created}</span></div>
                        <div>Báo sự cố (FailureLogs): <span className="font-bold text-gray-800">{weeklyImportResult.statistics.failure_logs_created || 0}</span></div>
                        <div>Sửa xong (RepairLogs): <span className="font-bold text-gray-800">{weeklyImportResult.statistics.repair_logs_created || 0}</span></div>
                      </div>
                      {weeklyImportResult.statistics.sheets_skipped && weeklyImportResult.statistics.sheets_skipped.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-200/55 text-gray-500 text-[10px]">
                          <p className="font-bold text-orange-700 uppercase tracking-wider mb-1">Các sheet được bỏ qua do đã trùng ngày ({weeklyImportResult.statistics.sheets_skipped.length}):</p>
                          <div className="max-h-20 overflow-y-auto space-y-1 font-mono text-[9px]">
                            {weeklyImportResult.statistics.sheets_skipped.map((s: any, idx: number) => (
                              <div key={idx} className="bg-white/70 p-1 rounded border border-gray-150">
                                Trang "{s.sheet}" ({s.date}): {s.reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Guidelines Section */}
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-6 space-y-4">
                <h4 className="font-bold text-xs uppercase text-blue-700 tracking-wider flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Hướng dẫn cấu trúc File Excel chuẩn để Import thành công</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed text-gray-600">
                  <div className="space-y-2">
                    <p className="font-bold text-gray-800">1. Báo cáo Hoạt động & Sự cố</p>
                    <p>Thường dùng để nạp hoạt động ngày/tháng. Các thuộc tính nhận diện cột (Row 2):</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>Cột ngày chạy: Chứa chữ <span className="font-bold">"thời gian"</span> (loại trừ cột hư hỏng).</li>
                      <li>Cột mô tả: Chứa chữ <span className="font-bold">"hư hỏng"</span>, <span className="font-bold">"công việc"</span>, <span className="font-bold">"nội dung"</span>.</li>
                      <li>Dải phương tiện (Row 3): Chứa mã xe (e.g. LB40-1, SK300), đánh dấu <span className="font-bold">"x"</span> ở dòng xe chạy.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-bold text-gray-800">2. Bảng Khảo Sát Checklist Đầu Ca</p>
                    <p>Thường xuất từ kết quả biểu mẫu khảo sát Google Forms. Hệ thống tự động nhận diện:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>Cột tên tài xế: Chứa chữ <span className="font-bold">"người vận hành"</span> hoặc <span className="font-bold">"họ tên"</span>.</li>
                      <li>Cột tên xe: Chứa chữ <span className="font-bold">"phương tiện"</span> hoặc <span className="font-bold">"tên phương tiện"</span>.</li>
                      <li>Cột an toàn: Chứa chữ <span className="font-bold">"đảm bảo an toàn"</span> để nạp trạng thái vận hành.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-bold text-gray-800">3. Báo cáo Tình trạng Tuần</p>
                    <p>Thường dùng để nạp trạng thái tuần từ tổ Cơ Điện. Hệ thống tự động quét dòng tiêu đề có chứa các cột:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li><span className="font-bold">STT</span>, <span className="font-bold">Tên thiết bị phương tiện</span> (VD: Liebherr CBB...-LB40-1)</li>
                      <li><span className="font-bold">Giờ hoạt động</span>, <span className="font-bold">Hoạt động</span> ("x"), <span className="font-bold">Không hoạt động</span> ("x")</li>
                      <li><span className="font-bold">Hiện trạng</span> (mô tả chi tiết lỗi), <span className="font-bold">Ghi chú</span></li>
                      <li><span className="font-bold">Sửa chữa hoàn thành</span>, <span className="font-bold">Sửa đọng chưa xử lý triệt để</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Lịch sử Nhập báo cáo Tuần (Import Management History) */}
              <div className="bg-white border border-gray-150 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-xs uppercase text-gray-800 tracking-wider flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span>Quản lý Lịch sử các Tuần đã Import</span>
                  </h4>
                  <button 
                    onClick={fetchWeeklyHistory}
                    disabled={historyLoading}
                    className="text-[11px] font-bold text-yellow-600 hover:text-yellow-750 transition"
                  >
                    {historyLoading ? 'Đang tải...' : 'Làm mới'}
                  </button>
                </div>
                
                {historyLoading ? (
                  <div className="text-center py-6 text-xs text-gray-400">Đang tải lịch sử import...</div>
                ) : weeklyHistory.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400">Chưa có tuần nào được import dữ liệu.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-150 text-xs">
                      <thead>
                        <tr className="text-gray-400 font-bold text-[10px] uppercase tracking-wider bg-gray-50/50">
                          <th className="px-4 py-2.5 text-left">Tên Tuần</th>
                          <th className="px-4 py-2.5 text-left">Ngày Báo Cáo</th>
                          <th className="px-4 py-2.5 text-center">Số Thiết Bị Nhập</th>
                          <th className="px-4 py-2.5 text-center">Số Thiết Bị Sự Cố</th>
                          <th className="px-4 py-2.5 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {weeklyHistory.map((h: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50/30 transition">
                            <td className="px-4 py-3 font-semibold text-gray-900">{h.week_name}</td>
                            <td className="px-4 py-3 font-mono text-gray-500">{h.date}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800">{h.logs_count}</td>
                            <td className="px-4 py-3 text-center">
                              {h.failures_count > 0 ? (
                                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                  {h.failures_count} sự cố
                                </span>
                              ) : (
                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                                  Bình thường
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeleteWeekly(h.date)}
                                className="text-red-600 hover:text-red-800 hover:underline font-bold text-[11px]"
                              >
                                Xóa Dữ Liệu
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      {/* ================================================================= */}
      {/* 1. MODAL: NGƯỜI DÙNG */}
      {/* ================================================================= */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">
                {selectedUser ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản nhân viên mới'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mã nhân viên *</label>
                  <input
                    type="text"
                    placeholder="VD: OP05, ME03..."
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold uppercase"
                    required
                    disabled={!!selectedUser}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Họ và tên *</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A..."
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tổ / Phòng ban</label>
                  <input
                    type="text"
                    placeholder="Đội xe 2..."
                    value={userDept}
                    onChange={(e) => setUserDept(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Điện thoại</label>
                  <input
                    type="text"
                    placeholder="09...'"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vai trò (Role) *</label>
                <select
                  value={userRoleId}
                  onChange={(e) => setUserRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                  required
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  {selectedUser ? 'Mật khẩu mới (Bỏ trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo *'}
                </label>
                <input
                  type="password"
                  placeholder={selectedUser ? 'Nhập mật khẩu mới...' : 'Mặc định nếu trống: 123456'}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-semibold"
                />
              </div>

              {selectedUser && (
                <label className="flex items-center space-x-2 font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userActive}
                    onChange={(e) => setUserActive(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 border-gray-300"
                  />
                  <span>Tài khoản đang hoạt động (Active)</span>
                </label>
              )}

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
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
      {/* 2. MODAL: DỰNG CÂU HỎI CHECKLIST */}
      {/* ================================================================= */}
      {showChecklistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Cấu hình câu hỏi checklist</h3>
              <button onClick={() => setShowChecklistModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleChecklistSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nội dung câu hỏi *</label>
                <textarea
                  placeholder="Kiểm tra độ võng xích gầu đào..."
                  value={checkName}
                  onChange={(e) => setCheckName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-semibold h-20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mức độ nghiêm trọng khi lỗi (Không Đạt) *</label>
                <div className="flex space-x-6 p-1">
                  <label className="flex items-center space-x-2 font-semibold text-gray-750 cursor-pointer">
                    <input
                      type="radio"
                      name="checklistSeverity"
                      value="light"
                      checked={checkSeverity === 'light'}
                      onChange={() => setCheckSeverity('light')}
                      className="text-primary-600 focus:ring-primary-500 h-4 w-4 border-gray-300"
                    />
                    <span>Lỗi nhẹ (Được phép chạy xe nếu có lý do an toàn)</span>
                  </label>
                  <label className="flex items-center space-x-2 font-semibold text-gray-750 cursor-pointer">
                    <input
                      type="radio"
                      name="checklistSeverity"
                      value="dangerous"
                      checked={checkSeverity === 'dangerous'}
                      onChange={() => setCheckSeverity('dangerous')}
                      className="text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300"
                    />
                    <span className="text-red-600 font-bold">⚠️ Lỗi nguy hiểm (Bắt buộc dừng máy & khóa xe)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Áp dụng cho các loại xe</label>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 max-h-[150px] overflow-y-auto">
                  {vehicleTypes.map((vt) => {
                    const isChecked = appliesTypes.includes(vt.vehicle_type_id);
                    return (
                      <label key={vt.vehicle_type_id} className="flex items-center space-x-2 font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAppliesTypes(appliesTypes.filter(id => id !== vt.vehicle_type_id));
                            } else {
                              setAppliesTypes([...appliesTypes, vt.vehicle_type_id]);
                            }
                          }}
                          className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 border-gray-300"
                        />
                        <span>{vt.type_name}</span>
                      </label>
                    );
                  })}
                  {vehicleTypes.length === 0 && (
                    <p className="text-[10px] text-gray-400">Không tìm thấy phân loại xe nào.</p>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">(* Nếu không chọn loại xe nào, checklist sẽ được áp dụng cho tất cả các loại xe).</p>
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowChecklistModal(false)}
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
      {/* 3. MODAL: DỰNG HẠNG MỤC SỰ CỐ */}
      {/* ================================================================= */}
      {showFailureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Cấu hình danh mục sự cố</h3>
              <button onClick={() => setShowFailureModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleFailureSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tên sự cố *</label>
                <input
                  type="text"
                  placeholder="VD: Rò rỉ ty ben thủy lực..."
                  value={failCatName}
                  onChange={(e) => setFailCatName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                  required
                />
              </div>

              {/* Severity is defaulted to light quietly */}

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFailureModal(false)}
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
      {/* 4. MODAL: SỬA THAM SỐ CẤU HÌNH */}
      {/* ================================================================= */}
      {showSettingsModal && selectedSetting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Điều chỉnh tham số cấu hình</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-white/80 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleSettingsSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border">
                <p className="font-bold text-gray-800">Khóa: {selectedSetting.key}</p>
                <p className="text-[10px] text-gray-500 mt-1">{selectedSetting.description}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giá trị điều chỉnh *</label>
                <input
                  type="text"
                  value={settingVal}
                  onChange={(e) => setSettingVal(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-bold text-primary-700 text-sm"
                  required
                />
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl transition"
                >
                  XÁC NHẬN LƯU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAuditDetailModal && selectedAuditLog && (() => {
        const oldVal = selectedAuditLog.old_value || {};
        const newVal = selectedAuditLog.new_value || {};
        const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
        
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
              <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm uppercase">Biến động dữ liệu chi tiết</h3>
                  <p className="text-[10px] text-white/80 font-medium">
                    Thực hiện bởi: {selectedAuditLog.operator?.full_name || 'Hệ thống'} ({selectedAuditLog.operator_id}) | Nhóm dữ liệu: {mapTableName(selectedAuditLog.table_name)}
                  </p>
                </div>
                <button onClick={() => setShowAuditDetailModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-4 border-b border-gray-200 pb-2 text-[10px] font-bold text-gray-400 uppercase">
                  <div>Trường dữ liệu</div>
                  <div>Giá trị cũ (Old)</div>
                  <div>Giá trị mới (New)</div>
                </div>
                
                <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto pr-1">
                  {allKeys.length === 0 ? (
                    <div className="py-4 text-center text-gray-400">Không ghi nhận thay đổi thuộc tính cụ thể.</div>
                  ) : (
                    allKeys.map(key => {
                      const oldStr = mapFieldValue(key, oldVal[key]);
                      const newStr = mapFieldValue(key, newVal[key]);
                      const isChanged = oldVal[key] !== newVal[key];
                      
                      return (
                        <div key={key} className={`grid grid-cols-3 gap-4 py-2.5 items-center ${isChanged ? 'bg-yellow-50/40' : ''}`}>
                          <div className="font-bold text-gray-800 text-[11px] break-all">{mapFieldKey(key)}</div>
                          <div className="text-gray-400 line-through break-all">{oldStr}</div>
                          <div className={`break-all font-bold ${isChanged ? 'text-primary-700 font-extrabold' : 'text-gray-750'}`}>{newStr}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end border-t border-gray-100 pt-4 shrink-0">
                  <button
                    onClick={() => setShowAuditDetailModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-xl transition text-xs"
                  >
                    ĐÓNG
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {showConfirmModal && confirmConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className={`px-6 py-4 flex items-center space-x-2 text-white shrink-0 ${confirmConfig.isDanger ? 'bg-gradient-to-r from-red-700 to-red-600' : 'bg-gradient-to-r from-primary-700 to-primary-600'}`}>
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-sm uppercase">{confirmConfig.title}</h3>
            </div>
            
            <div className="p-6 space-y-4 text-xs font-semibold text-gray-700">
              <p className="leading-relaxed">
                {confirmConfig.message}
              </p>
              
              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  {confirmConfig.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmConfig.onConfirm();
                    setShowConfirmModal(false);
                  }}
                  className={`px-4 py-2 text-white font-bold rounded-xl transition ${
                    confirmConfig.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-700 hover:bg-primary-800'
                  }`}
                >
                  {confirmConfig.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Admin;
