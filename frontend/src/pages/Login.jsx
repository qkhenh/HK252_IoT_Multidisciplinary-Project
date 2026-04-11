import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Truck, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/guard-dashboard');
  };

  return (
    // Nền gradient tinh tế để web không bị trống trải
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#005B9F]/10 via-white to-[#FF6B00]/10 font-sans w-full">
      
      {/* Khung Login - Thu hẹp chiều ngang (w-[380px]), bo góc to hơn */}
      <div className="p-10 rounded-2xl shadow-2xl w-[380px] bg-white border border-gray-100 relative">
        
        {/* Animated Element: Mô phỏng thanh chắn và icon bảo mật */}
        <div className="flex items-end justify-center mb-8 h-24 relative overflow-hidden bg-gray-50 rounded-lg border border-gray-200">
          <ShieldCheck className="absolute top-2 right-2 text-gray-300" size={32} />
          <div className="w-full h-3 bg-[#FF6B00] absolute bottom-0 left-0 rounded-full animate-pulse"></div>
          <div className="w-4 h-16 bg-gray-700 rounded-t-lg absolute bottom-0 left-10"></div>
          <Zap className="text-[#FF6B00] absolute bottom-4 right-10 animate-bounce" fill="#FF6B00" size={24}/>
          <Truck className="text-gray-600 absolute -bottom-1 left-0 animate-[driveIn_8s_ease-in-out_infinite]" size={40} />
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-3xl font-black italic text-[#005B9F] tracking-tighter flex items-center m-0">
            BKEzPass <Zap className="text-[#FF6B00] ml-1" fill="#FF6B00" size={24} />
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Username</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border-2 border-gray-300 bg-gray-50 rounded-lg focus:outline-none focus:border-[#005B9F] focus:bg-white transition-colors text-black font-bold"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Password</label>
            <input 
              type="password" 
              className="w-full px-4 py-3 border-2 border-gray-300 bg-gray-50 rounded-lg focus:outline-none focus:border-[#005B9F] focus:bg-white transition-colors text-black font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {/* Nút Login đã được cách xa (mt-8) và chữ TRẮNG */}
          <button 
            type="submit" 
            className="w-full bg-[#005B9F] text-white font-bold py-3.5 rounded-lg hover:bg-blue-800 transition-colors mt-8 shadow-lg shadow-blue-900/30"
          >
            LOG IN
          </button>
        </form>
      </div>

      <style>{`
        @keyframes driveIn {
          0% { left: -20%; opacity: 0; }
          15% { left: 10%; opacity: 1; }
          45% { left: 40%; opacity: 1; }
          80% { left: 80%; opacity: 1; }
          100% { left: 120%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Login;