import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CarFront, Bike, Truck, LogOut, User, Zap, Circle, Plus, 
  Edit, X, Clock, RotateCw, Trash2, Bell, Users, Car, 
  CalendarDays, History, ArrowRightLeft , UserPlus, Ticket, KeyRound, Timer, QrCode
} from 'lucide-react';
import { io } from 'socket.io-client';

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vehicles'); 
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [expandedVehicleLogs, setExpandedVehicleLogs] = useState(null); 
  const [vehicleLogsData, setVehicleLogsData] = useState({}); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' });

  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const [guests, setGuests] = useState([]);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestFormData, setGuestFormData] = useState({
    guest_name: '', guest_license_plate: '', vehicle_type: 'motorbike', visit_start_time: '', visit_end_time: ''
  });
  const [activeOtp, setActiveOtp] = useState(null);
  const [otpProgress, setOtpProgress] = useState(0); 
  const [otpTimeLeftStr, setOtpTimeLeftStr] = useState('00:00');

  const [qrPass, setQrPass] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrProgress, setQrProgress] = useState(0);
  const [qrTimeLeftStr, setQrTimeLeftStr] = useState('00:00');

  const formatVN = (dateStr, options = {}) => {
    if (!dateStr || dateStr === 'Unknown') return '---';
    
    // Bọc chuỗi gốc để hệ thống luôn hiểu đây là giờ UTC (Z)
    const safeDateStr = String(dateStr).endsWith('Z') ? dateStr : `${dateStr}Z`;
    const d = new Date(safeDateStr);
    
    if (isNaN(d.getTime())) return '---';

    // Cộng thẳng 7 tiếng (7 giờ * 60 phút * 60 giây * 1000 mili-giây) vào thời gian gốc
    const gmt7Time = new Date(d.getTime() + (7 * 60 * 60 * 1000));
    
    // Trích xuất ngày giờ (dùng getUTC để lấy chính xác con số sau khi đã cộng toán học)
    const day = String(gmt7Time.getUTCDate()).padStart(2, '0');
    const month = String(gmt7Time.getUTCMonth() + 1).padStart(2, '0');
    const year = gmt7Time.getUTCFullYear();
    const hours = String(gmt7Time.getUTCHours()).padStart(2, '0');
    const minutes = String(gmt7Time.getUTCMinutes()).padStart(2, '0');
    const seconds = String(gmt7Time.getUTCSeconds()).padStart(2, '0');

    // Tự động đối chiếu với các options bạn đang dùng ở phần giao diện
    if (options.hour && options.day) {
      return `${hours}:${minutes} - ${day}/${month}/${year}`; // Last Access
    } else if (options.hour && options.second) {
      return `${hours}:${minutes}:${seconds}`;                // Giờ của Log
    } else if (options.day) {
      return `${day}/${month}/${year}`;                       // Ngày đăng ký & Ngày của Log
    } else if (options.hour) {
      return `${hours}:${minutes}`;
    }
    
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const addNotification = (message, type = 'success') => {
    const newNotif = { 
      id: Date.now() + Math.random(), 
      message, 
      type, 
      time: formatVN(new Date().toISOString(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  useEffect(() => {
    fetchVehicles();

    const socket = io('http://localhost:5000');
    fetch('http://localhost:5000/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data.user_id) {
        socket.emit('join_user_room', data.data.user_id);
      }
    });

    socket.on('vehicle_status_changed', (data) => {
      if (data.status === 'approved') {
        addNotification(`✅ ${data.message}`, 'success');
      } else {
        addNotification(`❌ ${data.message}`, 'error');
      }
      fetchVehicles(true, true);
    });

    return () => socket.disconnect();
  }, []);

  // --- NÂNG CẤP LOGIC ĐẾM NGƯỢC OTP BẤT CHẤP LỖI TIMEZONE ---
  useEffect(() => {
    if (!activeOtp) return;

    // Đề phòng API trả về sai tên trường
    const endStr = activeOtp.valid_until || activeOtp.expires_at || activeOtp.expiry_time;
    const startStr = activeOtp.valid_from || activeOtp.created_at;

    let endTime = new Date(endStr).getTime();
    let startTime = new Date(startStr).getTime();
    const nowCheck = new Date().getTime();

    // MẸO: Nếu giờ lấy từ Backend bị lùi về quá khứ (lỗi lệch 7 tiếng của DB)
    // thì ta tự động cộng bù 7 tiếng (25.200.000 mili-giây) vào để khớp với thực tế
    if (endTime < nowCheck) {
        endTime += 7 * 60 * 60 * 1000; 
        startTime += 7 * 60 * 60 * 1000;
    }

    // Nếu backend không trả về giờ hoặc parse lỗi, tự gán luôn 15 phút
    if (isNaN(endTime)) {
        endTime = nowCheck + 3 * 60 * 1000;
        startTime = nowCheck;
    }

    // Hàm cập nhật tiến trình chạy ngay lập tức (không đợi 1 giây)
    const updateProgress = () => {
        const now = new Date().getTime();
        const remaining = endTime - now;
        const total = endTime - startTime > 0 ? endTime - startTime : 3 * 60 * 1000;

        if (remaining <= 0) {
            setActiveOtp(null);
            setOtpTimeLeftStr('00:00');
            setOtpProgress(0);
            return true; // Báo hiệu đã hết giờ
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setOtpTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            setOtpProgress((remaining / total) * 100);
            return false;
        }
    };

    // Chạy thử 1 lần đầu tiên, nếu chưa hết hạn thì mới cho vào vòng lặp setInterval
    const isExpired = updateProgress();
    if (isExpired) return;

    const interval = setInterval(() => {
        const expired = updateProgress();
        if (expired) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOtp]);

  const fetchVehicles = async (isRefresh = false, isBackground = false) => {
    try {
      if (!isRefresh && !isBackground) setLoading(true);
      if (isRefresh && !isBackground) setIsRefreshing(true);

      const response = await fetch('http://localhost:5000/api/v1/citizens/vehicles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : (data.data || [])); 
      }
    } catch (error) {
      console.log("Lỗi fetch:", error.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. NÂNG CẤP HÀM LẤY LOGS (FIX MẤT LOG & LỌC BIỂN SỐ THÔNG MINH)
  const toggleVehicleLogs = async (vehicleId, licensePlate) => {
    if (expandedVehicleLogs === vehicleId) {
      setExpandedVehicleLogs(null);
      return;
    }

    try {
      // Ép Backend trả về 100 logs gần nhất (tránh việc xe cũ bị đẩy mất khỏi danh sách)
      const response = await fetch(`http://localhost:5000/api/v1/citizens/logs?limit=100`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const allLogs = result.data?.data || [];
        
        // Hàm làm sạch biển số: Xóa mọi dấu chấm, gạch ngang, khoảng trắng để so sánh chính xác 100%
        const normalizePlate = (plate) => plate ? String(plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
        const targetPlate = normalizePlate(licensePlate);

        // Lọc chính xác các log CHỈ THUỘC VỀ chiếc xe này
        const filteredLogs = allLogs.filter(log => normalizePlate(log.license_plate) === targetPlate);
        
        setVehicleLogsData(prev => ({ ...prev, [vehicleId]: filteredLogs }));
        setExpandedVehicleLogs(vehicleId);
      }
    } catch (error) {
      addNotification("Không thể tải lịch sử xe", "error");
    }
  };

  const handleRefresh = () => fetchVehicles(true);
  const handleOpenAdd = () => { setEditMode(false); setFormData({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' }); setIsModalOpen(true); };
  const handleOpenEdit = (vehicle) => { setEditMode(true); setFormData({ vehicle_id: vehicle.vehicle_id, license_plate: vehicle.license_plate || '', vehicle_type: vehicle.vehicle_type || 'car', vehicle_color: vehicle.vehicle_color || '' }); setIsModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editMode ? `http://localhost:5000/api/v1/citizens/vehicles/${formData.vehicle_id}` : 'http://localhost:5000/api/v1/citizens/vehicles';
      const response = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ license_plate: formData.license_plate, vehicle_type: formData.vehicle_type, vehicle_color: formData.vehicle_color })
      });

      if (response.ok) {
        addNotification(editMode ? 'Đã gửi yêu cầu chỉnh sửa thông tin chờ quản lý duyệt.' : 'Đã gửi đăng ký xe mới chờ quản lý duyệt.', 'info');
        fetchVehicles(true);
        setIsModalOpen(false);
      }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); }
  };

  const handleDeleteRequest = async (vehicle) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn xe ${vehicle.license_plate}?`)) return;
    try {
      const response = await fetch(`http://localhost:5000/api/v1/citizens/vehicles/${vehicle.vehicle_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (response.ok) {
        addNotification(`Đã xóa xe ${vehicle.license_plate} thành công.`, 'success');
        fetchVehicles(true);
      }
    } catch (error) { alert('Lỗi kết nối máy chủ!'); }
  };

  // --- CÁC HÀM API GUESTS & OTP ---
  const fetchGuests = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/citizens/guests', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (res.ok) { const data = await res.json(); setGuests(data.data || []); }
    } catch (e) {}
  };

  const fetchActiveOtp = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/citizens/tokens', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (res.ok) {
        const data = await res.json();
        // KHÔNG dùng hàm thời gian để lọc nữa. Tin tưởng tuyệt đối vào trạng thái từ Backend!
        const active = (data.data || []).find(t => t.status === 'active' && !t.is_used);
        setActiveOtp(active || null);
      }
    } catch(e) {}
  };
  const generateOTP = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/citizens/tokens', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) { const data = await res.json(); setActiveOtp(data.data); addNotification("Đã tạo mã OTP thành công!", "success"); }
    } catch (e) {}
  };

  const generateQR = async () => {
    // --- ĐÁNH CHẶN: NẾU ĐÃ CÓ MÃ QR VÀ CHƯA HẾT HẠN THÌ CHỈ CẦN MỞ LẠI MODAL ---
    if (qrPass) {
      setIsQrModalOpen(true);
      return;
    }

    // NẾU CHƯA CÓ (hoặc mã cũ đã hết hạn bị hệ thống tự hủy), TIẾN HÀNH GỌI API MỚI
    try {
      const res = await fetch('http://localhost:5000/api/v1/citizens/qr-code', {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQrPass(data.data);
        setIsQrModalOpen(true);
      } else {
        addNotification("Không thể tạo mã QR lúc này", "error");
      }
    } catch(e) { 
      addNotification("Lỗi kết nối", "error"); 
    }
  };

  // ĐẾM NGƯỢC QR (ÉP CỨNG 3 PHÚT)
  useEffect(() => {
    if (!qrPass) return;
    const startStr = qrPass.valid_from || new Date().toISOString();
    let startTime = new Date(startStr).getTime();
    const nowCheck = new Date().getTime();

    if (startTime < nowCheck - 2 * 60 * 60 * 1000) startTime += 7 * 60 * 60 * 1000;
    let endTime = startTime + (3 * 60 * 1000);

    const updateProgress = () => {
        const now = new Date().getTime();
        const remaining = endTime - now;
        const total = 3 * 60 * 1000;
        if (remaining <= 0) {
            setQrPass(null); setIsQrModalOpen(false);
            return true; 
        } else {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setQrTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
            setQrProgress((remaining / total) * 100);
            return false;
        }
    };

    const isExpired = updateProgress();
    if (isExpired) return;
    const interval = setInterval(() => { if(updateProgress()) clearInterval(interval); }, 1000);
    return () => clearInterval(interval);
  }, [qrPass]);

  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    try {
      // Đổi giờ sang chuẩn ISO tránh lệch múi giờ Backend
      const payload = { ...guestFormData, visit_start_time: new Date(guestFormData.visit_start_time).toISOString(), visit_end_time: new Date(guestFormData.visit_end_time).toISOString() };
      const res = await fetch('http://localhost:5000/api/v1/citizens/guests', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) { addNotification("Đã đăng ký khách thành công.", "success"); fetchGuests(); setIsGuestModalOpen(false); } 
      else { const err = await res.json(); addNotification(err.message || "Lỗi đăng ký khách", "error"); }
    } catch(e) {}
  };

  const handleDeleteGuest = async (id, name) => {
    if (!window.confirm(`Hủy lịch hẹn của khách ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/citizens/guests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (res.ok) { addNotification(`Đã hủy lịch khách ${name}.`, "success"); fetchGuests(); }
    } catch(e) {}
  };

  const renderVehicleIcon = (type) => {
    const iconClass = "w-12 h-12 md:w-16 md:h-16 object-contain text-blue-600";
    switch (type?.toLowerCase()) {
      case 'car': return <CarFront className={iconClass} />;
      case 'motorbike': return <Bike className={`${iconClass} text-orange-500`} />;
      case 'truck': return <Truck className={`${iconClass} text-gray-700`} />;
      default: return <CarFront className={`${iconClass} text-gray-400`} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-[300px] bg-gray-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800 flex items-center">
          <h1 className="text-2xl font-black italic flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
        </div>
        <div className="flex-1 py-6 space-y-2 px-4">
          <button onClick={() => setActiveTab('vehicles')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'vehicles' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Car className="w-5 h-5" /> <span>Vehicle Management</span>
          </button>
          <button onClick={() => { setActiveTab('guests'); fetchGuests(); fetchActiveOtp(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'guests' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Users className="w-5 h-5" /> <span>Guest Registration</span>
          </button>
        </div>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }} className="w-full flex items-center justify-center space-x-2 text-sm font-bold text-red-100 hover:bg-red-500 hover:text-white transition-colors bg-orange-500/90 px-4 py-3 rounded-xl">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white h-20 shadow-sm border-b px-8 flex justify-between items-center z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">
              {activeTab === 'vehicles' ? 'My Registered Vehicles' : 'Guest Access Management'}
            </h2>
            {activeTab === 'vehicles' && (
              <button onClick={() => activeTab === 'vehicles' ? handleRefresh() : (fetchGuests(), fetchActiveOtp())} className={`p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 ${isRefreshing ? 'opacity-50' : ''}`}>
                <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-6">
            {/* NÚT TẠO QR ĐỊNH DANH */}
            <button onClick={generateQR} className="flex items-center space-x-2 bg-[#005B9F] hover:bg-blue-800 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
              <QrCode className="w-5 h-5" />
              <span className="hidden md:inline">MY QR PASS</span>
            </button>
            
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">{notifications.length}</span>}
              </button>
              
              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-gray-50 px-4 py-3 border-b font-black text-gray-700 flex justify-between items-center">
                    Notifications <span className="text-xs text-gray-400 cursor-pointer hover:text-[#005B9F]" onClick={() => setNotifications([])}>Clear All</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.length === 0 ? <p className="text-center text-gray-400 py-6 text-sm font-medium">No new notifications</p> : 
                      notifications.map(n => (
                        <div key={n.id} className="p-3 mb-1 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-800 font-medium">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/>{n.time}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
              <div onClick={() => navigate('/profile')} className="flex items-center space-x-3 pl-6 border-l border-gray-200 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-all" title="Xem thông tin cá nhân">
                  <div className="bg-gray-100 p-1.5 rounded-lg border border-gray-200"><User className="w-5 h-5 text-gray-600" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm">{localStorage.getItem('full_name') || 'CITIZEN'}</span>
                    <span className="text-[10px] text-[#005B9F] font-bold uppercase tracking-wider">Citizen</span>
                  </div>
              </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {activeTab === 'vehicles' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <p className="text-gray-500 font-medium">Manage and track your vehicle status in the residential area</p>
                <button onClick={handleOpenAdd} className="bg-[#FF6B00] hover:bg-[#e66000] text-white flex items-center space-x-2 px-6 py-3 rounded-xl font-black shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                  <Plus className="w-5 h-5" /> <span>REGISTER VEHICLE</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#005B9F]"></div></div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {vehicles?.map((vehicle) => (
                    <div key={vehicle.vehicle_id} className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-200 relative overflow-hidden group hover:shadow-md transition-shadow">
                      
                      <div className="absolute top-6 right-6 flex space-x-2 z-10">
                        <button 
                          onClick={() => toggleVehicleLogs(vehicle.vehicle_id, vehicle.license_plate)}
                          className={`p-2.5 rounded-xl transition-colors ${expandedVehicleLogs === vehicle.vehicle_id ? 'bg-blue-600 text-white' : 'text-gray-500 bg-gray-50 hover:bg-blue-50 hover:text-blue-600'}`}
                          title="View History"
                        >
                          <History className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button onClick={() => handleOpenEdit(vehicle)} className="p-2.5 text-gray-500 hover:text-[#005B9F] bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors"><Edit className="w-4 h-4 md:w-5 md:h-5" /></button>
                        <button onClick={() => handleDeleteRequest(vehicle)} className="p-2.5 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex items-center space-x-6">
                          <div className="p-4 md:p-5 bg-gray-50 rounded-2xl border border-gray-100 shrink-0">
                            {renderVehicleIcon(vehicle.vehicle_type)}
                          </div>
                          <div className="space-y-3">
                            <p className="text-3xl md:text-4xl font-black text-gray-900 tracking-widest uppercase">
                              {vehicle.license_plate || 'N/A'}
                            </p>
                            
                            {vehicle.status !== 'approved' ? (
                              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border bg-amber-50 text-amber-600 border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>{vehicle.status === 'pending_new' ? 'PENDING REGISTRATION' : 'PENDING UPDATE'}</span>
                              </div>
                            ) : (
                              <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${vehicle.is_inside ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                <Circle className={`w-2 h-2 ${vehicle.is_inside ? 'fill-green-500' : 'fill-gray-400'}`} />
                                <span>{vehicle.is_inside ? 'INSIDE' : 'OUTSIDE'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100 text-sm">
                        <div>
                          <p className="text-gray-400 font-black uppercase text-[10px] tracking-wider">Vehicle Type</p>
                          <p className="font-bold text-gray-800 capitalize mt-1 text-base">{vehicle.vehicle_type}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-black uppercase text-[10px] tracking-wider">Color</p>
                          <p className="font-bold text-gray-800 capitalize mt-1 text-base">{vehicle.vehicle_color || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-black uppercase text-[10px] tracking-wider flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Registered</p>
                          {/* SỬA LẠI ĐỂ DATE KHÔNG BỊ LỖI KHI BỌC QUA DẠNG STRING CỦA TO LOCALE */}
                          <p className="font-bold text-gray-800 mt-1 text-base">{vehicle.registered_at ? formatVN(vehicle.registered_at, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-[#005B9F] font-black uppercase text-[10px] tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last Access
                          </p>
                          <p className="font-bold text-gray-900 mt-1 text-base">
                            {/* ĐÃ THÊM NGÀY ĐẦY ĐỦ VÀO LAST ACCESS THEO YÊU CẦU */}
                            {vehicle.last_log_time ? formatVN(vehicle.last_log_time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                          </p>
                        </div>
                      </div>

                      {expandedVehicleLogs === vehicle.vehicle_id && (
                        <div className="mt-6 pt-6 border-t border-dashed border-gray-200 animate-in slide-in-from-top-2">
                          <h4 className="text-xs font-black text-gray-400 uppercase mb-4 flex items-center">
                            <ArrowRightLeft className="w-3 h-3 mr-2" /> Recent Activity Logs
                          </h4>
                          <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {vehicleLogsData[vehicle.vehicle_id]?.length > 0 ? (
                              vehicleLogsData[vehicle.vehicle_id].map((log, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${log.lane_name?.toLowerCase().includes('vào') ? 'bg-blue-500' : 'bg-[#FF6B00]'}`}></div>
                                    <span className="font-bold text-gray-700 text-sm">{log.lane_name || 'Cổng chính'}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-gray-900">{formatVN(log.check_in_time, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{formatVN(log.check_in_time, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-center py-4 text-sm text-gray-400 font-medium italic">No recent logs for this vehicle.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {vehicles?.length === 0 && <div className="col-span-full text-center py-20 text-gray-400 font-bold text-lg">You have not registered any vehicles yet.</div>}
                </div>
              )}
            </>
          )}
          {/* TAB 2: GUESTS & OTP */}
          {/* TAB 2: GUESTS & OTP */}
          {activeTab === 'guests' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* KHU VỰC 1: LỊCH HẸN KHÁCH (Bên Trái) */}
              <div className="xl:col-span-2 flex flex-col space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 flex items-center"><CalendarDays className="w-6 h-6 mr-2 text-[#005B9F]" /> SCHEDULED GUESTS</h3>
                    <p className="text-gray-500 text-sm mt-1">Pre-register visitors to grant automatic AI gate access.</p>
                  </div>
                  <button onClick={() => setIsGuestModalOpen(true)} className="bg-[#005B9F] hover:bg-blue-800 text-white flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all">
                    <UserPlus className="w-5 h-5" /> <span className="hidden md:inline">ADD GUEST</span>
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 font-black text-gray-400 text-xs uppercase tracking-wider">
                    <div className="col-span-3">Guest Name</div><div className="col-span-3">License Plate</div><div className="col-span-4">Valid Window (Time)</div><div className="col-span-2 text-center">Action</div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                    {guests.length === 0 ? (
                      <p className="text-center py-10 text-gray-400 font-medium italic">No scheduled guests. Click "Add Guest" to create one.</p>
                    ) : (
                      guests.map(g => (
                        <div key={g.registration_id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-blue-50/50 transition-colors">
                          <div className="col-span-3 font-bold text-gray-800 truncate">{g.guest_name}</div>
                          <div className="col-span-3 flex items-center space-x-2">
                            <span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded font-black text-gray-700 uppercase tracking-widest text-xs">{g.guest_license_plate}</span>
                          </div>
                          <div className="col-span-4 text-xs font-medium text-gray-500">
                            <div className="flex items-center text-green-600"><Circle className="w-2 h-2 fill-green-500 mr-1.5"/>{formatVN(g.visit_start_time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="flex items-center text-red-500 mt-1"><Circle className="w-2 h-2 fill-red-500 mr-1.5"/>{formatVN(g.visit_end_time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <button onClick={() => handleDeleteGuest(g.registration_id, g.guest_name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancel Registration">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* KHU VỰC 2: MÃ OTP KHẨN CẤP (Bên Phải) */}
              <div className="xl:col-span-1">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border-2 border-orange-100 flex flex-col items-center justify-center text-center relative overflow-hidden h-full min-h-[400px]">
                  <KeyRound className="absolute -bottom-10 -right-10 w-64 h-64 text-orange-50 opacity-50 pointer-events-none" />
                  <div className="z-10 w-full flex flex-col items-center">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4"><Ticket className="w-8 h-8 text-[#FF6B00]" /></div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-wide">Emergency Access</h3>
                    <p className="text-gray-500 text-sm mt-2 mb-8 px-4">Generate a 3-minute 6-digit OTP for sudden visitors.</p>

                    {!activeOtp ? (
                      <button onClick={generateOTP} className="w-full max-w-[250px] bg-[#FF6B00] hover:bg-[#e66000] text-white py-4 rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(255,107,0,0.3)] transition-transform transform hover:-translate-y-1">
                        GENERATE OTP
                      </button>
                    ) : (
                      <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <div className="bg-gray-50 w-full rounded-2xl py-6 border-2 border-dashed border-gray-300 mb-6 relative">
                          <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2">Your Code Is</p>
                          <p className="text-5xl font-black text-[#005B9F] tracking-[0.2em] ml-3 font-mono">
                            {activeOtp.token_data || activeOtp.otp_code}
                          </p>
                        </div>
                        <div className="w-full flex items-center justify-between text-sm font-bold text-gray-600 mb-2 px-2">
                          <span className="flex items-center"><Timer className="w-4 h-4 mr-1 text-[#FF6B00] animate-pulse"/> Expires in</span>
                          <span className="text-[#FF6B00] font-black">{otpTimeLeftStr}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-orange-400 to-[#FF6B00] h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${otpProgress}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* MODAL ADD/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#005B9F] p-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black">{editMode ? 'EDIT VEHICLE INFO' : 'REGISTER NEW VEHICLE'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-800 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">License Plate</label>
                <input type="text" required value={formData.license_plate} onChange={(e) => setFormData({...formData, license_plate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B00] font-bold text-lg uppercase" placeholder="e.g. 51G-123.45" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle Type</label>
                  <select value={formData.vehicle_type} onChange={(e) => setFormData({...formData, vehicle_type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B00] font-bold">
                    <option value="car">Car</option><option value="motorbike">Motorbike</option><option value="bicycle">Bicycle</option><option value="truck">Truck</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Color</label>
                  <input type="text" required value={formData.vehicle_color} onChange={(e) => setFormData({...formData, vehicle_color: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF6B00] font-bold" placeholder="e.g. Trắng" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-[#005B9F] text-white font-black rounded-xl shadow-md hover:bg-blue-800 transition-colors">{editMode ? 'UPDATE' : 'REGISTER'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL ADD GUEST */}
      {isGuestModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-gray-50 border-b border-gray-100 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900">Schedule a Guest</h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">Allow automatic AI gate entry.</p>
              </div>
              <button onClick={() => setIsGuestModalOpen(false)} className="bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white transition-colors p-2 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleGuestSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Guest Full Name</label>
                <input type="text" required value={guestFormData.guest_name} onChange={(e) => setGuestFormData({...guestFormData, guest_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 font-bold" placeholder="e.g. Nguyen Van A" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">License Plate</label>
                  <input type="text" required value={guestFormData.guest_license_plate} onChange={(e) => setGuestFormData({...guestFormData, guest_license_plate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 font-bold uppercase" placeholder="51G-12345" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle Type</label>
                  <select value={guestFormData.vehicle_type} onChange={(e) => setGuestFormData({...guestFormData, vehicle_type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 font-bold">
                    <option value="motorbike">Motorbike</option><option value="car">Car</option><option value="truck">Truck</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-[11px] font-black text-[#005B9F] uppercase mb-1">Valid From</label>
                  <input type="datetime-local" required value={guestFormData.visit_start_time} onChange={(e) => setGuestFormData({...guestFormData, visit_start_time: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-blue-200 bg-white focus:border-blue-500 text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-red-600 uppercase mb-1">Valid Until</label>
                  <input type="datetime-local" required value={guestFormData.visit_end_time} onChange={(e) => setGuestFormData({...guestFormData, visit_end_time: e.target.value})} className="w-full px-3 py-2.5 rounded-lg border border-red-200 bg-white focus:border-red-500 text-sm font-bold" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full px-4 py-4 bg-[#005B9F] text-white font-black rounded-xl shadow-lg hover:bg-blue-800 transition-colors flex justify-center items-center">
                  <UserPlus className="w-5 h-5 mr-2" /> CREATE GUEST PASS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MÃ QR ĐỊNH DANH */}
      {isQrModalOpen && qrPass && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex justify-center items-center z-[60] p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col items-center p-8 text-center relative">
            <button onClick={() => setIsQrModalOpen(false)} className="absolute top-4 right-4 bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            
            <h3 className="text-2xl font-black text-gray-900 mb-2">My QR Pass</h3>
            <p className="text-gray-500 text-sm mb-6">Scan this code at the camera to open the gate.</p>
            
            <div className="bg-white p-4 rounded-2xl border-4 border-[#005B9F] shadow-lg mb-6">
              {/* Dùng API ngoài để vẽ hình QR từ chuỗi UUID mà không cần tải thư viện */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrPass.qr_data}`} alt="QR Code" className="w-48 h-48" />
            </div>

            <div className="w-full flex items-center justify-between text-sm font-bold text-gray-600 mb-2 px-2">
              <span className="flex items-center"><Timer className="w-4 h-4 mr-1 text-[#005B9F] animate-pulse"/> Expires in</span>
              <span className="text-[#005B9F] font-black">{qrTimeLeftStr}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-blue-400 to-[#005B9F] h-3 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${qrProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CitizenDashboard;