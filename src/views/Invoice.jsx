import logoImg from '../assets/logo.png';
import stampImg from '../assets/stamp.png';

const DEFAULT_TERMS = [
  'Prices are factory rates — no middlemen, no hidden costs.',
  '50% advance payment required to confirm order; balance before/at delivery.',
  'Delivery: 7–15 working days from order confirmation, depending on quantity & customization.',
  'GST as applicable will be charged extra unless already included above.',
  'Installation support available on request.',
  'Quotation valid for 15 days from the date of issue.',
];

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function getHSNCode(name, index) {
  if (name.toLowerCase().includes("supermarket")) return `SMR-${String(index + 1).padStart(3, '0')}`;
  if (name.toLowerCase().includes("pharmacy")) return `PDR-${String(index + 1).padStart(3, '0')}`;
  if (name.toLowerCase().includes("medicine") || name.toLowerCase().includes("medical")) return `WMR-${String(index + 1).padStart(3, '0')}`;
  if (name.toLowerCase().includes("end cap")) return `ECDR-${String(index + 1).padStart(3, '0')}`;
  
  // Default fallback
  const initials = name.split(/[\s-]+/).map(w => w && w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = initials.length >= 2 ? initials.substring(0, 4) : 'RF';
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

export default function Invoice({ quote, company }) {
  const t = quote.totals;
  const gstMode = quote.gstMode || quote.gst_mode;
  const qNum = quote.quoteNumber || quote.quote_number;

  const discountAmount = t.discount_amount ?? t.discountAmount ?? 0;
  const discountPercent = t.discount_percent ?? t.discountPercent ?? 0;
  const validityDays = quote.validity_days ?? quote.validityDays ?? 15;

  let gstRows = null;
  if (gstMode === 'split') {
    gstRows = (
      <>
        <tr><td>CGST ({(t.gst_rate ?? t.gstRate) / 2}%)</td><td className="r">{money(t.cgst)}</td></tr>
        <tr><td>SGST ({(t.gst_rate ?? t.gstRate) / 2}%)</td><td className="r">{money(t.sgst)}</td></tr>
      </>
    );
  } else if (gstMode === 'igst') {
    gstRows = <tr><td>IGST ({t.gst_rate ?? t.gstRate}%)</td><td className="r">{money(t.igst)}</td></tr>;
  } else {
    gstRows = <tr><td colSpan={2} style={{ color: '#999', fontSize: 11 }}>GST not applicable on this quotation</td></tr>;
  }

  const customer = quote.customer;
  
  // Custom terms or default terms fallback
  const termsList = quote.terms && quote.terms.length > 0 
    ? quote.terms 
    : DEFAULT_TERMS.map(term => 
        term.startsWith('Quotation valid for') 
          ? `Quotation valid for ${validityDays} days from the date of issue.` 
          : term
      );

  return (
    <div className="invoice-container">
      {/* Header */}
      <div className="inv-header-row">
        <div className="inv-header-left">
          <img src={logoImg} alt="retailfix" className="inv-logo-img" />
        </div>
        <div className="inv-header-right">
          <h1 className="inv-title">QUOTATION</h1>
          <div className="inv-meta-item"><strong>Quotation No:</strong> {qNum}</div>
          <div className="inv-meta-item"><strong>Date:</strong> {quote.date}</div>
        </div>
      </div>

      <div className="inv-header-divider"></div>

      {/* Customer Details */}
      <div className="inv-details-row">
        <div className="inv-details-col">
          <div className="inv-details-title">FROM</div>
          <div className="inv-details-name">{company.name}</div>
          {company.address && <div>{company.address}</div>}
          {company.phone && <div>Ph: {company.phone}</div>}
          <div>{company.email} · {company.web}</div>
          {company.gstin && <div className="inv-gstin-line">GSTIN: {company.gstin}</div>}
        </div>
        <div className="inv-details-col">
          <div className="inv-details-title">QUOTATION FOR</div>
          <div className="inv-details-name">{customer.name}</div>
          {customer.address && <div>{customer.address}</div>}
          {customer.city && <div>{customer.city}</div>}
          {customer.phone && <div>Ph: {customer.phone}</div>}
          {customer.email && <div>Email: {customer.email}</div>}
          {customer.gstin && <div className="inv-gstin-line">GSTIN: {customer.gstin}</div>}
        </div>
      </div>

      {/* Items Table */}
      <div className="inv-table-container">
        <table className="inv-table-new">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
              <th style={{ textAlign: 'left' }}>Item Description</th>
              <th style={{ width: '120px', textAlign: 'center' }}>HSN Code</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td style={{ textAlign: 'left' }}>
                  <div className="inv-item-name">{it.name}</div>
                </td>
                <td style={{ textAlign: 'center' }}>{getHSNCode(it.name, i)}</td>
                <td style={{ textAlign: 'center' }}>{it.qty}</td>
                <td style={{ textAlign: 'right' }}>{money(it.price)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{money(it.line_total ?? it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Terms & Totals Area */}
      <div className="inv-bottom-row">
        <div className="inv-bottom-left">
          <div className="inv-bottom-title">TERMS &amp; CONDITIONS:</div>
          <ul className="inv-terms-bullets">
            {termsList.map((term, i) => <li key={i}>{term}</li>)}
          </ul>

          <div className="inv-bottom-title" style={{ marginTop: '20px' }}>BANK DETAILS:</div>
          {company.bankName ? (
            <div className="inv-bank-details">
              <div><strong>Bank Name:</strong> {company.bankName}</div>
              <div><strong>A/C Name:</strong> {company.accountHolder || company.name}</div>
              <div><strong>A/C No:</strong> {company.accountNumber}</div>
              <div><strong>IFSC Code:</strong> {company.ifscCode}</div>
              {company.branch && <div><strong>Branch:</strong> {company.branch}</div>}
            </div>
          ) : (
            <div className="inv-bank-details-empty">
              For bank details &amp; payment instructions, please contact our office.
            </div>
          )}
        </div>

        <div className="inv-bottom-right">
          <table className="inv-summary-table">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="r">{money(t.subtotal)}</td>
              </tr>
              {discountAmount > 0 && (
                <tr style={{ color: 'var(--primary)' }}>
                  <td>Discount ({discountPercent.toFixed(1)}%)</td>
                  <td className="r">-{money(discountAmount)}</td>
                </tr>
              )}
              {t.delivery > 0 && (
                <tr>
                  <td>Delivery / Installation</td>
                  <td className="r">{money(t.delivery)}</td>
                </tr>
              )}
              {gstMode === 'split' ? (
                <>
                  <tr><td>CGST ({(t.gst_rate ?? t.gstRate) / 2}%)</td><td className="r">{money(t.cgst)}</td></tr>
                  <tr><td>SGST ({(t.gst_rate ?? t.gstRate) / 2}%)</td><td className="r">{money(t.sgst)}</td></tr>
                </>
              ) : gstMode === 'igst' ? (
                <tr><td>IGST ({t.gst_rate ?? t.gstRate}%)</td><td className="r">{money(t.igst)}</td></tr>
              ) : (
                <tr><td colSpan={2} style={{ color: '#888', fontSize: '11px', fontStyle: 'italic' }}>GST not applicable</td></tr>
              )}
              <tr className="grand-total-row">
                <td>Grand Total</td>
                <td className="r">{money(t.grand_total ?? t.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures Area */}
      <div className="inv-signatures-row">
        <div className="inv-signature-col">
          <div className="inv-signature-line"></div>
          <div className="inv-signature-label">Authorized Signatory</div>
          <div className="inv-signature-sub">RetailFix – Display Rack Solutions</div>
        </div>
      </div>

      {/* Footer Divider */}
      <div className="inv-footer-divider"></div>

      {/* Center Footer Info */}
      <div className="inv-footer-info">
        <span>📞 {company.phone}</span>
        <span className="inv-footer-sep">|</span>
        <span>✉️ {company.email}</span>
        <span className="inv-footer-sep">|</span>
        <span>🌐 {company.web}</span>
      </div>

      {/* Circular Stamp */}
      <img src={stampImg} alt="RetailFix Stamp" className="inv-stamp" crossOrigin="anonymous" loading="eager" />
    </div>
  );
}
