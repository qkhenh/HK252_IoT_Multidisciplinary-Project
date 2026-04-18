import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import GuardDashboard from './pages/GuardDashboard';
import ManualMode from './pages/ManualMode';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/guard-dashboard" element={<GuardDashboard />} />
        <Route path="/manual-mode" element={<ManualMode />} />
      </Routes>
    </Router>
  );
}

export default App;