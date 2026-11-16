import { characterImages } from '../../assets/images.js';
import { gradients } from '../../data/demoData.js';

export default function CharacterArt({ index = 0, label = '', expression }) {
  const [start, end] = gradients[index % gradients.length];
  return (
    <div
      className="art"
      style={{
        background: `radial-gradient(circle at 70% 30%, #fff3, transparent 40%), linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      <img
        className="face"
        src={characterImages[index % 10]}
        alt={label || 'PanelVerse character'}
        data-expression={expression}
      />
      {label && <span>{label}</span>}
    </div>
  );
}
