/** 主应用组件 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import PaperManagement from './pages/PaperManagement';
import PaperUpload from './pages/PaperUpload';
import MinerUExtract from './pages/MinerUExtract';
import DeepSeekAnalysis from './pages/DeepSeekAnalysis';
import AnalysisResults from './pages/AnalysisResults';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Welcome />} />
          <Route path="papers" element={<PaperManagement />} />
          <Route path="upload" element={<PaperUpload />} />
          <Route path="mineru" element={<MinerUExtract />} />
          <Route path="deepseek" element={<DeepSeekAnalysis />} />
          <Route path="analysis/:ossKey" element={<AnalysisResults />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
