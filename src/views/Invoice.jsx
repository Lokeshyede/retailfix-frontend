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
    <>
      {/* Header */}
      <div className="inv-head">
        <div className="inv-logo-mark">
          <div className="inv-logo-box">R</div>
          <div>
            <div className="inv-co-name">{company.name}</div>
            <div className="inv-co-sub">{company.tagline}</div>
          </div>
        </div>
        <div className="inv-doc-title">
          <h2>QUOTATION</h2>
          <div className="qnum">{qNum}</div>
          <div style={{ fontSize: 11.5, color: '#777', marginTop: 3 }}>Date: {quote.date}</div>
        </div>
      </div>

      {/* Parties */}
      <div className="inv-parties">
        <div>
          <div className="label">From</div>
          <div style={{ fontWeight: 700 }}>{company.name}</div>
          <div>{company.address}</div>
          <div>Ph: {company.phone}</div>
          <div>{company.email} · {company.web}</div>
          {company.gstin && <div style={{ fontWeight: 'bold', color: '#333', marginTop: 3 }}>GSTIN: {company.gstin}</div>}
        </div>
        <div>
          <div className="label">Quotation For</div>
          <div style={{ fontWeight: 700 }}>{customer.name}</div>
          {customer.address && <div>{customer.address}</div>}
          {customer.city && <div>{customer.city}</div>}
          {customer.phone && <div>Ph: {customer.phone}</div>}
          {customer.email && <div>Email: {customer.email}</div>}
          {customer.gstin && <div style={{ fontWeight: 'bold', color: '#333', marginTop: 3 }}>GSTIN: {customer.gstin}</div>}
        </div>
      </div>

      {/* Items table – wrapped for horizontal scroll on mobile */}
      <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}>#</th>
            <th>Item</th>
            <th>Unit</th>
            <th className="r">Price</th>
            <th className="r">Qty</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <strong>{it.name}</strong><br />
                <span style={{ color: '#999', fontSize: 10.5 }}>{it.category}</span>
              </td>
              <td>{it.unit}</td>
              <td className="r">{money(it.price)}</td>
              <td className="r">{it.qty}</td>
              <td className="r"><strong>{money(it.line_total ?? it.lineTotal)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Totals */}
      <div className="inv-totals">
        <table>
          <tbody>
            <tr><td>Subtotal</td><td className="r">{money(t.subtotal)}</td></tr>
            {discountAmount > 0 && (
              <tr style={{ color: 'var(--danger)' }}>
                <td>Discount ({discountPercent.toFixed(1)}%)</td>
                <td className="r">-{money(discountAmount)}</td>
              </tr>
            )}
            {(t.delivery > 0) && (
              <tr><td>Delivery / Installation</td><td className="r">{money(t.delivery)}</td></tr>
            )}
            {gstRows}
            <tr className="grand">
              <td>Grand Total</td>
              <td className="r">{money(t.grand_total ?? t.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="inv-footer">
        <div>
          <h4>Terms &amp; Conditions</h4>
          <ul>{termsList.map((term, i) => <li key={i}>{term}</li>)}</ul>
        </div>
        <div>
          <h4>Bank Details</h4>
          {company.bankName ? (
            <div style={{ fontSize: 11, color: '#333', lineHeight: 1.4, marginBottom: 12 }}>
              <strong>A/c Name:</strong> {company.accountHolder || company.name}<br />
              <strong>Bank:</strong> {company.bankName}<br />
              <strong>A/c No:</strong> {company.accountNumber}<br />
              <strong>IFSC:</strong> {company.ifscCode}<br />
              {company.branch && <><strong>Branch:</strong> {company.branch}<br /></>}
            </div>
          ) : (
            <div style={{ color: '#777', fontSize: 11, marginBottom: 12 }}>
              For bank details &amp; payment instructions, please contact our office.
            </div>
          )}
          <h4>Contact &amp; Support</h4>
          <div style={{ fontWeight: 700 }}>{company.phone}</div>
          <div>{company.email}</div>
          <div className="inv-sign">
            <div className="line">Authorized Signatory — {company.name}</div>
          </div>
        </div>
      </div>
    </>
  );
}
