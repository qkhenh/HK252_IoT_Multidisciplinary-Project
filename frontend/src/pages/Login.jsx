import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Truck, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });

      const responseData = await response.json();

      if (response.ok && responseData.success && responseData.data?.access_token) {
        localStorage.setItem('token', responseData.data.access_token);
        const userRole = responseData.data.role;
        if (userRole === 'guard') navigate('/guard-dashboard');
        else if (userRole === 'manager') navigate('/manager-dashboard');
        else if (userRole === 'citizen') navigate('/citizen-dashboard');
      } else {
        setError(responseData.message || 'Invalid username or password!');
      }
    } catch (err) {
      setError('Cannot connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cấu hình cho watermark
  const marqueeRows = Array.from({ length: 6 });
  const spacing = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";
  const scrollingText = `BKEzPass ⚡${spacing}BKEzPass ⚡${spacing}BKEzPass ⚡${spacing}BKEzPass ⚡${spacing}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#005B9F] via-blue-100 to-white font-sans w-full relative overflow-hidden">
      
      {/* HIỆU ỨNG CHỮ CHẠY NGANG (HORIZONTAL WATERMARK) */}
      <div className="absolute inset-0 flex flex-col justify-around pointer-events-none select-none opacity-[0.04] z-0">
        {marqueeRows.map((_, i) => (
          <div key={i} className="whitespace-nowrap flex overflow-hidden border-b border-blue-200/20 py-2">
            <div className={`flex animate-marquee ${i % 2 === 0 ? '' : 'direction-reverse'}`} style={{ fontSize: '22px' }}>
              <span className="font-black italic -[0.3em]">{scrollingText}{scrollingText}</span>
              <span className="font-black italic -[0.3em]">{scrollingText}{scrollingText}</span>
            </div>
          </div>
        ))}
      </div>

      {/* KHUNG ĐĂNG NHẬP (SINGLE CARD CONTAINER) */}
      <div className="w-[420px] rounded-2xl shadow-2xl bg-white/95 backdrop-blur-md border border-white/40 relative z-10 overflow-hidden flex flex-col">
        
        {/* NỬA TRÊN: KHUNG CHUYỂN ĐỘNG (ANIMATION HEADER) */}
        <div className="h-32 bg-gradient-to-b from-[#005B9F]/10 to-transparent relative flex items-end justify-center border-b border-gray-200/80">
          <ShieldCheck className="absolute top-4 right-4 text-blue-200" size={32} />
          
          <div className="w-full h-2.5 bg-[#FF6B00] absolute bottom-0 left-0 animate-pulse shadow-[0_0_10px_rgba(255,107,0,0.5)]"></div>
          <div className="w-5 h-16 bg-slate-700 rounded-t-md absolute bottom-0 left-12 border-r-2 border-slate-600"></div>
          <Zap className="text-[#FF6B00] absolute bottom-4 right-12 animate-bounce" fill="#FF6B00" size={28}/>
          <Truck className="text-slate-600 absolute bottom-1 left-0 animate-[driveIn_8s_ease-in-out_infinite]" size={44} />
        </div>

        {/* NỬA DƯỚI: FORM ĐĂNG NHẬP (LOGIN FORM) */}
        <div className="p-8 pt-6">
          <div className="flex items-center justify-center mb-8">
            <h1 className="text-3xl font-black italic text-[#005B9F] tracking-tighter flex items-center m-0">
              BKEzPass <Zap className="text-[#FF6B00] ml-1" fill="#FF6B00" size={24} />
            </h1>
          </div>

          {error && (
              <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold text-sm rounded">
                  {error}
              </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Username</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#005B9F] font-bold bg-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#005B9F] font-bold bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className={`w-full text-white font-bold py-3.5 rounded-lg mt-6 shadow-lg shadow-blue-900/20 ${isLoading ? 'bg-blue-400' : 'bg-[#005B9F] hover:bg-blue-800 transition-colors'}`}
            >
              {isLoading ? 'AUTHENTICATING...' : 'LOG IN'}
            </button>
          </form>

        </div>
      </div>

      <style>{`
        @keyframes driveIn {
          0% { left: -20%; opacity: 0; }
          15% { left: 10%; opacity: 1; }
          80% { left: 80%; opacity: 1; }
          100% { left: 120%; opacity: 0; }
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-marquee {
          animation: marquee 60s linear infinite;
        }

        .direction-reverse {
          animation-direction: reverse;
        }
      `}</style>
    </div>
  );
};

export default Login;