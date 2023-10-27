import { Routes, Route } from 'react-router-dom';

import Layout from '@/layouts/main';

import Guide from './pages/guide';
import Api from './pages/api';
import NoMatch from './pages/no-match';
import ImageGuide from './pages/guide.image';
import TextGuide from './pages/guide.text';
import GettingStarted from './pages/getting-started';
import VideoGuide from './pages/guide.video';
import AudioGuide from './pages/guide.audio';
import PointCloudGuide from './pages/guide.point-cloud';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="guide" element={<Guide />}>
          <Route index element={<GettingStarted />} />
          <Route path="image" element={<ImageGuide />} />
          <Route path="point-cloud" element={<PointCloudGuide />} />
          <Route path="text" element={<TextGuide />} />
          <Route path="audio" element={<AudioGuide />} />
          <Route path="video" element={<VideoGuide />} />
        </Route>
        <Route path="api" element={<Api />} />
        <Route path="*" element={<NoMatch />} />
      </Route>
    </Routes>
  );
}
