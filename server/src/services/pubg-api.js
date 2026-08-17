const axios = require('axios');
const config = require('../config');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * PUBG API 客户端
 * 封装对 PUBG 官方 API 的调用
 */
class PubgApiClient {
  constructor() {
    const axiosConfig = {
      baseURL: config.pubg.baseUrl,
      timeout: 15000,
      headers: {
        Accept: 'application/vnd.api+json',
      },
    };

    // 支持 HTTP 代理（大陆环境访问 PUBG API 可能需要）
    if (process.env.HTTP_PROXY) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(process.env.HTTP_PROXY);
    }

    this.client = axios.create(axiosConfig);

    // 请求拦截器：自动注入 API Key
    this.client.interceptors.request.use((req) => {
      req.headers.Authorization = `Bearer ${config.pubg.apiKey}`;
      return req;
    });
  }

  /**
   * 设置 API Key（运行时动态设置）
   */
  setApiKey(key) {
    config.pubg.apiKey = key;
  }

  /**
   * 获取当前 API Key 是否已设置
   */
  hasApiKey() {
    return !!config.pubg.apiKey && config.pubg.apiKey !== 'your_pubg_api_key_here';
  }

  /**
   * 按玩家昵称搜索
   * GET /shards/{platform}/players?filter[playerNames]={name}
   */
  async searchPlayers(platform, playerName) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(`/shards/${shard}/players`, {
      params: { 'filter[playerNames]': playerName },
    });
    return data;
  }

  /**
   * 按玩家 ID 获取详情
   * GET /shards/{platform}/players/{id}
   */
  async getPlayerById(platform, playerId) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(`/shards/${shard}/players/${playerId}`);
    return data;
  }

  /**
   * 获取赛季列表
   * GET /shards/{platform}/seasons
   */
  async getSeasons(platform) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(`/shards/${shard}/seasons`);
    return data;
  }

  /**
   * 获取玩家赛季数据
   * GET /shards/{platform}/players/{accountId}/seasons/{seasonId}
   */
  async getPlayerSeasonStats(platform, accountId, seasonId) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(
      `/shards/${shard}/players/${accountId}/seasons/${seasonId}`
    );
    return data;
  }

  /**
   * 获取玩家生涯数据
   * GET /shards/{platform}/players/{accountId}/seasons/lifetime
   */
  async getPlayerLifetimeStats(platform, accountId) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(
      `/shards/${shard}/players/${accountId}/seasons/lifetime`
    );
    return data;
  }

  /**
   * 获取比赛详情
   * GET /shards/{platform}/matches/{matchId}
   */
  async getMatchDetail(platform, matchId) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(`/shards/${shard}/matches/${matchId}`);
    return data;
  }

  /**
   * 获取采样比赛（用于测试）
   * GET /shards/{platform}/samples
   */
  async getSamples(platform) {
    const shard = config.pubg.shards[platform] || platform;
    const { data } = await this.client.get(`/shards/${shard}/samples`);
    return data;
  }
}

module.exports = new PubgApiClient();