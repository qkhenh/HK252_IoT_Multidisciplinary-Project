import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, Bike, Truck, LogOut, User, Zap, Circle, Plus, Edit, X, Clock, RotateCw } from 'lucide-react';

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ vehicle_id: null, license_plate: '', vehicle_type: 'car', vehicle_color: '' });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setLoading(true);

      const response = await fetch('http://localhost:5000/api/v1/citizens/vehicles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : (data.data || [])); 
      } else {
        throw new Error("Lỗi API hoặc chưa đăng nhập");
      }

      // Ép icon xoay ít nhất 0.8 giây để User kịp nhìn thấy hiệu ứng
      if (isRefresh) await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      console.log("Fallback sang Mock Data vì lỗi:", error.message);
      setVehicles([
        { vehicle_id: 'v1', license_plate: '51F-123.45', vehicle_type: 'car', vehicle_color: 'Trắng', is_active: true, is_inside: true },
        { vehicle_id: 'v2', license_plate: '59A1-12345', vehicle_type: 'motorbike', vehicle_color: 'Đen', is_active: true, is_inside: false },
        { vehicle_id: 'v3', license_plate: '99A-999.99', vehicle_type: 'car', vehicle_color: 'Đỏ', is_active: false, is_inside: false }
      ]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchVehicles(true);
  };

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

  // --- ĐÃ CẬP NHẬT GỌI API PUT THẬT CHO CHỨC NĂNG EDIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        const response = await fetch(`http://localhost:5000/api/v1/citizens/vehicles/${formData.vehicle_id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
          },
          body: JSON.stringify({
            license_plate: formData.license_plate,
            vehicle_type: formData.vehicle_type,
            vehicle_color: formData.vehicle_color
          })
        });

        if (response.ok) {
          const resData = await response.json();
          // Lấy message thành công từ Backend ("Cập nhật thông tin xe thành công...")
          alert(`✅ ${resData.message || 'Cập nhật thành công!'}`);
          fetchVehicles(true); // Tự động xoay icon và tải lại danh sách mới
          setIsModalOpen(false);
        } else {
          const errData = await response.json();
          alert(`❌ Cập nhật thất bại: ${errData.message || 'Lỗi hệ thống'}`);
        }

      } else {
        // Chức năng Thêm mới (POST)
        const response = await fetch('http://localhost:5000/api/v1/citizens/vehicles', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
          },
          body: JSON.stringify({
            license_plate: formData.license_plate,
            vehicle_type: formData.vehicle_type,
            vehicle_color: formData.vehicle_color
          })
        });

        if (response.ok) {
          fetchVehicles(true);
          setIsModalOpen(false);
        } else {
          const errData = await response.json();
          alert(`❌ Đăng ký xe thất bại: ${errData.message || 'Lỗi không xác định'}`);
        }
      }
    } catch (error) {
      alert("Lỗi kết nối máy chủ khi submit form!");
      setIsModalOpen(false);
    }
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
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col w-full relative">
      <div className="bg-[#005B9F] flex items-center justify-between px-6 py-4 shadow-md w-full border-b-4 border-[#FF6B00] sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-black italic text-white flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
          <button 
            onClick={handleRefresh}
            className={`p-2 hover:bg-blue-800 rounded-full transition-all duration-300 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isRefreshing}
            title="Refresh Data"
          >
            <RotateCw className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center space-x-6 text-white font-bold">
          <div className="flex items-center space-x-2 bg-blue-800 px-4 py-2 rounded-lg border border-blue-700 shadow-inner">
            <User className="w-5 h-5 text-blue-200" /> 
            <span className="tracking-wide">CITIZEN_HOA</span>
          </div>
          <button onClick={() => navigate('/')} className="flex items-center space-x-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors bg-white px-4 py-2 rounded-lg shadow-sm">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">My Registered Vehicles</h2>
            <p className="text-gray-500 font-medium mt-1">Manage and track your vehicle status in the residential area.</p>
          </div>
          <button onClick={handleOpenAdd} className="bg-[#FF6B00] hover:bg-[#e66000] text-white flex items-center space-x-2 px-6 py-3 rounded-xl font-black shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
            <Plus className="w-6 h-6" /> <span>REGISTER VEHICLE</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005B9F]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles?.map((vehicle) => (
              <div key={vehicle.vehicle_id || Math.random()} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 group relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-2 ${!vehicle.is_active ? 'bg-red-500' : vehicle.is_inside ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <button onClick={() => handleOpenEdit(vehicle)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#005B9F] hover:bg-blue-50 rounded-lg transition-colors z-10">
                  <Edit className="w-5 h-5" />
                </button>
                <div className="flex justify-between items-start mb-6 mt-2">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                    {renderVehicleIcon(vehicle.vehicle_type)}
                  </div>
                  {!vehicle.is_active ? (
                    <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm border bg-red-50 text-red-600 border-red-200 mt-2 mr-8">
                      <Clock className="w-4 h-4" />
                      <span>PENDING APPROVAL</span>
                    </div>
                  ) : (
                    <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm border mt-2 mr-8 ${vehicle.is_inside ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      <Circle className={`w-3 h-3 ${vehicle.is_inside ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`} />
                      <span>{vehicle.is_inside ? 'INSIDE' : 'OUTSIDE'}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">License Plate</p>
                    <p className="text-2xl font-black text-gray-800 bg-gray-100 inline-block px-3 py-1 rounded-md border-2 border-gray-200 tracking-widest uppercase">
                      {vehicle.license_plate || 'N/A'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Type</p>
                      <p className="text-gray-800 font-bold capitalize">{vehicle.vehicle_type || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Color</p>
                      <p className="text-gray-800 font-bold capitalize">{vehicle.vehicle_color || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {vehicles?.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 font-bold">
                You have not registered any vehicles yet.
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-[#005B9F] p-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black">{editMode ? 'EDIT VEHICLE INFO' : 'REGISTER NEW VEHICLE'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-blue-800 p-1.5 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">License Plate</label>
                <input 
                  type="text" required
                  value={formData.license_plate} onChange={(e) => setFormData({...formData, license_plate: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#FF6B00] focus:ring-0 text-gray-800 font-bold text-lg uppercase"
                  placeholder="e.g. 51G-123.45"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle Type</label>
                  <select 
                    value={formData.vehicle_type} onChange={(e) => setFormData({...formData, vehicle_type: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#FF6B00] text-gray-800 font-bold"
                  >
                    <option value="car">Car</option>
                    <option value="motorbike">Motorbike</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="truck">Truck</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Color</label>
                  <input 
                    type="text" required
                    value={formData.vehicle_color} onChange={(e) => setFormData({...formData, vehicle_color: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#FF6B00] text-gray-800 font-bold"
                    placeholder="e.g. Trắng"
                  />
                </div>
              </div>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-4 text-sm text-yellow-800 font-medium">
                Information updates or new registrations will require manager approval before becoming active.
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-[#005B9F] text-white font-black rounded-xl shadow-md hover:bg-blue-800 hover:shadow-lg transition-all">
                  {editMode ? 'UPDATE & SUBMIT' : 'REGISTER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenDashboard;