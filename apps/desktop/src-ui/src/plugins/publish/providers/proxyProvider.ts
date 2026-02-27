import type { PluginHostAPI } from '../../_framework/PluginHostAPI';
import type { ProxyConfig, WechatApiProvider, DraftParams } from '../wechatApiProvider';
import { wechatHttpRequest, checkWxError } from '../wechatApiProvider';

function apiHeaders(config: ProxyConfig): Record<string, string> {
  const h: Record<string, string> = {};
  if (config.apiKey) h['X-API-Key'] = config.apiKey;
  return h;
}

function apiUrl(config: ProxyConfig, path: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  return `${base}${path}`;
}

export function createProxyProvider(host: PluginHostAPI, config: ProxyConfig): WechatApiProvider {
  return {
    mode: 'proxy',
    label: '自建代理',

    async getAccessToken() {
      const body = await wechatHttpRequest(host, {
        url: apiUrl(config, '/api/wechat/token'),
        method: 'POST',
        headers: apiHeaders(config),
        jsonBody: config.appid ? { appid: config.appid, secret: config.secret } : undefined,
      });
      checkWxError(body);
      const obj = body as Record<string, unknown>;
      const accessToken = obj.access_token as string;
      const expiresIn = (obj.expires_in as number) || 7200;
      if (!accessToken) throw new Error('响应中缺少 access_token');
      return { accessToken, expiresIn };
    },

    async uploadThumb(accessToken: string, imagePath: string) {
      const h = apiHeaders(config);
      if (accessToken) h['X-Access-Token'] = accessToken;
      const body = await wechatHttpRequest(host, {
        url: apiUrl(config, '/api/wechat/upload/thumb'),
        method: 'POST',
        headers: h,
        fileField: 'media',
        filePath: imagePath,
      });
      checkWxError(body);
      const mediaId = (body as Record<string, unknown>).media_id as string;
      if (!mediaId) throw new Error('响应中缺少 media_id');
      return { mediaId };
    },

    async uploadContentImage(accessToken: string, imagePath: string) {
      const h = apiHeaders(config);
      if (accessToken) h['X-Access-Token'] = accessToken;
      const body = await wechatHttpRequest(host, {
        url: apiUrl(config, '/api/wechat/upload/image'),
        method: 'POST',
        headers: h,
        fileField: 'media',
        filePath: imagePath,
      });
      checkWxError(body);
      const imgUrl = (body as Record<string, unknown>).url as string;
      if (!imgUrl) throw new Error('响应中缺少 url');
      return { url: imgUrl };
    },

    async addDraft(accessToken: string, params: DraftParams) {
      const h = apiHeaders(config);
      if (accessToken) h['X-Access-Token'] = accessToken;
      const article: Record<string, unknown> = {
        article_type: 'news',
        title: params.title,
        content: params.content,
        thumb_media_id: params.thumbMediaId,
      };
      if (params.author) article.author = params.author;
      if (params.digest) article.digest = params.digest;
      if (params.contentSourceUrl) article.content_source_url = params.contentSourceUrl;
      if (params.needOpenComment !== undefined) article.need_open_comment = params.needOpenComment;
      if (params.onlyFansCanComment !== undefined) article.only_fans_can_comment = params.onlyFansCanComment;
      if (params.picCrop235_1) article.pic_crop_235_1 = params.picCrop235_1;
      if (params.picCrop1_1) article.pic_crop_1_1 = params.picCrop1_1;

      const body = await wechatHttpRequest(host, {
        url: apiUrl(config, '/api/wechat/draft/add'),
        method: 'POST',
        headers: h,
        jsonBody: { articles: [article] },
      });
      checkWxError(body);
      const mediaId = (body as Record<string, unknown>).media_id as string;
      if (!mediaId) throw new Error('响应中缺少 media_id');
      return { mediaId };
    },

    async testConnection() {
      try {
        const result = await this.getAccessToken();
        return { ok: true, msg: `代理连接成功，token 有效期 ${Math.floor(result.expiresIn / 60)} 分钟` };
      } catch (err) {
        return { ok: false, msg: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
