import logoImg from '../assets/logo.png';

export default function TopBar({ activeView, onSwitch }) {
  return (
    <div className="topbar">
      <div className="brand">
        <img src={logoImg} alt="retailfix - Smart Solution For Modern Retail" className="brand-logo" />
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
