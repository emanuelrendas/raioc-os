/**
 * RAIOC OS - Corridor Analytical Projection Engine (Phase 6)
 * 
 * Computes forward-looking real estate metrics across target sovereign corridors:
 * - Inventory Absorption Rate (Months of remaining stock)
 * - Historical & 3-Year Projected Compounded Price Trends (AED/sqft)
 * - 3-Year Gross & Net Rental Yield Projections
 */

export const CORRIDOR_CONFIGS = [
  {
    id: 'palm_jebel_ali',
    slug: 'palm-jebel-ali',
    name: 'Palm Jebel Ali',
    type: 'Ultra-Luxury Waterfront Mega-Fronds',
    masterDeveloper: 'Nakheel',
    activeInventoryUnits: 1200,
    monthlyAbsorptionVelocityUnits: 75,
    baseHistoricalPricePerSqftAed: 3200,
    annualCapitalGrowthRate: 0.125, // 12.5% p.a.
    baseGrossYield: 6.5,
    baseNetYield: 5.2,
    serviceChargePerSqft: 22,
  },
  {
    id: 'dubai_islands',
    slug: 'dubai-islands',
    name: 'Dubai Islands',
    type: 'Emerging Prime Coastal Archipelago',
    masterDeveloper: 'Nakheel',
    activeInventoryUnits: 1850,
    monthlyAbsorptionVelocityUnits: 110,
    baseHistoricalPricePerSqftAed: 2400,
    annualCapitalGrowthRate: 0.110, // 11.0% p.a.
    baseGrossYield: 7.4,
    baseNetYield: 6.1,
    serviceChargePerSqft: 18,
  },
  {
    id: 'dubai_hills',
    slug: 'dubai-hills-estate',
    name: 'Dubai Hills Estate',
    type: 'Master-Planned Green Community',
    masterDeveloper: 'Emaar Properties',
    activeInventoryUnits: 950,
    monthlyAbsorptionVelocityUnits: 85,
    baseHistoricalPricePerSqftAed: 2100,
    annualCapitalGrowthRate: 0.085, // 8.5% p.a.
    baseGrossYield: 7.1,
    baseNetYield: 5.8,
    serviceChargePerSqft: 19,
  },
  {
    id: 'palm_jumeirah',
    slug: 'palm-jumeirah',
    name: 'Palm Jumeirah',
    type: 'Ultra-Luxury Waterfront Icon',
    masterDeveloper: 'Nakheel',
    activeInventoryUnits: 620,
    monthlyAbsorptionVelocityUnits: 55,
    baseHistoricalPricePerSqftAed: 3850,
    annualCapitalGrowthRate: 0.075, // 7.5% p.a.
    baseGrossYield: 6.2,
    baseNetYield: 4.9,
    serviceChargePerSqft: 25,
  },
];

export class CorridorProjectionEngine {
  /**
   * Calculates months of remaining inventory (Absorption Rate)
   * @param {number} activeStock - Active available units
   * @param {number} monthlyVelocity - Average monthly transactions
   * @returns {number} Months of stock remaining
   */
  calculateAbsorption(activeStock, monthlyVelocity) {
    if (!monthlyVelocity || monthlyVelocity <= 0) return 0;
    return Number((activeStock / monthlyVelocity).toFixed(1));
  }

  /**
   * Projects price per sqft across 3 years with compounding capital appreciation
   * @param {number} basePriceSqft - Historical/Current price per sqft
   * @param {number} annualGrowthRate - Compounding growth rate (e.g. 0.125)
   * @param {number} years - Forecast horizon (default: 3)
   * @returns {Array<Object>} Price projections by year
   */
  projectPriceCompounding(basePriceSqft, annualGrowthRate, years = 3) {
    const projections = [];
    let currentPrice = basePriceSqft;

    for (let yr = 1; yr <= years; yr++) {
      currentPrice = currentPrice * (1 + annualGrowthRate);
      const roundedPrice = Math.round(currentPrice);
      const cumulativeGrowthPct = Number((((roundedPrice - basePriceSqft) / basePriceSqft) * 100).toFixed(1));

      projections.push({
        year: yr,
        projectedPricePerSqftAed: roundedPrice,
        annualGrowthRatePct: Number((annualGrowthRate * 100).toFixed(1)),
        cumulativeGrowthPercent: cumulativeGrowthPct,
      });
    }

    return projections;
  }

