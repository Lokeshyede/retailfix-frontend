import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { getBackupData, restoreBackupData, exportProductsCSV, importProductsCSV } from '../api';

const DEFAULT_TERMS = [
  'Prices are factory rates — no middlemen, no hidden costs.',
  '50% advance payment required to confirm order; balance before/at delivery.',
  'Delivery: 7–15 working days from order confirmation, depending on quantity & customization.',
  'GST as applicable will be charged extra unless already included above.',
  'Installation support available on request.',
  'Quotation valid for 15 days from the date of issue.',
];

const DEFAULT_COMPANY = {
  name: 'RetailFix',
  tagline: 'Store Fixtures & Display Solutions',
  address: 'Plot No. 63, Govindpura Industrial Area, Bhopal, Madhya Pradesh, 462023, India',
  phone: '+91-92019 58481, 92019 58486',
  email: 'info@retailfix.in',
  web: 'retailfix.in',
  gstin: '23AAAAA0000A1Z0',
  bankName: 'HDFC Bank',
  accountHolder: 'RetailFix',
  accountNumber: '50200012345678',
  ifscCode: 'HDFC0001234',
  branch: 'Govindpura, Bhopal'
};

const SEED_PRODUCTS = [
  {id: "1", name: "Supermarket Display Rack", category: "Supermarket", unit: "per piece", price: 4999, desc: "Heavy-duty adjustable shelving for organized display.", hsn_code: "9403"},
  {id: "2", name: "Pharmacy Display Rack", category: "Pharmacy", unit: "per piece", price: 3999, desc: "Neatly display medicines for easy customer access.", hsn_code: "9403"},
  {id: "3", name: "Garment Display Rack", category: "Garment", unit: "per piece", price: 3999, desc: "Attractive fixtures for folded & hanging apparel.", hsn_code: "9403"},
  {id: "4", name: "Corner Shelf (Supermarket)", category: "Supermarket", unit: "per piece", price: 3499, desc: "Utilize every inch with stylish corner shelves.", hsn_code: "9403"},
  {id: "5", name: "End Cap Display Rack", category: "Supermarket", unit: "per piece", price: 4499, desc: "Attract attention with displays at aisle ends.", hsn_code: "9403"},
  {id: "6", name: "Wall-mounted Medicine Rack", category: "Pharmacy", unit: "per piece", price: 2999, desc: "Utilize walls for organized medicine displays.", hsn_code: "9403"}
];

const SEED_CUSTOMERS = [
  {id: "c1", name: "Sharma Kirana Store", phone: "9876543210", email: "sharma.kirana@gmail.com", city: "Bhopal", address: "12, Govindpura Industrial Area", gstin: "23AAAAA1111A1Z1", created_at: Date.now() - 86400000},
  {id: "c2", name: "Verma Medicos", phone: "9123456789", email: "verma.medicos@yahoo.com", city: "Indore", address: "Shop No. 4, MG Road", gstin: "23BBBBB2222B2Z2", created_at: Date.now() - 172800000},
  {id: "c3", name: "Metro Garments", phone: "9988776655", email: "metro.garments@outlook.com", city: "Jabalpur", address: "Civic Center, Main Market", gstin: "", created_at: Date.now()}
];

