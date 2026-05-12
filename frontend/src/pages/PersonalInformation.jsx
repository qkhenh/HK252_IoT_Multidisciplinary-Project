import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, MapPin, Phone, ShieldCheck, KeyRound, PhoneCall, FileText } from 'lucide-react';

const PersonalInformation = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Lấy thông tin user từ API /auth/me
    fetch('http://localhost:5000/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Không thể xác thực người dùng');
      return res.json();
    })
    .then(json => { 
      if(json.success) {
        setUserData(json.data); 
      } else {
        setError(json.message);
      }
    })
    .catch(err => setError(err.message));
  }, []);

  if (error) return <div className="p-20 text-center font-bold text-red-500 bg-red-50 min-h-screen">Lỗi: {error}</div>;
  if (!userData) return <div className="p-20 text-center font-bold text-gray-500 bg-gray-50 min-h-screen">Đang tải thông tin cá nhân...</div>;

  // Helper Component để render từng dòng thông tin (giống hàng trong bảng)
  const InfoFieldRow = ({ icon: Icon, label, value }) => (
    <div className="grid grid-cols-[200px,1fr] items-center gap-6 py-5 px-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors duration-200">
      <div className="flex items-center space-x-3 text-gray-600">
        <Icon className="w-5 h-5 text-[#005B9F]" />
        <span className="font-semibold text-gray-700">{label}</span>
      </div>
      <span className="font-bold text-gray-900 text-lg break-words">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-12 font-sans text-gray-900">
      {/* Nút quay lại */}
      <button onClick={() => navigate(-1)} className="flex items-center space-x-2.5 text-gray-600 hover:text-[#005B9F] font-bold mb-10 group transition-all">
        <ArrowLeft size={22} className="group-hover:-translate-x-1.5 transition-transform duration-300"/> 
        <span className="text-lg">Back to Homepage</span>
      </button>

      <div className="max-w-5xl mx-auto space-y-10">
        {/* === BẢNG THÔNG TIN CHÍNH (Unified Information Panel) === */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          
          {/* Header của bảng: Chứa Avatar (Hardcoded Image), Tên, Role */}
          <div className="p-10 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100 flex flex-col md:flex-row items-center gap-8">
            <div className="relative shrink-0">
              {/* === HARDCODED PROFILE IMAGE === */}
              <img 
                className="w-36 h-36 rounded-full object-cover shadow-xl border-4 border-white"
              />
              <span className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white" title="Online"></span>
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-3">
              <span className="inline-block px-4 py-1.5 bg-[#005B9F]/10 text-[#005B9F] rounded-full text-xs font-black uppercase tracking-widest border border-[#005B9F]/20">
                {userData?.role || 'Guest'}
              </span>
              <h1 className="text-4xl font-black text-gray-950 tracking-tighter">{userData?.full_name || 'Người dùng'}</h1>
              <p className="text-gray-600 text-lg font-medium">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
            </div>

            <button className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all active:scale-95 shrink-0">
              CHỈNH SỬA HỒ SƠ
            </button>
          </div>

          {/* Body của bảng: Chứa các dòng dữ liệu kẻ ô */}
          <div className="p-6 md:p-10 space-y-10">
            
            {/* Phân mục 1: ACCOUNT DETAILS */}
            <section>
              <h3 className="text-sm font-black text-black-400 uppercase tracking-widest mb-4 px-3 flex items-center space-x-2">
                <ShieldCheck size={16}/> <span>Account Details</span>
              </h3>
              <div className="border border-gray-300 rounded-2xl overflow-hidden divide-y divide-gray-300 bg-white">
                <InfoFieldRow 
                  icon={FileText} 
                  label="System User ID" 
                  value={userData?.user_id ? String(userData.user_id) : 'N/A'} 
                />
                <InfoFieldRow 
                  icon={KeyRound} 
                  label="Username" 
                  value={userData?.username} 
                />
                <InfoFieldRow 
                  icon={Mail} 
                  label="Email Address" 
                  value={userData?.email || 'Chưa cập nhật'} 
                />
              </div>
            </section>

            {/* Phân mục 2: LOCATION & CONTACT */}
            <section>
              <h3 className="text-sm font-black text-black-400 uppercase tracking-widest mb-4 px-3 flex items-center space-x-2">
                <MapPin size={16} className="text-[#FF6B00]"/> <span>Location & Contact</span>
              </h3>
              <div className="border border-gray-300 rounded-2xl overflow-hidden divide-y divide-gray-300 bg-white">
                <InfoFieldRow 
                  icon={MapPin} 
                  label="Zone / Address" 
                  value="Khu A - Tòa Nhà SmartPass" 
                />
                <InfoFieldRow 
                  icon={Phone} 
                  label="Contact Number" 
                  value="09xx-xxx-xxx" 
                />
              </div>
            </section>

          </div>
        </div>

        {/* === PHẦN THÔNG TIN BẢO TRÌ (Chỉ Manager thấy) === */}
        {userData?.role === 'manager' && (
          <div className="bg-orange-50 border-2 border-orange-100 p-8 rounded-[32px] space-y-6 shadow-sm">
             <h3 className="text-xl font-black text-orange-800 flex items-center space-x-3 border-b border-orange-100 pb-4">
              <PhoneCall size={24}/> <span>Support & System Maintenance (Manager Only)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-white p-6 rounded-2xl border border-orange-200 shadow-inner">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Nhà cung cấp thiết bị</p>
                <p className="font-black text-2xl text-[#005B9F] mt-2 italic tracking-tight">IoT Multidisciplinary - Group 8</p>
                <p className="text-base font-bold text-gray-600 mt-2">Hotline kỹ thuật: <span className='font-black text-orange-600'>1900-XXXX</span> (24/7)</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-orange-200 shadow-inner">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Lịch bảo trì hệ thống định kỳ</p>
                <p className="font-black text-2xl text-orange-700 mt-2 tracking-tight">Chủ nhật cuối cùng của tháng</p>
                <p className="text-base font-bold text-gray-600 mt-2">Thời gian dự kiến: <span className='font-bold'>01:00 AM - 04:00 AM</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalInformation;