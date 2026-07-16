import React, { useEffect, useState } from 'react';
import { 
  Wrench, CheckCircle, Clock, AlertTriangle, 
  Camera, Eye, Plus, ArrowRight, X, Info, History, Download,
  ChevronLeft, ChevronRight, Settings
} from 'lucide-react';
import { failureService, repairService, authService } from '../utils/api';
const parseUTCDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  return new Date(dateStr);
};

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

const getAttachmentUrl = (filePath: string | null | undefined) => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (window.location.hostname === 'localhost' && window.location.port === '5173') {
    return `http://localhost:8000/${normalizedPath}`;
  }
  return `/${normalizedPath}`;
};


interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show (ellipsis support)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100 mt-6 text-xs text-gray-500 font-semibold select-none">
      <div>
        Hiển thị <span className="text-gray-900 font-bold">{startItem}-{endItem}</span> trong số <span className="text-gray-900 font-bold">{totalItems}</span> bản ghi
      </div>
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition duration-150"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPageNumbers().map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => typeof p === 'number' && onPageChange(p)}
            disabled={p === '...'}
            className={`px-3 py-2 rounded-xl transition duration-150 min-w-[32px] text-center ${
              p === currentPage
                ? 'bg-primary-700 text-white font-bold shadow-sm shadow-primary-100'
                : p === '...'
                ? 'text-gray-400 cursor-default'
                : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition duration-150"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const Repairs: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [failures, setFailures] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedFailure, setSelectedFailure] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEndRepairModal, setShowEndRepairModal] = useState(false);
  const [activeRepair, setActiveRepair] = useState<any>(null);

  // Form states
  const [partsUsed, setPartsUsed] = useState('');
  const [repairNote, setRepairNote] = useState('');
  const [repairStatus, setRepairStatus] = useState('done');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Optimizations States (Tabs & Assignment)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [assignableOperators, setAssignableOperators] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningFailureId, setAssigningFailureId] = useState<number | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');

  // Admin Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFailure, setEditingFailure] = useState<any>(null);
  const [editFailureTime, setEditFailureTime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSeverity, setEditSeverity] = useState('light');
  const [editMechanicId, setEditMechanicId] = useState('');
  const [editRepairStatus, setEditRepairStatus] = useState('pending');
  const [editRepairStart, setEditRepairStart] = useState('');
  const [editRepairEnd, setEditRepairEnd] = useState('');
  const [editRepairNote, setEditRepairNote] = useState('');

  // Filters for History Tab
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterReporter, setFilterReporter] = useState('');
  const [filterRepairer, setFilterRepairer] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Pagination State
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE_ACTIVE = 6;
  const ITEMS_PER_PAGE_HISTORY = 10;

  // Notification State
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
    const initData = async () => {
      try {
        const [me] = await Promise.all([
          authService.me(),
        ]);
        setCurrentUser(me);
        await reloadData();
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải dữ liệu sửa chữa');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    setHistoryPage(1);
  }, [filterVehicle, filterReporter, filterRepairer, filterStartDate, filterEndDate]);

  const reloadData = async () => {
    try {
      // Fetch all failures (both repaired and unresolved)
      const listFailures = await failureService.list();
      setFailures(listFailures);

      // Fetch all repairs
      const listRepairs = await repairService.list();
      setRepairs(listRepairs);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đồng bộ dữ liệu');
    }
  };

  const getActiveFailures = () => {
    return failures.filter((f: any) => {
      if (f.is_repaired) return false;
      const isOperator = currentUser?.role_rel?.role_name === 'NGƯỜI VẬN HÀNH';
      if (isOperator) {
        const linkedRepair = getLinkedRepair(f.failure_id);
        
        // 1. If it is in Pending (Chờ tiếp nhận - meaning no active in-progress repair)
        // -> ALL operators can see it.
        if (!linkedRepair) {
          return true;
        }
        
        // 2. If it is In Progress (Đang sửa)
        // -> ONLY the assignee or the reporter can see it.
        const isReportedByMe = f.created_by === currentUser?.operator_id;
        const isAssignedToMe = linkedRepair.mechanic_id === currentUser?.operator_id;
        return isReportedByMe || isAssignedToMe;
      }
      return true;
    });
  };

  const getHistoryFailures = () => {
    return failures.filter((f: any) => {
      const isOperator = currentUser?.role_rel?.role_name === 'NGƯỜI VẬN HÀNH';
      if (isOperator) {
        const isReportedByMe = f.created_by === currentUser?.operator_id;
        const isRepairedByMe = f.repairs?.some((r: any) => r.mechanic_id === currentUser?.operator_id);
        return isReportedByMe || isRepairedByMe;
      }
      return true;
    });
  };

  const getFilteredHistory = () => {
    return getHistoryFailures().filter((f: any) => {
      if (filterVehicle) {
        const vehCode = f.vehicle?.vehicle_code?.toLowerCase() || '';
        const vehName = f.vehicle?.vehicle_name?.toLowerCase() || '';
        const query = filterVehicle.toLowerCase();
        if (!vehCode.includes(query) && !vehName.includes(query)) return false;
      }
      if (filterReporter) {
        const repName = f.creator?.full_name?.toLowerCase() || '';
        const repId = f.created_by?.toLowerCase() || '';
        const query = filterReporter.toLowerCase();
        if (!repName.includes(query) && !repId.includes(query)) return false;
      }
      if (filterRepairer) {
        const query = filterRepairer.toLowerCase();
        const hasMechMatch = f.repairs?.some((r: any) => {
          const mechName = r.mechanic?.full_name?.toLowerCase() || '';
          const mechId = r.mechanic_id?.toLowerCase() || '';
          return mechName.includes(query) || mechId.includes(query);
        });
        if (!hasMechMatch) return false;
      }
      if (filterStartDate) {
        const fTime = parseUTCDate(f.failure_time)?.getTime() || 0;
        const sTime = new Date(filterStartDate).getTime();
        if (fTime < sTime) return false;
      }
      if (filterEndDate) {
        const fTime = parseUTCDate(f.failure_time)?.getTime() || 0;
        const eTime = new Date(filterEndDate).getTime();
        if (fTime > eTime + 86400000) return false;
      }
      return true;
    });
  };

  const handleExportCSV = () => {
    const dataToExport = getFilteredHistory();
    if (dataToExport.length === 0) {
      alert('Không có dữ liệu để xuất báo cáo.');
      return;
    }

    let csvContent = '\uFEFF';
    csvContent += 'Mã yêu cầu,Mã xe,Tên xe,Sự cố,Người báo cáo,Phòng ban báo,Ca báo,Thời điểm báo,Người sửa,Bắt đầu sửa,Kết thúc sửa,Vật tư đã dùng,Ghi chú,Trạng thái\n';

    dataToExport.forEach((f: any) => {
      const doneRepair = f.repairs?.find((r: any) => r.repair_status === 'done' || r.repair_status === 'cancelled');
      const parts = doneRepair?.parts_used ? `"${doneRepair.parts_used.replace(/"/g, '""')}"` : '---';
      const notes = doneRepair?.note ? `"${doneRepair.note.replace(/"/g, '""')}"` : '---';
      
      const row = [
        f.failure_id,
        f.vehicle?.vehicle_code || '---',
        f.vehicle?.vehicle_name || '---',
        f.category?.category_name || '---',
        f.creator?.full_name || f.created_by,
        f.creator?.department || '---',
        f.operation?.shift?.shift_name || '---',
        parseUTCDate(f.failure_time)?.toLocaleString('vi-VN'),
        doneRepair ? (doneRepair.mechanic?.full_name || doneRepair.mechanic_id) : '---',
        doneRepair ? (parseUTCDate(doneRepair.repair_start)?.toLocaleString('vi-VN') || '') : '---',
        doneRepair ? (parseUTCDate(doneRepair.repair_end)?.toLocaleString('vi-VN') || '') : '---',
        parts,
        notes,
        f.is_repaired ? (doneRepair?.repair_status === 'cancelled' ? 'Đã hủy' : 'Đã hoàn tất') : 'Đang xử lý'
      ].join(',');

      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bao_cao_bao_tri_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAssignModal = async (failId: number) => {
    try {
      setAssigningFailureId(failId);
      setSelectedMechanicId('');
      if (assignableOperators.length === 0) {
        const ops = await repairService.getAssignableOperators();
        setAssignableOperators(ops);
      }
      setShowAssignModal(true);
    } catch (err: any) {
      showToast('Lỗi hệ thống', 'Không thể tải danh sách nhân viên: ' + err.message, 'warning');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningFailureId || !selectedMechanicId) {
      showToast('Thông tin yêu cầu', 'Vui lòng chọn nhân viên kỹ thuật thực hiện.', 'warning');
      return;
    }

    try {
      await repairService.assign({
        failure_id: assigningFailureId,
        mechanic_id: selectedMechanicId
      });
      setShowAssignModal(false);
      showToast('Phân công thành công', 'Yêu cầu sửa chữa đã được giao cho kỹ thuật viên.', 'success');
      await reloadData();
    } catch (err: any) {
      showToast('Lỗi giao việc', err.message, 'warning');
    }
  };

  const handleOpenEditModal = async (fail: any) => {
    setEditingFailure(fail);
    setEditFailureTime(fail.failure_time ? fail.failure_time.substring(0, 16) : '');
    setEditDescription(fail.description || '');
    setEditSeverity(fail.severity || 'light');
    
    // Find linked repair
    const linkedRepair = fail.repairs && fail.repairs.length > 0 ? fail.repairs[0] : null;
    if (linkedRepair) {
      setEditMechanicId(linkedRepair.mechanic_id || '');
      setEditRepairStatus(linkedRepair.repair_status || 'pending');
      setEditRepairStart(linkedRepair.repair_start ? linkedRepair.repair_start.substring(0, 16) : '');
      setEditRepairEnd(linkedRepair.repair_end ? linkedRepair.repair_end.substring(0, 16) : '');
      setEditRepairNote(linkedRepair.note || '');
    } else {
      setEditMechanicId('');
      setEditRepairStatus('pending');
      setEditRepairStart('');
      setEditRepairEnd('');
      setEditRepairNote('');
    }
    
    // Fetch assignable operators if not loaded
    if (assignableOperators.length === 0) {
      try {
        const ops = await repairService.getAssignableOperators();
        setAssignableOperators(ops);
      } catch (err: any) {
        console.error('Error fetching assignable operators:', err);
      }
    }
    
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFailure) return;
    
    try {
      const payload = {
        failure_time: editFailureTime,
        description: editDescription,
        severity: editSeverity,
        mechanic_id: editMechanicId || null,
        repair_status: editRepairStatus || null,
        repair_start: editRepairStart || null,
        repair_end: editRepairEnd || null,
        repair_note: editRepairNote || null
      };
      
      await failureService.adminUpdate(editingFailure.failure_id, payload);
      showToast('Cập nhật thành công', 'Thông tin sự cố và phiếu sửa chữa đã được cập nhật!', 'success');
      setShowEditModal(false);
      await reloadData();
    } catch (err: any) {
      showToast('Lỗi cập nhật', err.message || 'Không thể cập nhật sự cố', 'warning');
    }
  };

  const handleStartRepair = async (failId: number) => {
    try {
      await repairService.start({ failure_id: failId });
      showToast('Đã tiếp nhận', 'Bạn đã nhận yêu cầu sửa chữa phương tiện thành công!', 'success');
      await reloadData();
      if (showDetailModal) {
        setShowDetailModal(false);
      }
    } catch (err: any) {
      showToast('Lỗi hệ thống', err.message, 'warning');
    }
  };

  const handleDirectEndRepair = async (failId: number) => {
    try {
      const rep = await repairService.start({ failure_id: failId });
      handleOpenEndRepairModal(rep);
    } catch (err: any) {
      showToast('Lỗi hệ thống', err.message, 'warning');
    }
  };

  const handleOpenEndRepairModal = (repair: any) => {
    setActiveRepair(repair);
    setPartsUsed(repair.parts_used || '');
    setRepairNote(repair.note || '');
    setRepairStatus('done');
    setShowEndRepairModal(true);
  };

  const handleEndRepairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepair) return;

    try {
      await repairService.end(activeRepair.repair_id, {
        parts_used: partsUsed,
        note: repairNote,
        repair_status: repairStatus
      });
      setShowEndRepairModal(false);
      if (repairStatus === 'rejected') {
        showToast(
          'Đã chuyển lại cho danh sách chờ',
          `Yêu cầu #${activeRepair.failure_id} sẽ được hiển thị lại để người khác tiếp nhận. Lý do: ${repairNote}`,
          'info'
        );
      } else {
        showToast('Cập nhật thành công', 'Hồ sơ sửa chữa phương tiện đã được lưu lại.', 'success');
      }
      await reloadData();
    } catch (err: any) {
      showToast('Lỗi hệ thống', err.message, 'warning');
    }
  };

  const handleOpenDetailModal = (fail: any) => {
    setSelectedFailure(fail);
    setSelectedFile(null);
    setShowDetailModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile || !selectedFailure) return;
    setUploading(true);
    try {
      await failureService.uploadAttachment(selectedFailure.failure_id, selectedFile);
      showToast('Tải lên thành công', 'Ảnh hiện trạng đã được đính kèm vào hồ sơ.', 'success');
      setSelectedFile(null);
      // Reload failure details to see new photo
      const list = await failureService.list({ is_repaired: false });
      setFailures(list);
      const updatedFail = list.find((f: any) => f.failure_id === selectedFailure.failure_id);
      if (updatedFail) {
        setSelectedFailure(updatedFail);
      }
    } catch (err: any) {
      showToast('Lỗi tải ảnh', err.message, 'warning');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // Get active repair linked to a failure if exists
  const getLinkedRepair = (failId: number) => {
    return repairs.find(r => r.failure_id === failId && r.repair_status === 'in_progress');
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Sửa chữa & Bảo trì</h1>
          <p className="text-sm text-gray-500 mt-1">Hệ thống ghi nhận sự cố, theo dõi tiến độ khắc phục và lịch sử bảo trì xe</p>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto shadow-sm overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
          <button
            onClick={() => {
              setActiveTab('active');
              setActivePage(1);
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              activeTab === 'active' 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Đang xử lý ({getActiveFailures().length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setHistoryPage(1);
            }}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
              activeTab === 'history' 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Lịch sử ({getHistoryFailures().length})</span>
          </button>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        {activeTab === 'active' ? (
          /* ================================================================= */
          /* TAB 1: ĐANG XỬ LÝ (ACTIVE)                                        */
          /* ================================================================= */
          getActiveFailures().length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
              <p className="text-xs font-semibold">Tuyệt vời! Không có sự cố nào cần xử lý.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getActiveFailures()
                  .slice((activePage - 1) * ITEMS_PER_PAGE_ACTIVE, activePage * ITEMS_PER_PAGE_ACTIVE)
                  .map((fail: any) => {
                    const linkedRepair = getLinkedRepair(fail.failure_id);
                
                // Determine status and style
                let statusLabel = 'Chờ tiếp nhận';
                let statusClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                if (linkedRepair) {
                  statusLabel = 'Đang xử lý';
                  statusClass = 'bg-blue-50 text-blue-800 border-blue-200';
                }
                const isPending = !linkedRepair;
                const currentAssignee = linkedRepair 
                  ? (linkedRepair.mechanic?.full_name || linkedRepair.mechanic_id)
                  : 'Chưa phân công';

                const currentAssigneeDept = linkedRepair
                  ? (linkedRepair.mechanic?.department || 'Kỹ thuật')
                  : '';
                const borderClass = isPending ? 'border-l-[5px] border-l-amber-500' : 'border-l-[5px] border-l-blue-600';
                const shadowClass = isPending ? 'hover:shadow-amber-100/50' : 'hover:shadow-blue-100/50';

                return (
                  <div key={fail.failure_id} className={`p-6 bg-white ${borderClass} ${shadowClass} hover:-translate-y-0.5 transition-all duration-300 rounded-2xl border border-gray-200/80 flex flex-col justify-between space-y-4 text-xs shadow-md shadow-gray-100/50`}>
                    {/* Top metadata row */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 font-bold rounded-lg text-[9px] uppercase tracking-wide">
                            Yêu cầu #{fail.failure_id}
                          </span>
                          <span className={`whitespace-nowrap px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 pt-1">
                          {fail.vehicle?.vehicle_name || 'Phương tiện'} ({fail.vehicle?.vehicle_code || 'Chưa rõ'})
                        </h4>
                      </div>

                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-bold ${
                        fail.severity === 'dangerous' 
                          ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-100' 
                          : fail.severity === 'heavy' 
                            ? 'bg-orange-500 text-white shadow shadow-orange-100' 
                            : 'bg-yellow-500 text-gray-800 shadow shadow-yellow-100'
                      }`}>
                        {fail.severity === 'dangerous' ? '⚠️ Nguy hiểm (Dừng khẩn)' : fail.severity === 'heavy' ? '⚙️ Nặng (Vào bãi sửa)' : '🔧 Nhẹ (Theo dõi thêm)'}
                      </span>
                    </div>

                    {/* Failure details */}
                    {(() => {
                      const parsed = parseDescription(fail.description);
                      return (
                        <div className="space-y-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                          <p className="font-bold text-gray-800 flex items-center space-x-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            <span>Hạng mục: {fail.category?.category_name || 'Chưa phân loại'}</span>
                          </p>
                          <p className="text-gray-600 font-medium leading-relaxed pl-2.5 border-l-2 border-gray-300 italic">
                            "{parsed.mainDesc}"
                          </p>
                          {Object.keys(parsed.details).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200/50 grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-semibold">
                              {parsed.details['TG dừng'] && (
                                <div>
                                  <span className="font-bold block text-gray-400 uppercase tracking-wider text-[8px]">Thời gian dừng</span>
                                  <span className="text-red-600 font-bold">{parsed.details['TG dừng']}</span>
                                </div>
                              )}
                              {parsed.details['Tồn đọng từ'] && (
                                <div>
                                  <span className="font-bold block text-gray-400 uppercase tracking-wider text-[8px]">Tồn đọng từ ngày</span>
                                  <span className="text-orange-600 font-bold">{parsed.details['Tồn đọng từ']}</span>
                                </div>
                              )}
                              {parsed.details['Chi tiết'] && (
                                <div className="col-span-2">
                                  <span className="font-bold block text-gray-400 uppercase tracking-wider text-[8px]">Mô tả chi tiết</span>
                                  <span className="text-gray-700 font-semibold">{parsed.details['Chi tiết']}</span>
                                </div>
                              )}
                              {parsed.details['Ghi chú'] && (
                                <div className="col-span-2">
                                  <span className="font-bold block text-gray-400 uppercase tracking-wider text-[8px]">Ghi chú</span>
                                  <span className="text-gray-700 font-semibold">{parsed.details['Ghi chú']}</span>
                                </div>
                              )}
                              {parsed.details['Đề nghị'] && (
                                <div className="col-span-2">
                                  <span className="font-bold block text-gray-400 uppercase tracking-wider text-[8px]">Đề nghị</span>
                                  <span className="text-primary-700 font-semibold">{parsed.details['Đề nghị']}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Reporter */}
                      <div className="p-3.5 bg-gray-50/30 rounded-xl border border-gray-100 space-y-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Người báo sự cố</span>
                        <span className="font-bold text-gray-700 block">{fail.creator?.full_name || fail.created_by}</span>
                        <span className="block text-[9px] text-gray-400 font-medium">{fail.creator?.department || 'Tổ vận hành'}</span>
                      </div>
                      {/* Time */}
                      <div className="p-3.5 bg-gray-50/30 rounded-xl border border-gray-100 space-y-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Thời điểm báo sự cố</span>
                        <span className="font-bold text-gray-800 text-[10px] block">{parseUTCDate(fail.failure_time)?.toLocaleDateString('vi-VN')}</span>
                        <span className="text-[9px] text-gray-400 font-medium block">{parseUTCDate(fail.failure_time)?.toLocaleTimeString('vi-VN')}</span>
                      </div>
                    </div>

                    {/* Mechanic & Time Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Mechanic */}
                      <div className="p-3.5 bg-gray-50/30 rounded-xl border border-gray-100 space-y-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Thợ xử lý</span>
                        <span className="font-bold text-gray-700 flex items-center space-x-1.5">
                          <Wrench className="h-3.5 w-3.5 text-primary-600" />
                          <span>{currentAssignee}</span>
                        </span>
                        {currentAssigneeDept && <span className="block text-[9px] text-gray-400 font-medium">{currentAssigneeDept}</span>}
                      </div>
                      {/* Duration */}
                      <div className="p-3.5 bg-gray-50/30 rounded-xl border border-gray-100 space-y-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Thời gian thực tế</span>
                        {linkedRepair ? (
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-bold text-blue-600 flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>Sửa từ: {parseUTCDate(linkedRepair.repair_start)?.toLocaleTimeString('vi-VN')}</span>
                            </span>
                            <span className="block text-[9px] text-gray-400 font-medium">{parseUTCDate(linkedRepair.repair_start)?.toLocaleDateString('vi-VN')}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold italic block pt-1 flex items-center space-x-1">
                            <Clock className="h-3 w-3 text-gray-300" />
                            <span>Chưa bắt đầu sửa</span>
                          </span>
                        )}
                      </div>

                    </div>
                    {/* Photo attachments list preview */}
                    {fail.attachments && fail.attachments.length > 0 && (
                      <div className="flex space-x-2 py-1 overflow-x-auto">
                        {fail.attachments.map((att: any) => (
                          <img 
                            key={att.attachment_id} 
                            src={getAttachmentUrl(att.file_path)} 
                            alt="Đính kèm" 
                            className="h-10 w-10 object-cover rounded-lg border border-gray-200 hover:scale-105 transition cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetailModal(fail);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Action buttons footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 gap-2">
                      <div className="flex space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(fail)}
                          className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl border border-gray-200 transition flex items-center space-x-1.5 shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Chi tiết</span>
                        </button>

                        {(currentUser?.role_rel?.role_name === 'ADMIN' || currentUser?.role_rel?.permissions?.some((p: any) => p.permission_key === 'admin:all')) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(fail)}
                            className="px-3 py-2 bg-white hover:bg-gray-100 text-amber-600 font-bold rounded-xl border border-amber-200 transition flex items-center space-x-1.5 shrink-0"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            <span>Sửa sự cố</span>
                          </button>
                        )}
                      </div>

                      <div className="flex space-x-1.5">
                        {/* Assign task button for Manager/Admin */}
                        {(currentUser?.role_rel?.permissions?.some((p: any) => p.permission_key === 'repair:assign' || p.permission_key === 'admin:all') || currentUser?.role_rel?.role_name === 'QUẢN LÝ ĐỘI' || currentUser?.role_rel?.role_name === 'ADMIN') && (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(fail.failure_id)}
                            className="px-3 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-bold rounded-xl shadow-sm transition"
                          >
                            Giao việc
                          </button>
                        )}

                        {/* Accept task for pending */}
                        {!linkedRepair ? (
                          <button
                            type="button"
                            onClick={() => handleStartRepair(fail.failure_id)}
                            className="px-3 py-2 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white font-bold rounded-xl shadow-sm transition"
                          >
                            Nhận việc
                          </button>
                        ) : (
                          /* Update / Done task for assigned mechanic or manager/admin */
                          (linkedRepair.mechanic_id === currentUser?.operator_id || currentUser?.role_rel?.role_name === 'ADMIN' || currentUser?.role_rel?.role_name === 'QUẢN LÝ ĐỘI') ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEndRepairModal(linkedRepair)}
                                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition"
                              >
                                Cập nhật tiến độ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEndRepairModal(linkedRepair)}
                                className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold rounded-xl shadow-sm transition"
                              >
                                Hoàn thành
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-semibold italic flex items-center">
                              Được giao cho thợ khác
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              currentPage={activePage}
              totalPages={Math.ceil(getActiveFailures().length / ITEMS_PER_PAGE_ACTIVE)}
              totalItems={getActiveFailures().length}
              itemsPerPage={ITEMS_PER_PAGE_ACTIVE}
              onPageChange={(page) => setActivePage(page)}
            />
          </div>
        )
        ) : (
          /* ================================================================= */
          /* TAB 2: LỊCH SỬ BẢO TRÌ (HISTORY)                                  */
          /* ================================================================= */
          <div className="space-y-6">
            {/* Filter controls panel */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Phương tiện</label>
                <input
                  type="text"
                  placeholder="Mã xe hoặc tên xe..."
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Người báo cáo</label>
                <input
                  type="text"
                  placeholder="Mã NV hoặc họ tên..."
                  value={filterReporter}
                  onChange={(e) => setFilterReporter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Thợ sửa chữa</label>
                <input
                  type="text"
                  placeholder="Mã thợ hoặc họ tên..."
                  value={filterRepairer}
                  onChange={(e) => setFilterRepairer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs"
                />
              </div>
            </div>

            {/* Export and result status row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
              <span className="text-xs font-semibold text-gray-500">
                Tìm thấy <strong>{getFilteredHistory().length}</strong> kết quả bảo trì
              </span>

              {/* CSV Export for Admin / Manager */}
              {(currentUser?.role_rel?.role_name === 'QUẢN LÝ ĐỘI' || currentUser?.role_rel?.role_name === 'ADMIN') && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl flex items-center space-x-1.5 transition self-start sm:self-auto shadow-sm text-xs"
                >
                  <Download className="h-4 w-4" />
                  <span>Xuất báo cáo Excel (CSV)</span>
                </button>
              )}
            </div>

            {/* Condensed table view */}
            {getFilteredHistory().length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-xs italic">
                Không tìm thấy dữ liệu bảo trì khớp với điều kiện lọc.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="px-4 py-3">Mã YC</th>
                        <th className="px-4 py-3">Phương tiện</th>
                        <th className="px-4 py-3">Sự cố hỏng hóc</th>
                        <th className="px-4 py-3">Người báo</th>
                        <th className="px-4 py-3">Người sửa</th>
                        <th className="px-4 py-3">Thời gian</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 font-medium text-gray-700">
                      {getFilteredHistory()
                        .slice((historyPage - 1) * ITEMS_PER_PAGE_HISTORY, historyPage * ITEMS_PER_PAGE_HISTORY)
                        .map((fail: any) => {
                        const doneRepair = fail.repairs?.find((r: any) => r.repair_status === 'done' || r.repair_status === 'cancelled');
                        const activeRepair = fail.repairs?.find((r: any) => r.repair_status === 'in_progress');
                        const currentRepair = doneRepair || activeRepair;
                        
                        let statusText = 'Chờ tiếp nhận';
                        let statusClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                        
                        if (fail.is_repaired && doneRepair) {
                          if (doneRepair.repair_status === 'cancelled') {
                            statusText = 'Đã hủy';
                            statusClass = 'bg-gray-100 text-gray-800 border-gray-200';
                          } else {
                            statusText = 'Đã hoàn tất';
                            statusClass = 'bg-green-50 text-green-800 border-green-200';
                          }
                        } else if (activeRepair) {
                          statusText = 'Đang xử lý';
                          statusClass = 'bg-blue-50 text-blue-800 border-blue-200';
                        }

                        const latestRepairWithNote = fail.repairs?.slice().reverse().find((r: any) => r.note);
                        const latestRepairWithParts = fail.repairs?.slice().reverse().find((r: any) => r.parts_used);

                        return (
                          <tr key={fail.failure_id} className="hover:bg-gray-50/50 transition">
                            <td className="px-4 py-3 font-bold text-gray-900">#{fail.failure_id}</td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-primary-700 block">{fail.vehicle?.vehicle_code}</span>
                              <span className="text-[10px] text-gray-400 block">{fail.vehicle?.vehicle_name}</span>
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              {(() => {
                                const parsed = parseDescription(fail.description);
                                return (
                                  <div className="space-y-1 font-semibold">
                                    <span className="font-extrabold block text-gray-900">{fail.category?.category_name}</span>
                                    <span className="text-[10px] text-gray-600 block leading-snug">Chi tiết: {parsed.mainDesc}</span>
                                    {parsed.details['Tồn đọng từ'] && (
                                      <span className="text-[9px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100/50 inline-block mt-0.5 font-bold mr-1">
                                        ⏳ Tồn đọng từ: {parsed.details['Tồn đọng từ']}
                                      </span>
                                    )}
                                    {parsed.details['TG dừng'] && (
                                      <span className="text-[9px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100/50 inline-block mt-0.5 font-bold">
                                        ⏱️ Dừng: {parsed.details['TG dừng']}
                                      </span>
                                    )}
                                    {parsed.details['Ghi chú'] && (
                                      <span className="text-[9px] text-gray-500 block leading-snug">Ghi chú: {parsed.details['Ghi chú']}</span>
                                    )}
                                    {parsed.details['Đề nghị'] && (
                                      <span className="text-[9px] text-primary-700 block leading-snug">Đề nghị: {parsed.details['Đề nghị']}</span>
                                    )}
                                    {latestRepairWithNote && latestRepairWithNote.note && (
                                      <span className="text-[10px] text-green-700 bg-green-50/80 px-2 py-0.5 rounded border border-green-200/50 block font-semibold mt-1">
                                        🔧 Khắc phục: {latestRepairWithNote.note}
                                      </span>
                                    )}
                                    {latestRepairWithParts && latestRepairWithParts.parts_used && (
                                      <span className="text-[10px] text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/50 block font-semibold mt-1">
                                        📦 Phụ tùng: {latestRepairWithParts.parts_used}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              <span className="block">{fail.creator?.full_name || fail.created_by}</span>
                              <span className="text-[10px] text-gray-400 block">{fail.creator?.department || 'Tổ vận hành'}</span>
                            </td>
                            <td className="px-4 py-3">
                              {currentRepair ? (
                                <>
                                  <span className="block">{currentRepair.mechanic?.full_name || currentRepair.mechanic_id}</span>
                                  <span className="text-[10px] text-gray-400 block">{currentRepair.mechanic?.department || 'Bảo trì'}</span>
                                </>
                              ) : '---'}
                            </td>
                            <td className="px-4 py-3 text-[10px]">
                              {doneRepair ? (
                                <>
                                  <span className="block text-gray-500">Sửa: {parseUTCDate(doneRepair.repair_start)?.toLocaleDateString('vi-VN')}</span>
                                  <span className="block text-gray-500">Xong: {parseUTCDate(doneRepair.repair_end)?.toLocaleDateString('vi-VN')}</span>
                                </>
                              ) : activeRepair ? (
                                <>
                                  <span className="block text-gray-500">Sửa từ: {parseUTCDate(activeRepair.repair_start)?.toLocaleDateString('vi-VN')}</span>
                                  <span className="text-gray-400 block">Báo: {parseUTCDate(fail.failure_time)?.toLocaleDateString('vi-VN')}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">Báo: {parseUTCDate(fail.failure_time)?.toLocaleDateString('vi-VN')}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`whitespace-nowrap px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusClass}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenDetailModal(fail)}
                                className="whitespace-nowrap px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-bold transition flex items-center space-x-1.5 ml-auto animate-none"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list of cards */}
                <div className="md:hidden space-y-3">
                  {getFilteredHistory()
                    .slice((historyPage - 1) * ITEMS_PER_PAGE_HISTORY, historyPage * ITEMS_PER_PAGE_HISTORY)
                    .map((fail: any) => {
                      const doneRepair = fail.repairs?.find((r: any) => r.repair_status === 'done' || r.repair_status === 'cancelled');
                      const activeRepair = fail.repairs?.find((r: any) => r.repair_status === 'in_progress');
                      const currentRepair = doneRepair || activeRepair;
                      
                      let statusText = 'Chờ tiếp nhận';
                      let statusClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                      
                      if (fail.is_repaired && doneRepair) {
                        if (doneRepair.repair_status === 'cancelled') {
                          statusText = 'Đã hủy';
                          statusClass = 'bg-gray-100 text-gray-800 border-gray-200';
                        } else {
                          statusText = 'Đã hoàn tất';
                          statusClass = 'bg-green-50 text-green-800 border-green-200';
                        }
                      } else if (activeRepair) {
                        statusText = 'Đang xử lý';
                        statusClass = 'bg-blue-50 text-blue-800 border-blue-200';
                      }

                      const latestRepairWithNote = fail.repairs?.slice().reverse().find((r: any) => r.note);
                      const latestRepairWithParts = fail.repairs?.slice().reverse().find((r: any) => r.parts_used);

                      return (
                        <div key={fail.failure_id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 text-xs">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <span className="font-bold text-gray-900 text-xs">YC #{fail.failure_id}</span>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="px-2 py-0.5 bg-primary-50 text-primary-700 font-bold rounded border border-primary-100 text-[10px] shrink-0">
                                  {fail.vehicle?.vehicle_code}
                                </span>
                                <span className="font-bold text-gray-700 text-[11px] truncate max-w-[140px]">
                                  {fail.vehicle?.vehicle_name}
                                </span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusClass}`}>
                              {statusText}
                            </span>
                          </div>

                          {(() => {
                            const parsed = parseDescription(fail.description);
                            return (
                              <div className="text-[11px] text-gray-600 bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 space-y-1.5 font-medium">
                                <p className="font-bold text-gray-800">{fail.category?.category_name}</p>
                                <p className="text-[10px] text-gray-700 font-semibold leading-normal">Mô tả: {parsed.mainDesc}</p>
                                {parsed.details['Tồn đọng từ'] && (
                                  <p className="text-[10px] text-orange-700 font-semibold">⏳ Tồn đọng từ: {parsed.details['Tồn đọng từ']}</p>
                                )}
                                {parsed.details['TG dừng'] && (
                                  <p className="text-[10px] text-red-600 font-semibold">⏱️ Thời gian dừng: {parsed.details['TG dừng']}</p>
                                )}
                                {parsed.details['Ghi chú'] && (
                                  <p className="text-[10px] text-gray-500 font-medium italic">Ghi chú: {parsed.details['Ghi chú']}</p>
                                )}
                                {parsed.details['Đề nghị'] && (
                                  <p className="text-[10px] text-primary-700 font-semibold">Đề nghị: {parsed.details['Đề nghị']}</p>
                                )}
                                {latestRepairWithNote?.note && (
                                  <p className="text-[10px] text-green-700 bg-green-50/80 px-2 py-0.5 rounded border border-green-200/50 font-semibold mt-1 inline-block">
                                    🔧 Khắc phục: {latestRepairWithNote.note}
                                  </p>
                                )}
                                {latestRepairWithParts?.parts_used && (
                                  <p className="text-[10px] text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/50 font-semibold mt-1 block">
                                    📦 Phụ tùng: {latestRepairWithParts.parts_used}
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 border-t border-b border-gray-100 py-2 font-semibold">
                            <div>
                              <span className="text-[8px] text-gray-400 block uppercase">Người báo</span>
                              <span className="text-gray-700 block truncate">{fail.creator?.full_name}</span>
                            </div>
                            <div>
                              <span className="text-[8px] text-gray-400 block uppercase">Người sửa</span>
                              <span className="text-gray-700 block truncate">{currentRepair?.mechanic?.full_name || '---'}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            <span className="text-[9px] text-gray-400 font-medium">
                              Báo: {parseUTCDate(fail.failure_time)?.toLocaleDateString('vi-VN')}
                            </span>
                            <div className="flex space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenDetailModal(fail)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Chi tiết</span>
                              </button>

                              {(currentUser?.role_rel?.role_name === 'ADMIN' || currentUser?.role_rel?.permissions?.some((p: any) => p.permission_key === 'admin:all')) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(fail)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 border border-amber-100"
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                  <span>Sửa</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
            <Pagination
              currentPage={historyPage}
              totalPages={Math.ceil(getFilteredHistory().length / ITEMS_PER_PAGE_HISTORY)}
              totalItems={getFilteredHistory().length}
              itemsPerPage={ITEMS_PER_PAGE_HISTORY}
              onPageChange={(page) => setHistoryPage(page)}
            />
          </div>
        )}
      </div>
    </div>

    {/* ================================================================= */}
      {/* 1. MODAL: CHI TIẾT SỰ CỐ & TIMELINE */}
      {/* ================================================================= */}
      {showDetailModal && selectedFailure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Hồ sơ sự cố #{selectedFailure.failure_id}</h3>
              <button type="button" onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto text-xs">
              {(() => {
                const parsed = parseDescription(selectedFailure.description);
                return (
                  <div className="space-y-2.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p>Phương tiện: <strong>{selectedFailure.vehicle?.vehicle_name} ({selectedFailure.vehicle?.vehicle_code})</strong></p>
                    <p>Hạng mục hỏng hóc: <strong>{selectedFailure.category?.category_name}</strong></p>
                    <p>Mô tả sự cố: <strong className="text-gray-800 font-bold">{parsed.mainDesc}</strong></p>
                    {parsed.details['Chi tiết'] && <p>Mô tả chi tiết: <strong className="text-gray-800 font-bold">{parsed.details['Chi tiết']}</strong></p>}
                    
                    <p>Thời gian dừng máy: <strong className={parsed.details['TG dừng'] ? "text-red-600" : "text-gray-600"}>{parsed.details['TG dừng'] || "Không dừng máy"}</strong></p>
                    
                    <p>Trạng thái tồn đọng: <strong className={parsed.details['Tồn đọng từ'] ? "text-orange-600" : "text-gray-600"}>
                      {parsed.details['Tồn đọng từ'] ? `Có (Từ ngày ${parsed.details['Tồn đọng từ']})` : "Không"}
                    </strong></p>
                    
                    {parsed.details['Ghi chú'] && <p>Ghi chú kỹ thuật: <strong className="text-gray-700 font-bold">{parsed.details['Ghi chú']}</strong></p>}
                    {parsed.details['Đề nghị'] && <p>Đề nghị / Kiến nghị: <strong className="text-primary-700 font-bold">{parsed.details['Đề nghị']}</strong></p>}
                    
                    <p>Mức độ ưu tiên: <strong className={
                      selectedFailure.severity === 'dangerous' ? 'text-red-600' : selectedFailure.severity === 'heavy' ? 'text-orange-600' : 'text-yellow-600'
                    }>
                      {selectedFailure.severity === 'dangerous' ? 'Nguy hiểm (Dừng máy ngay)' : selectedFailure.severity === 'heavy' ? 'Nặng (Vào bãi sửa)' : 'Nhẹ (Theo dõi thêm)'}
                    </strong></p>
                    <p>Người báo cáo: <strong>{selectedFailure.creator?.full_name || selectedFailure.created_by}</strong> {selectedFailure.creator?.department ? `(${selectedFailure.creator.department})` : ''}</p>
                    <p>Thời điểm báo: <strong>{parseUTCDate(selectedFailure.failure_time)?.toLocaleString('vi-VN')}</strong></p>
                  </div>
                );
              })()}

              {/* Photo attachments list */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                  <Camera className="h-4 w-4" />
                  <span>Hình ảnh đính kèm hiện trạng ({selectedFailure.attachments?.length || 0})</span>
                </h4>
                
                {(!selectedFailure.attachments || selectedFailure.attachments.length === 0) ? (
                  <div className="p-4 bg-gray-50 rounded-xl border text-center text-gray-400 italic">
                    Chưa đính kèm ảnh thực tế.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedFailure.attachments.map((att: any) => (
                      <div key={att.attachment_id} className="relative group overflow-hidden rounded-xl border border-gray-200 bg-black">
                        <img 
                          src={getAttachmentUrl(att.file_path)} 
                          alt="Ảnh sự cố" 
                          className="h-28 w-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1 text-[8px] text-center">
                          Tải lên: {parseUTCDate(att.uploaded_at)?.toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Section */}
                <div className="p-4 bg-primary-50/50 border border-primary-100 rounded-xl flex items-center space-x-4">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleUploadPhoto}
                    disabled={!selectedFile || uploading}
                    className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-lg transition disabled:opacity-50 text-[10px]"
                  >
                    {uploading ? 'Đang tải...' : 'Upload ảnh'}
                  </button>
                </div>
              </div>

              {/* Lịch sử cập nhật / Nhật ký sửa chữa */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                  <History className="h-4 w-4 text-primary-600" />
                  <span>Lịch sử sửa chữa & cập nhật ({selectedFailure.repairs?.length || 0})</span>
                </h4>
                
                {(!selectedFailure.repairs || selectedFailure.repairs.length === 0) ? (
                  <div className="p-4 bg-gray-50 rounded-xl border text-center text-gray-400 italic">
                    Chưa ghi nhận tiến trình sửa chữa nào.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {selectedFailure.repairs.map((rep: any) => (
                      <div key={rep.repair_id} className="pl-6 relative">
                        {/* Timeline bullet */}
                        <span className={`absolute left-1 top-1.5 h-3.5 w-3.5 rounded-full border-4 border-white flex items-center justify-center ${
                          rep.repair_status === 'done'
                            ? 'bg-green-500 shadow-green-200 shadow'
                            : rep.repair_status === 'cancelled'
                              ? 'bg-gray-500 shadow-gray-200 shadow'
                              : rep.repair_status === 'rejected'
                                ? 'bg-red-500 shadow-red-200 shadow'
                                : rep.repair_end
                                  ? 'bg-blue-500 shadow-blue-200 shadow'
                                  : 'bg-yellow-500 shadow-yellow-200 shadow animate-pulse'
                        }`} />
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800">
                              {rep.repair_status === 'done' 
                                ? '✓ Đã sửa xong' 
                                : rep.repair_status === 'cancelled'
                                  ? '✗ Đã hủy'
                                  : rep.repair_status === 'rejected'
                                    ? '↩️ Yêu cầu sửa lại'
                                    : rep.repair_end
                                      ? '📝 Cập nhật tiến độ'
                                      : '⚡ Đang xử lý'}
                            </span>
                            <span className="text-[9px] text-gray-400 font-semibold">
                              {rep.repair_end 
                                ? `${parseUTCDate(rep.repair_start)?.toLocaleString('vi-VN')} - ${parseUTCDate(rep.repair_end)?.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`
                                : parseUTCDate(rep.repair_start)?.toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600">
                            Người sửa: <strong>{rep.mechanic?.full_name || rep.mechanic_id}</strong> {rep.mechanic?.department ? `(${rep.mechanic.department})` : ''}
                          </p>
                          {rep.parts_used && (
                            <p className="text-[10px] text-primary-700 font-bold mt-0.5">
                              🔧 Vật tư đã dùng: {rep.parts_used}
                            </p>
                          )}
                          {rep.note && (() => {
                            const parsedNote = parseDescription(rep.note);
                            return (
                              <p className="text-[10px] text-gray-500 italic mt-0.5">
                                Ghi chú kỹ thuật: "{parsedNote.mainDesc}"
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0 flex justify-between space-x-3">
              {(() => {
                if (selectedFailure.is_repaired) {
                  return (
                    <span className="text-xs text-green-700 bg-green-50 px-3.5 py-2.5 rounded-xl border border-green-200/50 font-bold flex items-center">
                      ✓ Sự cố đã khắc phục xong
                    </span>
                  );
                }
                
                const linkedRepair = getLinkedRepair(selectedFailure.failure_id);
                const isAssignedToMeOrAdmin = !linkedRepair || (linkedRepair.mechanic_id === currentUser?.operator_id || currentUser?.role_rel?.role_name === 'ADMIN' || currentUser?.role_rel?.role_name === 'QUẢN LÍ ĐỘI');
                
                if (isAssignedToMeOrAdmin) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleStartRepair(selectedFailure.failure_id)}
                      className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl"
                    >
                      {linkedRepair ? 'TIẾP TỤC SỬA' : 'NHẬN SỬA'}
                    </button>
                  );
                } else {
                  return (
                    <span className="text-xs text-gray-400 font-bold italic flex items-center bg-gray-150 px-3.5 py-2 rounded-xl border border-gray-250/20">
                      🔒 Được giao cho thợ khác
                    </span>
                  );
                }
              })()}
              {/* OLD BUTTON BLOCK REMOVED FOR REPAIRED HIDING */}
              {/*
                const linkedRepair = getLinkedRepair(selectedFailure.failure_id);
                const isAssignedToMeOrAdmin = !linkedRepair || (linkedRepair.mechanic_id === currentUser?.operator_id || currentUser?.role_rel?.role_name === 'ADMIN' || currentUser?.role_rel?.role_name === 'QUẢN LÍ ĐỘI');
                
                if (isAssignedToMeOrAdmin) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleStartRepair(selectedFailure.failure_id)}
                      className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl"
                    >
                      {linkedRepair ? 'TIẾP TỤC SỬA' : 'NHẬN SỬA'}
                    </button>
                  );
                } else {
                  return (
                    <span className="text-xs text-gray-400 font-bold italic flex items-center bg-gray-150 px-3.5 py-2 rounded-xl border border-gray-250/20">
                      🔒 Được giao cho thợ khác
                    </span>
                  );
                }
              })()}
*/}
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl"
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. MODAL: CẬP NHẬT KẾT THÚC SỬA CHỮA */}
      {/* ================================================================= */}
      {showEndRepairModal && activeRepair && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Cập nhật hồ sơ sửa chữa</h3>
              <button type="button" onClick={() => setShowEndRepairModal(false)} className="text-white/80 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleEndRepairSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Trạng thái bảo trì *</label>
                <select
                  value={repairStatus}
                  onChange={(e) => setRepairStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                  required
                >
                  <option value="done">Hoàn thành (Đưa xe hoạt động lại)</option>
                  <option value="in_progress">Chưa xong (Đang sửa chữa tiếp)</option>
                  <option value="rejected">Không sửa được (Yêu cầu quay lại chờ tiếp nhận)</option>
                  <option value="cancelled">Báo nhầm / Hủy bỏ yêu cầu (Sự cố không tồn tại)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vật tư / Phụ tùng sử dụng</label>
                <input
                  type="text"
                  placeholder="Má phanh, gioăng cao su, dây cáp..."
                  value={partsUsed}
                  onChange={(e) => setPartsUsed(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Ghi chú chi tiết khắc phục {repairStatus !== 'in_progress' && '*'}
                </label>
                <textarea
                  placeholder={
                    repairStatus === 'rejected' 
                      ? 'Nhập cụ thể lý do không sửa được (ví dụ: Thiếu ống thủy lực D32, phải đặt hàng)... *' 
                      : repairStatus === 'cancelled' 
                        ? 'Nhập lý do hủy bỏ yêu cầu (ví dụ: báo nhầm, xe tự hết lỗi)... *' 
                        : 'Đã căn chỉnh lại ốc vít, chêm dầu thủy lực...'
                  }
                  value={repairNote}
                  onChange={(e) => setRepairNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl h-20"
                  required={repairStatus !== 'in_progress'}
                />
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEndRepairModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  LƯU TIẾN TRÌNH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. MODAL: GIAO VIỆC (ASSIGN TASK) */}
      {/* ================================================================= */}
      {showAssignModal && assigningFailureId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Phân công sửa chữa</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Chọn nhân viên kỹ thuật thực hiện *</label>
                <select
                  value={selectedMechanicId}
                  onChange={(e) => setSelectedMechanicId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                  required
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {assignableOperators.map(op => (
                    <option key={op.operator_id} value={op.operator_id}>
                      {op.operator_id} - {op.full_name} ({op.role_rel?.description || 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  XÁC NHẬN GIAO VIỆC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3.5. MODAL: CHỈNH SỬA SỰ CỐ (ADMIN EDIT MODAL) */}
      {/* ================================================================= */}
      {showEditModal && editingFailure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Hiệu chỉnh thông tin sự cố & sửa chữa</span>
              </h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-white/80 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-1.5 uppercase text-[10px] tracking-wider font-extrabold">Thông tin sự cố</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thời điểm báo sự cố *</label>
                    <input
                      type="datetime-local"
                      value={editFailureTime}
                      onChange={(e) => setEditFailureTime(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mức độ nghiêm trọng *</label>
                    <select
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                      required
                    >
                      <option value="light">Nhẹ (Theo dõi thêm)</option>
                      <option value="heavy">Nặng (Hư hỏng lớn)</option>
                      <option value="dangerous">Nguy hiểm (Dừng hoạt động)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mô tả sự cố & thông số (Downtime/Tồn đọng) *</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    placeholder="Mô tả sự cố..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-1.5 uppercase text-[10px] tracking-wider font-extrabold">Thông tin bảo trì & sửa chữa</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thợ sửa chữa chịu trách nhiệm</label>
                    <select
                      value={editMechanicId}
                      onChange={(e) => setEditMechanicId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    >
                      <option value="">-- Chọn kỹ thuật viên --</option>
                      {assignableOperators.map(op => (
                        <option key={op.operator_id} value={op.operator_id}>
                          {op.operator_id} - {op.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trạng thái sửa chữa</label>
                    <select
                      value={editRepairStatus}
                      onChange={(e) => setEditRepairStatus(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    >
                      <option value="pending">Chờ tiếp nhận (Pending)</option>
                      <option value="in_progress">Đang sửa chữa (In progress)</option>
                      <option value="done">Đã hoàn thành (Done)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thời điểm bắt đầu sửa</label>
                    <input
                      type="datetime-local"
                      value={editRepairStart}
                      onChange={(e) => setEditRepairStart(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thời điểm hoàn thành sửa</label>
                    <input
                      type="datetime-local"
                      value={editRepairEnd}
                      onChange={(e) => setEditRepairEnd(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú sửa chữa (Vật tư sử dụng/Nguyên nhân)</label>
                  <textarea
                    rows={2}
                    value={editRepairNote}
                    onChange={(e) => setEditRepairNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                    placeholder="Vật tư, linh kiện thay thế, lý do dừng sửa..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-bold rounded-xl transition shadow-md"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. MODAL: THÔNG BÁO HỆ THỐNG (CUSTOM TOAST / NOTIFICATION DIALOG) */}
      {/* ================================================================= */}
      {notification.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50">
              {notification.type === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : notification.type === 'warning' ? (
                <AlertTriangle className="h-6 w-6 text-orange-600 animate-pulse" />
              ) : (
                <Wrench className="h-6 w-6 text-blue-600" />
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
    </>
  );
};
export default Repairs;
