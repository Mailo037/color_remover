import { useEffect, useRef, useState } from 'react';
import { uiTemplates } from '../uiTemplates';
import { RollingNumber } from './RollingNumber';

export const EditableNumber = ({ value, onChange, min, max }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => { setTempValue(value); }, [value]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    let parsed = parseInt(tempValue, 10);
    if (isNaN(parsed)) parsed = value;
    if (parsed < min) parsed = min;
    if (parsed > max) parsed = max;
    onChange(parsed);
    setTempValue(parsed);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleFinishEditing(); };

  if (isEditing) {
    return (
      <input
        ref={inputRef} type="number" value={tempValue}
        onChange={(e) => setTempValue(e.target.value)} onBlur={handleFinishEditing} onKeyDown={handleKeyDown}
        className={uiTemplates.inputs.number}
        min={min} max={max}
      />
    );
  }

  return (
    <span 
      onClick={() => setIsEditing(true)}
      className={uiTemplates.inputs.inlineNumber}
      title="Click to edit"
    >
      <RollingNumber value={value} />
    </span>
  );
};
