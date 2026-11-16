import { useCallback, useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { characterImages } from '../assets/images.js';
import { characters } from '../data/demoData.js';
import { useToast } from '../context/ToastContext.jsx';

const initialItems = [
  { id: 1, t: 'panel', x: 30, y: 30, w: 260, h: 200, fill: '#ffffff' },
  { id: 2, t: 'panel', x: 310, y: 30, w: 260, h: 200, fill: '#e6e6e6' },
  { id: 3, t: 'panel', x: 30, y: 250, w: 540, h: 300, fill: '#cfcfcf' },
  { id: 5, t: 'face', x: 150, y: 70, w: 120, h: 156, v: 0, e: 'angry' },
  { id: 4, t: 'bubble', x: 50, y: 50, w: 140, h: 50, text: 'The storm is coming.', fill: '#fff' },
];

const objectKinds = ['panel', 'bubble', 'thought', 'narr', 'sfx', 'face'];

function speechShape(item) {
  return new Konva.Shape({
    fill: item.fill,
    stroke: '#000',
    strokeWidth: 2.5,
    dash: item.t === 'thought' ? [6, 4] : [],
    sceneFunc(context, shape) {
      const { w, h } = item;
      const point = (angle, scale) => [
        w / 2 + w / 2 * scale * Math.cos(angle),
        h / 2 + h / 2 * scale * Math.sin(angle),
      ];
      const segments = 9;
      context.beginPath();
      context.moveTo(...point(0, 0.9));
      for (let index = 0; index < segments; index += 1) {
        const end = point((index + 1) / segments * 6.2832, 0.9);
        const control = point((index + 0.5) / segments * 6.2832, 1.22);
        context.quadraticCurveTo(control[0], control[1], end[0], end[1]);
      }
      context.closePath();
      if (item.t === 'bubble') {
        context.moveTo(w * 0.28, h * 0.8);
        context.lineTo(w * 0.14, h + 16);
        context.lineTo(w * 0.5, h * 0.88);
      }
      context.fillStrokeShape(shape);
    },
  });
}

function makeNode(item, onSelect, onChange) {
  const group = new Konva.Group({
    x: item.x,
    y: item.y,
    draggable: true,
    name: 'comic-item',
    id: `i${item.id}`,
  });

  if (item.t === 'panel') {
    group.add(new Konva.Rect({
      width: item.w,
      height: item.h,
      fill: item.fill,
      stroke: '#000',
      strokeWidth: 4,
    }));
    if (item.extra) {
      group.add(new Konva.Text({
        x: 8,
        y: 8,
        text: item.extra,
        fill: '#111',
        fontSize: 14,
        fontFamily: 'Inter',
      }));
    }
  } else if (item.t === 'face') {
    const image = new window.Image();
    image.onload = () => group.getLayer()?.batchDraw();
    image.src = characterImages[item.v % 10];
    group.add(new Konva.Image({ image, width: item.w, height: item.h }));
  } else {
    let shape;
    if (item.t === 'narr') {
      shape = new Konva.Rect({ width: item.w, height: item.h, fill: '#FBBF24', stroke: '#000', strokeWidth: 2 });
    } else if (item.t === 'sfx') {
      shape = new Konva.Star({
        x: item.w / 2,
        y: item.h / 2,
        numPoints: 12,
        innerRadius: item.h * 0.33,
        outerRadius: item.w / 2,
        fill: '#fff',
        stroke: '#000',
        strokeWidth: 3,
      });
    } else {
      shape = speechShape(item);
    }
    group.add(shape);
    group.add(new Konva.Text({
      width: item.w,
      height: item.h,
      text: item.text,
      align: 'center',
      verticalAlign: 'middle',
      fontSize: item.fs || 13,
      fontFamily: item.t === 'sfx' ? 'Bangers' : 'Inter',
      fontStyle: item.t === 'sfx' ? 'normal' : 'bold',
      fill: '#111',
      padding: 8,
    }));
  }

  group.on('click tap', () => onSelect(item.id));
  group.on('dragend transformend', () => {
    const next = {
      ...item,
      x: group.x(),
      y: group.y(),
      w: Math.round(item.w * group.scaleX()),
      h: Math.round(item.h * group.scaleY()),
    };
    group.scale({ x: 1, y: 1 });
    onChange(item.id, next);
  });
  return group;
}

export default function ComicEditor() {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const contentRef = useRef(null);
  const transformerRef = useRef(null);
  const nextId = useRef(10);
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([initialItems]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [proposal, setProposal] = useState(null);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('Unsaved');
  const toast = useToast();
  const selected = items.find((item) => item.id === selectedId);

  const recordItems = useCallback((nextItems) => {
    setItems(nextItems);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextItems]);
    setHistoryIndex((current) => current + 1);
    setSaved('Unsaved');
  }, [historyIndex]);

  const changeItem = useCallback((id, update, record = false) => {
    const nextItems = items.map((item) => (item.id === id ? { ...item, ...update } : item));
    if (record) {
      recordItems(nextItems);
    } else {
      setItems(nextItems);
      setSaved('Unsaved');
    }
  }, [items, recordItems]);

  useEffect(() => {
    const stage = new Konva.Stage({ container: canvasRef.current, width: 600, height: 580 });
    const layer = new Konva.Layer();
    const background = new Konva.Rect({ width: 600, height: 580, fill: '#f4f1ea' });
    const content = new Konva.Group();
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      borderStroke: '#9B6DFF',
      anchorStroke: '#9B6DFF',
    });
    layer.add(background);
    layer.add(content);
    layer.add(transformer);
    stage.add(layer);
    stage.on('click tap', (event) => {
      if (event.target === stage || event.target.getParent() === layer) setSelectedId(null);
    });
    stageRef.current = stage;
    layerRef.current = layer;
    contentRef.current = content;
    transformerRef.current = transformer;

    return () => {
      stage.destroy();
      stageRef.current = null;
      layerRef.current = null;
      contentRef.current = null;
      transformerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const content = contentRef.current;
    const transformer = transformerRef.current;
    if (!layer || !content || !transformer) return;

    content.destroyChildren();
    items.forEach((item) => content.add(makeNode(
      item,
      setSelectedId,
      (id, updated) => {
        const nextItems = items.map((current) => (current.id === id ? updated : current));
        recordItems(nextItems);
      },
    )));
    const selectedNode = selectedId ? content.findOne(`#i${selectedId}`) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    layer.batchDraw();
  }, [items, selectedId, recordItems]);

  function addItem(type) {
    const id = ++nextId.current;
    const item = type === 'panel'
      ? { id, t: type, x: 40, y: 40, w: 200, h: 150, fill: '#ffffff' }
      : type === 'face'
        ? { id, t: type, x: 60, y: 60, w: 120, h: 156, v: id % 10, e: 'neutral' }
        : {
          id,
          t: type,
          x: 60,
          y: 60,
          w: type === 'sfx' ? 120 : 150,
          h: type === 'sfx' ? 120 : 60,
          text: type === 'narr' ? 'Meanwhile…' : type === 'sfx' ? 'WHAM!' : 'New text',
          fill: '#fff',
        };
    recordItems([...items, item]);
    setSelectedId(id);
  }

  function undoRedo(direction) {
    const target = Math.max(0, Math.min(history.length - 1, historyIndex + direction));
    if (target === historyIndex) return;
    setHistoryIndex(target);
    setItems(history[target]);
    setSelectedId(null);
  }

  function deleteSelected() {
    if (!selected) return;
    recordItems(items.filter((item) => item.id !== selected.id));
    setSelectedId(null);
  }

  function saveDraft() {
    setSaved('Saved in this session only (no backend)');
    toast('Draft kept in this session');
  }

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    transformerRef.current.nodes([]);
    stage.toDataURL({ pixelRatio: 2, callback(dataUrl) {
      const link = document.createElement('a');
      link.download = 'page1.png';
      link.href = dataUrl;
      link.click();
      setSelectedId(null);
    } });
  }

  async function proposeEdit(event) {
    event.preventDefault();
    const value = command.toLowerCase().trim();
    if (!value) return;
    setBusy(true);
    setProposal(null);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const lastPanel = [...items].reverse().find((item) => item.t === 'panel');
    let suggestion = null;
    if (lastPanel && /large|bigger/.test(value)) {
      suggestion = {
        label: 'Enlarge the last panel by 20%',
        apply: (current) => current.map((item) => item.id === lastPanel.id
          ? { ...item, w: item.w * 1.2, h: item.h * 1.2 }
          : item),
      };
    } else if (lastPanel && /storm|cloud|rain|dramatic/.test(value)) {
      suggestion = {
        label: 'Add a storm-cloud label and darken the last panel',
        apply: (current) => current.map((item) => item.id === lastPanel.id
          ? { ...item, fill: '#8a8a8a', extra: '⛈ storm clouds (placeholder art)' }
          : item),
      };
    } else if (lastPanel && /anger|angry/.test(value)) {
      suggestion = {
        label: 'Tint the last panel red and tag expression: anger',
        apply: (current) => current.map((item) => (
          item.id === lastPanel.id
            ? { ...item, fill: '#b0b0b0', extra: 'Kaito: anger' }
            : item.t === 'face' ? { ...item, e: 'angry' } : item
        )),
      };
    } else if (lastPanel && /close/.test(value)) {
      suggestion = {
        label: 'Mark last panel as close-up camera',
        apply: (current) => current.map((item) => item.id === lastPanel.id
          ? { ...item, extra: 'Camera: close-up' }
          : item),
      };
    }
    setProposal(suggestion);
    setBusy(false);
  }

  function applyProposal() {
    if (!proposal) return;
    recordItems(proposal.apply(items));
    setProposal(null);
    toast('Edit applied');
  }

  return (
    <>
      <div className="row sp comic-toolbar">
        <b>Chronicles of Kaito · Page 1</b>
        <div className="row">
          <span className="mu">{saved}</span>
          <button className="btn g sm" onClick={() => undoRedo(-1)} disabled={historyIndex === 0}>Undo</button>
          <button className="btn g sm" onClick={() => undoRedo(1)} disabled={historyIndex >= history.length - 1}>Redo</button>
          <button className="btn g sm" onClick={saveDraft}>Save draft</button>
          <button className="btn g sm" onClick={exportPng}>Export PNG</button>
        </div>
      </div>

      <div className="studio">
        <div className="card">
          <b>Add</b>
          <div className="comic-add">
            {objectKinds.map((type) => (
              <button className="btn g sm" onClick={() => addItem(type)} key={type}>
                {type === 'panel' ? 'Panel'
                  : type === 'bubble' ? 'Speech bubble'
                    : type === 'thought' ? 'Thought bubble'
                      : type === 'narr' ? 'Narration box'
                        : type === 'sfx' ? 'SFX burst' : 'Character art'}
              </button>
            ))}
          </div>
        </div>
        <div id="stage"><div id="cv" ref={canvasRef} /></div>
        <div className="card" id="pr">
          {selected ? (
            <>
              <b>{selected.t}</b>
              <div className="mu" style={{ fontSize: 13 }}>{Math.round(selected.w)}×{Math.round(selected.h)}</div>
              {selected.t === 'face' ? (
                <label>Character
                  <select
                    className="character-select"
                    value={selected.v}
                    onChange={(event) => changeItem(selected.id, { v: Number(event.target.value) }, true)}
                  >
                    {characters.map((item, index) => <option value={index} key={item.n}>{item.n}</option>)}
                  </select>
                </label>
              ) : selected.t === 'panel' ? (
                <label>Colour
                  <input type="color" value={selected.fill} onChange={(event) => changeItem(selected.id, { fill: event.target.value })} onBlur={() => recordItems(items)} />
                </label>
              ) : (
                <>
                  <label>Text
                    <textarea
                      style={{ minHeight: 70 }}
                      value={selected.text}
                      onChange={(event) => changeItem(selected.id, { text: event.target.value })}
                      onBlur={() => recordItems(items)}
                    />
                  </label>
                  <label>Size
                    <input type="range" min="10" max="28" value={selected.fs || 13} onChange={(event) => changeItem(selected.id, { fs: Number(event.target.value) })} onMouseUp={() => recordItems(items)} />
                  </label>
                </>
              )}
              <button className="btn g sm" style={{ marginTop: 8 }} onClick={deleteSelected}>Delete</button>
            </>
          ) : <span className="mu">Select an object on the canvas.</span>}
        </div>
      </div>

      <div className="card ai" style={{ marginTop: 10 }}>
        <form className="row" onSubmit={proposeEdit}>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Try: make the final panel larger, add storm clouds, change kaito’s expression to anger"
            style={{ flex: 1, minWidth: 200 }}
            aria-label="AI command"
          />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Proposing…' : 'Propose edit'}</button>
        </form>
        <div style={{ marginTop: 8 }}>
          {busy && <div className="scan" style={{ height: 40 }} />}
          {!busy && command.trim() && !proposal && (
            <span className="mu">That command is not supported in this demo. Try “make the final panel larger”, “add storm clouds” or “change Kaito’s expression to anger”.</span>
          )}
          {proposal && (
            <>
              <div className="row">
                <span>Proposal: {proposal.label}</span>
                <button className="btn sm" onClick={applyProposal}>Apply</button>
                <button className="btn g sm" onClick={() => setProposal(null)}>Reject</button>
              </div>
              <div className="mu" style={{ fontSize: 12 }}>No image is generated: this demo changes layout and labels only.</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
