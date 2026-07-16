import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import Vehicles from './pages/Vehicles';
import Repairs from './pages/Repairs';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Layout from './components/Layout';
import './App.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes (Wrapped in layout) */}
        <Route 
          path="/dashboard" 
          element={
            <Layout>
              <Dashboard />
            </Layout>
          } 
        />
        <Route 
          path="/operations" 
          element={
            <Layout>
              <Operations />
            </Layout>
          } 
        />
        <Route 
          path="/vehicles" 
          element={
            <Layout>
              <Vehicles />
            </Layout>
          } 
        />
        <Route 
          path="/repairs" 
          element={
            <Layout>
              <Repairs />
            </Layout>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <Layout>
              <Reports />
            </Layout>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <Layout>
              <Admin />
            </Layout>
          } 
        />

        {/* Catch-all redirects */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
