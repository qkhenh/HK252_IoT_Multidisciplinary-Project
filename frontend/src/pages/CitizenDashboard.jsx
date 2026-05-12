import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Bike, Truck, LogOut, User, Zap, Circle, Plus, Edit, X, Clock, RotateCw, Trash2, Bell, Users, Car, CalendarDays } from 'lucide-react';
import { io } from 'socket.io-client'; // Import thư viện WebSocket

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vehicles'); 
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' });

  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const addNotification = (message, type = 'success') => {
    const newNotif = { id: Date.now() + Math.random(), message, type, time: new Date().toLocaleTimeString('vi-VN') };
    setNotifications(prev => [newNotif, ...prev]);
  };

  useEffect(() => {
    fetchVehicles();

    // 1. Kết nối Socket.io
    const socket = io('http://localhost:5000');

    // 2. Lấy user_id hiện tại từ API auth/me để tham gia đúng phòng (Room)
    fetch('http://localhost:5000/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data.user_id) {
        socket.emit('join_user_room', data.data.user_id);
      }
    });

    // 3. Lắng nghe thông báo TỪ MANAGER (LUỒNG 1 & 2)
    socket.on('vehicle_status_changed', (data) => {
      if (data.status === 'approved') {
        addNotification(`✅ ${data.message}`, 'success');
      } else {
        addNotification(`❌ ${data.message}`, 'error');
      }
      // Tải lại danh sách xe ngay lập tức để cập nhật UI (hiện xe, biến mất xe, hoặc đổi thông tin)
      fetchVehicles(true, true);
    });

    return () => socket.disconnect();
  }, []);

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
        // THÔNG BÁO CITIZEN GỬI YÊU CẦU THÀNH CÔNG
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
        // LUỒNG 3: XÓA XE CHỈ HIỆN BÊN CITIZEN
        addNotification(`Đã xóa xe ${vehicle.license_plate} thành công.`, 'success');
        fetchVehicles(true);
      }
    } catch (error) { alert('Lỗi kết nối máy chủ!'); }
  };

  const renderVehicleIcon = (type) => {
    const safeType = type ? String(type).toLowerCase() : 'unknown';
    const iconClass = "w-12 h-12 md:w-16 md:h-16 object-contain text-[#005B9F]";
    switch (safeType) {
      case 'car': return <CarFront className={iconClass} />;
      case 'motorbike': return <Bike className={`${iconClass} text-[#FF6B00]`} />;
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
          <button onClick={() => setActiveTab('guests')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'guests' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
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
              {activeTab === 'vehicles' ? 'My Registered Vehicles' : 'Guest Registration'}
            </h2>
            {activeTab === 'vehicles' && (
              <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 ${isRefreshing ? 'opacity-50' : ''}`}>
                <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-6">
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

                      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100 text-sm">
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
                          <p className="font-bold text-gray-800 mt-1 text-base">{vehicle.registered_at ? new Date(vehicle.registered_at).toLocaleDateString('vi-VN') : 'Unknown'}</p>
                        </div>
                      </div>

                    </div>
                  ))}
                  {vehicles?.length === 0 && <div className="col-span-full text-center py-20 text-gray-400 font-bold text-lg">You have not registered any vehicles yet.</div>}
                </div>
              )}
            </>
          )}
        </main>
      </div>

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
    </div>
  );
};

export default CitizenDashboard;