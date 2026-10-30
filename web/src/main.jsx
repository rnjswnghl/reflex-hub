import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* 방문 통계: 쿠키 없음, 익명. 페이지를 연 수만 센다 (Vercel 대시보드 Analytics 탭) */}
    <Analytics />
  </StrictMode>,
);
