export default function TopBar({ activeView, onSwitch }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div className="brand-text">
          <span className="name">RETAILFIX</span>
          <span className="tag">Quotation Studio</span>
        </div>
      </div>
      <div className="tabs">
        {[
          { key: 'builder', label: 'New Quote' },
          { key: 'catalog', label: 'Catalog' },
          { key: 'saved', label: 'Saved' },
          { key: 'customers', label: 'Customers' },
          { key: 'settings', label: 'Settings' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${activeView === key ? 'active' : ''}`}
            onClick={() => onSwitch(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
