import { useState, useEffect, useRef } from 'react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getProducts, getCustomers, saveQuotation, createCustomer, getNextQuotationNumber } from '../api';
import Invoice from './Invoice';
import html2pdf from 'html2pdf.js';


function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function calcTotals(cart, products, gstMode, gstRate, delivery, discountType, discountValue, customPrices) {
  let subtotal = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = products.find(x => x.id === id);
    if (p) {
      let priceVal = parseFloat(customPrices[id]);
      if (isNaN(priceVal) || priceVal < 0) {
        priceVal = p.price;
      }
      const price = Math.max(0, priceVal);
      const q = Math.max(1, parseInt(qty) || 0);
      subtotal += price * q;
    }
  });

  const safeGstRate = Math.max(0, parseFloat(gstRate) || 0);
  const safeDelivery = Math.max(0, parseFloat(delivery) || 0);
  const safeDiscountValue = Math.max(0, parseFloat(discountValue) || 0);

  let discountAmount = 0;
  let discountPercent = 0;
  if (discountType === 'percent') {
    discountPercent = Math.min(100, safeDiscountValue);
    discountAmount = subtotal * (discountPercent / 100);
  } else {
    discountAmount = Math.min(subtotal, safeDiscountValue);
    discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount) + safeDelivery;
  let gstAmount = 0, cgst = 0, sgst = 0, igst = 0;
  if (gstMode !== 'none') {
    gstAmount = taxableAmount * (safeGstRate / 100);
    if (gstMode === 'split') {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    } else {
      igst = gstAmount;
    }
  }

  const finalGrandTotal = taxableAmount + gstAmount;

  return {
    subtotal,
    delivery: safeDelivery,
    discountPercent,
    discountAmount,
    gstRate: safeGstRate,
    taxableAmount,
    gstAmount,
    cgst,
    sgst,
    igst,
    grandTotal: finalGrandTotal,
    
    // snake_case aliases for backend validation
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    gst_rate: safeGstRate,
    gst_amount: gstAmount,
    grand_total: finalGrandTotal
  };
}

const DEFAULT_COMPANY = {
  name: 'RetailFix',
  tagline: 'Store Fixtures & Display Solutions',
  address: 'Plot No. 63, Govindpura Industrial Area, Bhopal, Madhya Pradesh, 462023, India',
  phone: '+91-92019 58481, 92019 58486',
  email: 'info@retailfix.in',
  web: 'retailfix.in',
};

const CATEGORIES = ['All', 'Supermarket', 'Pharmacy', 'Garment', 'Custom Fixtures', 'Accessories', 'Other'];