export default function Settings() {
  const showToast = useToast();
  const [terms, setTerms] = useState([]);
  const [newTerm, setNewTerm] = useState('');
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  
  const [restoring, setRestoring] = useState(false);
  const [stats, setStats] = useState({ products: 0, customers: 0, quotations: 0 });
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreModalActive, setRestoreModalActive] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await getBackupData();
      setStats({
        products: data.products?.length || 0,
        customers: data.customers?.length || 0,
        quotations: data.quotations?.length || 0
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Load terms
    const savedTerms = localStorage.getItem('retailfix_default_terms');
    if (savedTerms) {
      setTerms(JSON.parse(savedTerms));
    } else {
      setTerms(DEFAULT_TERMS);
      localStorage.setItem('retailfix_default_terms', JSON.stringify(DEFAULT_TERMS));
    }

    // Load company profile
    const savedCompany = localStorage.getItem('retailfix_company_profile');
    if (savedCompany) {
      setCompany(JSON.parse(savedCompany));
    } else {
      setCompany(DEFAULT_COMPANY);
      localStorage.setItem('retailfix_company_profile', JSON.stringify(DEFAULT_COMPANY));
    }

    fetchStats();
  }, []);

  const saveTerms = (updated) => {
    setTerms(updated);
    localStorage.setItem('retailfix_default_terms', JSON.stringify(updated));
    showToast('Default terms updated successfully ✓');
  };

  const addTerm = () => {
    if (!newTerm.trim()) return;
    const updated = [...terms, newTerm.trim()];
    saveTerms(updated);
    setNewTerm('');
  };

  const removeTerm = (index) => {
    const updated = terms.filter((_, i) => i !== index);
    saveTerms(updated);
  };

  const handleBackup = async () => {
    try {
      const data = await getBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retailfix_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Database backup downloaded ✓');
    } catch {
      showToast('Backup generation failed', 'err');
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        
        if (!json || typeof json !== 'object' || !('products' in json) || !('customers' in json) || !('quotations' in json)) {
          showToast('Invalid backup file: missing products, customers, or quotations lists', 'err');
          e.target.value = '';
          return;
        }

        if (!Array.isArray(json.products) || !Array.isArray(json.customers) || !Array.isArray(json.quotations)) {
          showToast('Invalid backup format: data tables must be arrays', 'err');
          e.target.value = '';
          return;
        }

        setRestorePreview(json);
        setRestoreModalActive(true);
      } catch (err) {
        showToast('Invalid JSON file format', 'err');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    setRestoreModalActive(false);
    try {
      const res = await restoreBackupData(restorePreview);
      if (res.status === 'success') {
        showToast('Database restored successfully ✓');
        setStats({
          products: restorePreview.products.length,
          customers: restorePreview.customers.length,
          quotations: restorePreview.quotations.length
        });
      } else {
        showToast('Failed to restore: ' + res.message, 'err');
      }
    } catch {
      showToast('Restore request failed', 'err');
    } finally {
      setRestoring(false);
      setRestorePreview(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      showToast('Exporting catalog...');
      const data = await exportProductsCSV();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Product catalog exported successfully ✓');
    } catch (err) {
      showToast('Export failed', 'err');
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      showToast('Importing products...');
      const res = await importProductsCSV(file);
      showToast(`Imported ${res.imported} products successfully ✓`);
      fetchStats(); // refresh database stats
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Import failed';
      showToast(errMsg, 'err');
    } finally {
      e.target.value = ''; // reset file input
    }
  };

  const handleCompanyChange = (key, val) => {
    setCompany(c => ({ ...c, [key]: val }));
  };

  const saveCompany = () => {
    localStorage.setItem('retailfix_company_profile', JSON.stringify(company));
    showToast('Company profile saved successfully ✓');
  };

  const resetTermsToDefault = () => {
    if (window.confirm('Reset all terms to factory defaults?')) {
      saveTerms(DEFAULT_TERMS);
    }
  };

  const handleResetToSeeds = async () => {
    if (!window.confirm('Reset database to demo catalog and customers? This will delete all current quotations, products, and customers.')) return;
    setRestoring(true);
    try {
      const payload = {
        products: SEED_PRODUCTS,
        customers: SEED_CUSTOMERS,
        quotations: []
      };
      const res = await restoreBackupData(payload);
      if (res.status === 'success') {
        showToast('Database reset to seeds ✓');
        setStats({
          products: SEED_PRODUCTS.length,
          customers: SEED_CUSTOMERS.length,
          quotations: 0
        });
      } else {
        showToast('Reset failed', 'err');
      }
    } catch {
      showToast('Reset request failed', 'err');
    } finally {
      setRestoring(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('WARNING: Clear entire database? This deletes all products, customers, and quotations, and CANNOT BE UNDONE.')) return;
    setRestoring(true);
    try {
      const payload = {
        products: [],
        customers: [],
        quotations: []
      };
      const res = await restoreBackupData(payload);
      if (res.status === 'success') {
        showToast('Database cleared successfully ✓');
        setStats({ products: 0, customers: 0, quotations: 0 });
      } else {
        showToast('Clear failed', 'err');
      }
    } catch {
      showToast('Clear request failed', 'err');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Control Panel</span>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="builder-layout">
        {/* Left: Backup & Restore */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18, fontFamily: 'Archivo Black', margin: '0 0 10px 0' }}>Database Backup &amp; Restore</h2>
            <p style={{ fontSize: 13.5, color: '#6b6557', lineHeight: 1.5, marginBottom: 20 }}>
              Export all system records (Products, Customers, and Quotations) to a portable JSON file. 
              You can import this file on any machine running RetailFix to restore your workspace.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleBackup}>
                📥 Export Backup (.json)
              </button>
              
              <label className="btn btn-ghost" style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', width: 'auto' }}>
                📤 Import Backup
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleRestoreFile} 
                  style={{ display: 'none' }} 
                  disabled={restoring}
                />
              </label>
            </div>

            <h3 style={{ fontSize: 14, fontFamily: 'Archivo Black', margin: '24px 0 10px 0', borderTop: '1px solid var(--line)', paddingTop: 16 }}>Product Excel (CSV) Import/Export</h3>
            <p style={{ fontSize: 13, color: '#6b6557', lineHeight: 1.5, marginBottom: 12 }}>
              Import new products or export your current catalog using Excel-compatible CSV files.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button className="btn btn-ghost" onClick={handleExportCSV}>
                📥 Export Catalog (CSV)
              </button>
              
              <label className="btn btn-ghost" style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', width: 'auto' }}>
                📤 Import Catalog (CSV)
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleImportCSV} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
            {restoring && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--safety-dark)' }}>Restoring database, please wait...</div>}
            
            <h3 style={{ fontSize: 14, fontFamily: 'Archivo Black', margin: '24px 0 10px 0', borderTop: '1px solid var(--line)', paddingTop: 16 }}>Database Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="val">{stats.products}</div>
                <div className="lbl">Products</div>
              </div>
              <div className="stat-card">
                <div className="val">{stats.customers}</div>
                <div className="lbl">Customers</div>
              </div>
              <div className="stat-card">
                <div className="val">{stats.quotations}</div>
                <div className="lbl">Quotations</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleResetToSeeds}>
                🔄 Load Demo Seeds
              </button>
              <button className="btn btn-danger-ghost btn-sm" onClick={handleClearDatabase}>
                ⚠️ Clear Database
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <h2 style={{ fontSize: 18, fontFamily: 'Archivo Black', margin: '0 0 10px 0' }}>Company &amp; Payment Profile</h2>
            <div className="field-row">
              <div className="field">
                <label>Company Name</label>
                <input type="text" value={company.name} onChange={e => handleCompanyChange('name', e.target.value)} />
              </div>
              <div className="field">
                <label>Tagline</label>
                <input type="text" value={company.tagline} onChange={e => handleCompanyChange('tagline', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Address</label>
              <input type="text" value={company.address} onChange={e => handleCompanyChange('address', e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Phone Numbers</label>
                <input type="text" value={company.phone} onChange={e => handleCompanyChange('phone', e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="text" value={company.email} onChange={e => handleCompanyChange('email', e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Website</label>
                <input type="text" value={company.web} onChange={e => handleCompanyChange('web', e.target.value)} />
              </div>
              <div className="field">
                <label>Company GSTIN</label>
                <input type="text" value={company.gstin} onChange={e => handleCompanyChange('gstin', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 14, fontFamily: 'Archivo Black', margin: '0 0 12px 0' }}>Bank Account Details</h3>
              <div className="field-row">
                <div className="field">
                  <label>Bank Name</label>
                  <input type="text" placeholder="e.g. HDFC Bank" value={company.bankName || ''} onChange={e => handleCompanyChange('bankName', e.target.value)} />
                </div>
                <div className="field">
                  <label>A/c Holder Name</label>
                  <input type="text" placeholder="e.g. RetailFix" value={company.accountHolder || ''} onChange={e => handleCompanyChange('accountHolder', e.target.value)} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Account Number</label>
                  <input type="text" value={company.accountNumber || ''} onChange={e => handleCompanyChange('accountNumber', e.target.value)} />
                </div>
                <div className="field">
                  <label>IFSC Code</label>
                  <input type="text" placeholder="e.g. HDFC0001234" value={company.ifscCode || ''} onChange={e => handleCompanyChange('ifscCode', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Branch Name</label>
                <input type="text" value={company.branch || ''} onChange={e => handleCompanyChange('branch', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={saveCompany}>
              Save Company Profile ✓
            </button>
          </div>
        </div>

        {/* Right: Default Terms & Conditions */}
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontFamily: 'Archivo Black', margin: 0 }}>Default Terms</h2>
            <button className="btn btn-ghost btn-sm" onClick={resetTermsToDefault}>Reset</button>
          </div>
          <p style={{ fontSize: 13.5, color: '#6b6557', lineHeight: 1.5, marginBottom: 16 }}>
            These terms &amp; conditions will be auto-loaded for every new quotation you generate.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 350, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
            {terms.map((term, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'start', padding: '8px 10px', background: '#faf9f6', border: '1px solid var(--line)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--steel-600)', marginTop: 1 }}>{i + 1}.</span>
                <span style={{ fontSize: 12.5, flex: 1, lineHeight: 1.4 }}>{term}</span>
                <button 
                  onClick={() => removeTerm(i)} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 0 }}
                  title="Remove term"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              placeholder="Type a new term & condition..." 
              value={newTerm} 
              onChange={e => setNewTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTerm()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-dark" onClick={addTerm}>+ Add</button>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      <Modal
        active={restoreModalActive}
        title="Confirm Database Restore"
        onClose={() => setRestoreModalActive(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setRestoreModalActive(false); setRestorePreview(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmRestore}>Confirm &amp; Overwrite</button>
          </>
        }
      >
        <div className="modal-body">
          <p style={{ color: 'var(--danger)', fontWeight: 'bold', marginBottom: 16 }}>
            WARNING: Restoring will overwrite all existing products, customers, and quotations in the database. This action cannot be undone.
          </p>
          {restorePreview && (
            <div style={{ background: '#faf9f6', border: '1px solid var(--line)', padding: 14, borderRadius: 8, fontSize: 13.5, lineHeight: 1.6 }}>
              <strong>Backup File Contents:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>Products: <strong>{restorePreview.products.length}</strong> items</li>
                <li>Customers: <strong>{restorePreview.customers.length}</strong> items</li>
                <li>Quotations: <strong>{restorePreview.quotations.length}</strong> items</li>
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
