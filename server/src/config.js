try { require('dotenv').config(); } catch (e) { /* Railway 无 .env 文件 */ }

module.exports = {
  // PUBG API 配置
  pubg: {
    baseUrl: 'https://api.pubg.com',
    apiKey: process.env.PUBG_API_KEY || '',
    // Shard 映射：平台代码 -> PUBG shard 名称
    shards: {
      steam: 'steam',
      kakao: 'kakao',
      xbox: 'xbox',
      psn: 'psn',
    },
    // 支持的平台列表
    platforms: [
      { value: 'steam', label: 'Steam / Epic (PC)' },
      { value: 'kakao', label: 'Kakao (PC-韩服)' },
      { value: 'xbox', label: 'Xbox' },
      { value: 'psn', label: 'PlayStation' },
    ],
  },

  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10) || 3000,
  },

  // 请求限流
  rateLimit: {
    windowMs: 60 * 1000, // 1 分钟
    max: 30, // 每个 IP 每分钟最多 30 次请求
  },
};