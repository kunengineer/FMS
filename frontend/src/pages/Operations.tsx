import React, { useEffect, useState } from 'react';
import { 
  ClipboardList, Plus, Search, CheckCircle, 
  AlertOctagon, HelpCircle, Check,
  Camera, Eye, Lock, RefreshCw, X, ShieldCheck,
  AlertTriangle, Wrench
} from 'lucide-react';
import { 
  operationService, vehicleService, authService, 
  adminService, failureService 
} from '../utils/api';
import { SignaturePad } from '../components/SignaturePad';

// Client-side UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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

export const parseNotes = (notes: string) => {
  if (!notes) return { cleanNotes: '', details: {} as Record<string, string> };
  
  let cleanNotes = notes.replace(/^\[Weekly Report\]\s*/i, '').trim();
  const parsed = parseDescription(cleanNotes);
  return {
    cleanNotes: parsed.mainDesc,
    details: parsed.details
  };
};

const getDurationString = (startStr: string, endStr: string | null) => {
  if (!startStr || !endStr) return '';
  try {
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMin < 0) diffMin += 24 * 60; // handle cross-midnight
    if (diffMin <= 0) return '';
    if (diffMin >= 60) {
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      return mins > 0 ? `(${hours}h${mins}m)` : `(${hours}h)`;
    }
    return `(${diffMin} phút)`;
  } catch (e) {
    return '';
  }
};

const formatTimeString = (timeStr: string | null | undefined) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hr = parts[0].slice(-2).padStart(2, '0');
    const min = parts[1].slice(0, 2).padStart(2, '0');
    return `${hr}:${min}`;
  }
  return timeStr;
};

