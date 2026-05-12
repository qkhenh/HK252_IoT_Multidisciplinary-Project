import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import GuardDashboard from './pages/GuardDashboard';
import ManualMode from './pages/ManualMode';
import CitizenDashboard from './pages/CitizenDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import PersonalInformation from './pages/PersonalInformation';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/guard-dashboard" element={<GuardDashboard />} />
        <Route path="/manual-mode" element={<ManualMode />} />
        <Route path="/citizen-dashboard" element={<CitizenDashboard />} />
        <Route path="/manager-dashboard" element={<ManagerDashboard />} />
        <Route path="/profile" element={<PersonalInformation />} />
      </Routes>
    </Router>
  );
}

export default App;