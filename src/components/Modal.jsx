export default function Modal({ active, title, onClose, children, footer, wide = false, className = "", overlayClassName = "" }) {
  if (!active) return null;
  return (
    <div className={`modal-backdrop active ${overlayClassName}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

