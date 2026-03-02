const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(__dirname, 'data');
const TEMPLATES = path.join(__dirname, 'templates');
const DOMAIN = 'https://ppfbatao.com';
const YEAR = new Date().getFullYear();
const GOOGLE_VERIFICATION = '';

// ─── PPF Constants ───────────────────────────────────────────────────────────
const PPF_RATE = 7.1;
const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 150000;
const LOCK_IN_YEARS = 15;

// ─── Yearly deposit presets ──────────────────────────────────────────────────
const YEARLY_AMOUNTS = [
  500, 1000, 2000, 3000, 5000, 10000, 12000, 15000, 20000, 25000,
  30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000, 120000, 150000
];

// ─── Tenure presets (years) ──────────────────────────────────────────────────
const TENURES = [15, 20, 25, 30, 35];

// ─── Monthly deposit presets (for monthly pages) ─────────────────────────────
const MONTHLY_AMOUNTS = [
  500, 1000, 2000, 3000, 5000, 7500, 10000, 12500
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatINRShort(num) {
  num = Math.round(num);
  if (num >= 10000000) return '\u20B9' + (num / 10000000).toFixed(num % 10000000 === 0 ? 0 : 2) + ' Cr';
  if (num >= 100000) return '\u20B9' + (num / 100000).toFixed(num % 100000 === 0 ? 0 : 2) + ' L';
  if (num >= 1000) return '\u20B9' + (num / 1000).toFixed(0) + 'K';
  return '\u20B9' + formatINR(num);
}

function amountSlug(num) {
  if (num >= 100000) {
    const l = num / 100000;
    return l === Math.floor(l) ? l + '-lakh' : l.toFixed(1).replace('.', '-') + '-lakh';
  }
  if (num >= 1000) {
    const k = num / 1000;
    return k === Math.floor(k) ? k + 'k' : k.toFixed(1).replace('.', '-') + 'k';
  }
  return num.toString();
}

function amountLabel(num) {
  if (num >= 100000) {
    const l = num / 100000;
    return '\u20B9' + (l === Math.floor(l) ? l : l.toFixed(1)) + ' Lakh';
  }
  if (num >= 1000) {
    const k = num / 1000;
    return '\u20B9' + (k === Math.floor(k) ? k : k.toFixed(1)) + 'K';
  }
  return '\u20B9' + formatINR(num);
}

function monthlyAmountLabel(num) {
  if (num >= 100000) {
    const l = num / 100000;
    return '\u20B9' + (l === Math.floor(l) ? l : l.toFixed(1)) + ' Lakh/month';
  }
  if (num >= 1000) {
    const k = num / 1000;
    return '\u20B9' + (k === Math.floor(k) ? k : k.toFixed(1)) + 'K/month';
  }
  return '\u20B9' + formatINR(num) + '/month';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── PPF Calculation (compound annually, deposit at start of year) ───────────
function calculatePPF(yearlyDeposit, rate, years) {
  let balance = 0;
  const schedule = [];
  for (let y = 1; y <= years; y++) {
    balance += yearlyDeposit;
    const interest = Math.round(balance * rate / 100);
    balance += interest;
    schedule.push({
      year: y,
      deposit: yearlyDeposit,
      interest: interest,
      balance: balance,
      totalDeposited: yearlyDeposit * y
    });
  }
  const totalDeposited = yearlyDeposit * years;
  const totalInterest = balance - totalDeposited;
  return { maturity: balance, totalDeposited, totalInterest, schedule };
}

// ─── Load data ───────────────────────────────────────────────────────────────
const ppfRules = JSON.parse(fs.readFileSync(path.join(DATA, 'ppf-rules.json'), 'utf8'));
const comparisons = JSON.parse(fs.readFileSync(path.join(DATA, 'comparisons.json'), 'utf8'));
const layoutTemplate = fs.readFileSync(path.join(TEMPLATES, 'layout.html'), 'utf8');

// ─── Calculator JS (shared across all pages) ────────────────────────────────
const CALCULATOR_JS = `
var yearlySchedule = [];

function formatCurrency(num) {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatCurrencyShort(num) {
    num = Math.round(num);
    if (num >= 10000000) return '\\u20B9' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '\\u20B9' + (num / 100000).toFixed(2) + ' L';
    return '\\u20B9' + formatCurrency(num);
}

function getRawNumber(id) {
    return parseInt(document.getElementById(id).value.replace(/[^0-9]/g, '')) || 0;
}

function formatAmountInput() {
    var input = document.getElementById('yearlyDeposit');
    var raw = input.value.replace(/[^0-9]/g, '');
    if (raw) input.value = new Intl.NumberFormat('en-IN').format(parseInt(raw));
    calculate();
}

function calculatePPF(yearlyDeposit, rate, years) {
    var balance = 0;
    var schedule = [];
    for (var y = 1; y <= years; y++) {
        balance += yearlyDeposit;
        var interest = Math.round(balance * rate / 100);
        balance += interest;
        schedule.push({
            year: y,
            deposit: yearlyDeposit,
            interest: interest,
            balance: balance,
            totalDeposited: yearlyDeposit * y
        });
    }
    return {
        maturity: balance,
        totalDeposited: yearlyDeposit * years,
        totalInterest: balance - (yearlyDeposit * years),
        schedule: schedule
    };
}

function drawPieChart(deposited, interest) {
    var canvas = document.getElementById('pieChart');
    if (!canvas) return;
    var container = canvas.parentElement;
    var size = container.offsetWidth;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    var cx = size / 2, cy = size / 2, outerR = size / 2 - 4, innerR = outerR * 0.62;
    var total = deposited + interest;
    if (total <= 0) return;
    var depositAngle = (deposited / total) * Math.PI * 2, gap = 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + gap / 2, -Math.PI / 2 + depositAngle - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + depositAngle - gap / 2, -Math.PI / 2 + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#f97316'; ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + depositAngle + gap / 2, -Math.PI / 2 + Math.PI * 2 - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + Math.PI * 2 - gap / 2, -Math.PI / 2 + depositAngle + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#38bdf8'; ctx.fill();
}

function renderTable() {
    var head = document.getElementById('tableHead');
    var body = document.getElementById('tableBody');
    head.innerHTML = '<tr><th>Year</th><th>Deposit</th><th>Interest</th><th>Balance</th></tr>';
    body.innerHTML = yearlySchedule.map(function(r) {
        return '<tr><td>Year ' + r.year + '</td><td>\\u20B9' + formatCurrency(r.deposit) + '</td><td>\\u20B9' + formatCurrency(r.interest) + '</td><td>\\u20B9' + formatCurrency(r.balance) + '</td></tr>';
    }).join('');
}

function calculate() {
    var yearlyDeposit = getRawNumber('yearlyDeposit');
    var rate = parseFloat(document.getElementById('interestRate').value) || 0;
    var years = parseInt(document.getElementById('tenure').value) || 0;
    if (yearlyDeposit <= 0 || years <= 0) return;
    var result = calculatePPF(yearlyDeposit, rate, years);
    document.getElementById('maturityValue').textContent = formatCurrencyShort(result.maturity);
    document.getElementById('interestValue').textContent = formatCurrencyShort(result.totalInterest);
    document.getElementById('depositedValue').textContent = formatCurrencyShort(result.totalDeposited);
    drawPieChart(result.totalDeposited, result.totalInterest);
    document.getElementById('chartTotal').textContent = formatCurrencyShort(result.maturity);
    var depositPct = Math.round(result.totalDeposited / result.maturity * 100);
    document.getElementById('legendDeposited').textContent = '\\u20B9' + formatCurrency(result.totalDeposited);
    document.getElementById('legendInterest').textContent = '\\u20B9' + formatCurrency(result.totalInterest);
    document.getElementById('legendDepositedPct').textContent = depositPct + '%';
    document.getElementById('legendInterestPct').textContent = (100 - depositPct) + '%';
    yearlySchedule = result.schedule;
    renderTable();
}

function downloadPDF() {
    if (yearlySchedule.length === 0) return;
    var yearlyDeposit = getRawNumber('yearlyDeposit');
    var rate = parseFloat(document.getElementById('interestRate').value) || 0;
    var years = parseInt(document.getElementById('tenure').value) || 0;
    var result = calculatePPF(yearlyDeposit, rate, years);
    var pw = window.open('', '_blank');
    pw.document.write('<!DOCTYPE html><html><head><title>PPF Investment Schedule - PPF Batao</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:\\'Outfit\\',sans-serif;color:#1a1a1a;line-height:1.6;padding:40px 50px;max-width:900px;margin:0 auto;font-size:13px}h1{font-family:\\'Playfair Display\\',serif;font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:13px;margin-bottom:24px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:24px}.summary-item{background:#f7f7f7;padding:12px 16px;border-radius:8px}.summary-item .s-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666}.summary-item .s-value{font-size:18px;font-weight:700;margin-top:2px}.summary-item.highlight .s-value{color:#f97316}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:right;padding:8px 10px;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666}th:first-child{text-align:left}td{padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums}td:first-child{text-align:left;color:#666}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}@media print{body{padding:20px}.summary-item{background:#f7f7f7;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>PPF Investment Schedule</h1><div class="subtitle">Generated on ' + new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) + ' \\u00B7 ppfbatao.com</div><div class="summary"><div class="summary-item highlight"><div class="s-label">Maturity Value</div><div class="s-value">\\u20B9' + formatCurrency(result.maturity) + '</div></div><div class="summary-item"><div class="s-label">Total Deposited</div><div class="s-value">\\u20B9' + formatCurrency(result.totalDeposited) + '</div></div><div class="summary-item"><div class="s-label">Total Interest</div><div class="s-value">\\u20B9' + formatCurrency(result.totalInterest) + '</div></div><div class="summary-item"><div class="s-label">Tax Saved (Est.)</div><div class="s-value">\\u20B9' + formatCurrency(Math.min(yearlyDeposit, 150000) * years * 0.312) + '</div></div></div><div style="font-size:13px;color:#666;margin-bottom:8px">Interest Rate: ' + rate + '% p.a. \\u00B7 Tenure: ' + years + ' Years \\u00B7 Yearly Deposit: \\u20B9' + formatCurrency(yearlyDeposit) + '</div><h2 style="font-size:16px;margin-top:24px;margin-bottom:4px">Year-wise Breakdown</h2><table><thead><tr><th>Year</th><th>Deposit</th><th>Interest Earned</th><th>Cumulative Deposit</th><th>Balance</th></tr></thead><tbody>' + result.schedule.map(function(r){return '<tr><td>Year '+r.year+'</td><td>\\u20B9'+formatCurrency(r.deposit)+'</td><td>\\u20B9'+formatCurrency(r.interest)+'</td><td>\\u20B9'+formatCurrency(r.totalDeposited)+'</td><td>\\u20B9'+formatCurrency(r.balance)+'</td></tr>';}).join('') + '</tbody></table><div class="footer">Generated by PPF Batao (ppfbatao.com) \\u00B7 Built by TUD Innovations Pvt Ltd<br>Note: Returns are 100% tax-free under EEE status. Calculations assume constant interest rate.</div><script>setTimeout(function(){window.print();window.close()},500)<\\/script></body></html>');
    pw.document.close();
}

// Init
document.getElementById('yearlyDeposit').addEventListener('input', formatAmountInput);
document.getElementById('interestRate').addEventListener('input', calculate);
document.getElementById('tenure').addEventListener('input', calculate);

document.querySelector('.btn-calculate').addEventListener('click', function() {
    if (window.innerWidth < 900) document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
});

// Prefill and calculate
document.getElementById('yearlyDeposit').value = new Intl.NumberFormat('en-IN').format(PREFILL_AMOUNT);
document.getElementById('interestRate').value = PREFILL_RATE;
document.getElementById('tenure').value = PREFILL_TENURE;
calculate();
`;

// ─── Page content generators ─────────────────────────────────────────────────

function calculatorHTML() {
  return `
<div class="calc-section">
    <div class="form-panel-wrapper">
        <div class="panel">
            <div class="panel-title"><div class="num">1</div> Investment Details</div>
            <div class="section-label">PPF Parameters</div>
            <div class="form-group">
                <label>Yearly Deposit (\u20B9)</label>
                <div class="input-with-unit">
                    <span class="unit">\u20B9</span>
                    <input type="text" id="yearlyDeposit" inputmode="numeric" placeholder="1,50,000">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Interest Rate (% per annum)</label>
                    <div class="input-with-unit">
                        <input type="number" id="interestRate" class="input-rate" step="0.1" min="0" max="20" placeholder="7.1">
                        <span class="unit unit-right">%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Investment Period (Years)</label>
                    <input type="number" id="tenure" min="15" max="50" placeholder="15">
                </div>
            </div>
            <button class="btn-calculate" onclick="calculate()">Calculate Maturity \u2192</button>
        </div>
    </div>
    <div>
        <div class="panel" id="resultsPanel">
            <div class="panel-title"><div class="num">2</div> Maturity Breakdown</div>
            <div class="result-cards">
                <div class="result-card highlight">
                    <div class="label">Maturity Value</div>
                    <div class="value" id="maturityValue">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Total Interest</div>
                    <div class="value" id="interestValue">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Total Deposited</div>
                    <div class="value" id="depositedValue">-</div>
                </div>
            </div>
            <div class="chart-section">
                <div class="chart-container">
                    <canvas id="pieChart"></canvas>
                    <div class="chart-center">
                        <div class="total-label">Maturity</div>
                        <div class="total-value" id="chartTotal">-</div>
                    </div>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--accent)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Total Deposited</div>
                            <div class="legend-value" id="legendDeposited">-</div>
                        </div>
                        <div class="legend-percent" id="legendDepositedPct">-</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--blue)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Interest Earned (Tax-Free)</div>
                            <div class="legend-value" id="legendInterest">-</div>
                        </div>
                        <div class="legend-percent" id="legendInterestPct">-</div>
                    </div>
                </div>
            </div>
            <div class="table-header">
                <div class="table-title">Year-wise Breakdown</div>
            </div>
            <div class="table-container">
                <table class="amort-table">
                    <thead id="tableHead"><tr><th>Year</th><th>Deposit</th><th>Interest</th><th>Balance</th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
            <button class="btn-download" onclick="downloadPDF()">\u2193 Download PPF Statement (PDF)</button>
        </div>
    </div>
</div>`;
}

function detailsGridHTML() {
  return `
<div class="details-grid">
    <div class="detail-item">
        <div class="d-label">Current Interest Rate</div>
        <div class="d-value accent">${PPF_RATE}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Lock-in Period</div>
        <div class="d-value">15 Years</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Min Deposit/Year</div>
        <div class="d-value">\u20B9500</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Max Deposit/Year</div>
        <div class="d-value">\u20B91,50,000</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Tax Benefit</div>
        <div class="d-value accent">EEE (Exempt-Exempt-Exempt)</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Section 80C Limit</div>
        <div class="d-value">\u20B91,50,000</div>
    </div>
</div>`;
}

// ─── Maturity table for different amounts at given tenure ─────────────────────
function maturityTableHTML(tenure) {
  const rows = YEARLY_AMOUNTS.map(amt => {
    const r = calculatePPF(amt, PPF_RATE, tenure);
    return `<tr><td class="amt-col">\u20B9${formatINR(amt)}/yr</td><td>\u20B9${formatINR(r.totalDeposited)}</td><td>\u20B9${formatINR(r.totalInterest)}</td><td class="emi-col">\u20B9${formatINR(r.maturity)}</td></tr>`;
  }).join('');
  return `
<table class="comparison-table">
    <thead><tr><th>Yearly Deposit</th><th>Total Deposited</th><th>Interest Earned</th><th>Maturity Value</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

// ─── Maturity table for different tenures at given amount ─────────────────────
function tenureTableHTML(amount) {
  const rows = TENURES.map(t => {
    const r = calculatePPF(amount, PPF_RATE, t);
    return `<tr><td class="amt-col">${t} Years</td><td>\u20B9${formatINR(r.totalDeposited)}</td><td>\u20B9${formatINR(r.totalInterest)}</td><td class="emi-col">\u20B9${formatINR(r.maturity)}</td></tr>`;
  }).join('');
  return `
<table class="comparison-table">
    <thead><tr><th>Tenure</th><th>Total Deposited</th><th>Interest Earned</th><th>Maturity Value</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

// ─── Comparison table (PPF vs other instruments) ─────────────────────────────
function comparisonSummaryTableHTML() {
  const rows = comparisons.map(c => {
    return `<tr><td class="amt-col"><a href="/${c.slug}" style="color:var(--accent);text-decoration:none">${c.shortName}</a></td><td>${c.returnRate}%</td><td>${c.lockIn}</td><td>${c.taxOnReturns}</td><td>${c.risk}</td></tr>`;
  }).join('');
  return `
<table class="comparison-table">
    <thead><tr><th>Instrument</th><th>Returns</th><th>Lock-in</th><th>Tax on Returns</th><th>Risk</th></tr></thead>
    <tbody>
        <tr style="background:var(--accent-dim)"><td class="amt-col" style="font-weight:700;color:var(--accent)">PPF</td><td>${PPF_RATE}%</td><td>15 Years</td><td>Fully Tax-Free (EEE)</td><td>Zero</td></tr>
        ${rows}
    </tbody>
</table>`;
}

// ─── Historical rates table ──────────────────────────────────────────────────
function historicalRatesTableHTML() {
  const rows = ppfRules.historicalRates.map(r => {
    return `<tr><td class="amt-col">${r.period}</td><td class="emi-col">${r.rate}%</td></tr>`;
  }).join('');
  return `
<table class="comparison-table">
    <thead><tr><th>Period</th><th>Interest Rate</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

// ─── FAQ generators ──────────────────────────────────────────────────────────
function generalFAQs() {
  return [
    { q: 'What is PPF (Public Provident Fund)?', a: 'PPF is a government-backed long-term savings scheme in India that offers guaranteed, tax-free returns. It has a 15-year lock-in period and the current interest rate is ' + PPF_RATE + '% per annum, compounded annually.' },
    { q: 'What is the current PPF interest rate in ' + YEAR + '?', a: 'The current PPF interest rate is ' + PPF_RATE + '% per annum (as of ' + ppfRules.rateEffectiveFrom + '). The rate is set by the Government of India and reviewed quarterly.' },
    { q: 'Is PPF interest tax-free?', a: 'Yes, PPF enjoys EEE (Exempt-Exempt-Exempt) tax status. Your deposits qualify for Section 80C deduction (up to \u20B91.5 lakh), the interest earned is tax-free, and the maturity amount is also completely tax-free.' },
    { q: 'What is the minimum and maximum deposit in PPF?', a: 'The minimum yearly deposit in PPF is \u20B9500 and the maximum is \u20B91,50,000. You can deposit in a maximum of 12 installments per year.' },
    { q: 'Can I withdraw from PPF before maturity?', a: 'Partial withdrawal is allowed from the 7th financial year onwards. You can withdraw up to 50% of the balance at the end of the 4th year or the year immediately preceding, whichever is lower. Loans against PPF are available from the 3rd to 6th year.' },
  ];
}

function amountTenureFAQs(amount, tenure) {
  const r = calculatePPF(amount, PPF_RATE, tenure);
  const monthly = Math.round(amount / 12);
  return [
    { q: 'What is the maturity value of \u20B9' + formatINR(amount) + ' yearly PPF investment for ' + tenure + ' years?', a: 'If you invest \u20B9' + formatINR(amount) + ' per year in PPF at ' + PPF_RATE + '% for ' + tenure + ' years, your maturity value will be \u20B9' + formatINR(r.maturity) + '. This includes \u20B9' + formatINR(r.totalDeposited) + ' total deposits and \u20B9' + formatINR(r.totalInterest) + ' in tax-free interest.' },
    { q: 'How much tax can I save with \u20B9' + formatINR(amount) + ' PPF investment?', a: 'Deposits up to \u20B91,50,000 per year qualify for Section 80C deduction. If you are in the 31.2% tax bracket (highest old regime), you can save approximately \u20B9' + formatINR(Math.round(Math.min(amount, 150000) * 0.312)) + ' in taxes every year.' },
    { q: 'How much should I invest monthly to deposit \u20B9' + formatINR(amount) + ' per year in PPF?', a: 'To invest \u20B9' + formatINR(amount) + ' per year in PPF, you need to set aside approximately \u20B9' + formatINR(monthly) + ' per month. You can make deposits in up to 12 installments per financial year.' },
    { q: 'What happens after ' + tenure + ' years PPF maturity?', a: tenure === 15 ? 'After the initial 15-year lock-in, you can either withdraw the entire amount tax-free, or extend it in blocks of 5 years (with or without fresh contributions). The extended period also earns the prevailing PPF interest rate.' : 'A ' + tenure + '-year PPF investment means extending beyond the initial 15-year lock-in in 5-year blocks. After maturity, you can withdraw the full amount tax-free or continue extending in 5-year blocks.' },
    { q: 'Is PPF investment of \u20B9' + formatINR(amount) + '/year better than FD?', a: 'At ' + PPF_RATE + '% tax-free return, PPF significantly outperforms FDs for long-term investment. A comparable FD would need to offer ' + (PPF_RATE / 0.688).toFixed(1) + '% pre-tax returns (for 31.2% tax bracket) to match PPF\'s after-tax return. Over ' + tenure + ' years, this compounding advantage is substantial.' },
  ];
}

function comparisonFAQs(comp) {
  return [
    { q: 'What is the difference between PPF and ' + comp.name + '?', a: 'PPF offers ' + PPF_RATE + '% guaranteed tax-free returns with a 15-year lock-in, while ' + comp.shortName + ' offers ' + comp.returnRate + '% returns with ' + comp.lockIn + ' lock-in. PPF has EEE tax status making it fully tax-free, whereas ' + comp.shortName + ': ' + comp.taxOnReturns + '.' },
    { q: 'Which is better — PPF or ' + comp.shortName + '?', a: comp.verdict },
    { q: 'Can I invest in both PPF and ' + comp.shortName + '?', a: 'Yes, you can invest in both PPF and ' + comp.shortName + '. However, the combined Section 80C deduction limit is \u20B91,50,000 per year' + (comp.slug === 'ppf-vs-nps' ? ' (NPS provides an additional \u20B950,000 deduction under Section 80CCD(1B))' : '') + '. Many investors diversify across both instruments to balance risk and returns.' },
    { q: 'Is PPF safer than ' + comp.shortName + '?', a: 'PPF is backed by the Government of India and carries zero risk with guaranteed returns. ' + comp.shortName + ' has ' + comp.risk.toLowerCase() + ' risk. ' + (comp.risk === 'Zero' ? 'Both are government-backed, so both are equally safe.' : 'If capital preservation is your priority, PPF is the safer choice.') },
    { q: 'What are the tax benefits of PPF vs ' + comp.shortName + '?', a: 'PPF has EEE status — deposits, interest, and maturity are all tax-free. ' + comp.shortName + ' Section 80C: ' + comp.section80C + '. Tax on returns: ' + comp.taxOnReturns + '.' },
  ];
}

// ─── HTML generators ─────────────────────────────────────────────────────────
function faqHTML(faqs) {
  return faqs.map(f => `
    <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
    </div>`).join('');
}

function faqSchemaJSON(faqs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(f => ({
      '@type': 'Question',
      'name': f.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': f.a }
    }))
  });
}

// ─── Build page from template ────────────────────────────────────────────────
function buildPage({ title, description, keywords, canonicalPath, content, breadcrumb, faqSection, linksSection, calculatorJs, jsonLd }) {
  const allJsonLd = (jsonLd || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n    ');
  const gv = GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">` : '';

  return layoutTemplate
    .replace(/{{PAGE_TITLE}}/g, title)
    .replace(/{{META_DESCRIPTION}}/g, description)
    .replace(/{{META_KEYWORDS}}/g, keywords || '')
    .replace('{{CANONICAL_PATH}}', canonicalPath)
    .replace('{{GOOGLE_VERIFICATION}}', gv)
    .replace('{{JSON_LD}}', allJsonLd)
    .replace('{{BREADCRUMB}}', breadcrumb || '')
    .replace('{{CONTENT}}', content || '')
    .replace('{{FAQ_SECTION}}', faqSection || '')
    .replace('{{LINKS_SECTION}}', linksSection || '')
    .replace('{{CALCULATOR_JS}}', calculatorJs || '');
}

// ─── Sitemap tracking ────────────────────────────────────────────────────────
const sitemapEntries = [];
function addSitemapEntry(path, priority, changefreq) {
  sitemapEntries.push({ path, priority: priority || 0.6, changefreq: changefreq || 'monthly' });
}

// ─── Page builders ───────────────────────────────────────────────────────────

// --- Amount × Tenure pages (core programmatic SEO) ---
function generateAmountTenurePage(amount, tenure) {
  const r = calculatePPF(amount, PPF_RATE, tenure);
  const slug = `ppf-calculator-for-${amountSlug(amount)}-per-year-for-${tenure}-years`;
  const amtLabel = amountLabel(amount);
  const monthly = Math.round(amount / 12);

  const title = `${amtLabel}/Year PPF for ${tenure} Years \u2014 Maturity \u20B9${formatINR(r.maturity)} | PPF Batao`;
  const desc = `Invest ${amtLabel} per year in PPF for ${tenure} years at ${PPF_RATE}%. Maturity = \u20B9${formatINR(r.maturity)}. Tax-free interest earned: \u20B9${formatINR(r.totalInterest)}. Free PPF calculator with year-wise breakdown.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span><a href="/ppf-calculator">PPF Calculator</a><span>\u203A</span>${amtLabel}/yr \u00D7 ${tenure} Years</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF Calculator: <span class="hl">${amtLabel}/Year</span> for ${tenure} Years</h1>
    <p>Invest ${amtLabel} yearly in PPF at ${PPF_RATE}% and get \u20B9${formatINR(r.maturity)} tax-free at maturity. That's \u20B9${formatINR(r.totalInterest)} in interest earned.</p>
</div>`;

  const infoHTML = `
<div class="info-section">
    <h2>PPF Investment of ${amtLabel}/Year for ${tenure} Years</h2>
    ${detailsGridHTML()}
    <p>If you invest <strong style="color:var(--text)">${amtLabel}</strong> per year (approximately <strong style="color:var(--text)">\u20B9${formatINR(monthly)}/month</strong>) in PPF at the current rate of ${PPF_RATE}%, your investment will grow to <strong style="color:var(--accent)">\u20B9${formatINR(r.maturity)}</strong> in ${tenure} years.</p>
    <ul>
        <li>Total amount deposited: \u20B9${formatINR(r.totalDeposited)}</li>
        <li>Total interest earned (tax-free): \u20B9${formatINR(r.totalInterest)}</li>
        <li>Effective wealth multiplier: ${(r.maturity / r.totalDeposited).toFixed(2)}x</li>
        <li>Estimated annual tax savings (30% bracket): \u20B9${formatINR(Math.round(Math.min(amount, 150000) * 0.312))}</li>
    </ul>

    <h2>PPF Maturity for ${amtLabel}/Year at Different Tenures</h2>
    ${tenureTableHTML(amount)}

    <h2>PPF Maturity for ${tenure} Years at Different Amounts</h2>
    ${maturityTableHTML(tenure)}
</div>`;

  // Ad after hero
  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  // Links
  const amountLinks = YEARLY_AMOUNTS.filter(a => a !== amount).slice(0, 12).map(a => {
    const ar = calculatePPF(a, PPF_RATE, tenure);
    return `<a href="/ppf-calculator-for-${amountSlug(a)}-per-year-for-${tenure}-years">${amountLabel(a)}/yr \u00D7 ${tenure} yrs<span class="link-sub">Maturity: \u20B9${formatINR(ar.maturity)}</span></a>`;
  }).join('');

  const tenureLinks = TENURES.filter(t => t !== tenure).map(t => {
    const tr = calculatePPF(amount, PPF_RATE, t);
    return `<a href="/ppf-calculator-for-${amountSlug(amount)}-per-year-for-${t}-years">${amtLabel}/yr \u00D7 ${t} yrs<span class="link-sub">Maturity: \u20B9${formatINR(tr.maturity)}</span></a>`;
  }).join('');

  const compLinks = comparisons.map(c => `<a href="/${c.slug}">PPF vs ${c.shortName}<span class="link-sub">${c.returnRate}% | ${c.risk} risk</span></a>`).join('');

  const linksSection = `
<div class="links-section">
    <h2>PPF for ${tenure} Years at Other Amounts</h2>
    <div class="links-grid">${amountLinks}</div>
</div>
<div class="links-section">
    <h2>${amtLabel}/Year PPF at Other Tenures</h2>
    <div class="links-grid">${tenureLinks}</div>
</div>
<div class="links-section">
    <h2>Compare PPF with Other Investments</h2>
    <div class="links-grid">${compLinks}</div>
</div>`;

  const faqs = amountTenureFAQs(amount, tenure);
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator', 'item': DOMAIN + '/ppf-calculator' },
      { '@type': 'ListItem', 'position': 3, 'name': `${amtLabel}/yr \u00D7 ${tenure} Years` }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = ${amount};\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = ${tenure};\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: `ppf calculator ${amountLabel(amount)}, ppf maturity ${tenure} years, ppf returns calculator, ppf investment calculator`,
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.6);
}

// --- Main PPF Calculator page ---
function generateMainCalculatorPage() {
  const r = calculatePPF(150000, PPF_RATE, 15);
  const slug = 'ppf-calculator';

  const title = `PPF Calculator Online ${YEAR} | Free PPF Maturity Calculator India - PPF Batao`;
  const desc = `Calculate PPF maturity value instantly. Free online PPF calculator with year-wise breakdown, tax savings & PDF download. Current rate: ${PPF_RATE}% p.a.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span>PPF Calculator</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF <span class="hl">Calculator</span> ${YEAR}</h1>
    <p>Calculate your PPF maturity value, tax-free interest earned, and year-wise investment breakdown at the current rate of ${PPF_RATE}% p.a.</p>
</div>`;

  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const infoHTML = `
<div class="info-section">
    <h2>About PPF (Public Provident Fund)</h2>
    ${detailsGridHTML()}
    <p>PPF is one of India's most popular long-term savings instruments, backed by the Government of India. It offers guaranteed, tax-free returns under the EEE (Exempt-Exempt-Exempt) tax status, making it one of the safest and most tax-efficient investments available.</p>
    <ul>
        <li><strong style="color:var(--text)">Guaranteed returns</strong> — backed by the Government of India</li>
        <li><strong style="color:var(--text)">100% tax-free</strong> — deposits, interest, and maturity all exempt from tax</li>
        <li><strong style="color:var(--text)">Section 80C benefit</strong> — save up to \u20B946,800 in taxes every year</li>
        <li><strong style="color:var(--text)">Compounding power</strong> — interest compounds annually for wealth multiplication</li>
    </ul>

    <h2>PPF Maturity Table (${PPF_RATE}% for 15 Years)</h2>
    <p>Here's how much your PPF investment would grow at the current rate of ${PPF_RATE}% over the standard 15-year period:</p>
    ${maturityTableHTML(15)}

    <h2>PPF Historical Interest Rates</h2>
    <p>PPF interest rates are set by the Government and reviewed quarterly. Here's the rate history:</p>
    ${historicalRatesTableHTML()}

    <h2>PPF vs Other Tax-Saving Investments</h2>
    <p>How does PPF compare with other Section 80C eligible investments?</p>
    ${comparisonSummaryTableHTML()}
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  // Links
  const amountLinks = YEARLY_AMOUNTS.map(a => {
    const ar = calculatePPF(a, PPF_RATE, 15);
    return `<a href="/ppf-calculator-for-${amountSlug(a)}-per-year-for-15-years">${amountLabel(a)}/yr for 15 Years<span class="link-sub">Maturity: \u20B9${formatINR(ar.maturity)}</span></a>`;
  }).join('');

  const compLinks = comparisons.map(c => `<a href="/${c.slug}">PPF vs ${c.shortName}<span class="link-sub">${c.returnRate}% | ${c.risk} risk</span></a>`).join('');

  const linksSection = `
<div class="links-section">
    <h2>PPF Maturity by Investment Amount</h2>
    <div class="links-grid">${amountLinks}</div>
</div>
<div class="links-section">
    <h2>Compare PPF with Other Investments</h2>
    <div class="links-grid">${compLinks}</div>
</div>`;

  const faqs = generalFAQs();
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator' }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = 150000;\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = 15;\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: 'ppf calculator, ppf maturity calculator, ppf interest calculator, ppf calculator online, ppf return calculator India',
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.9, 'weekly');
}

// --- Comparison pages (PPF vs FD, PPF vs ELSS, etc.) ---
function generateComparisonPage(comp) {
  const slug = comp.slug;
  const r15 = calculatePPF(150000, PPF_RATE, 15);

  const title = `${comp.name} vs PPF ${YEAR} \u2014 Which is Better? | PPF Batao`;
  const desc = `Compare PPF (${PPF_RATE}%) vs ${comp.shortName} (${comp.returnRate}%). Detailed comparison of returns, tax benefits, lock-in period, risk & liquidity. Find which is better for you.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span><a href="/ppf-calculator">PPF Calculator</a><span>\u203A</span>PPF vs ${comp.shortName}</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF vs <span class="hl">${comp.shortName}</span> \u2014 Which is Better?</h1>
    <p>Detailed comparison of PPF (${PPF_RATE}% tax-free) and ${comp.name} (${comp.returnRate}%) to help you choose the right investment.</p>
</div>`;

  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const compTableHTML = `
<table class="comparison-table">
    <thead><tr><th>Feature</th><th style="color:var(--accent)">PPF</th><th>${comp.shortName}</th></tr></thead>
    <tbody>
        <tr><td class="amt-col">Returns</td><td class="emi-col">${PPF_RATE}% p.a. (guaranteed)</td><td>${comp.returnRate}%</td></tr>
        <tr><td class="amt-col">Lock-in Period</td><td>15 Years</td><td>${comp.lockIn}</td></tr>
        <tr><td class="amt-col">Tax on Returns</td><td class="emi-col">Fully Tax-Free (EEE)</td><td>${comp.taxOnReturns}</td></tr>
        <tr><td class="amt-col">Section 80C</td><td>Yes (up to \u20B91.5 lakh)</td><td>${comp.section80C}</td></tr>
        <tr><td class="amt-col">Risk Level</td><td class="emi-col">Zero (Govt backed)</td><td>${comp.risk}</td></tr>
        <tr><td class="amt-col">Liquidity</td><td>Low (partial after 7 years)</td><td>${comp.liquidity}</td></tr>
        <tr><td class="amt-col">Best For</td><td>Long-term tax-free guaranteed growth</td><td>${comp.suitableFor}</td></tr>
    </tbody>
</table>`;

  const infoHTML = `
<div class="info-section">
    <h2>PPF vs ${comp.name} \u2014 Detailed Comparison</h2>
    ${compTableHTML}

    <h2>Our Verdict</h2>
    <p>${comp.verdict}</p>

    <h2>PPF Maturity Values at ${PPF_RATE}%</h2>
    <p>See how much your PPF investment can grow over different tenures:</p>
    ${maturityTableHTML(15)}
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  // Links
  const otherCompLinks = comparisons.filter(c => c.slug !== slug).map(c =>
    `<a href="/${c.slug}">PPF vs ${c.shortName}<span class="link-sub">${c.returnRate}% | ${c.risk} risk</span></a>`
  ).join('');

  const amountLinks = YEARLY_AMOUNTS.slice(0, 10).map(a => {
    const ar = calculatePPF(a, PPF_RATE, 15);
    return `<a href="/ppf-calculator-for-${amountSlug(a)}-per-year-for-15-years">${amountLabel(a)}/yr for 15 Years<span class="link-sub">Maturity: \u20B9${formatINR(ar.maturity)}</span></a>`;
  }).join('');

  const linksSection = `
<div class="links-section">
    <h2>Other PPF Comparisons</h2>
    <div class="links-grid">${otherCompLinks}</div>
</div>
<div class="links-section">
    <h2>PPF Calculator by Amount</h2>
    <div class="links-grid">${amountLinks}</div>
</div>`;

  const faqs = comparisonFAQs(comp);
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator', 'item': DOMAIN + '/ppf-calculator' },
      { '@type': 'ListItem', 'position': 3, 'name': `PPF vs ${comp.shortName}` }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = 150000;\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = 15;\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: `ppf vs ${comp.shortName.toLowerCase()}, ${comp.shortName.toLowerCase()} vs ppf, ppf or ${comp.shortName.toLowerCase()} which is better`,
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.8, 'monthly');
}

// --- Tenure-specific pages (15 years, 20 years, etc.) ---
function generateTenurePage(tenure) {
  const r = calculatePPF(150000, PPF_RATE, tenure);
  const slug = `ppf-calculator-for-${tenure}-years`;

  const title = `PPF Calculator for ${tenure} Years \u2014 Maturity Value at ${PPF_RATE}% | PPF Batao`;
  const desc = `Calculate PPF returns for ${tenure} years. Invest \u20B91.5L/yr at ${PPF_RATE}% and get \u20B9${formatINR(r.maturity)} tax-free. Year-wise PPF maturity table for all amounts.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span><a href="/ppf-calculator">PPF Calculator</a><span>\u203A</span>${tenure} Years</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF Calculator for <span class="hl">${tenure} Years</span></h1>
    <p>See how much your PPF investment grows over ${tenure} years at the current rate of ${PPF_RATE}% per annum. All returns are 100% tax-free.</p>
</div>`;

  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const infoHTML = `
<div class="info-section">
    <h2>PPF Investment for ${tenure} Years</h2>
    ${detailsGridHTML()}
    <p>${tenure === 15 ? 'The standard PPF lock-in period is 15 years. After maturity, you can withdraw the full amount tax-free or extend in 5-year blocks.' : `Investing in PPF for ${tenure} years means extending your account beyond the initial 15-year lock-in in 5-year blocks. The longer tenure allows significantly more compounding of your tax-free returns.`}</p>

    <h2>PPF Maturity Table for ${tenure} Years at ${PPF_RATE}%</h2>
    <p>Maturity values for different yearly deposits over ${tenure} years:</p>
    ${maturityTableHTML(tenure)}
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  // Links
  const amountLinks = YEARLY_AMOUNTS.map(a => {
    const ar = calculatePPF(a, PPF_RATE, tenure);
    return `<a href="/ppf-calculator-for-${amountSlug(a)}-per-year-for-${tenure}-years">${amountLabel(a)}/yr \u00D7 ${tenure} yrs<span class="link-sub">Maturity: \u20B9${formatINR(ar.maturity)}</span></a>`;
  }).join('');

  const tenureLinks = TENURES.filter(t => t !== tenure).map(t => {
    const tr = calculatePPF(150000, PPF_RATE, t);
    return `<a href="/ppf-calculator-for-${t}-years">PPF for ${t} Years<span class="link-sub">\u20B91.5L/yr maturity: \u20B9${formatINR(tr.maturity)}</span></a>`;
  }).join('');

  const linksSection = `
<div class="links-section">
    <h2>PPF Maturity by Amount (${tenure} Years)</h2>
    <div class="links-grid">${amountLinks}</div>
</div>
<div class="links-section">
    <h2>PPF Calculator for Other Tenures</h2>
    <div class="links-grid">${tenureLinks}</div>
</div>`;

  const faqs = amountTenureFAQs(150000, tenure);
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator', 'item': DOMAIN + '/ppf-calculator' },
      { '@type': 'ListItem', 'position': 3, 'name': `${tenure} Years` }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = 150000;\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = ${tenure};\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: `ppf calculator ${tenure} years, ppf maturity ${tenure} years, ppf returns ${tenure} years`,
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.8, 'monthly');
}

// --- Amount-only pages (e.g., ppf-calculator-for-1-lakh-per-year) ---
function generateAmountPage(amount) {
  const r = calculatePPF(amount, PPF_RATE, 15);
  const slug = `ppf-calculator-for-${amountSlug(amount)}-per-year`;
  const amtLabel = amountLabel(amount);

  const title = `PPF Calculator for ${amtLabel}/Year \u2014 Maturity at ${PPF_RATE}% | PPF Batao`;
  const desc = `Invest ${amtLabel} per year in PPF at ${PPF_RATE}%. 15-year maturity: \u20B9${formatINR(r.maturity)} (tax-free). See maturity for 15, 20, 25, 30 & 35 years.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span><a href="/ppf-calculator">PPF Calculator</a><span>\u203A</span>${amtLabel}/Year</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF Calculator for <span class="hl">${amtLabel}/Year</span></h1>
    <p>See how ${amtLabel} yearly PPF investment grows at ${PPF_RATE}% across different tenures. All returns are 100% tax-free.</p>
</div>`;

  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const infoHTML = `
<div class="info-section">
    <h2>PPF Investment of ${amtLabel} Per Year</h2>
    ${detailsGridHTML()}
    <p>Investing ${amtLabel} per year in PPF gives you access to guaranteed, tax-free returns. Here's how your investment grows across different tenures:</p>

    <h2>PPF Maturity for ${amtLabel}/Year at Different Tenures</h2>
    ${tenureTableHTML(amount)}
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  // Links
  const tenureLinks = TENURES.map(t => {
    const tr = calculatePPF(amount, PPF_RATE, t);
    return `<a href="/ppf-calculator-for-${amountSlug(amount)}-per-year-for-${t}-years">${amtLabel}/yr \u00D7 ${t} yrs<span class="link-sub">Maturity: \u20B9${formatINR(tr.maturity)}</span></a>`;
  }).join('');

  const otherAmountLinks = YEARLY_AMOUNTS.filter(a => a !== amount).slice(0, 12).map(a => {
    const ar = calculatePPF(a, PPF_RATE, 15);
    return `<a href="/ppf-calculator-for-${amountSlug(a)}-per-year">${amountLabel(a)}/Year<span class="link-sub">15yr maturity: \u20B9${formatINR(ar.maturity)}</span></a>`;
  }).join('');

  const linksSection = `
<div class="links-section">
    <h2>${amtLabel}/Year PPF at Different Tenures</h2>
    <div class="links-grid">${tenureLinks}</div>
</div>
<div class="links-section">
    <h2>PPF Calculator for Other Amounts</h2>
    <div class="links-grid">${otherAmountLinks}</div>
</div>`;

  const faqs = amountTenureFAQs(amount, 15);
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator', 'item': DOMAIN + '/ppf-calculator' },
      { '@type': 'ListItem', 'position': 3, 'name': `${amtLabel}/Year` }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = ${amount};\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = 15;\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: `ppf calculator ${amountLabel(amount).replace('\u20B9','')}, ppf ${amountLabel(amount).replace('\u20B9','')} per year, ppf maturity ${amountLabel(amount).replace('\u20B9','')}`,
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.7, 'monthly');
}

