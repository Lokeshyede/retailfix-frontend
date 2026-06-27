import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';

const emptyForm = { name: '', phone: '', email: '', city: '', address: '', gstin: '' };

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function Customers() {
  const showToast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Filters & Sorting
  const [filterCity, setFilterCity] = useState('All');
  const [sortBy, setSortBy] = useState('name_asc'); // name_asc | revenue_desc | quotes_desc | recent

  const load = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch {
      showToast('Failed to load customers', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  
  const openEdit = (c) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      city: c.city || '',
      address: c.address || '',
      gstin: c.gstin || '',
    });
    setModalOpen(true);
  };
  
  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Customer name is required', 'err'); return; }
    
    // Basic Input Validations
    if (form.phone.trim()) {
      const phoneRegex = /^[0-9]{10,12}$/;
      const numericPhone = form.phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(numericPhone)) {
        showToast('Please enter a valid 10 to 12 digit phone number', 'err');
        return;
      }
    }
    
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        showToast('Please enter a valid email address', 'err');
        return;
      }
    }
    
    if (form.gstin.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(form.gstin.trim().toUpperCase())) {
        showToast('Invalid GSTIN format (e.g. 23AAAAA1111A1Z1)', 'err');
        return;
      }
    }

    // Duplicate check on frontend
    const duplicate = customers.some(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== editId);
    if (duplicate) {
      showToast(`A customer named "${form.name.trim()}" already exists`, 'err');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await updateCustomer(editId, form);
        showToast('Customer updated ✓');
      } else {
        await createCustomer(form);
        showToast('Customer added ✓');
      }
      await load();
      closeModal();
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message || 'Save failed', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await deleteCustomer(id);
      showToast('Customer deleted');
      await load();
    } catch {
      showToast('Delete failed', 'err');
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  // Unique list of cities for category pills
  const citiesList = ['All', ...new Set(customers.map(c => c.city).filter(Boolean))];

  // Perform filtration
  const q = search.toLowerCase();
  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(q) || 
                          (c.phone && c.phone.includes(q)) || 
                          (c.city && c.city.toLowerCase().includes(q)) || 
                          (c.gstin && c.gstin.toLowerCase().includes(q));
    
    const matchesCity = filterCity === 'All' || c.city === filterCity;
    return matchesSearch && matchesCity;
  });

  // Perform sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'revenue_desc') {
      return (b.total_revenue || 0) - (a.total_revenue || 0);
    } else if (sortBy === 'quotes_desc') {
      return (b.total_quotes || 0) - (a.total_quotes || 0);
    } else if (sortBy === 'recent') {
      return b.created_at - a.created_at;
    }
    return 0;
  });

  // Compute Statistics
  const totalCustomersCount = customers.length;
  const activeCustomersCount = customers.filter(c => (c.total_quotes || 0) > 0).length;
  const totalBusinessVolume = customers.reduce((sum, c) => sum + (c.total_revenue || 0), 0);

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Directory</span>
          <h1>Customers</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      {/* Customer stats cards */}
      {customers.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 18 }}>
          <div className="stat-card">
            <div className="val">{totalCustomersCount}</div>
            <div className="lbl">Total Customers</div>
          </div>
          <div className="stat-card">
            <div className="val">{activeCustomersCount}</div>
            <div className="lbl">Active Clients</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--ok)' }}>{money(totalBusinessVolume)}</div>
            <div className="lbl">Total business</div>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Search Customer</label>
            <input 
              type="text" 
              placeholder="🔍 Search name, phone, city, GSTIN..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name_asc">Name (A-Z)</option>
              <option value="revenue_desc">Business Volume (Highest First)</option>
              <option value="quotes_desc">Quotation Count (Highest First)</option>
              <option value="recent">Recently Added (Newest First)</option>
            </select>
          </div>
        </div>
        
        {customers.length > 0 && citiesList.length > 2 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <label style={{ fontSize: 10.5, marginBottom: 8 }}>Filter by City</label>
            <div className="category-tabs">
              {citiesList.map(city => (
                <button 
                  key={city} 
                  className={`category-pill ${filterCity === city ? 'active' : ''}`}
                  onClick={() => setFilterCity(city)}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <h3>No customers yet</h3>
          <p>Add your frequent clients so you can select and autofill them during quotation generation.</p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={openAdd}>
            + Add Your First Customer
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3>No matches for "{search}"</h3>
          <p>Try searching for a different name, phone, or location.</p>
        </div>
      ) : (
        <div className="product-grid">
          {sorted.map(c => (
            <div className="product-card" key={c.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 200 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <span className="product-cat" style={{ background: 'var(--steel-100)', color: 'var(--steel-800)' }}>
                    {c.city || 'No City'}
                  </span>
                  {c.total_quotes ? (
                    <span className="product-cat" style={{ background: 'var(--steel-950)', color: '#fff' }}>
                      📋 {c.total_quotes} Quote{c.total_quotes > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                <div className="product-name" style={{ fontSize: 16, marginTop: 8 }}>{c.name}</div>
                
                <div style={{ fontSize: 13, color: '#6b6557', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {c.phone && <div>📞 {c.phone}</div>}
                  {c.email && <div>✉️ {c.email}</div>}
                  {c.address && <div style={{ lineBreak: 'anywhere' }}>📍 {c.address}</div>}
                  {c.gstin && <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--safety-dark)' }}>GSTIN: {c.gstin}</div>}
                </div>
              </div>
              
              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                {c.total_quotes ? (
                  <div style={{ fontSize: 12.5, fontWeight: 'bold', color: 'var(--steel-700)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>
                    Total Sales: <span style={{ color: 'var(--safety-dark)' }}>{money(c.total_revenue)}</span>
                  </div>
                ) : null}
                <div className="product-actions" style={{ borderTop: '1px solid #f6f4ee', paddingTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        active={modalOpen}
        title={editId ? 'Edit Customer' : 'Add Customer'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Customer'}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <div className="field">
            <label>Customer / Shop Name *</label>
            <input type="text" placeholder="e.g. Verma Medicos" {...field('name')} />
          </div>
          
          <div className="field-row">
            <div className="field">
              <label>Phone Number</label>
              <input type="text" placeholder="9xxxxxxxxx" {...field('phone')} />
            </div>
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="client@email.com" {...field('email')} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>City</label>
              <input type="text" placeholder="e.g. Bhopal" {...field('city')} />
            </div>
            <div className="field">
              <label>GSTIN (Optional)</label>
              <input type="text" placeholder="e.g. 23AAAAA1111A1Z1" {...field('gstin')} />
            </div>
          </div>

          <div className="field">
            <label>Full Address</label>
            <textarea rows={2} placeholder="Shop No, Building, Street, Area" {...field('address')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