export default function Builder({ onQuoteSaved, editQuote, clearEditQuote }) {
  const showToast = useToast();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});          // { productId: qty }
  const [customPrices, setCustomPrices] = useState({}); // { productId: price }
  
  const [gstMode, setGstModeState] = useState('split');
  const [gstRate, setGstRate] = useState(18);
  const [delivery, setDelivery] = useState(0);

  // Customer states
  const [custId, setCustId] = useState(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveCustomerToDirectory, setSaveCustomerToDirectory] = useState(true);

  // Discount & validity
  const [discountType, setDiscountType] = useState('percent'); // percent | value
  const [discountValue, setDiscountValue] = useState(0);
  const [validityDays, setValidityDays] = useState(15);

  // Custom terms
  const [activeTerms, setActiveTerms] = useState([]);
  const [newTermText, setNewTermText] = useState('');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nextQuoteNumber, setNextQuoteNumber] = useState('');
  const printRef = useRef(null);
  const categoryTabsRef = useRef(null);

  // Filtering products
  const [pickerCategory, setPickerCategory] = useState('All');
  
  // Mobile tabs
  const [mobileTab, setMobileTab] = useState('picker'); // picker | cart

  // Customer collapsible "More Details"
  const [custMoreOpen, setCustMoreOpen] = useState(false);

  // Company details
  const [company, setCompany] = useState(DEFAULT_COMPANY);

  const fetchNextQuoteNumber = async () => {
    try {
      const res = await getNextQuotationNumber();
      setNextQuoteNumber(res.next_number);
    } catch {
      setNextQuoteNumber('RF-Q-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
    }
  };

  useEffect(() => {
    // Load products
    getProducts()
      .then(setProducts)
      .catch(() => showToast('Failed to load products', 'err'))
      .finally(() => setLoading(false));

    // Load customers
    getCustomers()
      .then(setCustomers)
      .catch(() => {});

    // Load default terms
    const savedTerms = localStorage.getItem('retailfix_default_terms');
    if (savedTerms) {
      setActiveTerms(JSON.parse(savedTerms));
    } else {
      const defaults = [
        'Prices are factory rates — no middlemen, no hidden costs.',
        '50% advance payment required to confirm order; balance before/at delivery.',
        'Delivery: 7–15 working days from order confirmation, depending on quantity & customization.',
        'GST as applicable will be charged extra unless already included above.',
        'Installation support available on request.',
        'Quotation valid for 15 days from the date of issue.',
      ];
      setActiveTerms(defaults);
      localStorage.setItem('retailfix_default_terms', JSON.stringify(defaults));
    }

    // Load company profile
    const savedCompany = localStorage.getItem('retailfix_company_profile');
    if (savedCompany) {
      setCompany(JSON.parse(savedCompany));
    }

    fetchNextQuoteNumber();

    // Load auto-save draft
    if (!editQuote) {
      try {
        const draftStr = localStorage.getItem('retailfix_builder_draft');
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          if (Object.keys(draft.cart || {}).length > 0 || draft.custName) {
            setCart(draft.cart || {});
            setCustomPrices(draft.customPrices || {});
            setCustId(draft.custId || null);
            setCustName(draft.custName || '');
            setCustPhone(draft.custPhone || '');
            setCustEmail(draft.custEmail || '');
            setCustCity(draft.custCity || '');
            setCustAddress(draft.custAddress || '');
            setCustGstin(draft.custGstin || '');
            setDelivery(draft.delivery || 0);
            setGstRate(draft.gstRate ?? 18);
            setGstModeState(draft.gstMode || 'split');
            setDiscountValue(draft.discountValue || 0);
            setDiscountType(draft.discountType || 'percent');
            setValidityDays(draft.validityDays || 15);
            if (draft.activeTerms && draft.activeTerms.length) setActiveTerms(draft.activeTerms);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Auto-save draft whenever form data changes
  useEffect(() => {
    if (editQuote) return;
    const draft = {
      cart, customPrices, custId, custName, custPhone, custEmail, custCity, custAddress, custGstin,
      delivery, gstRate, gstMode, discountValue, discountType, validityDays, activeTerms
    };
    localStorage.setItem('retailfix_builder_draft', JSON.stringify(draft));
  }, [cart, customPrices, custId, custName, custPhone, custEmail, custCity, custAddress, custGstin, delivery, gstRate, gstMode, discountValue, discountType, validityDays, activeTerms, editQuote]);

  // Handle editQuote parameter loading
  useEffect(() => {
    if (editQuote && products.length > 0) {
      const newCart = {};
      const nextCustomPrices = {};
      const updatedProducts = [...products];

      editQuote.items.forEach(item => {
        let dbProd = updatedProducts.find(p => p.name === item.name);
        if (!dbProd) {
          // If product is not in DB catalog, create temporary item in local state
          const mockId = 'mock-' + Math.random().toString(36).substring(2, 9);
          dbProd = { id: mockId, name: item.name, category: item.category, unit: item.unit, price: item.price };
          updatedProducts.push(dbProd);
        }
        newCart[dbProd.id] = item.qty;
        nextCustomPrices[dbProd.id] = item.price;
      });

      // Update products state if we added mock items
      setProducts(updatedProducts);
      setCart(newCart);
      setCustomPrices(nextCustomPrices);
      
      setCustId(editQuote.customer_id);
      setCustName(editQuote.customer.name);
      setCustPhone(editQuote.customer.phone || '');
      setCustEmail(editQuote.customer.email || '');
      setCustCity(editQuote.customer.city || '');
      setCustAddress(editQuote.customer.address || '');
      setCustGstin(editQuote.customer.gstin || '');
      
      setGstModeState(editQuote.gst_mode);
      setGstRate(editQuote.totals.gst_rate ?? 18);
      setDelivery(editQuote.totals.delivery || 0);
      setDiscountValue(editQuote.totals.discount_amount || 0);
      setDiscountType('value'); // Set as flat cash for accurate loading
      setValidityDays(editQuote.validity_days || 15);
      setActiveTerms(editQuote.terms || []);
      
      showToast(`Loaded details from quote ${editQuote.quote_number} (New serial will be assigned)`);
      clearEditQuote(); // consume state
      
      // Auto switch to cart tab on mobile so they can see loaded items
      setMobileTab('cart');
    }
  }, [editQuote, products]);

  // Disable body scroll on mobile when drawer is open
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 920) {
      document.body.classList.toggle('drawer-open', mobileTab === 'cart');
    }
    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [mobileTab]);

  // Filter customers as name is typed
  const handleCustNameChange = (val) => {
    setCustName(val);
    setCustId(null); // Clear selected customer id if typed manually
    if (val.trim()) {
      const q = val.toLowerCase();
      const matches = customers.filter(c => c.name.toLowerCase().includes(q));
      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCustomer = (c) => {
    setCustId(c.id);
    setCustName(c.name);
    setCustPhone(c.phone || '');
    setCustEmail(c.email || '');
    setCustCity(c.city || '');
    setCustAddress(c.address || '');
    setCustGstin(c.gstin || '');
    setShowSuggestions(false);
    showToast(`Autofilled ${c.name}`);
  };

  const toggleCart = (id) => {
    setCart(c => {
      const next = { ...c };
      if (next[id]) {
        delete next[id];
        // clean up custom prices too
        setCustomPrices(prev => {
          const nextPrices = { ...prev };
          delete nextPrices[id];
          return nextPrices;
        });
      } else {
        next[id] = 1;
      }
      return next;
    });
  };

  const updateQty = (id, val) => {
    if (val === '') {
      setCart(c => ({ ...c, [id]: '' }));
    } else {
      let q = parseInt(val);
      setCart(c => ({ ...c, [id]: isNaN(q) ? '' : q }));
    }
  };

  const handleQtyBlur = (id, val) => {
    let q = parseInt(val);
    if (isNaN(q) || q < 1) q = 1;
    setCart(c => ({ ...c, [id]: q }));
  };

  const updatePrice = (id, val) => {
    if (val === '') {
      setCustomPrices(c => ({ ...c, [id]: '' }));
    } else {
      let price = parseFloat(val);
      setCustomPrices(c => ({ ...c, [id]: isNaN(price) ? '' : price }));
    }
  };

  const handlePriceBlur = (id, val, defaultPrice) => {
    let price = parseFloat(val);
    if (isNaN(price) || price < 0) price = defaultPrice;
    setCustomPrices(c => ({ ...c, [id]: price }));
  };

  const reset = () => {
    if (Object.keys(cart).length && !window.confirm('Clear current quotation and start fresh?')) return;
    setCart({});
    setCustomPrices({});
    setCustId(null);
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    setCustCity('');
    setCustAddress('');
    setCustGstin('');
    setDelivery(0);
    setGstRate(18);
    setGstModeState('split');
    setDiscountValue(0);
    setDiscountType('percent');
    setValidityDays(15);
    setPickerCategory('All');
    setMobileTab('picker');
    // Reload default terms
    const savedTerms = localStorage.getItem('retailfix_default_terms');
    if (savedTerms) setActiveTerms(JSON.parse(savedTerms));
    fetchNextQuoteNumber();
    localStorage.removeItem('retailfix_builder_draft');
  };

  const totals = calcTotals(cart, products, gstMode, gstRate, delivery, discountType, discountValue, customPrices);

  const addCustomTerm = () => {
    if (!newTermText.trim()) return;
    setActiveTerms([...activeTerms, newTermText.trim()]);
    setNewTermText('');
  };

  const removeCustomTerm = (idx) => {
    setActiveTerms(activeTerms.filter((_, i) => i !== idx));
  };

  const generateQuotation = () => {
    if (Object.keys(cart).length === 0) { showToast('Add at least one item', 'err'); return; }
    if (!custName.trim()) { showToast('Enter customer / shop name', 'err'); return; }

    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const items = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(x => x.id === id);
      let parsedQty = parseInt(qty);
      if (isNaN(parsedQty) || parsedQty < 1) parsedQty = 1;
      let parsedPrice = parseFloat(customPrices[id]);
      if (isNaN(parsedPrice) || parsedPrice < 0) parsedPrice = p.price;
      return { name: p.name, category: p.category, unit: p.unit, price: parsedPrice, qty: parsedQty, line_total: parsedPrice * parsedQty };
    });

    setCurrentQuote({
      quote_number: nextQuoteNumber,
      date: dateStr,
      customer_id: custId,
      customer: {
        name: custName,
        phone: custPhone,
        email: custEmail,
        city: custCity,
        address: custAddress,
        gstin: custGstin
      },
      items,
      gst_mode: gstMode,
      totals,
      terms: activeTerms,
      validity_days: validityDays
    });
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!currentQuote) return;
    setSaving(true);
    try {
      let finalCustId = currentQuote.customer_id;
      // Auto-save new customer if checked and it's a new profile
      if (!finalCustId && saveCustomerToDirectory) {
        try {
          const newCust = await createCustomer({
            name: currentQuote.customer.name,
            phone: currentQuote.customer.phone,
            email: currentQuote.customer.email,
            city: currentQuote.customer.city,
            address: currentQuote.customer.address,
            gstin: currentQuote.customer.gstin
          });
          finalCustId = newCust.id;
          currentQuote.customer_id = finalCustId;
          showToast(`Saved customer "${newCust.name}" to directory ✓`);
        } catch {
          showToast('Failed to auto-save customer profile, saving quote anyway', 'err');
        }
      }
      
      await saveQuotation(currentQuote);
      showToast('Quotation saved ✓');
      // Refresh local autocomplete suggestions list
      getCustomers().then(setCustomers).catch(() => {});
      onQuoteSaved?.();
      fetchNextQuoteNumber();
      localStorage.removeItem('retailfix_builder_draft');
    } catch {
      showToast('Failed to save quotation', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    await handleSave();
    const element = document.getElementById('invoice-render');
    if (!element) return;

    element.classList.add('pdf-mode');

    const opt = {
      margin: 0,
      filename: `quotation_${currentQuote?.quote_number || 'draft'}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: {
        unit: 'px',
        format: [794, 1123],
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['css', 'legacy']
      }
    };

    try {
      showToast('Generating PDF...');
      const pdf = await html2pdf()
        .from(element)
        .set(opt)
        .toPdf()
        .get('pdf');

      const total = pdf.internal.getNumberOfPages();
      if (total > 1) {
        const last = pdf.internal.pages[total];
        if (!last || last.length === 1) {
          pdf.deletePage(total);
        }
      }

      pdf.save(`quotation_${currentQuote?.quote_number || 'draft'}.pdf`);
      showToast('PDF downloaded successfully!', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF', 'err');
    } finally {
      element.classList.remove('pdf-mode');
    }
  };

  const handlePrint = async () => {
    await handleSave();
    if (printRef.current) {
      printRef.current.innerHTML = document.getElementById('invoice-render').innerHTML;
    }
    window.print();
  };

  // Filtered product catalog search
  const q = search.toLowerCase();
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchesCategory = pickerCategory === 'All' || p.category === pickerCategory;
    return matchesSearch && matchesCategory;
  });

  const cartIds = Object.keys(cart);

  return (
    <div className="rf-builder-wrapper">
      {/* Section Header */}
      <div className="rf-section-head">
        <div>
          <span className="eyebrow">Step 01 — Build</span>
          <h1>New Quotation</h1>
        </div>
        <div className="rf-head-actions">
          <span className="quote-sn-badge mono">{nextQuoteNumber || '…'}</span>
          <button className="btn btn-ghost btn-sm" onClick={reset}>↺ Reset</button>
        </div>
      </div>

      {/* Main Builder Grid Layout */}
      <div className="builder-layout">
        {/* Left Column: Products Picker */}
        <div className="rf-picker-section">
          {/* Customer card inside picker (sits at top of page/column) */}
          <div className="rf-cust-card">
            <div className="rf-cust-primary-row">
              <div className="rf-input-wrapper" style={{ position: 'relative' }}>
                <label htmlFor="cust-name-input">Customer / Shop *</label>
                <div className="rf-input-relative">
                  <input
                    id="cust-name-input"
                    type="text"
                    placeholder="Name or search…"
                    value={custName}
                    onChange={e => handleCustNameChange(e.target.value)}
                    onFocus={() => custName.trim() && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="rf-input"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="rf-cust-suggestions">
                      {suggestions.map(c => (
                        <div
                          key={c.id}
                          className="rf-cust-suggestion-item"
                          onClick={() => selectCustomer(c)}
                          onMouseDown={e => e.preventDefault()}
                        >
                          <span className="rf-sug-name">{c.name}</span>
                          <span className="rf-sug-meta">
                            {c.city && <span className="rf-sug-city">{c.city}</span>}
                            {c.phone && <span className="rf-sug-phone">{c.phone}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="rf-input-wrapper rf-cust-phone-wrapper">
                <label htmlFor="cust-phone-input">Phone</label>
                <input
                  id="cust-phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="9xxxxxxxxx"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                  className="rf-input"
                />
              </div>
              <button
                className="rf-cust-more-toggle"
                onClick={() => setCustMoreOpen(o => !o)}
                aria-expanded={custMoreOpen}
                type="button"
                title={custMoreOpen ? 'Hide details' : 'More details'}
              >
                {custMoreOpen ? '▲ Less' : '▼ More'}
              </button>
            </div>

            {/* Expandable fields */}
            {custMoreOpen && (
              <div className="rf-customer-more-fields">
                <div className="rf-input-grid">
                  <div className="rf-input-wrapper">
                    <label htmlFor="cust-email-input">Email</label>
                    <input
                      id="cust-email-input"
                      type="email"
                      placeholder="client@email.com"
                      value={custEmail}
                      onChange={e => setCustEmail(e.target.value)}
                      className="rf-input"
                    />
                  </div>
                  <div className="rf-input-wrapper">
                    <label htmlFor="cust-city-input">City</label>
                    <input
                      id="cust-city-input"
                      type="text"
                      placeholder="e.g. Bhopal"
                      value={custCity}
                      onChange={e => setCustCity(e.target.value)}
                      className="rf-input"
                    />
                  </div>
                  <div className="rf-input-wrapper">
                    <label htmlFor="cust-gstin-input">GSTIN (Optional)</label>
                    <input
                      id="cust-gstin-input"
                      type="text"
                      placeholder="Client GST Number"
                      value={custGstin}
                      onChange={e => setCustGstin(e.target.value)}
                      className="rf-input"
                    />
                  </div>
                  <div className="rf-input-wrapper">
                    <label htmlFor="cust-address-input">Address (Optional)</label>
                    <input
                      id="cust-address-input"
                      type="text"
                      placeholder="Shop No, Street, Area"
                      value={custAddress}
                      onChange={e => setCustAddress(e.target.value)}
                      className="rf-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {!custId && custName.trim() && (
              <div className="rf-cust-save-row">
                <input
                  type="checkbox"
                  id="save-cust-check"
                  checked={saveCustomerToDirectory}
                  onChange={e => setSaveCustomerToDirectory(e.target.checked)}
                  className="rf-checkbox"
                />
                <label htmlFor="save-cust-check" className="rf-checkbox-label">
                  Save <strong>"{custName}"</strong> to directory
                </label>
              </div>
            )}
          </div>

          {/* Sticky search and horizontal swipable category section */}
          <div className="rf-picker-sticky-head">
            <div className="rf-search-bar">
              <div className="rf-search-icon">🔍</div>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rf-search-input"
              />
            </div>
            <div className="rf-category-scroll-wrapper">
              <button
                className="rf-cat-scroll-btn rf-cat-scroll-left"
                onClick={() => { if (categoryTabsRef.current) categoryTabsRef.current.scrollLeft -= 120; }}
                aria-label="Scroll categories left"
                type="button"
              >◀</button>
              <div className="rf-category-tabs" ref={categoryTabsRef}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`rf-category-pill ${pickerCategory === cat ? 'active' : ''}`}
                    onClick={() => setPickerCategory(cat)}
                    type="button"
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                className="rf-cat-scroll-btn rf-cat-scroll-right"
                onClick={() => { if (categoryTabsRef.current) categoryTabsRef.current.scrollLeft += 120; }}
                aria-label="Scroll categories right"
                type="button"
              >▶</button>
            </div>
          </div>

          <div className="rf-catalog-list">
            {loading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : products.length === 0 ? (
              <div className="cart-empty">No products in catalog yet.</div>
            ) : filtered.length === 0 ? (
              <div className="cart-empty">No matches found.</div>
            ) : (
              <div className="rf-products-grid">
                {filtered.map(p => (
                  <div className={`rf-product-card ${cart[p.id] ? 'added' : ''}`} key={p.id}>
                    <div className="rf-prod-info">
                      <div className="rf-prod-name" title={p.name}>{p.name}</div>
                      <div className="rf-prod-meta">{p.category} · {p.unit}</div>
                    </div>
                    <div className="rf-prod-actions">
                      <span className="rf-prod-price">{money(p.price)}</span>
                      {cart[p.id] ? (
                        <div className="rf-qty-selector">
                          <button className="rf-qty-btn" onClick={() => updateQty(p.id, Math.max(1, cart[p.id] - 1))} title="−" type="button">−</button>
                          <input
                            type="number"
                            className="rf-qty-input mono"
                            value={cart[p.id]}
                            min="1"
                            onChange={e => updateQty(p.id, e.target.value)}
                            onBlur={e => handleQtyBlur(p.id, e.target.value)}
                            onClick={e => e.target.select()}
                            title="Qty"
                          />
                          <button className="rf-qty-btn" onClick={() => updateQty(p.id, cart[p.id] + 1)} title="+" type="button">+</button>
                          <button className="rf-qty-remove" onClick={() => toggleCart(p.id)} title="Remove" type="button">✕</button>
                        </div>
                      ) : (
                        <button className="rf-add-btn" onClick={() => toggleCart(p.id)} type="button">+ Add</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column / Sticky Bottom Drawer: Cart Summary */}
        <div className={`rf-cart-drawer ${mobileTab === 'cart' ? 'rf-expanded' : 'rf-collapsed'}`}>
          <div className="rf-cart-drawer-content">
            <h3 className="rf-desktop-cart-title">Quotation Summary</h3>

            {/* Selected Items */}
            <div className="rf-cart-items">
              {cartIds.length === 0 ? (
                <div className="cart-empty">No items added yet.<br />Pick products from the left.</div>
              ) : cartIds.map(id => {
                const p = products.find(x => x.id === id);
                if (!p) return null;
                const qty = cart[id];
                const price = customPrices[id] ?? p.price;
                return (
                  <div className="rf-cart-item-row" key={id}>
                    <div className="cname" title={p.name}>{p.name}</div>
                    <input
                      type="number" className="cqty mono" min="1" value={qty}
                      onChange={e => updateQty(id, e.target.value)}
                      onBlur={e => handleQtyBlur(id, e.target.value)}
                      title="Qty"
                    />
                    <input 
                      type="number" className="rf-cart-item-price mono" min="0" value={price}
                      onChange={e => updatePrice(id, e.target.value)}
                      onBlur={e => handlePriceBlur(id, e.target.value, p.price)}
                      title="Rate ₹"
                    />
                    <div className="clinetotal">{money(price * qty)}</div>
                    <button className="cdel" onClick={() => toggleCart(id)} type="button">✕</button>
                  </div>
                );
              })}
            </div>

            {/* GST Toggles */}
            <div style={{ marginTop: 12 }}>
              <label>GST Mode</label>
              <div className="rf-gst-toggle">
                {[['split', 'CGST+SGST'], ['igst', 'IGST'], ['none', 'No GST']].map(([mode, label]) => (
                  <div
                    key={mode}
                    className={`rf-gst-opt ${gstMode === mode ? 'active' : ''}`}
                    onClick={() => setGstModeState(mode)}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* GST Rate and Validity Days */}
            <div className="field-row" style={{ marginTop: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>GST Rate (%)</label>
                <input
                  type="number" 
                  value={gstRate} 
                  min="0" 
                  max="28"
                  disabled={gstMode === 'none'}
                  onChange={e => {
                    const val = e.target.value;
                    setGstRate(val === '' ? '' : val);
                  }}
                  onBlur={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setGstRate(Math.max(0, Math.min(28, val)));
                  }}
                  className="rf-input"
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Validity (Days)</label>
                <input
                  type="number" 
                  value={validityDays} 
                  min="1"
                  onChange={e => {
                    const val = e.target.value;
                    setValidityDays(val === '' ? '' : val);
                  }}
                  onBlur={e => {
                    const val = parseInt(e.target.value) || 15;
                    setValidityDays(Math.max(1, val));
                  }}
                  className="rf-input"
                />
              </div>
            </div>

            {/* Discount Section */}
            <div className="field-row" style={{ marginTop: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Discount Type</label>
                <select value={discountType} onChange={e => { setDiscountType(e.target.value); setDiscountValue(0); }} className="rf-input">
                  <option value="percent">Percentage (%)</option>
                  <option value="value">Flat Cash (₹)</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Discount Value</label>
                <input
                  type="number" 
                  value={discountValue} 
                  min="0"
                  onChange={e => {
                    const val = e.target.value;
                    setDiscountValue(val === '' ? '' : val);
                  }}
                  onBlur={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const maxVal = discountType === 'percent' ? 100 : totals.subtotal;
                    setDiscountValue(Math.max(0, Math.min(maxVal, val)));
                  }}
                  className="rf-input"
                />
              </div>
            </div>

            {/* Delivery Charge */}
            <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>Delivery / Installation (₹)</label>
              <input
                type="number" 
                value={delivery} 
                min="0"
                onChange={e => {
                  const val = e.target.value;
                  setDelivery(val === '' ? '' : val);
                }}
                onBlur={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setDelivery(Math.max(0, val));
                }}
                className="rf-input"
              />
            </div>

            {/* Price Calculations */}
            <div className="rf-totals-box">
              <div className="rf-trow"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && (
                <div className="rf-trow" style={{ color: 'var(--rf-danger)' }}>
                  <span>Discount ({totals.discountPercent.toFixed(1)}%)</span>
                  <span>-{money(totals.discountAmount)}</span>
                </div>
              )}
              {totals.delivery > 0 && (
                <div className="rf-trow"><span>Delivery / Installation</span><span>{money(totals.delivery)}</span></div>
              )}
              {gstMode === 'split' && (
                <>
                  <div className="rf-trow"><span>CGST ({(totals.gstRate / 2).toFixed(1)}%)</span><span>{money(totals.cgst)}</span></div>
                  <div className="rf-trow"><span>SGST ({(totals.gstRate / 2).toFixed(1)}%)</span><span>{money(totals.sgst)}</span></div>
                </>
              )}
              {gstMode === 'igst' && (
                <div className="rf-trow"><span>IGST ({totals.gstRate}%)</span><span>{money(totals.igst)}</span></div>
              )}
              <div className="rf-trow grand"><span>Grand Total</span><span>{money(totals.grandTotal)}</span></div>
            </div>

            {/* Editable terms section */}
            <div className="rf-terms-section">
              <label>Custom Terms for this Quote</label>
              <div className="rf-terms-list">
                {activeTerms.map((term, i) => (
                  <div key={i} className="rf-term-item">
                    <span className="rf-term-text" title={term}>{term}</span>
                    <button 
                      onClick={() => removeCustomTerm(i)}
                      className="rf-term-remove"
                      type="button"
                    >✕</button>
                  </div>
                ))}
              </div>
              <div className="rf-terms-add">
                <input 
                  type="text" 
                  placeholder="New custom term..." 
                  value={newTermText}
                  onChange={e => setNewTermText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTerm()}
                  className="rf-input"
                />
                <button className="btn btn-dark btn-sm" onClick={addCustomTerm} type="button">+ Add</button>
              </div>
            </div>
          </div>

          {/* Bottom Sticky Action Bar (Unified toggle and generate buttons) */}
          <div className={`rf-drawer-action-area bottom-action-bar ${previewOpen ? "preview-open" : ""}`}>
            <button 
              className="btn btn-ghost rf-mobile-cart-toggle" 
              onClick={() => setMobileTab(mobileTab === 'cart' ? 'picker' : 'cart')}
              type="button"
            >
              🛒 Cart ({cartIds.length}) {mobileTab === 'cart' ? '▼' : '▲'}
            </button>
            <button
              className="btn btn-primary rf-drawer-generate-btn"
              onClick={generateQuotation}
              type="button"
            >
              Generate Quotation →
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        active={previewOpen}
        title="Quotation Preview"
        onClose={() => setPreviewOpen(false)}
        wide
        overlayClassName="modal-overlay"
        className="modal-content"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPreviewOpen(false)} type="button">Close</button>
            <button className="btn btn-dark" onClick={handleDownloadPDF} type="button">
              ⬇ Download PDF
            </button>
            <button className="btn btn-primary" onClick={handlePrint} type="button">🖨 Print</button>
          </>
        }
      >
        <div className="modal-body modal-body-preview" style={{ background: '#e9e6dc', padding: 24 }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div className="invoice-paper card-pad" id="invoice-render" style={{ padding: 32, borderRadius: 8 }}>
              {currentQuote && <Invoice quote={currentQuote} company={company} />}
            </div>
          </div>
        </div>
      </Modal>

      {/* Hidden print target */}
      <div className="print-sheet" ref={printRef} />
    </div>
  );
}
