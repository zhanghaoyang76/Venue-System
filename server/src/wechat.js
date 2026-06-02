const axios = require('axios');
const config = require('./config');

/**
 * @param {string} code wx.login 返回的 code
 * @returns {Promise<string>} openid
 */
async function codeToOpenId(code) {
  if (!config.wxAppId || !config.wxSecret) {
    throw new Error('未配置 WX_APPID / WX_SECRET，无法换取 openid。开发可设置 MOCK_AUTH=1 并使用 mockOpenId。');
  }

  const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: config.wxAppId,
      secret: config.wxSecret,
      js_code: code,
      grant_type: 'authorization_code',
    },
    timeout: 10000,
  });

  if (data.errcode) {
    throw new Error(`微信接口错误: ${data.errcode} ${data.errmsg || ''}`);
  }
  if (!data.openid) {
    throw new Error('微信未返回 openid');
  }
  return data.openid;
}

module.exports = { codeToOpenId };
