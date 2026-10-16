import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readShareHash } from './lib/sharePayload';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

// Share links (#spin=…) load only the lightweight viewer bundle; the editor,
// drag-and-drop and background-removal code stay out of embeds entirely.
async function render() {
  const encoded = readShareHash(window.location.hash);
  if (encoded) {
    const { default: ViewerApp } = await import('./ViewerApp');
    root.render(
      <StrictMode>
        <ViewerApp key={encoded} encoded={encoded} />
      </StrictMode>,
    );
  } else {
    const { default: EditorApp } = await import('./EditorApp');
    root.render(
      <StrictMode>
        <EditorApp />
      </StrictMode>,
    );
  }
}

window.addEventListener('hashchange', () => void render());
void render();
