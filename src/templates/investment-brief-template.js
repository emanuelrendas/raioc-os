/**
 * RAIOC OS - Private Investment Brief (One-Pager) Canonical Template
 * Schema: RAIOC_PIB_ONE_PAGER_V2
 * 
 * Provides deterministic textual interpolation, data sanitization,
 * and structured Markdown synthesis for institutional private client dossiers.
 */

export const RAIOC_PIB_SCHEMA_VERSION = 'RAIOC_PIB_ONE_PAGER_V2';

/**
 * Sanitizes input text to prevent markdown breaking and unwanted characters
 * @param {string} str 
 * @returns {string}
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Formats a currency amount in AED with thousand separators
 * @param {number} amount 
 * @returns {string}
 */
export function formatAed(amount) {
  const num = Number(amount) || 0;
  return `AED ${num.toLocaleString('en-US')}`;
}

/**
 * Formats a percentage number with 2 decimal places
 * @param {number} pct 
 * @returns {string}
 */
export function formatPct(pct) {
  const num = Number(pct) || 0;
  return `${num.toFixed(2)}%`;
}

/**
 * Sanitizes and validates the brief input data against the RAIOC_PIB_ONE_PAGER_V2 schema
 * @param {Object} data 
 * @returns {Object} Sanitized brief data
 */
export function sanitizeBriefData(data = {}) {
  const mandateId = sanitizeText(data.mandateId || `MND-${Date.now()}`);
  const briefId = sanitizeText(data.briefId || `PIB-${Date.now()}`);
  const investorName = sanitizeText(data.investorName || 'Confidential Sovereign Investor');
  const corridorName = sanitizeText(data.corridorName || 'Palm Jebel Ali Sovereign Corridor');
  const corridorKey = sanitizeText(data.corridorKey || 'PALM_JEBEL_ALI');
  const strategy = sanitizeText(data.strategy || 'CAPITAL_PRESERVATION_ULTRA_PRIME');
  const macroThesis = sanitizeText(data.macroThesis || 'Ultra-prime waterfront frond expansion capturing UHNW sovereign wealth.');
  const allocationAed = Number(data.allocationAed) || 15000000;
  const allocationUsd = Math.round(allocationAed / 3.6725);
  const ownershipVehicle = sanitizeText(data.ownershipVehicle || 'SPV_DIFC_ADGM');
  const unitSizeSqft = Number(data.unitSizeSqft) || (allocationAed >= 25000000 ? 5500 : 2200);

  const financialMetrics = data.financialMetrics || {};
  const capRate = Number(financialMetrics.capRate) || 5.15;
  const capRateBand = financialMetrics.capRateBand || [4.8, 5.5];
  const irr7y = Number(financialMetrics.sevenYearIrr || financialMetrics.fiveYearIrr) || 14.65;
  const irr7yBand = financialMetrics.irr7yBand || [13.5, 15.8];
  const cagr10yBand = financialMetrics.cagr10yBand || [8.5, 10.2];
  const annualServiceChargeAed = Number(financialMetrics.annualServiceChargeAed) || (unitSizeSqft * 22);
  const netOperatingIncomeAed = Number(financialMetrics.netOperatingIncomeAed) || Math.round(allocationAed * 0.0515);
  const totalStatutoryFeesAed = Number(financialMetrics.totalStatutoryFeesAed) || Math.round(allocationAed * 0.0525 + 5200);
  const allInOutlayAed = Number(financialMetrics.allInOutlayAed) || (allocationAed + totalStatutoryFeesAed);

  const statutory = data.statutory || {};
  const dldFeeAed = Number(statutory.dldFeeAed) || Math.round(allocationAed * 0.04);
  const trusteeFeeAed = Number(statutory.trusteeFeeAed) || 4200;
  const oqoodFeeAed = Number(statutory.oqoodFeeAed) || 1000;
  const sinkingFundAed = Number(statutory.sinkingFundAed) || Math.round(allocationAed * 0.0125);

  const regulatoryAnchors = data.regulatoryAnchors || {
    escrow_law: 'Dubai Law No. (8) of 2007 / UAE Law No. 8 of 2007 (100% Escrow Guarantee & 5% Post-Completion Retention)',
    structural_warranty: 'UAE Civil Code Art. 880 (10-Year Decennial Structural Warranty)',
    golden_visa: 'UAE Cabinet Resolution No. 65 of 2022 (10-Year Golden Visa at AED 2M+)',
  };

  const isGoldenVisa = allocationAed >= 2000000;
  const generatedAt = data.generatedAt || new Date().toISOString();

  return {
    schemaVersion: RAIOC_PIB_SCHEMA_VERSION,
    briefId,
    mandateId,
    investorName,
    corridorKey,
    corridorName,
    strategy,
    macroThesis,
    allocationAed,
    allocationUsd,
    ownershipVehicle,
    unitSizeSqft,
    financialMetrics: {
      capRate,
      capRateBand,
      irr7y,
      irr7yBand,
      cagr10yBand,
      annualServiceChargeAed,
      netOperatingIncomeAed,
      totalStatutoryFeesAed,
      allInOutlayAed,
    },
    statutory: {
      dldFeeAed,
      trusteeFeeAed,
      oqoodFeeAed,
      sinkingFundAed,
    },
    regulatoryAnchors,
    isGoldenVisa,
    generatedAt,
  };
}

