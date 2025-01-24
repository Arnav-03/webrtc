import React, { useState } from 'react';
import Broadcaster from './components/Broadcaster';
import Viewer from './components/Viewer';


function App() {
  const [mode, setMode] = useState(null);

  return (
    <div className="app-container">
      <h1>WebRTC Live Streaming</h1>
      {!mode && (
        <div>
          <button onClick={() => setMode('broadcaster')}>
            Start Broadcasting
          </button>
          <button onClick={() => setMode('viewer')}>
            View Stream
          </button>
        </div>
      )}

      {mode === 'broadcaster' && <Broadcaster />}
      {mode === 'viewer' && <Viewer />}
    </div>
  );
}

export default App;