export const Operations: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Lists
  const [logs, setLogs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [failureCategories, setFailureCategories] = useState<any[]>([]);
  
  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Action Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeLog, setActiveLog] = useState<any>(null);

  // Filter params
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State: START OPERATION
  const [idempotencyKey, setIdempotencyKey] = useState(generateUUID());
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedVehicleStatus, setSelectedVehicleStatus] = useState<string>('active');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [startHour, setStartHour] = useState(new Date().toTimeString().slice(0, 8));
  const [hourmeterStart, setHourmeterStart] = useState<number | ''>('');
  const [conditionBefore, setConditionBefore] = useState<'ok' | 'broken'>('ok');
  
  // Handover warning triggers
  const [requiresHandoverAck, setRequiresHandoverAck] = useState(false);
  const [handoverFailures, setHandoverFailures] = useState<any[]>([]);
  const [acknowledgedPreviousFailure, setAcknowledgedPreviousFailure] = useState(false);
  
  // Checklists answers
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, { result: boolean; note: string }>>({});
  
  // Failure submission (if start with broken or during shift)
  const [selectedFailureCatId, setSelectedFailureCatId] = useState('');
  const [failureDesc, setFailureDesc] = useState('');
  const [failureSeverity, setFailureSeverity] = useState('light');
  
  // Safety and Signature
  const [isSafetyConfirmed, setIsSafetyConfirmed] = useState(false);
  const [safetyReason, setSafetyReason] = useState('');
  const [unsafetyReason, setUnsafetyReason] = useState('');
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [workType, setWorkType] = useState<'production' | 'repair'>('production');
  const [isRepairDone, setIsRepairDone] = useState<boolean>(true);
  const [repairPartsUsed, setRepairPartsUsed] = useState<string>('');
  const [repairNoteText, setRepairNoteText] = useState<string>('');
  const [startNotes, setStartNotes] = useState('');

  // Checklist evaluation computed properties
  const failedItems = checklists.filter(item => checklistAnswers[item.checklist_id]?.result === false);
  const hasDangerousFailure = failedItems.some(item => item.severity === 'dangerous');
  const hasLightFailure = failedItems.length > 0 && !hasDangerousFailure;
  const allChecklistsOk = failedItems.length === 0;

  // Form State: END OPERATION
  const [hourmeterEnd, setHourmeterEnd] = useState<number | ''>('');
  const [endHour, setEndHour] = useState(new Date().toTimeString().slice(0, 8));
  const [isEndHourModified, setIsEndHourModified] = useState(false);
  const [endNotes, setEndNotes] = useState('');

  // Active during-shift failure report
  const [showDuringShiftFailureModal, setShowDuringShiftFailureModal] = useState(false);
  const [duringShiftFailureLog, setDuringShiftFailureLog] = useState<any>(null);
  const [repairedInShift, setRepairedInShift] = useState(false);
  const [partsUsed, setPartsUsed] = useState('');
  const [repairNote, setRepairNote] = useState('');
  
  // Success states
  const [showFailureSuccessModal, setShowFailureSuccessModal] = useState(false);
  const [lastReportedFailure, setLastReportedFailure] = useState<any>(null);

  // Custom Toast Notification Modal
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'info' | 'danger';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showToast = (title: string, message: string, type: 'success' | 'warning' | 'info' | 'danger' = 'success') => {
    setNotification({ show: true, title, message, type });
  };

  // Form State: DURING SHIFT FAILURE (Bản chuẩn)
  const [failureTimeStr, setFailureTimeStr] = useState('');
  const [repairOption, setRepairOption] = useState<'repaired_done' | 'repaired_pending' | 'repaired_none'>('repaired_none');
  const [repairStartStr, setRepairStartStr] = useState('');
  const [repairEndStr, setRepairEndStr] = useState('');

  useEffect(() => {
    const initData = async () => {
      try {
        const [me, shs, cats] = await Promise.all([
          authService.me(),
          adminService.listShifts(),
          adminService.listFailureCategories()
        ]);
        setCurrentUser(me);
        setShifts(shs);
        setFailureCategories(cats);
        await reloadLogs();
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải thông tin khởi tạo');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Dynamic clock effect when open shift modal is open
  useEffect(() => {
    if (!showStartModal) return;

    const updateClock = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const timeStr = now.toTimeString().slice(0, 8); // "HH:MM:SS" (chạy động)
      const dateStr = now.toISOString().slice(0, 10);
      
      setStartHour(timeStr);
      setWorkDate(dateStr);
      
      // Update selectedShiftId dynamically based on the running clock
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const prepWindow = 30; 
      let matchedShiftId = '';
      
      const shiftSlots = shifts.map(s => {
        const [sh, sm] = s.start_time.split(':').map(Number);
        let [eh, em] = s.end_time.split(':').map(Number);
        const startMin = sh * 60 + sm;
        let endMin = eh * 60 + em;
        if (endMin === 0) endMin = 1440;
        return { shiftId: s.shift_id.toString(), startMinutes: startMin, endMinutes: endMin };
      });
      
      for (const slot of shiftSlots) {
        let isInside = false;
        let startPrep = slot.startMinutes - prepWindow;
        let endPrep = slot.endMinutes - prepWindow;
        if (startPrep < 0) startPrep += 1440;
        if (endPrep < 0) endPrep += 1440;
        
        if (startPrep < endPrep) {
          if (currentTotalMinutes >= startPrep && currentTotalMinutes < endPrep) isInside = true;
        } else {
          if (currentTotalMinutes >= startPrep || currentTotalMinutes < endPrep) isInside = true;
        }
        if (isInside) {
          matchedShiftId = slot.shiftId;
          break;
        }
      }
      
      if (!matchedShiftId && shifts.length > 0) {
        matchedShiftId = shifts[0].shift_id.toString();
      }
      
      if (matchedShiftId) {
        setSelectedShiftId(matchedShiftId);
      }
    };

    updateClock(); // Run immediately
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, [showStartModal, shifts]);

  // Dynamic clock effect when end shift modal is open (until modified by user)
  useEffect(() => {
    if (!showEndModal || isEndHourModified) return;

    const updateClock = () => {
      const now = new Date();
      setEndHour(now.toTimeString().slice(0, 8)); // HH:MM:SS (chạy động)
    };

    updateClock(); // Run immediately
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, [showEndModal, isEndHourModified]);

  useEffect(() => {
    if (showStartModal) {
      if (hasDangerousFailure) {
        setWorkType('repair');
        setIsSafetyConfirmed(false);
      } else {
        setWorkType('production');
        setIsSafetyConfirmed(true);
      }
    }
  }, [hasDangerousFailure, showStartModal]);

  const reloadLogs = async () => {
    try {
      const data = await operationService.list({
        vehicle_id: filterVehicle || undefined,
        work_date: filterDate || undefined
      });
      setLogs(data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải lịch sử ca');
    }
  };

  const getAutoShiftAndHour = (shiftsList: any[]) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeStr = now.toTimeString().slice(0, 8); // "HH:MM:SS" (thêm giây)
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // Allow a 30-minute preparation window before a shift starts.
    const prepWindow = 30; 
    let matchedShiftId = '';
    
    const shiftSlots = shiftsList.map(s => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      let [eh, em] = s.end_time.split(':').map(Number);
      
      const startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      
      // Represent 00:00:00 as 1440 (24:00) to allow clean range checks
      if (endMin === 0) {
        endMin = 1440;
      }
      
      return {
        shiftId: s.shift_id.toString(),
        startMinutes: startMin,
        endMinutes: endMin
      };
    });
    
    for (const slot of shiftSlots) {
      let isInside = false;
      let startPrep = slot.startMinutes - prepWindow;
      let endPrep = slot.endMinutes - prepWindow;
      
      // Wrap around 24 hours (1440 minutes)
      if (startPrep < 0) {
        startPrep += 1440;
      }
      if (endPrep < 0) {
        endPrep += 1440;
      }
      
      if (startPrep < endPrep) {
        if (currentTotalMinutes >= startPrep && currentTotalMinutes < endPrep) {
          isInside = true;
        }
      } else {
        if (currentTotalMinutes >= startPrep || currentTotalMinutes < endPrep) {
          isInside = true;
        }
      }
      
      if (isInside) {
        matchedShiftId = slot.shiftId;
        break;
      }
    }
    
    if (!matchedShiftId && shiftsList.length > 0) {
      matchedShiftId = shiftsList[0].shift_id.toString();
    }
    
    return {
      shiftId: matchedShiftId,
      timeStr: timeStr,
      dateStr: now.toISOString().slice(0, 10)
    };
  };

  const handleOpenStartModal = async () => {
    setIdempotencyKey(generateUUID());
    setSelectedVehicleId('');
    setSelectedVehicleStatus('active');
    
    // Automatically set shift, date, and hour
    const autoVals = getAutoShiftAndHour(shifts);
    setSelectedShiftId(autoVals.shiftId);
    setWorkDate(autoVals.dateStr);
    setStartHour(autoVals.timeStr);
    
    setHourmeterStart('');
    setConditionBefore('ok');
    setRequiresHandoverAck(false);
    setHandoverFailures([]);
    setAcknowledgedPreviousFailure(false);
    setChecklistAnswers({});
    setIsSafetyConfirmed(false);
    setSafetyReason('');
    setUnsafetyReason('');
    setShowSafetyWarning(false);
    setSignatureData(null);
    setStartNotes('');
    
    try {
      // Fetch vehicles (keep all to display disabled locked status)
      const listVehicles = await vehicleService.list();
      setVehicles(listVehicles);
      setShowStartModal(true);
    } catch (err: any) {
      showToast('Lỗi', 'Không thể tải danh sách phương tiện: ' + err.message, 'warning');
    }
  };

  // Trigger when selected vehicle changes in wizard
  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedVehicleStatus('active');
      return;
    }
    const vehicle = vehicles.find(v => v.vehicle_id && selectedVehicleId && v.vehicle_id.toString().toLowerCase() === selectedVehicleId.toString().toLowerCase());
    if (vehicle) {
      setSelectedVehicleStatus(vehicle.status);
      setHourmeterStart(parseFloat(vehicle.current_hourmeter));
      
      if (vehicle.status !== 'active') {
        const statusText = vehicle.status === 'repairing' ? 'Đang sửa chữa' : 'Ngưng hoạt động';
        showToast(
          '⚠️ Thiết bị đang bị khóa',
          `Xe ${vehicle.vehicle_code} đang ở trạng thái "${statusText}". Không thể thực hiện mở ca sản xuất bình thường.`,
          'danger'
        );
      }
      
      // Load checklist for this vehicle type if active
      if (vehicle.status === 'active') {
        operationService.listChecklists(vehicle.vehicle_type_id)
          .then(items => {
            setChecklists(items);
            const initialAnswers: Record<number, { result: boolean; note: string }> = {};
            items.forEach((it: any) => {
              initialAnswers[it.checklist_id] = { result: true, note: '' };
            });
            setChecklistAnswers(initialAnswers);
          });
      }

      // Reset handover warnings
      setRequiresHandoverAck(false);
      setHandoverFailures([]);
      setAcknowledgedPreviousFailure(false);
    }
  }, [selectedVehicleId, vehicles]);

  // Handle start shift submit
  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (selectedVehicleStatus !== 'active') {
      showToast(
        '⚠️ Thiết bị đang bị khóa',
        'Không thể mở ca cho phương tiện đang sửa chữa hoặc ngưng hoạt động.',
        'danger'
      );
      return;
    }
    if (!selectedVehicleId || !selectedShiftId || hourmeterStart === '' || !currentUser) {
      showToast('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường bắt buộc.', 'warning');
      return;
    }

    const vehicleCode = vehicles.find(v => v.vehicle_id && selectedVehicleId && v.vehicle_id.toString().toLowerCase() === selectedVehicleId.toString().toLowerCase())?.vehicle_code || 'phương tiện';

    const checklistFailures = Object.entries(checklistAnswers)
      .filter(([_, ans]) => ans.result === false)
      .map(([id, ans]) => ({
        checklist_id: parseInt(id),
        name: checklists.find(c => c.checklist_id === parseInt(id))?.item_name || 'Hạng mục kiểm tra',
        note: ans.note
      }));

    const isBroken = conditionBefore === 'broken';
    const failedItems = checklists.filter(item => checklistAnswers[item.checklist_id]?.result === false);
    const hasDangerousFailure = failedItems.some(item => item.severity === 'dangerous');
    const hasLightFailure = failedItems.length > 0 && !hasDangerousFailure;

    if (isBroken) {
      if (!selectedFailureCatId || !failureDesc) {
        showToast('Thiếu thông tin', 'Vui lòng điền thông tin sự cố hư hỏng.', 'warning');
        return;
      }
    } else {
      // If there are checklist failures, require details notes
      const missingNotes = checklistFailures.some(f => !f.note.trim());
      if (missingNotes) {
        showToast('Thiếu thông tin', 'Vui lòng nhập mô tả cụ thể cho tất cả các hạng mục Không Đạt.', 'warning');
        return;
      }

      if (workType === 'repair') {
        if (!unsafetyReason.trim()) {
          showToast('Thiếu lý do', 'Vui lòng nhập mô tả sự cố hư hỏng cần sửa chữa.', 'warning');
          return;
        }
      } else if (hasDangerousFailure) {
        if (!unsafetyReason.trim()) {
          showToast('Thiếu lý do báo hỏng', 'Vui lòng nhập lý do cụ thể và báo cáo khóa xe.', 'warning');
          return;
        }
      } else {
        if (isSafetyConfirmed) {
          if (hasLightFailure && !safetyReason.trim()) {
            showToast('Thiếu lý do', 'Vui lòng nhập lý do vẫn đảm bảo an toàn dù có lỗi nhẹ.', 'warning');
            return;
          }
          if (!signatureData) {
            showToast('Chưa ký tên', 'Bạn phải ký tên xác nhận trước khi mở ca.', 'warning');
            return;
          }
        } else {
          if (!unsafetyReason.trim()) {
            showToast('Thiếu lý do báo hỏng', 'Vui lòng nhập lý do báo hỏng và khóa xe.', 'warning');
            return;
          }
        }
      }
    }

    // Determine condition_before_shift:
    const finalConditionBefore = (workType === 'repair' || isBroken || !isSafetyConfirmed || hasDangerousFailure) ? 'broken' : 'ok';

    // Prepare checklist payload
    const checklistPayload = Object.entries(checklistAnswers).map(([id, val]) => ({
      checklist_id: parseInt(id),
      result: val.result,
      note: val.note
    }));

    const payload = {
      vehicle_id: selectedVehicleId,
      operator_id: currentUser.operator_id,
      shift_id: parseInt(selectedShiftId),
      work_date: workDate,
      start_hour: startHour.split(':').length === 3 ? startHour : startHour + ':00',
      hourmeter_start: parseFloat(hourmeterStart.toString()),
      condition_before_shift: finalConditionBefore,
      is_safety_confirmed: finalConditionBefore === 'ok' ? isSafetyConfirmed : false,
      safety_reason: finalConditionBefore === 'ok' && hasLightFailure ? safetyReason : null,
      signature_data: finalConditionBefore === 'ok' ? signatureData : null,
      acknowledged_previous_failure: acknowledgedPreviousFailure,
      acknowledged_by: acknowledgedPreviousFailure ? currentUser.operator_id : null,
      idempotency_key: idempotencyKey,
      notes: startNotes,
      checklist_results: checklistPayload,
      work_type: workType
    };

    try {
      setSubmitting(true);
      setError(null);
      // 1. Always create the shift operation log first so it is recorded in the database
      const db_op = await operationService.start(payload);
      const op_id = db_op.operation_id;

      // 2. Report failures if broken
      if (finalConditionBefore === 'broken') {
        if (conditionBefore === 'broken') {
          await failureService.reportBeforeShift({
            vehicle_id: selectedVehicleId,
            category_id: parseInt(selectedFailureCatId),
            description: failureDesc,
            severity: failureSeverity,
            operation_id: op_id
          });
        } else {
          // Checklist failure causing broken status
          const defaultCatId = failureCategories[0]?.category_id || 1;
          const severityText = hasDangerousFailure ? 'dangerous' : 'heavy';
          
          await failureService.reportBeforeShift({
            vehicle_id: selectedVehicleId,
            category_id: defaultCatId,
            description: workType === 'repair' ? `Yêu cầu sửa chữa trước ca: ${unsafetyReason}` : `Báo hỏng do checklist không đạt: ${unsafetyReason}`,
            severity: severityText,
            operation_id: op_id
          });

          for (const fail of checklistFailures) {
            await failureService.reportBeforeShift({
              vehicle_id: selectedVehicleId,
              category_id: defaultCatId,
              description: `[Checklist Không Đạt] Hạng mục: ${fail.name}. Chi tiết: ${fail.note}`,
              severity: severityText,
              operation_id: op_id
            });
          }
        }
        showToast('⚠️ Đã ghi nhận sự cố - Xe tạm dừng sản xuất', `Xe ${vehicleCode} đã được chuyển sang trạng thái Đang sửa chữa và bị khóa sản xuất. Vui lòng kiểm tra danh sách sửa chữa để xử lý tiếp.`, 'danger');
      } else {
        // Standard success path
        showToast('✅ Mở ca thành công', 'Ca làm việc của bạn đã được ghi nhận. Xe đã sẵn sàng vận hành.', 'success');
      }

      setShowStartModal(false);
      await reloadLogs();
    } catch (err: any) {
      // Check if it is a handover warning error
      try {
        const errorJson = JSON.parse(err.message);
        if (errorJson.error_code === 'HANDOVER_ACKNOWLEDGEMENT_REQUIRED') {
          setRequiresHandoverAck(true);
          setHandoverFailures(errorJson.failures);
          return;
        }
      } catch (e) {
        // Not JSON
      }
      showToast('Lỗi', 'Không thể mở ca: ' + err.message, 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEndModal = (log: any) => {
    setActiveLog(log);
    setHourmeterEnd(parseFloat(log.hourmeter_start));
    setEndHour(new Date().toTimeString().slice(0, 8));
    setIsEndHourModified(false);
    setEndNotes('');
    setIsRepairDone(true);
    setRepairPartsUsed('');
    setRepairNoteText('');
    setShowEndModal(true);
  };

  const handleEndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLog || hourmeterEnd === '') return;

    if (parseFloat(hourmeterEnd.toString()) < parseFloat(activeLog.hourmeter_start)) {
      showToast('Sai lệch số giờ máy', 'Số giờ máy cuối ca không được nhỏ hơn số giờ đầu ca.', 'warning');
      return;
    }

    try {
      const payload: any = {
        hourmeter_end: parseFloat(hourmeterEnd.toString()),
        end_hour: isEndHourModified ? (endHour.split(':').length === 3 ? endHour : endHour + ':00') : new Date().toTimeString().slice(0, 8),
        notes: endNotes
      };
      
      if (activeLog.work_type === 'repair') {
        payload.is_repair_done = isRepairDone;
        payload.parts_used = repairPartsUsed;
        payload.repair_note = repairNoteText;
      }

      const updatedLog = await operationService.end(activeLog.operation_id, payload);
      setShowEndModal(false);
      
      const vehicleCode = updatedLog.vehicle?.vehicle_code || 'phương tiện';
      const hasUnresolved = updatedLog.failures?.some((f: any) => !f.is_repaired) || updatedLog.vehicle?.status === 'repairing';

      if (hasUnresolved && updatedLog.work_type !== 'repair') {
        showToast('⚠️ Kết thúc ca - Còn sự cố chưa xử lý', `Xe ${vehicleCode} đã chuyển sang trạng thái Đang sửa chữa. Ca sau sẽ không thể sử dụng xe này. Vui lòng kiểm tra danh sách sửa chữa.`, 'warning');
      } else if (updatedLog.work_type === 'repair' && hasUnresolved) {
        showToast('⚡ Kết thúc ca sửa chữa', `Đã kết thúc ca sửa chữa xe ${vehicleCode}. Sự cố chưa khắc phục xong, xe tiếp tục ở trạng thái Đang sửa chữa.`, 'warning');
      } else {
        showToast('✅ Kết thúc ca thành công', 'Ca làm việc của bạn đã kết thúc. Dữ liệu đã được lưu.', 'success');
      }
      
      await reloadLogs();
    } catch (err: any) {
      showToast('Lỗi', 'Không thể đóng ca: ' + err.message, 'warning');
    }
  };

  // Open details
  const handleOpenDetailModal = async (log: any) => {
    try {
      const details = await operationService.get(log.operation_id);
      setActiveLog(details);
      setShowDetailModal(true);
    } catch (err: any) {
      showToast('Lỗi', 'Không thể tải chi tiết: ' + err.message, 'warning');
    }
  };

  // Trigger reporting a failure during shift
  const handleOpenDuringShiftFailureModal = (log: any) => {
    setActiveLog(log);
    setSelectedFailureCatId('');
    setFailureDesc('');
    setFailureSeverity('light');
    setFailureTimeStr(new Date().toTimeString().slice(0, 5));
    setRepairOption('repaired_none');
    setRepairStartStr(new Date().toTimeString().slice(0, 5));
    setRepairEndStr(new Date().toTimeString().slice(0, 5));
    setPartsUsed('');
    setRepairNote('');
    setShowDuringShiftFailureModal(true);
  };

  const handleDuringShiftFailureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLog || !selectedFailureCatId || !failureDesc || !failureTimeStr) {
      showToast('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin sự cố.', 'warning');
      return;
    }

    const isRepaired = repairOption === 'repaired_done';

    // Validate times if repaired in shift
    if (isRepaired) {
      if (!repairStartStr || !repairEndStr) {
        showToast('Thiếu thông tin', 'Vui lòng điền thời gian bắt đầu và kết thúc sửa chữa.', 'warning');
        return;
      }
      if (repairEndStr <= repairStartStr) {
        showToast('Sai lệch thời gian', 'Thời gian kết thúc sửa chữa phải sau thời gian bắt đầu sửa chữa.', 'warning');
        return;
      }
    }

    try {
      await failureService.reportDuringShift({
        vehicle_id: activeLog.vehicle_id,
        category_id: parseInt(selectedFailureCatId),
        description: failureDesc,
        severity: failureSeverity,
        operation_id: activeLog.operation_id,
        repaired_in_shift: isRepaired,
        parts_used: isRepaired ? partsUsed : '',
        repair_note: isRepaired ? repairNote : '',
        failure_time_str: failureTimeStr,
        repair_start_str: isRepaired ? repairStartStr : '',
        repair_end_str: isRepaired ? repairEndStr : '',
        repair_option: repairOption
      });
      setShowDuringShiftFailureModal(false);
      
      // Store failure details for success modal
      setLastReportedFailure({
        category_name: failureCategories.find(c => c.category_id === parseInt(selectedFailureCatId))?.category_name,
        description: failureDesc,
        repaired_in_shift: isRepaired,
        severity: failureSeverity,
        vehicle_code: activeLog.vehicle?.vehicle_code
      });
      
      if (isRepaired) {
        showToast('🛠 Đã ghi nhận sự cố và xử lý xong', `Sự cố trên xe ${activeLog.vehicle?.vehicle_code || 'thiết bị'} đã được ghi nhận và sửa xong trong ca. Xe vẫn sẵn sàng vận hành.`, 'info');
      } else {
        showToast('⚠️ Đã báo cáo sự cố hư hỏng', `Sự cố trên xe ${activeLog.vehicle?.vehicle_code || 'thiết bị'} đã được ghi nhận và chuyển kỹ thuật viên bảo trì xử lý.`, 'warning');
      }
      
      setShowFailureSuccessModal(true);
      await reloadLogs();
    } catch (err: any) {
      showToast('Lỗi', 'Lỗi khi báo cáo sự cố: ' + err.message, 'warning');
    }
  };

  const getRepairCompletedNotification = () => {
    if (!currentUser) return null;
    const activeLog = logs.find(log => log.hourmeter_end === null && log.operator_id === currentUser.operator_id);
    if (!activeLog) return null;
    
    const hasFailures = activeLog.failures && activeLog.failures.length > 0;
    if (!hasFailures) return null;
    
    const allRepaired = activeLog.failures.every((f: any) => f.is_repaired);
    if (allRepaired) {
      let mechanicName = '';
      for (const f of activeLog.failures) {
        if (f.repairs && f.repairs.length > 0) {
          const doneRepair = f.repairs.find((r: any) => r.repair_status === 'done');
          if (doneRepair && doneRepair.mechanic) {
            mechanicName = doneRepair.mechanic.full_name;
            break;
          }
        }
      }
      return {
        vehicle_code: activeLog.vehicle?.vehicle_code,
        vehicle_id: activeLog.vehicle_id,
        mechanic_name: mechanicName
      };
    }
    return null;
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between space-y-3 xs:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật ký Ca làm việc</h1>
          <p className="text-sm text-gray-500 mt-1">Mở ca, bàn giao phương tiện, kiểm tra checklist an toàn & đóng ca</p>
        </div>
        <button
          onClick={handleOpenStartModal}
          className="xs:self-end px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white rounded-xl font-semibold shadow-md flex items-center justify-center space-x-2 text-sm focus:outline-none transition-all active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          <span>MỞ CA CHẠY XE</span>
        </button>
      </div>

      {/* Repair Completed Notification Banner */}
      {(() => {
        const repairNotif = getRepairCompletedNotification();
        if (repairNotif) {
          const activeLog = logs.find(log => log.hourmeter_end === null && log.operator_id === currentUser?.operator_id);
          return (
            <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl shadow-sm flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-lg">🔔</span>
                <span className="font-bold">
                  {activeLog?.work_type === 'repair'
                    ? `Phương tiện ${repairNotif.vehicle_code} đã được sửa chữa xong${repairNotif.mechanic_name ? ` bởi ${repairNotif.mechanic_name}` : ''}! Bạn có thể đóng ca sửa chữa hoặc tiếp tục bàn giao.`
                    : `Xe ${repairNotif.vehicle_code} đã được sửa xong${repairNotif.mechanic_name ? ` bởi ${repairNotif.mechanic_name}` : ''}! Bạn có thể tiếp tục sản xuất hoặc kết thúc ca.`}
                </span>
              </div>
              <button
                onClick={() => handleOpenEndModal(activeLog)}
                className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-[10px] transition shrink-0 ml-4 shadow-sm"
              >
                {activeLog?.work_type === 'repair' ? 'ĐÓNG CA SỬA CHỮA' : 'ĐÓNG CA'}
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-6 space-y-1">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tìm kiếm phương tiện</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo ID xe (UUID hoặc Mã xe)..."
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold"
            />
          </div>
        </div>
        <div className="sm:col-span-4 space-y-1">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ngày vận hành</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold"
          />
        </div>
        <button
          onClick={reloadLogs}
          className="sm:col-span-2 w-full py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-bold text-xs transition"
        >
          Lọc dữ liệu
        </button>
      </div>

      {/* HISTORIC LOG LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
        {/* Table for larger screens */}
        <div className="hidden md:block overflow-x-auto w-full max-w-full">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs table-fixed md:table-auto">
            <thead className="bg-gray-50/50 uppercase tracking-wider text-gray-500 font-bold">
              <tr>
                <th className="px-6 py-4 w-[110px] whitespace-nowrap">Ngày</th>
                <th className="px-6 py-4 min-w-[200px]">Phương tiện</th>
                <th className="px-6 py-4 min-w-[160px]">Người vận hành</th>
                <th className="px-6 py-4 w-[100px] whitespace-nowrap">Ca</th>
                <th className="px-6 py-4 w-[120px] whitespace-nowrap">Giờ máy</th>
                <th className="px-6 py-4 w-[140px] whitespace-nowrap">Tình trạng xe</th>
                <th className="px-6 py-4 text-center w-[180px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                    Chưa ghi nhận ca chạy xe nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log: any) => (
                  <tr key={log.operation_id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">
                      {new Date(log.work_date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-700 font-bold rounded border border-primary-100 whitespace-nowrap text-[10px] shrink-0">
                          {log.vehicle?.vehicle_code}
                        </span>
                        <span className="font-semibold text-gray-600 truncate max-w-[120px] md:max-w-[160px]" title={log.vehicle?.vehicle_name}>
                          {log.vehicle?.vehicle_name}
                        </span>
                      </div>
                      {log.failures && log.failures.length > 0 && (
                        <div className="mt-1 text-[10px] text-red-600 font-bold max-w-[240px] truncate" title={log.failures.map((f: any) => f.description).join(', ')}>
                          <span>{log.failures[0].description.toLowerCase().includes('bảo dưỡng') || log.failures[0].description.toLowerCase().includes('kiểm định') ? '🔧' : '⚠️'}</span>
                          <span className="ml-1 text-gray-700">{log.failures[0].description}</span>
                          {log.failures[0].repairs && log.failures[0].repairs.length > 0 && (
                            <span className="text-gray-400 font-semibold ml-1">
                              ({log.failures[0].repairs[0].mechanic?.full_name || 'Thợ'} 
                              {log.failures[0].repairs[0].repair_start && ` | ${parseUTCDate(log.failures[0].repairs[0].repair_start)?.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}-${parseUTCDate(log.failures[0].repairs[0].repair_end)?.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800 truncate max-w-[100px] md:max-w-[140px]" title={log.operator?.full_name}>
                        {log.operator?.full_name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{log.operator?.operator_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.shift?.shift_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.hourmeter_end !== null ? `${log.hourmeter_end}h` : `${log.hourmeter_start}h`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.work_type === 'repair' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Ca sửa chữa
                        </span>
                      ) : log.failures && log.failures.length > 0 ? (
                        log.failures.some((f: any) => !f.is_repaired) ? (
                          log.vehicle?.status === 'stopped_repair' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title="Ngưng sửa chữa">
                              Có sự cố (Ngưng sửa chữa)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border-orange-200" title="Phát sinh sự cố chưa sửa xong trong ca">
                              Có sự cố (Đang sửa)
                            </span>
                          )
                        ) : log.failures.every((f: any) => f.repairs?.some((r: any) => r.repair_status === 'cancelled')) ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200" title="Sự cố báo nhầm hoặc đã hủy bỏ, thiết bị đạt an toàn">
                            Đạt an toàn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title="Phát sinh sự cố đã sửa xong trong ca">
                            Có sự cố (Đã sửa)
                          </span>
                        )
                      ) : log.condition_before_shift === 'broken' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          Không đạt an toàn
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                          Đạt an toàn
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetailModal(log)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {log.hourmeter_end === null ? (
                          <>
                            {log.work_type === 'repair' ? (
                              currentUser?.operator_id === log.operator_id && (
                                <button
                                  onClick={() => handleOpenEndModal(log)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition"
                                >
                                  Đóng ca
                                </button>
                              )
                            ) : (
                              currentUser?.operator_id === log.operator_id && (
                                <>
                                  <button
                                    onClick={() => handleOpenDuringShiftFailureModal(log)}
                                    className="p-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg transition"
                                    title="Khai báo sự cố phát sinh"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEndModal(log)}
                                    className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-[10px] font-bold transition"
                                  >
                                    Đóng ca
                                  </button>
                                </>
                              )
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-semibold italic">Đã hoàn thành</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards view */}
        <div className="md:hidden p-4 space-y-3 bg-gray-50/30">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-gray-400 italic text-xs">
              Chưa ghi nhận ca chạy xe nào khớp với bộ lọc.
            </div>
          ) : (
            logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log: any) => {
              let statusBadge = null;
              if (log.work_type === 'repair') {
                statusBadge = <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Ca sửa chữa</span>;
              } else if (log.failures && log.failures.length > 0) {
                if (log.failures.some((f: any) => !f.is_repaired)) {
                  statusBadge = log.vehicle?.status === 'stopped_repair' ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Có sự cố (Ngưng sửa chữa)</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">Có sự cố (Đang sửa)</span>
                  );
                } else if (log.failures.every((f: any) => f.repairs?.some((r: any) => r.repair_status === 'cancelled'))) {
                  statusBadge = <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">Đạt an toàn</span>;
                } else {
                  statusBadge = <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Có sự cố (Đã sửa)</span>;
                }
              } else if (log.condition_before_shift === 'broken') {
                statusBadge = <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">Không đạt an toàn</span>;
              } else {
                statusBadge = <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">Đạt an toàn</span>;
              }

              return (
                <div key={log.operation_id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-700 font-bold rounded border border-primary-100 text-[10px] shrink-0">
                          {log.vehicle?.vehicle_code}
                        </span>
                        <span className="font-bold text-gray-800 text-xs truncate max-w-[140px]">
                          {log.vehicle?.vehicle_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold">
                        {new Date(log.work_date).toLocaleDateString('vi-VN')} • {log.shift?.shift_name?.toLowerCase().startsWith('ca') ? log.shift?.shift_name : `Ca ${log.shift?.shift_name}`}
                      </p>
                    </div>
                    {statusBadge}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-500 border-t border-b border-gray-100 py-2">
                    <div>
                      <span className="text-[8px] text-gray-400 block uppercase">Người vận hành</span>
                      <span className="text-gray-800 block truncate">{log.operator?.full_name}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-400 block uppercase">Số giờ máy</span>
                      <span className="text-gray-800 block">
                        {log.hourmeter_end !== null ? `${log.hourmeter_start}h → ${log.hourmeter_end}h` : `${log.hourmeter_start}h (Đang chạy)`}
                      </span>
                    </div>
                  </div>

                  {log.failures && log.failures.length > 0 && (
                    <div className="text-[10px] text-red-700 bg-red-50/50 p-2 rounded-lg border border-red-100 font-semibold">
                      <span>⚠️ Sự cố:</span> {log.failures[0].description}
                      {log.failures[0].repairs && log.failures[0].repairs.length > 0 && (
                        <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                          Thợ: {log.failures[0].repairs[0].mechanic?.full_name || 'Thợ'}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-50">
                    <button
                      onClick={() => handleOpenDetailModal(log)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Chi tiết</span>
                    </button>

                    {log.hourmeter_end === null ? (
                      <>
                        {log.work_type === 'repair' ? (
                          currentUser?.operator_id === log.operator_id && (
                            <button
                              onClick={() => handleOpenEndModal(log)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition"
                            >
                              Đóng ca
                            </button>
                          )
                        ) : (
                          currentUser?.operator_id === log.operator_id && (
                            <>
                              <button
                                onClick={() => handleOpenDuringShiftFailureModal(log)}
                                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Báo sự cố</span>
                              </button>
                              <button
                                onClick={() => handleOpenEndModal(log)}
                                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-[10px] font-bold transition"
                              >
                                Đóng ca
                              </button>
                            </>
                          )
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-semibold italic flex items-center">✓ Đã hoàn thành</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {logs.length > itemsPerPage && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between text-xs font-bold text-gray-500">
            <div>
              Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, logs.length)} trên tổng số {logs.length} ca làm việc
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                Trước
              </button>
              <span className="text-gray-700 font-semibold">Trang {currentPage} / {Math.ceil(logs.length / itemsPerPage)}</span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(logs.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(logs.length / itemsPerPage)}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  currentPage === Math.ceil(logs.length / itemsPerPage) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ================================================================= */}
      {/* 1. MODAL: MỞ CA (WIZARD FORM) */}
      {/* ================================================================= */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-5 w-5" />
                <h3 className="font-bold text-sm uppercase">Thiết lập Mở ca chạy xe</h3>
              </div>
              <button onClick={() => setShowStartModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleStartSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Thông tin Người vận hành (Auto-fill - Không được sửa) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200/60 rounded-xl">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Người vận hành (Hệ thống xác thực)</label>
                  <input
                    type="text"
                    value={`${currentUser?.full_name || ''} (${currentUser?.operator_id || ''})`}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100/80 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Đội / Tổ công tác (Auto-fill)</label>
                  <input
                    type="text"
                    value={currentUser?.department || 'Tổ Vận Hành'}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100/80 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Step 1: Vehicle & Shift */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Chọn Phương Tiện *</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold text-gray-800"
                    required
                  >
                    <option value="">-- Chọn xe --</option>
                    {vehicles.map(v => {
                      const isLocked = v.status !== 'active';
                      const labelStatus = v.status === 'repairing' 
                        ? ' [🚧 Đang sửa chữa]' 
                        : v.status === 'inactive' 
                          ? ' [Ngưng hoạt động]' 
                          : '';
                      return (
                        <option 
                          key={v.vehicle_id} 
                          value={v.vehicle_id}
                          className={isLocked ? 'text-red-500 bg-red-50 line-through font-semibold' : 'font-semibold text-gray-800'}
                        >
                          {v.vehicle_code} - {v.vehicle_name}{labelStatus} (Hiện tại: {v.current_hourmeter}h)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Auto shift & time badge display */}
                <div className="p-3.5 bg-primary-50/50 rounded-xl border border-primary-100/60 grid grid-cols-2 gap-4 text-xs font-semibold text-primary-800 self-end">
                  <div>
                    <span className="block text-[9px] text-primary-500 uppercase font-bold tracking-wider mb-0.5">Ca làm việc (Hệ thống)</span>
                    <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-lg inline-block">
                      {shifts.find(s => s.shift_id.toString() === selectedShiftId)?.shift_name || 'Tự động xác định'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-primary-500 uppercase font-bold tracking-wider mb-0.5">Giờ mở ca ghi nhận</span>
                    <span className="text-xs font-bold text-primary-700 block mt-0.5">
                      {startHour} ({new Date(workDate).toLocaleDateString('vi-VN')})
                    </span>
                  </div>
                </div>
              </div>

              {/* Cảnh báo phương tiện đang bị khóa sửa chữa / ngưng hoạt động */}
              {selectedVehicleId && selectedVehicleStatus !== 'active' && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-2 text-red-700 font-bold text-xs uppercase">
                    <AlertOctagon className="h-5 w-5 shrink-0 animate-bounce" />
                    <span>Phương tiện đang khóa bảo trì / ngưng hoạt động!</span>
                  </div>
                  <p className="text-xs text-gray-600 pl-7 leading-relaxed font-medium">
                    Xe <strong>{vehicles.find(v => v.vehicle_id && selectedVehicleId && v.vehicle_id.toString().toLowerCase() === selectedVehicleId.toString().toLowerCase())?.vehicle_code}</strong> đang ở trạng thái <strong className="text-red-600 uppercase">"{selectedVehicleStatus === 'repairing' ? 'Đang sửa chữa' : 'Ngưng hoạt động'}"</strong>.
                    Hệ thống nghiêm cấm đưa xe đang sửa chữa vào hoạt động sản xuất để đảm bảo an toàn lao động.
                  </p>
                  <p className="text-[10px] text-gray-500 pl-7 font-bold">
                    💡 Hướng dẫn giải tỏa khóa: Vui lòng tự sửa chữa hoặc cập nhật sửa chữa trong menu "Sửa chữa" để chuyển trạng thái xe về bình thường.
                  </p>
                </div>
              )}

              {/* Handover Warn Block */}
              {requiresHandoverAck && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg space-y-3">
                  <div className="flex items-center space-x-2 text-red-700 font-bold text-xs uppercase">
                    <AlertOctagon className="h-5 w-5 shrink-0" />
                    <span>Cảnh báo bàn giao ca: Sự cố chưa sửa từ ca trước!</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600 pl-7">
                    {handoverFailures.map((f: any) => (
                      <div key={f.failure_id} className="p-2 bg-white rounded border border-red-100">
                        <strong>Hạng mục: {f.category_name}</strong> - {f.description}
                        <div className="text-[10px] text-gray-400 mt-0.5">Thời điểm báo: {f.failure_time}</div>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center space-x-2 text-xs font-bold text-red-700 pl-7 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgedPreviousFailure}
                      onChange={(e) => setAcknowledgedPreviousFailure(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 h-4 w-4 border-red-300"
                    />
                    <span>TÔI XÁC NHẬN ĐÃ ĐỌC, ĐÃ HIỂU VÀ ĐỒNG Ý BÀN GIAO SỰ CỐ TRÊN</span>
                  </label>
                </div>
              )}

              {selectedVehicleId && selectedVehicleStatus === 'active' && (
                <>
                  {/* Step 2: Hourmeter Start & Condition */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giờ máy đầu ca (Hourmeter Start) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={hourmeterStart}
                        onChange={(e) => setHourmeterStart(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tình trạng phương tiện *</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 bg-gray-50 px-4 py-2 border rounded-xl cursor-pointer">
                          <input
                            type="radio"
                            name="condition"
                            checked={conditionBefore === 'ok'}
                            onChange={() => setConditionBefore('ok')}
                            className="text-primary-600 focus:ring-primary-500 h-4 w-4 border-gray-300"
                          />
                          <span>Bình Thường</span>
                        </label>
                        <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 bg-gray-50 px-4 py-2 border rounded-xl cursor-pointer">
                          <input
                            type="radio"
                            name="condition"
                            checked={conditionBefore === 'broken'}
                            onChange={() => setConditionBefore('broken')}
                            className="text-primary-600 focus:ring-primary-500 h-4 w-4 border-gray-300"
                          />
                          <span className="text-red-600">Có Sự Cố Hư Hỏng</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: CHECKLIST DỰA TRÊN THIẾT BỊ HOẶC FORM BÁO HỎNG */}
                  {conditionBefore === 'ok' ? (
                    <div className="space-y-3 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Checklist kiểm tra trước ca</label>
                        <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-2 py-0.5 rounded">
                          Thiết bị yêu cầu: {checklists.length} mục
                        </span>
                      </div>
                      
                      <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-200 text-xs max-h-[250px] overflow-y-auto">
                        {checklists.map((item: any) => {
                          const isFailed = checklistAnswers[item.checklist_id]?.result === false;
                          return (
                            <div key={item.checklist_id} className="p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between hover:bg-gray-100/50 transition gap-2 sm:gap-3">
                              <div className="space-y-1 sm:mr-3 flex-1 w-full">
                                <p className="font-semibold text-gray-700">
                                  {item.item_name}
                                  {item.severity === 'dangerous' && (
                                    <span className="ml-2 px-1.5 py-0.5 text-[8px] font-bold bg-red-100 text-red-800 rounded">
                                      Nguy hiểm
                                    </span>
                                  )}
                                  {isFailed && <span className="text-red-500 font-bold ml-1">* (Bắt buộc nhập mô tả)</span>}
                                </p>
                                <input
                                  type="text"
                                  placeholder={isFailed ? "Mô tả cụ thể hư hỏng bắt buộc..." : "Ghi chú thêm nếu cần..."}
                                  value={checklistAnswers[item.checklist_id]?.note || ''}
                                  onChange={(e) => setChecklistAnswers({
                                    ...checklistAnswers,
                                    [item.checklist_id]: { ...checklistAnswers[item.checklist_id], note: e.target.value }
                                  })}
                                  required={isFailed}
                                  className={`w-full text-[10px] px-2 py-1 border rounded transition-colors ${
                                    isFailed ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200'
                                  }`}
                                />
                              </div>
                              <div className="flex space-x-1.5 shrink-0 self-end sm:self-start mt-1">
                                <button
                                  type="button"
                                  onClick={() => setChecklistAnswers({
                                    ...checklistAnswers,
                                    [item.checklist_id]: { ...checklistAnswers[item.checklist_id], result: true }
                                  })}
                                  className={`w-20 text-center py-1 rounded font-bold text-[10px] transition ${
                                    checklistAnswers[item.checklist_id]?.result 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-white text-gray-400 border border-gray-200'
                                  }`}
                                >
                                  Đạt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setChecklistAnswers({
                                    ...checklistAnswers,
                                    [item.checklist_id]: { ...checklistAnswers[item.checklist_id], result: false }
                                  })}
                                  className={`w-20 text-center py-1 rounded font-bold text-[10px] transition ${
                                    checklistAnswers[item.checklist_id]?.result === false
                                      ? 'bg-red-600 text-white' 
                                      : 'bg-white text-gray-400 border border-gray-200'
                                  }`}
                                >
                                  Không Đạt
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-4 pt-4 border-t border-gray-100">
                      <h4 className="font-bold text-xs text-red-700 uppercase">Khai báo sự cố hư hỏng để nhập bảo trì</h4>
                      <div className="text-xs">
                        <label className="block font-semibold text-gray-500 mb-1">Hạng mục sự cố *</label>
                        <select
                          value={selectedFailureCatId}
                          onChange={(e) => setSelectedFailureCatId(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded"
                        >
                          <option value="">-- Chọn hạng mục --</option>
                          {failureCategories.map(cat => (
                            <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs">
                        <label className="block font-semibold text-gray-500 mb-1">Mô tả cụ thể hiện trạng hư hỏng *</label>
                        <textarea
                          placeholder="Mô tả sự cố như thế nào, rò rỉ đâu..."
                          value={failureDesc}
                          onChange={(e) => setFailureDesc(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded h-16"
                        />
                      </div>
                    </div>
                  )}

                  {/* Safety confirmations & digital signature */}
                  {conditionBefore === 'ok' ? (
                    <div className="space-y-4 border-t border-gray-100 pt-4">
                      {hasDangerousFailure ? (
                        <div className="p-4 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-r-lg space-y-2">
                          <p className="font-bold text-xs uppercase">⚠️ Cảnh báo lỗi nghiêm trọng</p>
                          <p className="text-xs font-semibold text-red-750">
                            Phương tiện đang ghi nhận lỗi nghiêm trọng (Nguy hiểm) trong checklist trước ca. Bạn không thể mở ca sản xuất. Hệ thống bắt buộc mở ca sửa chữa để khắc phục sự cố.
                          </p>
                          <div className="text-xs pt-1">
                            <label className="block font-bold text-red-700 uppercase mb-1">Mô tả cụ thể sự cố cần sửa chữa *</label>
                            <textarea
                              placeholder="Nhập lý do chi tiết..."
                              value={unsafetyReason}
                              onChange={(e) => setUnsafetyReason(e.target.value)}
                              className="w-full px-3 py-2 border border-red-300 rounded-xl h-20 bg-white"
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Ca type selector */}
                          <div className="space-y-2 mb-4">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Loại ca mở đầu *</label>
                            <div className="grid grid-cols-2 gap-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setWorkType('production');
                                  setIsSafetyConfirmed(true);
                                }}
                                className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
                                  workType === 'production'
                                    ? 'border-primary-500 bg-primary-50/50 text-primary-700 font-bold'
                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                <span>🏭 Ca sản xuất</span>
                                <span className="text-[9px] font-medium text-gray-400">Vận hành sản xuất bình thường</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWorkType('repair');
                                  setIsSafetyConfirmed(false);
                                }}
                                className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
                                  workType === 'repair'
                                    ? 'border-red-500 bg-red-50/50 text-red-700 font-bold'
                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                <span>🛠️ Ca sửa chữa</span>
                                <span className="text-[9px] font-medium text-gray-400">Không sản xuất – cần sửa chữa</span>
                              </button>
                            </div>
                          </div>

                          {workType === 'production' ? (
                            <div className="space-y-4">
                              {hasLightFailure && isSafetyConfirmed && (
                                <div className="space-y-1.5 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs animate-in slide-in-from-top-2 duration-200">
                                  <label className="block font-bold text-yellow-800 uppercase">Lý do vẫn đảm bảo an toàn dù có lỗi nhẹ *</label>
                                  <input
                                    type="text"
                                    placeholder="Nhập lý do chi tiết..."
                                    value={safetyReason}
                                    onChange={(e) => {
                                      setSafetyReason(e.target.value);
                                      if (e.target.value.trim() !== '') {
                                        setShowSafetyWarning(false);
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-yellow-300 rounded-xl bg-white"
                                  />
                                </div>
                              )}

                              <label className="flex items-start space-x-3 cursor-pointer text-xs font-bold text-gray-700 bg-primary-50/50 p-4 border border-primary-100 rounded-xl">
                                <input
                                  type="checkbox"
                                  checked={isSafetyConfirmed}
                                  onChange={(e) => {
                                    setIsSafetyConfirmed(e.target.checked);
                                    if (e.target.checked && hasLightFailure && !safetyReason.trim()) {
                                      setShowSafetyWarning(true);
                                    } else {
                                      setShowSafetyWarning(false);
                                    }
                                  }}
                                  className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5 border-gray-300 mt-0.5 shrink-0"
                                />
                                <div>
                                  <span> 
                                    {vehicles.find(v => v.vehicle_id && selectedVehicleId && v.vehicle_id.toString().toLowerCase() === selectedVehicleId.toString().toLowerCase())?.vehicle_type?.type_name === 'Cần cẩu'
                                      ? "Cần cẩu đảm bảo an toàn để bắt đầu làm việc"
                                      : "Phương tiện đảm bảo an toàn để bắt đầu làm việc"}
                                  </span>
                                  {showSafetyWarning && (
                                    <p className="text-red-500 text-[10px] font-bold mt-1">
                                      ⚠️ Cảnh báo: Vui lòng nhập lý do vẫn đảm bảo an toàn trước khi xác nhận!
                                    </p>
                                  )}
                                </div>
                              </label>

                              {isSafetyConfirmed ? (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                  <SignaturePad
                                    onSave={(data) => setSignatureData(data)}
                                    onClear={() => setSignatureData(null)}
                                  />
                                </div>
                              ) : (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                                  <p className="font-bold text-gray-500 uppercase">Báo cáo xe gặp sự cố & đưa vào bảo trì</p>
                                  <p className="text-gray-400 text-[10px]">
                                    Khi không xác nhận an toàn, phương tiện sẽ được chuyển sang trạng thái đang sửa chữa.
                                  </p>
                                  <div className="pt-1">
                                    <label className="block font-semibold text-gray-500 mb-1">Mô tả lý do không đảm bảo an toàn *</label>
                                    <textarea
                                      placeholder="Nhập lý do không thể vận hành phương tiện..."
                                      value={unsafetyReason}
                                      onChange={(e) => setUnsafetyReason(e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-xl h-20 bg-white"
                                      required
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 bg-red-50/50 border border-red-150 rounded-xl space-y-2 text-xs">
                              <p className="font-bold text-red-700 uppercase">Mở ca sửa chữa</p>
                              <p className="text-gray-500 text-[11px]">
                                Phương tiện sẽ được chuyển sang trạng thái "Đang sửa chữa" và ca sửa chữa sẽ bắt đầu.
                              </p>
                              <div className="pt-1">
                                <label className="block font-semibold text-gray-700 mb-1">Nội dung hư hỏng cần khắc phục *</label>
                                <textarea
                                  placeholder="Nhập mô tả chi tiết hư hỏng cần sửa chữa..."
                                  value={unsafetyReason}
                                  onChange={(e) => setUnsafetyReason(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-xl h-20 bg-white"
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-lg space-y-2 mt-4">
                      <p className="font-bold text-xs uppercase">⚠️ Không thể xác nhận an toàn</p>
                      <p className="text-xs font-medium">
                        Phương tiện đang gặp sự cố hư hỏng. Hệ thống sẽ lưu nhật ký ca chạy, chuyển trạng thái xe sang Đang sửa chữa và gửi yêu cầu sửa chữa.
                      </p>
                    </div>
                  )}

                  {conditionBefore === 'ok' && (
                    <div className="text-xs pt-4 border-t border-gray-100">
                      <label className="block font-bold text-gray-500 uppercase mb-2">Ghi chú vận hành</label>
                      <textarea
                        placeholder="Ghi nhận giờ ăn, phụ tùng dự kiến..."
                        value={startNotes}
                        onChange={(e) => setStartNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl h-16"
                      />
                    </div>
                  )}
                </>
              )}
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 p-4 bg-gray-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  HỦY BỎ
                </button>
                {selectedVehicleStatus === 'active' ? (
                  <button
                    type="submit"
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md ${
                      (conditionBefore === 'broken' || hasDangerousFailure || !isSafetyConfirmed)
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white'
                    }`}
                  >
                    {(conditionBefore === 'broken' || hasDangerousFailure || !isSafetyConfirmed)
                      ? 'BÁO SỰ CỐ & KHÓA XE'
                      : 'XÁC NHẬN MỞ CA'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2.5 bg-gray-300 text-gray-500 font-bold rounded-xl text-xs cursor-not-allowed flex items-center space-x-1"
                  >
                    <Lock className="h-4 w-4" />
                    <span>KHÔNG THỂ MỞ CA</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. MODAL: ĐÓNG CA (CLOSE SHIFT) */}
      {/* ================================================================= */}
      {showEndModal && activeLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-5 w-5" />
                <h3 className="font-bold text-sm uppercase">
                  {activeLog.work_type === 'repair' ? 'Kết thúc ca sửa chữa' : 'Kết thúc ca làm việc'}
                </h3>
              </div>
              <button onClick={() => setShowEndModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleEndSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                <p>Phương tiện: <strong>{activeLog.vehicle?.vehicle_code}</strong></p>
                <p>Số giờ máy lúc mở ca: <strong>{activeLog.hourmeter_start}h</strong></p>
                <p>Người mở ca: <strong>{activeLog.operator?.full_name} (lúc {activeLog.start_hour?.slice(0, 8)} ngày {new Date(activeLog.work_date).toLocaleDateString('vi-VN')})</strong></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Số giờ máy cuối ca (Hourmeter End) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={hourmeterEnd}
                  onChange={(e) => setHourmeterEnd(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Giờ kết thúc ca *</label>
                <input
                  type="time"
                  step="1"
                  value={endHour.slice(0, 8)}
                  onChange={(e) => {
                    setEndHour(e.target.value);
                    setIsEndHourModified(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              {activeLog.work_type === 'repair' ? (
                <div className="space-y-4 border-t border-gray-150 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Kết quả sửa chữa *</label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                      <label className="flex items-center space-x-2 font-bold cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="repair_status_end"
                          checked={isRepairDone === true}
                          onChange={() => setIsRepairDone(true)}
                          className="text-green-600"
                        />
                        <span className="text-green-700">Đã sửa xong (Xe hoạt động)</span>
                      </label>
                      <label className="flex items-center space-x-2 font-bold cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="repair_status_end"
                          checked={isRepairDone === false}
                          onChange={() => setIsRepairDone(false)}
                          className="text-red-600"
                        />
                        <span className="text-red-700">Chưa sửa xong</span>
                      </label>
                    </div>
                  </div>

                  {isRepairDone && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nội dung khắc phục / sửa chữa *</label>
                        <textarea
                          placeholder="Nhập chi tiết biện pháp khắc phục..."
                          value={repairNoteText}
                          onChange={(e) => setRepairNoteText(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs h-16"
                          required={isRepairDone}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vật tư / Phụ tùng thay thế (nếu có)</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: lọc dầu mới, gioăng cao su..."
                          value={repairPartsUsed}
                          onChange={(e) => setRepairPartsUsed(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Báo cáo tình trạng lúc bàn giao</label>
                  <textarea
                    placeholder="Ghi nhận lỗi mới phát hiện, dầu rò rỉ nếu có..."
                    value={endNotes}
                    onChange={(e) => setEndNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs h-20"
                  />
                </div>
              )}
              </div>

              <div className="flex space-x-3 justify-end border-t border-gray-100 p-4 bg-gray-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition"
                >
                  XÁC NHẬN KẾT THÚC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. MODAL: XEM CHI TIẾT CA (DETAIL VIEW) */}
      {/* ================================================================= */}
      {showDetailModal && activeLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Chi tiết Nhật ký ca #{activeLog.operation_id}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Phương tiện</p>
                  <p className="font-bold text-gray-800 text-sm">{activeLog.vehicle?.vehicle_name} ({activeLog.vehicle?.vehicle_code})</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Ngày vận hành</p>
                  <p className="font-bold text-gray-800 text-sm">{new Date(activeLog.work_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Người vận hành</p>
                  <p className="font-bold text-gray-800">{activeLog.operator?.full_name} ({activeLog.operator_id})</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Ca chạy</p>
                  <p className="font-bold text-gray-800">{activeLog.shift?.shift_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Giờ máy</p>
                  <p className="font-bold text-gray-800 text-sm">
                    {activeLog.hourmeter_end !== null ? `${activeLog.hourmeter_end}h` : `${activeLog.hourmeter_start}h`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-0.5">Thời gian vận hành</p>
                  <p className="font-bold text-gray-800 text-sm">
                    {activeLog.notes?.includes("Weekly Report") || activeLog.notes?.includes("báo cáo tuần") ? (
                      "Cả tuần (Báo cáo tuần)"
                    ) : (
                      `${formatTimeString(activeLog.start_hour)} → ${activeLog.end_hour ? formatTimeString(activeLog.end_hour) : 'Chưa đóng ca'} ${activeLog.end_hour && getDurationString(activeLog.start_hour, activeLog.end_hour)}`
                    )}
                  </p>
                </div>
              </div>

              {/* Breakdown & Repair Details section */}
              {activeLog.failures && activeLog.failures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs">Thông tin Hư hỏng / Bảo dưỡng & Khắc phục</h4>
                  <div className="border border-gray-150 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
                    {activeLog.failures.map((fail: any) => (
                      <div key={fail.failure_id} className="p-3.5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Sự cố / Công việc</p>
                            {(() => {
                              const parsed = parseDescription(fail.description);
                              const icon = fail.description.toLowerCase().includes('bảo dưỡng') || fail.description.toLowerCase().includes('kiểm định') ? '🔧' : '⚠️';
                              return (
                                <div className="space-y-1.5 font-semibold text-xs text-gray-700">
                                  <p className="font-bold text-gray-900 text-sm flex items-center space-x-1.5">
                                    <span>{icon}</span>
                                    <span>{parsed.mainDesc}</span>
                                  </p>
                                  {Object.keys(parsed.details).length > 0 && (
                                    <div className="mt-1 grid grid-cols-2 gap-2 bg-gray-50/50 p-2 rounded-lg border border-gray-150 text-[10px]">
                                      {parsed.details['TG dừng'] && (
                                        <div>
                                          <span className="font-bold block text-gray-450 uppercase text-[8px]">Thời gian dừng</span>
                                          <span className="text-red-600 font-bold">{parsed.details['TG dừng']}</span>
                                        </div>
                                      )}
                                      {parsed.details['Tồn đọng từ'] && (
                                        <div>
                                          <span className="font-bold block text-gray-450 uppercase text-[8px]">Tồn đọng từ ngày</span>
                                          <span className="text-orange-600 font-bold">{parsed.details['Tồn đọng từ']}</span>
                                        </div>
                                      )}
                                      {parsed.details['Chi tiết'] && (
                                        <div className="col-span-2">
                                          <span className="font-bold block text-gray-450 uppercase text-[8px]">Mô tả chi tiết</span>
                                          <span className="text-gray-700 font-bold">{parsed.details['Chi tiết']}</span>
                                        </div>
                                      )}
                                      {parsed.details['Ghi chú'] && (
                                        <div className="col-span-2">
                                          <span className="font-bold block text-gray-450 uppercase text-[8px]">Ghi chú</span>
                                          <span className="text-gray-700 font-bold">{parsed.details['Ghi chú']}</span>
                                        </div>
                                      )}
                                      {parsed.details['Đề nghị'] && (
                                        <div className="col-span-2">
                                          <span className="font-bold block text-gray-450 uppercase text-[8px]">Đề nghị</span>
                                          <span className="text-primary-700 font-bold">{parsed.details['Đề nghị']}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="shrink-0 ml-4">
                            {fail.is_repaired ? (
                              fail.repairs?.some((r: any) => r.repair_status === 'cancelled') ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                  Báo nhầm / Hủy bỏ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                                  Đã khắc phục
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 animate-pulse">
                                Đang xử lý
                              </span>
                            )}
                          </div>
                        </div>

                        {fail.repairs && fail.repairs.length > 0 && fail.repairs.map((rep: any) => {
                          const parsedNote = parseDescription(rep.note || '');
                          return (
                            <div key={rep.repair_id} className="grid grid-cols-2 gap-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-150/50 text-[11px] font-semibold text-gray-700">
                              <div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Người thực hiện</p>
                                <p className="text-gray-800 mt-0.5">{rep.mechanic?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Thời gian xử lý</p>
                                <p className="text-gray-800 mt-0.5">
                                  {activeLog.notes?.includes("Weekly Report") || activeLog.notes?.includes("báo cáo tuần") ? (
                                    (() => {
                                      if (!rep.repair_end) return 'Chưa xong (Đang theo dõi)';
                                      const startD = rep.repair_start ? parseUTCDate(rep.repair_start) : null;
                                      const endD = rep.repair_end ? parseUTCDate(rep.repair_end) : null;
                                      if (startD && endD) {
                                        const diffMs = endD.getTime() - startD.getTime();
                                        const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
                                        return diffHours > 0 ? `Trong tuần (${diffHours}h)` : 'Trong tuần';
                                      }
                                      return 'Trong tuần';
                                    })()
                                  ) : (
                                    <>
                                      {rep.repair_start ? parseUTCDate(rep.repair_start)?.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : 'N/A'} 
                                      {' → '} 
                                      {rep.repair_end ? parseUTCDate(rep.repair_end)?.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : 'Chưa xong'}
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="col-span-2 border-t border-gray-200/50 pt-1.5 mt-0.5">
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Nội dung sửa chữa</p>
                                <p className="text-gray-600 font-medium mt-0.5 leading-relaxed">{parsedNote.mainDesc || 'Không ghi nhận'}</p>
                                {rep.parts_used && <p className="text-[10px] text-primary-700 font-bold mt-1">🔧 Vật tư đã dùng: {rep.parts_used}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist Results Section */}
              {activeLog.checklist_results && activeLog.checklist_results.length > 0 && (() => {
                const standardResults = activeLog.checklist_results.filter((res: any) => {
                  const name = (res.checklist_item?.item_name || '').toLowerCase();
                  return !name.includes('đảm bảo an toàn') && !name.includes('hư hỏng trong ca') && !name.includes('ghi chú hư hỏng');
                });
                
                const isSafe = activeLog.is_safety_confirmed;
                const safetyResult = activeLog.checklist_results.find((res: any) => 
                  (res.checklist_item?.item_name || '').toLowerCase().includes('đảm bảo an toàn')
                );
                const failureNoteResult = activeLog.checklist_results.find((res: any) => 
                  (res.checklist_item?.item_name || '').toLowerCase().includes('hư hỏng trong ca') || (res.checklist_item?.item_name || '').toLowerCase().includes('ghi chú hư hỏng')
                );
                
                const failedItems = standardResults.filter((res: any) => !res.result);
                const failedText = failedItems.map((res: any) => 
                  res.note ? `${res.checklist_item?.item_name || 'Hạng mục'}: ${res.note}` : `${res.checklist_item?.item_name || 'Hạng mục'} (Không đạt)`
                ).join(', ');

                const safetyText = safetyResult?.note || (isSafe ? 'Đảm bảo an toàn để bắt đầu làm việc' : 'Không đảm bảo an toàn');
                const cleanActiveNotes = activeLog.notes && activeLog.notes !== 'Imported from Google Forms checklist survey' 
                  ? parseNotes(activeLog.notes).cleanNotes 
                  : '';
                const failureNoteText = failureNoteResult?.note 
                  || (failedText ? `Phát hiện lỗi qua checklist: ${failedText}` : '') 
                  || (cleanActiveNotes ? cleanActiveNotes : 'Bình thường (Không ghi nhận hư hỏng)');
                
                return (
                  <div className="space-y-4">
                    {/* Safety and Failure Note displays outside checklist */}
                    <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Xác nhận an toàn đầu ca</p>
                          <p className="font-bold text-gray-800 text-xs mt-1">
                            {safetyText}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                          isSafe 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {isSafe ? 'AN TOÀN' : 'KHÔNG AN TOÀN'}
                        </span>
                      </div>
                      
                      <div className="border-t border-blue-100/50 pt-3">
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Ghi chú sự cố / tình trạng đầu ca</p>
                        <p className="font-bold text-gray-800 text-xs mt-1">
                          {failureNoteText}
                        </p>
                      </div>
                    </div>

                    {standardResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs">Kết quả kiểm tra Checklist trước ca</h4>
                        <div className="border border-gray-150 rounded-xl overflow-hidden bg-white divide-y divide-gray-100 text-xs">
                          {standardResults.map((res: any) => {
                            const itemName = res.checklist_item?.item_name || `Hạng mục #${res.checklist_id}`;
                            return (
                              <div key={res.result_id} className="p-3 flex items-start justify-between hover:bg-gray-50/50 transition">
                                <div className="space-y-1">
                                  <p className="font-semibold text-gray-800">{itemName}</p>
                                  {res.note && (
                                    <p className="text-[10px] text-red-600 font-bold bg-red-50/55 px-2 py-0.5 rounded inline-block">
                                      📝 Chú thích: {res.note}
                                    </p>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold shrink-0 ${
                                  res.result 
                                    ? 'bg-green-50 text-green-700 border-green-200' 
                                    : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                }`}>
                                  {res.result ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Signature display */}
              {activeLog.signature_data && (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs">Chữ ký số xác nhận</h4>
                  <div className="p-2 border border-gray-200 bg-gray-50 rounded-xl inline-block max-w-[200px]">
                    <img src={activeLog.signature_data} alt="Chữ ký người vận hành" className="h-16 w-auto object-contain" />
                  </div>
                  <p className="text-[10px] text-gray-400">Xác nhận lúc: {parseUTCDate(activeLog.signature_time)?.toLocaleString('vi-VN')}</p>
                </div>
              )}

              {activeLog.safety_reason && (
                <div className="space-y-1">
                  <h4 className="font-bold text-yellow-800 uppercase tracking-wider text-xs">Lý do vẫn đảm bảo an toàn (khi có lỗi nhẹ)</h4>
                  <p className="p-3 bg-yellow-50 text-yellow-950 rounded-xl border border-yellow-250 font-medium whitespace-pre-wrap">{activeLog.safety_reason}</p>
                </div>
              )}

              {activeLog.notes && (() => {
                const parsedNotes = parseNotes(activeLog.notes);
                return (
                  <div className="space-y-1">
                    <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs">Ghi chú ca</h4>
                    <p className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-medium whitespace-pre-wrap">{parsedNotes.cleanNotes || "Không ghi nhận"}</p>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0 text-right">
              <button
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
      {/* 4. MODAL: BÁO HỎNG TRONG CA (REPORT DURING SHIFT FAILURE) */}
      {/* ================================================================= */}
      {showDuringShiftFailureModal && activeLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold text-sm uppercase">Khai báo sự cố phát sinh trong ca</h3>
              <button onClick={() => setShowDuringShiftFailureModal(false)} className="text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleDuringShiftFailureSubmit} className="flex-1 flex flex-col overflow-hidden text-xs text-gray-700">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Thông tin chung */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px] border-b pb-1 text-primary-700">1. Thông tin chung</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Thời điểm xảy ra sự cố *</label>
                    <input
                      type="time"
                      value={failureTimeStr}
                      onChange={(e) => setFailureTimeStr(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Hạng mục sự cố *</label>
                    <select
                      value={selectedFailureCatId}
                      onChange={(e) => setSelectedFailureCatId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-xs"
                      required
                    >
                      <option value="">-- Chọn hạng mục --</option>
                      {failureCategories.map(cat => (
                        <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Severity is defaulted to light quietly */}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Mô tả chi tiết hiện trạng sự cố *</label>
                  <textarea
                    placeholder="Mô tả cụ thể biểu hiện hư hỏng, bộ phận bị ảnh hưởng..."
                    value={failureDesc}
                    onChange={(e) => setFailureDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl h-20 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Section 2: Xử lý sự cố */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px] border-b pb-1 text-primary-700">2. Xử lý sự cố</h4>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Sự cố này có được sửa chữa trong ca?</label>
                  <div className="flex flex-col space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200/50">
                    <label className="flex items-center space-x-2 font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="repairOption"
                        value="repaired_done"
                        checked={repairOption === 'repaired_done'}
                        onChange={() => setRepairOption('repaired_done')}
                        className="text-green-600 focus:ring-green-500 h-4 w-4 border-gray-300"
                      />
                      <span className="text-green-700">✓ Có, đã tự sửa xong (Xe tiếp tục hoạt động)</span>
                    </label>
                    <label className="flex items-center space-x-2 font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="repairOption"
                        value="repaired_none"
                        checked={repairOption === 'repaired_none'}
                        onChange={() => setRepairOption('repaired_none')}
                        className="text-red-600 focus:ring-red-500 h-4 w-4 border-gray-300"
                      />
                      <span className="text-red-600 font-bold">✗ Chưa sửa xong / Cần Tổ bảo trì xử lý (Khóa xe ca sau)</span>
                    </label>
                  </div>
                </div>

                {/* Optional fields for repaired_done */}
                {repairOption === 'repaired_done' && (
                  <div className="space-y-4 p-4 bg-green-50/50 rounded-xl border border-green-200/50 animate-in slide-in-from-top-2 duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">Thời gian bắt đầu sửa *</label>
                        <input
                          type="time"
                          value={repairStartStr}
                          onChange={(e) => setRepairStartStr(e.target.value)}
                          className="w-full px-3 py-2 border border-green-300 rounded-xl font-bold text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">Thời gian kết thúc sửa *</label>
                        <input
                          type="time"
                          value={repairEndStr}
                          onChange={(e) => setRepairEndStr(e.target.value)}
                          className="w-full px-3 py-2 border border-green-300 rounded-xl font-bold text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">Vật tư / phụ tùng đã sử dụng</label>
                      <input
                        type="text"
                        placeholder="VD: Thay dây dẫn thủy lực..."
                        value={partsUsed}
                        onChange={(e) => setPartsUsed(e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 rounded-xl font-semibold text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-green-700 uppercase mb-2">Ghi chú khắc phục *</label>
                      <textarea
                        placeholder="Mô tả cách thức sửa chữa, khắc phục sự cố..."
                        value={repairNote}
                        onChange={(e) => setRepairNote(e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 rounded-xl h-14 font-medium"
                        required={repairOption === 'repaired_done'}
                      />
                    </div>
                  </div>
                )}

                {repairOption !== 'repaired_done' && (
                  <div className="p-3 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-lg">
                    <p className="font-bold uppercase text-[10px] tracking-wide">⚠️ Cảnh báo</p>
                    <p className="text-[10px] mt-1 leading-relaxed font-semibold">
                      Xe sẽ bị khóa sản xuất cho đến khi sửa xong. Ca sau sẽ không thể chọn xe này.
                    </p>
                  </div>
                )}
              </div>

              {/* Section 3: Xác nhận */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px] border-b pb-1 text-primary-700">3. Xác nhận</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Người báo cáo (Auto fill)</label>
                    <p className="font-bold text-gray-700">{currentUser?.full_name || 'Hệ thống'}</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Thời gian báo cáo (Auto timestamp)</label>
                    <p className="font-bold text-gray-700">{new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</p>
                  </div>
                </div>
              </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 justify-end border-t border-gray-100 p-4 bg-gray-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDuringShiftFailureModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white font-bold rounded-xl transition shadow-md"
                >
                  XÁC NHẬN BÁO CÁO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. MODAL: BÁO CÁO HƯ HỎNG THÀNH CÔNG (SUCCESS SCREEN WITH WORKFLOW INFO) */}
      {/* ================================================================= */}
      {showFailureSuccessModal && lastReportedFailure && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-8 text-center text-white relative">
              <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-3">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wider animate-pulse">Báo cáo sự cố thành công!</h3>
              <p className="text-xs text-green-100 mt-1 font-medium">Hệ thống đã tự động phân phối thông tin sự cố</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 text-xs text-gray-600 overflow-y-auto max-h-[60vh]">
              {/* Failure summary card */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">PHƯƠNG TIỆN:</span>
                  <span className="font-bold text-gray-800">{lastReportedFailure.vehicle_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">HẠNG MỤC:</span>
                  <span className="font-bold text-gray-800 text-right">{lastReportedFailure.category_name}</span>
                </div>

                <div className="flex justify-between pt-1 border-t border-gray-200/50">
                  <span className="text-gray-400 font-bold">KHẮC PHỤC:</span>
                  <span className={`font-bold ${lastReportedFailure.repaired_in_shift ? 'text-green-600' : 'text-red-500'}`}>
                    {lastReportedFailure.repaired_in_shift ? 'Đã sửa xong trong ca ✓' : 'Chưa sửa xong - Đang sửa ✗'}
                  </span>
                </div>
              </div>

              {/* Trạng thái thiết bị & Tiến trình tiếp theo */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider text-[10px] border-b pb-1">TRẠNG THÁI THIẾT BỊ & TIẾN TRÌNH TIẾP THEO</h4>
                
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-150 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-semibold">Trạng thái xe hiện tại:</span>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                      lastReportedFailure.repaired_in_shift
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                    }`}>
                      {lastReportedFailure.repaired_in_shift ? 'SẴN SÀNG HOẠT ĐỘNG' : 'TẠM KHÓA - ĐANG SỬA CHỮA'}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 border-t border-gray-200/50 pt-2.5">
                    <p className="font-bold text-gray-700">Kế hoạch xử lý tiếp theo:</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      {lastReportedFailure.repaired_in_shift
                        ? "Sự cố nhẹ đã được khắc phục hoàn tất. Thiết bị tiếp tục được phân bổ sản xuất bình thường."
                        : "Sự cố đã được ghi nhận trên hệ thống. Trạng thái xe sẽ tự động mở khóa trở lại trạng thái Sẵn sàng ngay sau khi người vận hành hoàn thành việc khắc phục sự cố."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Steps Info */}
              <div className="p-3 bg-blue-50 border-l-4 border-primary-500 text-primary-800 rounded-r-lg space-y-1">
                <p className="font-bold">💡 Quy trình xử lý sự cố trong ca:</p>
                <p className="text-[10px] leading-relaxed">
                  {lastReportedFailure.repaired_in_shift 
                    ? "Vì sự cố đã được bạn tự sửa xong trong ca, xe vẫn hoạt động bình thường ở ca sau." 
                    : "Vì sự cố chưa sửa xong, xe đã được chuyển sang trạng thái 'ĐANG SỬA CHỮA'. Bạn vẫn tiếp tục chạy nốt ca hiện tại của mình, nhưng hệ thống sẽ tự động khóa xe này ở ca sau để đảm bảo an toàn lao động."}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowFailureSuccessModal(false)}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-primary-700 text-white font-bold rounded-xl shadow-md transition"
              >
                XÁC NHẬN ĐÃ HIỂU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 6. MODAL: THÔNG BÁO HỆ THỐNG (CUSTOM TOAST / NOTIFICATION DIALOG) */}
      {/* ================================================================= */}
      {notification.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50">
              {notification.type === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : notification.type === 'warning' ? (
                <AlertTriangle className="h-6 w-6 text-orange-600 animate-pulse" />
              ) : notification.type === 'danger' ? (
                <AlertOctagon className="h-6 w-6 text-red-600 animate-pulse" />
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
export default Operations;