  /**
   * Projects 3-Year Gross and Net Yield progression
   * @param {number} baseGross - Base gross yield %
   * @param {number} baseNet - Base net yield %
   * @param {number} years - Horizon (default: 3)
   * @returns {Array<Object>} 3-Year yield progression
   */
  projectYieldArbitrage(baseGross, baseNet, years = 3) {
    const projections = [];
    for (let yr = 1; yr <= years; yr++) {
      // Yield escalation curve as infrastructure matures and demand ramps
      const grossYield = Number((baseGross + (yr - 1) * 0.35).toFixed(2));
      const netYield = Number((baseNet + (yr - 1) * 0.32).toFixed(2));

      projections.push({
        year: yr,
        grossYieldPercent: grossYield,
        netYieldPercent: netYield,
        arbitrageSpreadPercent: Number((grossYield - netYield).toFixed(2)),
      });
    }
    return projections;
  }

  /**
   * Generates comprehensive projection report for a specific corridor or all target corridors
   * @param {string} corridorQuery - Corridor ID, slug, or name (or 'all')
   * @returns {Object} Analytical projection package
   */
  getCorridorInsights(corridorQuery = 'all') {
    const q = String(corridorQuery).toLowerCase().replace(/[_-]/g, ' ').trim();
    let targets = CORRIDOR_CONFIGS;

    if (q && q !== 'all') {
      targets = CORRIDOR_CONFIGS.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (q.includes('jebel ali') && c.id === 'palm_jebel_ali') ||
          (q.includes('islands') && c.id === 'dubai_islands') ||
          (q.includes('hills') && c.id === 'dubai_hills')
      );
      if (targets.length === 0) targets = CORRIDOR_CONFIGS;
    }

    const corridorInsights = targets.map((cfg) => {
      const absorptionMonths = this.calculateAbsorption(cfg.activeInventoryUnits, cfg.monthlyAbsorptionVelocityUnits);
      const priceProjections = this.projectPriceCompounding(cfg.baseHistoricalPricePerSqftAed, cfg.annualCapitalGrowthRate, 3);
      const yieldProjections = this.projectYieldArbitrage(cfg.baseGrossYield, cfg.baseNetYield, 3);

      return {
        corridorId: cfg.id,
        corridorName: cfg.name,
        type: cfg.type,
        masterDeveloper: cfg.masterDeveloper,
        inventoryMetrics: {
          activeInventoryUnits: cfg.activeInventoryUnits,
          monthlyAbsorptionVelocityUnits: cfg.monthlyAbsorptionVelocityUnits,
          inventoryAbsorptionMonths: absorptionMonths,
          stockStatus: absorptionMonths < 12 ? 'HIGH_ABSORPTION_SCARCITY' : 'HEALTHY_EXPANSION',
        },
        pricingMetrics: {
          baseHistoricalPricePerSqftAed: cfg.baseHistoricalPricePerSqftAed,
          annualCapitalGrowthRatePercent: Number((cfg.annualCapitalGrowthRate * 100).toFixed(1)),
          threeYearPriceProjections: priceProjections,
          projectedPricePerSqftAedYear1: priceProjections[0]?.projectedPricePerSqftAed,
          projectedPricePerSqftAedYear3: priceProjections[2]?.projectedPricePerSqftAed,
        },
        yieldMetrics: {
          baseGrossYieldPercent: cfg.baseGrossYield,
          baseNetYieldPercent: cfg.baseNetYield,
          threeYearYieldProjections: yieldProjections,
          projectedNetYieldYear3: yieldProjections[2]?.netYieldPercent,
        },
        calculatedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      corridorCount: corridorInsights.length,
      corridors: corridorInsights,
      summary: {
        highestAbsorptionRateCorridor: [...corridorInsights].sort((a, b) => a.inventoryMetrics.inventoryAbsorptionMonths - b.inventoryMetrics.inventoryAbsorptionMonths)[0]?.corridorName,
        highestGrowthCorridor: [...corridorInsights].sort((a, b) => b.pricingMetrics.annualCapitalGrowthRatePercent - a.pricingMetrics.annualCapitalGrowthRatePercent)[0]?.corridorName,
        highestYieldCorridor: [...corridorInsights].sort((a, b) => b.yieldMetrics.baseGrossYieldPercent - a.yieldMetrics.baseGrossYieldPercent)[0]?.corridorName,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const corridorProjectionEngine = new CorridorProjectionEngine();
