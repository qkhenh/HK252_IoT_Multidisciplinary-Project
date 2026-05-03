import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Bike, Truck, LogOut, User, Zap, Circle, Plus, Edit, X, Clock, RotateCw, Trash2, Bell, Users, Car } from 'lucide-react';

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vehicles'); // Tab điều hướng
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' });

  // State thông báo
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const addNotification = (message, type = 'success') => {
    const newNotif = { id: Date.now(), message, type, time: new Date().toLocaleTimeString('vi-VN') };
    setNotifications(prev => [newNotif, ...prev]);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const response = await fetch('http://localhost:5000/api/v1/citizens/vehicles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : (data.data || [])); 
      } else {
        throw new Error("Lỗi API");
      }
      if (isRefresh) await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.log("Lỗi fetch:", error.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => fetchVehicles(true);

  const handleOpenAdd = () => {
    setEditMode(false);
    setFormData({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vehicle) => {
    setEditMode(true);
    setFormData({ 
      vehicle_id: vehicle.vehicle_id, 
      license_plate: vehicle.license_plate || '', 
      vehicle_type: vehicle.vehicle_type || 'car', 
      vehicle_color: vehicle.vehicle_color || '' 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editMode 
        ? `http://localhost:5000/api/v1/citizens/vehicles/${formData.vehicle_id}`
        : 'http://localhost:5000/api/v1/citizens/vehicles';
        
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({
          license_plate: formData.license_plate, vehicle_type: formData.vehicle_type, vehicle_color: formData.vehicle_color
        })
      });

      if (response.ok) {
        const resData = await response.json();
        addNotification(resData.message || (editMode ? 'Yêu cầu cập nhật xe đã được gửi' : 'Yêu cầu đăng ký xe mới đã được gửi'));
        fetchVehicles(true);
        setIsModalOpen(false);
      } else {
        const errData = await response.json();
        alert(`❌ Lỗi: ${errData.message}`);
      }
    } catch (error) {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  const handleDeleteRequest = async (vehicle) => {
    if (!window.confirm(`Yêu cầu xóa xe ${vehicle.license_plate}?`)) return;
    try {
      const response = await fetch(`http://localhost:5000/api/v1/citizens/vehicles/${vehicle.vehicle_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (response.ok) {
        addNotification(`Đã gửi yêu cầu xóa xe ${vehicle.license_plate} đến Ban quản lý.`);
        fetchVehicles(true);
      } else {
        alert("Lỗi không thể xóa xe");
      }
    } catch (error) { alert('Lỗi kết nối máy chủ!'); }
  };

  const renderVehicleIcon = (type) => {
    const safeType = type ? String(type).toLowerCase() : 'unknown';
    const iconClass = "w-16 h-16 object-contain opacity-80 group-hover:opacity-100 transition-opacity";
    switch (safeType) {
      case 'car': return <CarFront className={`${iconClass} text-blue-600`} />;
      case 'motorbike': return <Bike className={`${iconClass} text-orange-500`} />;
      case 'truck': return <Truck className={`${iconClass} text-gray-700`} />;
      default: return <CarFront className={`${iconClass} text-gray-400`} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-[300px] bg-gray-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-gray-1000 flex items-center">
          <h1 className="text-2xl font-black italic flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
        </div>
        <div className="flex-1 py-6 space-y-2 px-4">
          <button 
            onClick={() => setActiveTab('vehicles')} 
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'vehicles' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Car className="w-5 h-5" /> <span>Vehicle Management</span>
          </button>
          <button 
            onClick={() => setActiveTab('guests')} 
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'guests' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <Users className="w-5 h-5" /> <span>Guest Registration</span>
          </button>
        </div>
        <div className="p-4 border-t border-gray-1000">
          <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }} className="w-full flex items-center justify-center space-x-2 text-sm font-bold text-red-100 hover:bg-red-500 hover:text-white transition-colors bg-orange-500/90 px-4 py-3 rounded-xl">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* TOP HEADER */}
        <header className="bg-white h-20 shadow-sm border-b px-8 flex justify-between items-center z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-gray-800 tracking-tight">
              {activeTab === 'vehicles' ? 'My Registered Vehicles' : 'Guest Registration'}
            </h2>
            {activeTab === 'vehicles' && (
              <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 ${isRefreshing ? 'opacity-50' : ''}`}>
                <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-6">
            {/* NOTIFICATION BELL */}
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              {/* NOTIFICATION DROPDOWN */}
              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-gray-50 px-4 py-3 border-b font-black text-gray-700 flex justify-between items-center">
                    Notifications
                    <span className="text-xs text-gray-400 cursor-pointer hover:text-blue-600" onClick={() => setNotifications([])}>Clear All</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm font-medium">No new notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-3 mb-1 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-800 font-medium">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/>{n.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                <div className="bg-gray-100 p-1.5 rounded-lg border border-gray-200"><User className="w-5 h-5 text-gray-600" /></div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 text-sm">HOA</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Citizen</span>
                </div>
              </div>
            </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          
          {/* VIEW: VEHICLES MANAGEMENT */}
          {activeTab === 'vehicles' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <p className="text-gray-500 font-medium">Manage and track your vehicle status in the residential area.</p>
                <button onClick={handleOpenAdd} className="bg-[#FF6B00] hover:bg-[#e66000] text-white flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                  <Plus className="w-5 h-5" /> <span>REGISTER VEHICLE</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005B9F]"></div></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {vehicles?.map((vehicle) => (
                    <div key={vehicle.vehicle_id || Math.random()} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-300 relative overflow-hidden group">
                      <div className="absolute top-4 right-4 flex space-x-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(vehicle)} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteRequest(vehicle)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <div className="flex items-center space-x-4 mb-6">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">{renderVehicleIcon(vehicle.vehicle_type)}</div>
                        
                        {vehicle.status !== 'approved' ? (
                          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-l font-bold shadow-sm border ${vehicle.status === 'pending_delete' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            <Clock className="w-3 h-3" />
                            <span>{vehicle.status === 'pending_new' ? 'PENDING REGISTRATION' : vehicle.status === 'pending_update' ? 'PENDING UPDATE' : 'PENDING DELETE'}</span>
                          </div>
                        ) : (
                          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-l font-bold shadow-sm border ${vehicle.is_inside ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            <Circle className={`w-2 h-2 ${vehicle.is_inside ? 'fill-green-500' : 'fill-gray-400'}`} />
                            <span>{vehicle.is_inside ? 'INSIDE' : 'OUTSIDE'}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-2xl font-black text-gray-800 bg-gray-100 inline-block px-3 py-1 rounded-md border border-gray-300 tracking-widest uppercase">{vehicle.license_plate || 'N/A'}</p>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 text-sm">
                          <div><p className="text-gray-400 font-bold uppercase text-[10px]">Type</p><p className="font-bold text-gray-700 capitalize">{vehicle.vehicle_type}</p></div>
                          <div><p className="text-gray-400 font-bold uppercase text-[10px]">Color</p><p className="font-bold text-gray-700 capitalize">{vehicle.vehicle_color}</p></div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {vehicles?.length === 0 && <div className="col-span-full text-center py-12 text-gray-400 font-bold">You have not registered any vehicles yet.</div>}
                </div>
              )}
            </>
          )}

          {/* VIEW: GUEST REGISTRATION (Placeholder) */}
          {activeTab === 'guests' && (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-gray-700">Guest Registration Module</h3>
              <p className="text-gray-500 mt-2">Tính năng đăng ký khách đang được phát triển...</p>
            </div>
          )}

        </main>
      </div>

      {/* MODAL FORM */}
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-[#005B9F] text-white font-black rounded-xl shadow-md hover:bg-blue-800">{editMode ? 'UPDATE' : 'REGISTER'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenDashboard;