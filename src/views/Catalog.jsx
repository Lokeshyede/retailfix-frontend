import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';

const DEFAULT_CATEGORIES = ['Supermarket', 'Pharmacy', 'Garment', 'Custom Fixtures', 'Accessories', 'Other'];
const UNITS = ['per piece', 'per set', 'per sq.ft.', 'per running ft.', 'per unit'];

const emptyForm = { name: '', category: 'Supermarket', unit: 'per piece', price: '', desc: '', hsn_code: '' };

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function Catalog({ onProductsChange }) {
  const showToast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Search, Filter, Sort
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name_asc'); // name_asc | price_asc | price_desc | popularity

  // Custom Category Handling
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryVal, setCustomCategoryVal] = useState('');

  const load = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
      onProductsChange?.(data);
    } catch {
      showToast('Failed to load products', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { 
    setEditId(null); 
    setForm(emptyForm); 
    setIsCustomCategory(false);
    setCustomCategoryVal('');
    setModalOpen(true); 
  };

  const openEdit = (p) => {
    setEditId(p.id);
    const isDefault = DEFAULT_CATEGORIES.includes(p.category);
    setForm({ name: p.name, category: isDefault ? p.category : '', unit: p.unit, price: String(p.price), desc: p.desc || '', hsn_code: p.hsn_code || '' });
    if (!isDefault) {
      setIsCustomCategory(true);
      setCustomCategoryVal(p.category);
    } else {
      setIsCustomCategory(false);
      setCustomCategoryVal('');
    }
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Product name is required', 'err'); return; }
    
    const category = isCustomCategory ? customCategoryVal.trim() : form.category;
    if (!category) { showToast('Product category is required', 'err'); return; }
    
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { showToast('Enter a valid price', 'err'); return; }

    const hsn_code = form.hsn_code ? form.hsn_code.trim() : '';
    if (!hsn_code) { showToast('HSN Code is required', 'err'); return; }
    if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(hsn_code)) {
      showToast('HSN Code must be 4, 6, or 8 digits and contain only numbers', 'err');
      return;
    }

    // Enforce product uniqueness strictly
    const duplicate = products.some(p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase() && p.id !== editId);
    if (duplicate) {
      showToast(`A product named "${form.name.trim()}" already exists`, 'err');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, category, price, hsn_code };

      if (editId) {
        await updateProduct(editId, payload);
        showToast('Product updated ✓');
      } else {
        await createProduct(payload);
        showToast('Product added ✓');
      }

      await load();
      closeModal();

    } catch (err) {
      console.error("SAVE ERROR:", err);
      showToast(
        err?.response?.data?.detail || err.message || 'Save failed',
        'err'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try {
      await deleteProduct(id);
      showToast('Product deleted');
      await load();
    } catch {
      showToast('Delete failed', 'err');
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleCategorySelectChange = (e) => {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      setIsCustomCategory(true);
      setForm(f => ({ ...f, category: '' }));
    } else {
      setIsCustomCategory(false);
      setForm(f => ({ ...f, category: val }));
    }
  };

  // Compile list of all categories dynamically for filters
  const allCategories = ['All', ...new Set([...DEFAULT_CATEGORIES, ...products.map(p => p.category)])];

  // Perform filtration
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.desc && p.desc.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Perform sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'price_asc') {
      return a.price - b.price;
    } else if (sortBy === 'price_desc') {
      return b.price - a.price;
    } else if (sortBy === 'popularity') {
      return (b.quote_count || 0) - (a.quote_count || 0);
    }
    return 0;
  });

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Step 00 — Setup</span>
          <h1>Product Catalog</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      {/* Search and Filters panel */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Search Catalog</label>
            <input 
              type="text" 
              placeholder="🔍 Search name, description..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name_asc">Name (A-Z)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
              <option value="popularity">Popularity (Most Quoted)</option>
            </select>
          </div>
        </div>
        
        {products.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <label style={{ fontSize: 10.5, marginBottom: 8 }}>Filter by Category</label>
            <div className="category-tabs">
              {allCategories.map(cat => (
                <button 
                  key={cat} 
                  className={`category-pill ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>No products yet</h3>
          <p>Add your display racks and fixtures — they'll show up when building quotations.</p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={openAdd}>
            + Add Your First Product
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3>No matching results</h3>
          <p>Try searching for a different term or selecting a different category.</p>
        </div>
      ) : (
        <div className="product-grid">
          {sorted.map(p => (
            <div className="product-card" key={p.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <span className="product-cat">{p.category}</span>
                  {(p.quote_count && p.quote_count >= 3) ? (
                    <span className="product-cat" style={{ background: 'var(--safety-light)', color: 'var(--safety-dark)' }}>⭐ Popular</span>
                  ) : null}
                </div>
                <div className="product-name">{p.name}</div>
                <div className="product-desc">{p.desc || ''}</div>
                <div style={{ fontSize: 11, color: 'var(--steel-600)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                  HSN: {p.hsn_code || 'N/A'}
                </div>
              </div>
              
              <div style={{ marginTop: 'auto' }}>
                <div className="product-price">{money(p.price)} <span>/ {p.unit}</span></div>
                {p.quote_count ? (
                  <div style={{ fontSize: 11, color: '#8a8474', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                    Quoted {p.quote_count} time{p.quote_count > 1 ? 's' : ''}
                  </div>
                ) : null}
                <div className="product-actions" style={{ paddingTop: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        active={modalOpen}
        title={editId ? 'Edit Product' : 'Add Product'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Product'}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <div className="field">
            <label>Product Name *</label>
            <input type="text" placeholder="e.g. Supermarket Display Rack" {...field('name')} />
          </div>
          
          <div className="field-row">
            <div className="field">
              <label>Category</label>
              <select 
                value={isCustomCategory ? 'CUSTOM' : form.category} 
                onChange={handleCategorySelectChange}
              >
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="CUSTOM">+ Add Custom Category...</option>
              </select>
            </div>
            
            <div className="field">
              <label>Unit</label>
              <select {...field('unit')}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {isCustomCategory && (
            <div className="field">
              <label>Custom Category Name *</label>
              <input 
                type="text" 
                placeholder="Type your category name..." 
                value={customCategoryVal} 
                onChange={e => setCustomCategoryVal(e.target.value)} 
              />
            </div>
          )}

          <div className="field">
            <label>Price (₹) *</label>
            <input type="number" min="0" placeholder="4999" {...field('price')} />
          </div>

          <div className="field">
            <label>HSN Code *</label>
            <input type="text" placeholder="e.g. 9403" {...field('hsn_code')} />
          </div>
          
          <div className="field">
            <label>Short Description (optional)</label>
            <textarea rows={2} placeholder="e.g. Heavy-duty adjustable shelving, powder-coated steel" {...field('desc')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
