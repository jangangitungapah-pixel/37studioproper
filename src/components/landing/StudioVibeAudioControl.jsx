import { useEffect, useRef, useState } from 'react';
import { AudioLines, Play, Square } from 'lucide-react';
import LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';

export default function StudioVibeAudioControl() {
  const synthRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusNote, setStatusNote] = useState('Pratinjau ambient synth · klik untuk dengar');

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
        synthRef.current = null;
      }
    };
  }, []);

  function handleToggleSynth() {
    if (isPlaying) {
      synthRef.current?.stop();
      setIsPlaying(false);
      setStatusNote('Pratinjau dijeda · audio dimatikan');
      return;
    }

    if (!synthRef.current) {
      synthRef.current = new LofiAmbientSynth();
    }

    synthRef.current.start(0.38);

    if (synthRef.current.isPlaying) {
      setIsPlaying(true);
      setStatusNote('Ambient room synth aktif · volume ringan');
    } else {
      setIsPlaying(false);
      setStatusNote('Audio browser tidak tersedia pada perangkat ini');
    }
  }

  return (
    <div className={`client-landing-vibe-player${isPlaying ? ' is-playing' : ''}`}>
      <button
        type="button"
        className="client-landing-vibe-button"
        onClick={handleToggleSynth}
        aria-pressed={isPlaying ? 'true' : 'false'}
      >
        <span className="client-landing-vibe-icon" aria-hidden="true">
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </span>

        <span className="client-landing-vibe-copy">
          <strong>{isPlaying ? 'Hentikan Nuansa Ruang' : 'Putar Nuansa Ambient Studio'}</strong>
          <span>{statusNote}</span>
        </span>

        <span className="client-landing-vibe-eq" aria-hidden="true">
          <span />
          <span />
          <span />
          <AudioLines size={15} />
        </span>
      </button>
    </div>
  );
}