// --- Monthly deposit pages ---
function generateMonthlyPage(monthlyAmount) {
  const yearlyAmount = monthlyAmount * 12;
  const cappedYearly = Math.min(yearlyAmount, 150000);
  const r = calculatePPF(cappedYearly, PPF_RATE, 15);
  const slug = `ppf-calculator-for-${amountSlug(monthlyAmount)}-per-month`;

  const title = `PPF Calculator for \u20B9${formatINR(monthlyAmount)}/Month \u2014 Maturity at ${PPF_RATE}% | PPF Batao`;
  const desc = `Invest \u20B9${formatINR(monthlyAmount)} per month in PPF (\u20B9${formatINR(cappedYearly)}/year) at ${PPF_RATE}%. 15-year maturity: \u20B9${formatINR(r.maturity)} tax-free.`;

  const breadcrumb = `<div class="breadcrumb"><a href="/">PPF Batao</a><span>\u203A</span><a href="/ppf-calculator">PPF Calculator</a><span>\u203A</span>\u20B9${formatINR(monthlyAmount)}/Month</div>`;

  const heroHTML = `
<div class="page-hero">
    <h1>PPF Calculator: <span class="hl">\u20B9${formatINR(monthlyAmount)}/Month</span></h1>
    <p>Investing \u20B9${formatINR(monthlyAmount)} monthly means \u20B9${formatINR(cappedYearly)} yearly in PPF${yearlyAmount > 150000 ? ' (capped at \u20B91,50,000 max)' : ''}. Your 15-year maturity: \u20B9${formatINR(r.maturity)} tax-free.</p>
</div>`;

  const adHTML = `<div style="max-width:800px;margin:0 auto;padding:0 24px 20px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

  const infoHTML = `
<div class="info-section">
    <h2>PPF with \u20B9${formatINR(monthlyAmount)} Monthly Investment</h2>
    ${detailsGridHTML()}
    ${yearlyAmount > 150000 ? `<p><strong style="color:var(--red)">Note:</strong> The maximum PPF deposit is \u20B91,50,000 per year. \u20B9${formatINR(monthlyAmount)}/month = \u20B9${formatINR(yearlyAmount)}/year exceeds this limit. The calculator uses the capped amount of \u20B91,50,000/year.</p>` : ''}
    <p>Investing \u20B9${formatINR(monthlyAmount)} per month (totaling \u20B9${formatINR(cappedYearly)} per year) in PPF at ${PPF_RATE}% gives you a maturity of \u20B9${formatINR(r.maturity)} after 15 years — all completely tax-free.</p>

    <h2>Maturity at Different Tenures</h2>
    ${tenureTableHTML(cappedYearly)}
</div>`;

  const content = heroHTML + adHTML + calculatorHTML() + infoHTML;

  const otherMonthlyLinks = MONTHLY_AMOUNTS.filter(m => m !== monthlyAmount).map(m => {
    const yAmt = Math.min(m * 12, 150000);
    const mr = calculatePPF(yAmt, PPF_RATE, 15);
    return `<a href="/ppf-calculator-for-${amountSlug(m)}-per-month">\u20B9${formatINR(m)}/Month<span class="link-sub">15yr maturity: \u20B9${formatINR(mr.maturity)}</span></a>`;
  }).join('');

  const linksSection = `
<div class="links-section">
    <h2>PPF Calculator for Other Monthly Amounts</h2>
    <div class="links-grid">${otherMonthlyLinks}</div>
</div>`;

  const faqs = amountTenureFAQs(cappedYearly, 15);
  const faqSection = `<div class="faq-section"><h2>Frequently Asked Questions</h2>${faqHTML(faqs)}</div>`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': DOMAIN + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'PPF Calculator', 'item': DOMAIN + '/ppf-calculator' },
      { '@type': 'ListItem', 'position': 3, 'name': `\u20B9${formatINR(monthlyAmount)}/Month` }
    ]},
    JSON.parse(faqSchemaJSON(faqs))
  ];

  const prefillJs = `var PREFILL_AMOUNT = ${cappedYearly};\nvar PREFILL_RATE = ${PPF_RATE};\nvar PREFILL_TENURE = 15;\n` + CALCULATOR_JS;

  const html = buildPage({
    title, description: desc,
    keywords: `ppf ${formatINR(monthlyAmount)} per month, ppf calculator monthly, ppf monthly investment ${formatINR(monthlyAmount)}`,
    canonicalPath: slug,
    content, breadcrumb, faqSection, linksSection,
    calculatorJs: prefillJs, jsonLd
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  addSitemapEntry(slug, 0.6);
}

// ─── Generate sitemap & robots ───────────────────────────────────────────────
function generateSitemap() {
  const urls = [
    { path: '', priority: 1.0, changefreq: 'weekly' },
    ...sitemapEntries
  ];

  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${DOMAIN}/${u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n\uD83D\uDD28 PPF Batao \u2014 Programmatic SEO Build');
console.log('=====================================\n');

ensureDir(DIST);

// 1. Copy static files
console.log('\uD83D\uDCC4 Copying static files...');
['ads.txt'].forEach(f => {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
});
// Copy index.html and privacy.html
['index.html', 'privacy.html'].forEach(f => {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
});

// 2. Main calculator page
console.log('\uD83D\uDCCA Generating main PPF calculator page...');
generateMainCalculatorPage();

// 3. Tenure pages
console.log('\uD83D\uDCC5 Generating tenure pages...');
let tenureCount = 0;
TENURES.forEach(t => { generateTenurePage(t); tenureCount++; });
console.log(`   \u2192 ${tenureCount} tenure pages`);

// 4. Amount pages
console.log('\uD83D\uDCB0 Generating amount pages...');
let amountCount = 0;
YEARLY_AMOUNTS.forEach(a => { generateAmountPage(a); amountCount++; });
console.log(`   \u2192 ${amountCount} amount pages`);

// 5. Amount × Tenure pages (core programmatic SEO)
console.log('\uD83D\uDCCA Generating amount \u00D7 tenure pages...');
let amtTenureCount = 0;
YEARLY_AMOUNTS.forEach(amount => {
  TENURES.forEach(tenure => {
    generateAmountTenurePage(amount, tenure);
    amtTenureCount++;
  });
});
console.log(`   \u2192 ${amtTenureCount} amount \u00D7 tenure pages`);

// 6. Monthly deposit pages
console.log('\uD83D\uDCC6 Generating monthly deposit pages...');
let monthlyCount = 0;
MONTHLY_AMOUNTS.forEach(m => { generateMonthlyPage(m); monthlyCount++; });
console.log(`   \u2192 ${monthlyCount} monthly pages`);

// 7. Comparison pages
console.log('\uD83D\uDD04 Generating comparison pages...');
let compCount = 0;
comparisons.forEach(c => { generateComparisonPage(c); compCount++; });
console.log(`   \u2192 ${compCount} comparison pages`);

// 8. Sitemap + robots.txt
console.log('\n\uD83D\uDDFA\uFE0F  Generating sitemap.xml and robots.txt...');
generateSitemap();

// Summary
const totalPages = 1 + tenureCount + amountCount + amtTenureCount + monthlyCount + compCount + 2; // +2 for index + privacy
console.log(`\n\u2705 Build complete!`);
console.log(`   Total pages: ${totalPages} generated`);
console.log(`   Sitemap entries: ${sitemapEntries.length + 1}`);
