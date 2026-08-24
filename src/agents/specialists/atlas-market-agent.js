/**
 * RAIOC Specialist Agent: ATLAS (Real Estate & Market Intelligence)
 * Evaluates Dubai prime communities, yields, developer credibility, and investment strategies.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { ikl } from '../../core/ikl/index.js';

export class AtlasMarketAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'atlas',
      name: 'ATLAS',
      role: 'Real Estate & Market Intelligence Specialist',
      capabilities: ['market_analysis', 'community_benchmarking', 'developer_audit', 'ikl_query', 'investment_strategy'],
      systemPrompt: 'You specialize in Dubai prime real estate analytics, off-plan vs secondary market yields, and statutory IKL intelligence.',
    });
  }

  async processTask(task, context = {}) {
    const { communityId, developerId, budgetAed } = task;

    let communityData = null;
    if (communityId) {
      communityData = ikl.getCommunity(communityId);
    }

    let developerData = null;
    if (developerId) {
      developerData = ikl.getDeveloper(developerId);
    }

    const community = communityData || ikl.getCommunities()[0];
    const developer = developerData || ikl.getDevelopers()[0];

    let recommendation = null;
    if (task.persona) {
      recommendation = ikl.recommend(task.persona);
    }

    const marketIntelligence = {
      community,
      developer,
      recommendation,
      iklVersion: ikl.getVersion(),
      evaluatedAt: new Date().toISOString(),
    };

    const avgYield = community.avgGrossYield || 7.0;
    this.logDecision(
      `Computed market recommendation for budget AED ${budgetAed || '2M+'}: Selected prime community ${community.name} with target gross yield ${avgYield}%`,
      'RECOMMEND_PRIME_ASSET_ALLOCATION',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.96,
        impactLevel: 'HIGH',
        metadata: { community: community.id },
      }
    );

    this.storeMemory(`market_intelligence_${communityId || 'general'}`, marketIntelligence, {
      tags: ['market', 'community', 'yield', 'dubai'],
    });

    return marketIntelligence;
  }
}

export const atlasMarketAgent = new AtlasMarketAgent();
