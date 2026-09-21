import { Camera, ImagePlus, X } from 'lucide-react'
import { useRef } from 'react'

export default function ImagePicker({ file, previewUrl, onSelect, onClear }) {
  const inputRef = useRef(null)

  const handleFile = (event) => {
    const selected = event.target.files?.[0]
    if (selected) onSelect(selected)
    event.target.value = ''
  }

  if (file && previewUrl) {
    return (
      <div className="preview-wrap">
        <img className="image-preview" src={previewUrl} alt="Selected entrance or path" />
        <button className="remove-image" type="button" onClick={onClear} aria-label="Remove selected image">
          <X aria-hidden="true" size={20} />
        </button>
        <button className="replace-button" type="button" onClick={() => inputRef.current?.click()}>
          <ImagePlus aria-hidden="true" size={20} /> Replace photo
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handleFile} aria-label="Replace entrance or path photo" />
      </div>
    )
  }

  return (
    <button className="upload-area" type="button" onClick={() => inputRef.current?.click()}>
      <span className="upload-icon"><Camera aria-hidden="true" size={30} /></span>
      <strong>Take or choose a photo</strong>
      <span>Frame the entrance, ramp, or path as clearly as possible.</span>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handleFile} aria-label="Take or choose an entrance or path photo" />
    </button>
  )
}