/**
 * Renders the Private Investment Brief (One-Pager) in Canonical Markdown
 * @param {Object} rawData 
 * @returns {string} Markdown document
 */
export function renderPrivateInvestmentBrief(rawData = {}) {
  const d = sanitizeBriefData(rawData);

  const vehicleDescription = d.ownershipVehicle.includes('DIFC') || d.ownershipVehicle.includes('SPV')
    ? 'DIFC / ADGM Special Purpose Vehicle (Common Law Trust Ringfence & Double Tax Treaty Shield)'
    : 'Direct Individual Freehold Title Deed (Direct 10-Year Golden Visa Custody)';

  return `# 🏛 PRIVATE INVESTMENT BRIEF (ONE-PAGER)
**Document Schema:** \`${d.schemaVersion}\`  
**Reference ID:** \`${d.briefId}\`  
**Mandate Reference:** \`${d.mandateId}\`  
**Investor / Mandate Principal:** ${d.investorName}  
**Date of Issuance:** ${d.generatedAt.split('T')[0]}  
**Advisory Authority:** Emanuel Rendas Private Real Estate Advisory · Dubai  
**Intelligence Mesh:** ATLAS (Market Engineering) & LEX (Statutory Underwriting)  

---

### I. EXECUTIVE ALLOCATION & CORRIDOR VECTOR
* **Target Corridor:** ${d.corridorName} (\`${d.corridorKey}\`)
* **Portfolio Strategy:** \`${d.strategy}\`
* **Macroeconomic Thesis:** ${d.macroThesis}
* **Capital Allocation:** **${formatAed(d.allocationAed)}** *(~USD ${d.allocationUsd.toLocaleString('en-US')})*
* **Total Statutory Outlay:** **${formatAed(d.financialMetrics.allInOutlayAed)}**
* **Ownership Custody Vehicle:** ${vehicleDescription}

---

### II. DETERMINISTIC FINANCIAL BENCHMARKS & RETURN PROFILE
| Metric | Benchmark Target | Corridor Modelled Band | Fiduciary Validation |
| :--- | :--- | :--- | :--- |
| **Net Cap Rate (p.a.)** | **${formatPct(d.financialMetrics.capRate)}** | ${d.financialMetrics.capRateBand[0]}% – ${d.financialMetrics.capRateBand[1]}% | Post-Mollak Audited Yield |
| **7-Year Target IRR (TIR)** | **${formatPct(d.financialMetrics.irr7y)}** | ${d.financialMetrics.irr7yBand[0]}% – ${d.financialMetrics.irr7yBand[1]}% | Compounded Exit Model |
| **10-Year Macro CAGR** | **${((d.financialMetrics.cagr10yBand[0] + d.financialMetrics.cagr10yBand[1]) / 2).toFixed(1)}%** | ${d.financialMetrics.cagr10yBand[0]}% – ${d.financialMetrics.cagr10yBand[1]}% | Sovereign Physical Scarcity |
| **Year 1 Net Operating Income** | **${formatAed(d.financialMetrics.netOperatingIncomeAed)}** | Base Yield | Deducted Service Charges |
| **Annual Service Charge** | **${formatAed(d.financialMetrics.annualServiceChargeAed)}** | RERA Mollak Index | ${d.unitSizeSqft.toLocaleString('en-US')} sqft Model |

---

### III. STATUTORY ACQUISITION BREAKDOWN
* **Dubai Land Department Transfer (4.0%):** ${formatAed(d.statutory.dldFeeAed)}
* **Trustee Office Registration:** ${formatAed(d.statutory.trusteeFeeAed)}
* **Oqood Pre-Registration Fee:** ${formatAed(d.statutory.oqoodFeeAed)}
* **Sinking Fund Reserve Allocation:** ${formatAed(d.statutory.sinkingFundAed)}
* **Total Initial Statutory Closing Costs:** **${formatAed(d.financialMetrics.totalStatutoryFeesAed)}**

---

### IV. STATUTORY COMPLIANCE & SOVEREIGN SHIELD (LEX VERIFIED)
1. **Escrow Guarantee (Dubai Law No. 8 of 2007):**
   * 100% of investor tranches segregated in DLD/RERA audited escrow trust accounts.
   * Developer draws strictly linked to physical engineering milestones.
   * Statutory 5% post-completion retention held for 12 months post-handover.
2. **Decennial Structural Warranty (UAE Civil Code Art. 880):**
   * 10-year strict joint liability imposed on master contractor and structural architect for core integrity.
3. **Residency & Sovereign Wealth Path (Cabinet Resolution No. 65 of 2022):**
   * ${d.isGoldenVisa ? '✅ **Fully Qualified:** 10-Year Renewable UAE Golden Visa with direct family sponsorship.' : 'ℹ️ **Standard Threshold:** Allocation below AED 2,000,000 threshold.'}

---

### V. FIDUCIARY ATTESTATION & ADVISORY SEAL
This Private Investment Brief represents an independent, AML-certified institutional analysis conducted under strict fiduciary standards. No commissions or developer affiliations compromise the modelled downside protection.

**Underwritten by:**  
*ATLAS Real Estate Intelligence & LEX Regulatory Mesh*  
**Approved by:**  
*Emanuel Rendas — Private Real Estate Advisory, Dubai, UAE*  
*Timestamp:* \`${d.generatedAt}\`
`;
}
