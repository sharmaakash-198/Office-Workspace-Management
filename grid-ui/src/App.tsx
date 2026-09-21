import { useState } from 'react';
import FloorEditor from './components/FloorEditor';
import PrettyFloorView from './components/PrettyFloorView';
import type { FloorDocument } from './lib/drafts';

function App() {
  const [prettyDoc, setPrettyDoc] = useState<FloorDocument | null>(null);

  return (
    <>
      <div
        className="app-planner-wrap"
        style={{
          display: prettyDoc ? 'none' : 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '100vh',
        }}
        aria-hidden={Boolean(prettyDoc)}
      >
        <FloorEditor onOpenPretty={setPrettyDoc} />
      </div>
      {prettyDoc && (
        <PrettyFloorView document={prettyDoc} onBack={() => setPrettyDoc(null)} />
      )}
    </>
  );
}

export default App;
