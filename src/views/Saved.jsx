import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getQuotations, deleteQuotation } from '../api';
import Invoice from './Invoice';

const DEFAULT_COMPANY = {
  name: 'RetailFix',
  tagline: 'Store Fixtures & Display Solutions',
  address: 'Plot No. 63, Govindpura Industrial Area, Bhopal, Madhya Pradesh, 462023, India',
  phone: '+91-92019 58481, 92019 58486',
  email: 'info@retailfix.in',
  web: 'retailfix.in',
};

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function Saved({ refreshKey, onModify }) {
  const showToast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewQuote, setViewQuote] = useState(null);
  const [company, setCompany] = useState(DEFAULT_COMPANY);

  // Filter states
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // all | today | this_week | this_month | last_30
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc | date_asc | total_desc | total_asc

  const load = async () => {
    try {
      const data = await getQuotations();
      setQuotes(data);
    } catch {
      showToast('Failed to load quotations', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const savedCompany = localStorage.getItem('retailfix_company_profile');
    if (savedCompany) {
      setCompany(JSON.parse(savedCompany));
    } else {
      setCompany(DEFAULT_COMPANY);
    }
  }, [refreshKey]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this saved quotation?')) return;
    try {
      await deleteQuotation(id);
      showToast('Quotation deleted');
      await load();
    } catch {
      showToast('Delete failed', 'err');
    }
  };

  const handlePrint = () => {
    const ps = document.getElementById('print-sheet-saved');
    if (ps) ps.innerHTML = document.getElementById('invoice-render-saved').innerHTML;
    window.print();
  };

  // Perform filtration
  const filtered = quotes.filter(q => {
    // 1. Text Search
    if (search.trim()) {
      const query = search.toLowerCase();
      const matchQuoteNum = q.quote_number.toLowerCase().includes(query);
      const matchCustName = q.customer.name.toLowerCase().includes(query);
      const matchCity = (q.customer.city || '').toLowerCase().includes(query);
      const matchItems = q.items.some(item => item.name.toLowerCase().includes(query));
      if (!matchQuoteNum && !matchCustName && !matchCity && !matchItems) {
        return false;
      }
    }

    // 2. Custom Date Range Filter
    if (startDate) {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      if (q.created_at < startMs) return false;
    }
    if (endDate) {
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);
      if (q.created_at > endMs) return false;
    }

    // 3. Date Preset Filter (Only checked if custom dates are empty)
    if (!startDate && !endDate && datePreset !== 'all') {
      const now = new Date();
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      if (datePreset === 'today') {
        if (q.created_at < startOfToday) return false;
      } else if (datePreset === 'this_week') {
        const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
        if (q.created_at < sevenDaysAgo) return false;
      } else if (datePreset === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        if (q.created_at < startOfMonth) return false;
      } else if (datePreset === 'last_30') {
        const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;
        if (q.created_at < thirtyDaysAgo) return false;
      }
    }

    // 4. Amount Filter
    const total = q.totals.grand_total ?? q.totals.grandTotal;
    if (minAmount && total < parseFloat(minAmount)) {
      return false;
    }
    if (maxAmount && total > parseFloat(maxAmount)) {
      return false;
    }

    return true;
  });

  // Perform sorting
  const sorted = [...filtered].sort((a, b) => {
    const totalA = a.totals.grand_total ?? a.totals.grandTotal ?? 0;
    const totalB = b.totals.grand_total ?? b.totals.grandTotal ?? 0;
    
    if (sortBy === 'date_desc') {
      return b.created_at - a.created_at;
    } else if (sortBy === 'date_asc') {
      return a.created_at - b.created_at;
    } else if (sortBy === 'total_desc') {
      return totalB - totalA;
    } else if (sortBy === 'total_asc') {
      return totalA - totalB;
    }
    return 0;
  });

  const totalCount = sorted.length;
  const totalValueSum = sorted.reduce((sum, q) => sum + (q.totals.grand_total ?? q.totals.grandTotal), 0);

  const resetFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setDatePreset('all');
    setSortBy('date_desc');
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Archive</span>
          <h1>Saved Quotations</h1>
        </div>
      </div>

      {/* Filter panel */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <label style={{ marginBottom: 10 }}>Search &amp; Filter Archive</label>
        
        <div className="field-row3" style={{ marginBottom: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Search Quote #, Customer, City, Items</label>
            <input 
              type="text" 
              placeholder="🔍 Search name, quote number..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Date Preset</label>
            <select value={datePreset} onChange={e => { setDatePreset(e.target.value); setStartDate(''); setEndDate(''); }}>
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">This Week (Last 7 Days)</option>
              <option value="this_month">This Month</option>
              <option value="last_30">Last 30 Days</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="total_desc">Amount (Highest First)</option>
              <option value="total_asc">Amount (Lowest First)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Custom Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setDatePreset('all'); }} 
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label style={{ fontSize: 10.5 }}>Custom End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setDatePreset('all'); }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--steel-700)', textTransform: 'uppercase' }}>Grand Total Range (₹):</span>
            <input 
              type="number" 
              placeholder="Min" 
              value={minAmount} 
              onChange={e => setMinAmount(e.target.value)} 
              className="filter-amount-input"
            />
            <span style={{ fontSize: 12 }}>to</span>
            <input 
              type="number" 
              placeholder="Max" 
              value={maxAmount} 
              onChange={e => setMaxAmount(e.target.value)} 
              className="filter-amount-input"
            />
          </div>

          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary report bar */}
      {quotes.length > 0 && (
        <div className="quote-summary-bar">
          <div className="summary-count">
            Showing <strong>{totalCount}</strong> of <strong>{quotes.length}</strong> quotation{quotes.length > 1 ? 's' : ''}
          </div>
          <div className="summary-value">
            Total Value: {money(totalValueSum)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗂️</div>
          <h3>No quotations saved</h3>
          <p>Quotations you generate will be listed here for quick access.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3>No matching results</h3>
          <p>No saved quotations match the selected filters. Try clearing some criteria.</p>
        </div>
      ) : (
        <div>
          {sorted.map(q => {
            const grand = q.totals.grand_total ?? q.totals.grandTotal;
            return (
              <div className="quote-list-item" key={q.id}>
                <div className="qmeta">
                  <div className="qid">{q.quote_number}</div>
                  <div className="qname">{q.customer.name}</div>
                  <div className="qsub">
                    {q.date} · {q.items.length} item{q.items.length > 1 ? 's' : ''}
                    {q.customer.city ? ` · ${q.customer.city}` : ''}
                    {(q.totals.discount_amount > 0 || q.totals.discountAmount > 0) && <span style={{ color: 'var(--danger)', marginLeft: 8 }}> · Discount Applied</span>}
                  </div>
                </div>
                <div className="qamt">{money(grand)}</div>
                <div className="quote-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewQuote(q)}>View</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onModify(q)}>Modify / Copy</button>
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(q.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View modal */}
      <Modal
        active={!!viewQuote}
        title="Quotation Preview"
        onClose={() => setViewQuote(null)}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setViewQuote(null)}>Close</button>
            <button className="btn btn-dark" onClick={() => { showToast('Opening print dialog — choose "Save as PDF"'); handlePrint(); }}>⬇ Download PDF</button>
            <button className="btn btn-primary" onClick={handlePrint}>🖨 Print</button>
          </>
        }
      >
        <div className="modal-body modal-body-preview" style={{ background: '#e9e6dc', padding: 24 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div className="invoice-paper card-pad" id="invoice-render-saved" style={{ padding: 32, borderRadius: 8 }}>
              {viewQuote && <Invoice quote={viewQuote} company={company} />}
            </div>
          </div>
        </div>
      </Modal>

      {/* Hidden print target */}
      <div className="print-sheet" id="print-sheet-saved" />
    </div>
  );
}
