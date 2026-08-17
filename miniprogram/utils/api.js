const app = getApp();

/**
 * 将对象转换为 URL 查询参数字符串
 */
function toQueryString(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
}

/**
 * 后端 API 请求封装
 */
const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const baseUrl = app.globalData.apiBaseUrl;
    let requestUrl = `${baseUrl}${url}`;

    // GET 请求：手动拼接 query 参数到 URL
    if ((options.method || 'GET') === 'GET' && options.data) {
      const qs = toQueryString(options.data);
      if (qs) {
        requestUrl += (requestUrl.includes('?') ? '&' : '?') + qs;
      }
    }

    wx.request({
      url: requestUrl,
      method: options.method || 'GET',
      // POST 等非 GET 请求才把 data 放 body
      data: (options.method || 'GET') === 'GET' ? undefined : options.data || {},
      header: {
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({
            code: res.statusCode,
            message: res.data?.error || '请求失败',
          });
        }
      },
      fail: (err) => {
        reject({
          code: -1,
          message: '网络请求失败，请检查后端服务是否已启动',
          detail: err,
        });
      },
    });
  });
};

/**
 * API 接口
 */
module.exports = {
  // 健康检查
  health: () => request('/health'),

  // 搜索玩家
  searchPlayers: (platform, name) =>
    request('/players/search', {
      data: { platform, name },
    }),

  // 获取玩家详情
  getPlayerDetail: (platform, id) =>
    request(`/players/${id}`, { data: { platform } }),

  // 获取赛季列表
  getSeasons: (platform) =>
    request('/seasons', { data: { platform } }),

  // 获取玩家赛季战绩
  getSeasonStats: (platform, seasonId, accountId) =>
    request(`/seasons/${seasonId}/player/${accountId}`, {
      data: { platform },
    }),

  // 获取玩家生涯战绩
  getLifetimeStats: (platform, accountId) =>
    request(`/seasons/lifetime/${accountId}`, { data: { platform } }),

  // 获取比赛详情
  getMatchDetail: (platform, matchId) =>
    request(`/matches/${matchId}`, { data: { platform } }),

  // 批量获取比赛列表
  getMatchBatch: (platform, ids) =>
    request('/matches/batch/list', {
      data: { platform, ids: ids.join(',') },
    }),
};