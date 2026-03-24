const TokenUsage = require('../models/TokenUsage');

/**
 * Track OpenAI token usage from a completion response.
 * @param {Object} response - The OpenAI API response
 * @param {Object} options - { userId, endpoint, feature }
 */
async function trackTokenUsage(response, options) {
  try {
    const usage = response.usage;
    console.log('[TokenTracker] Called for', options.feature, '| usage:', usage ? `prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}` : 'NO USAGE DATA');
    if (!usage) return;

    const result = await TokenUsage.logUsage({
      userId: options.userId,
      endpoint: options.endpoint,
      model: response.model || options.model || 'gpt-4o-mini',
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      feature: options.feature || 'other'
    });
    console.log('[TokenTracker] Saved:', result._id, 'tokens:', result.totalTokens);
  } catch (err) {
    console.error('[TokenTracker] Failed:', err.message);
  }
}

module.exports = trackTokenUsage;
