# 云同步服务

一个 Cloudflare Pages 项目，只做一件事：按**同步码**读写整份数据 JSON。合并逻辑在客户端，服务端不解释内容。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sync?code=XXXXXXXX` | 取回该码对应的数据；没有则 404 |
| PUT | `/api/sync` | 请求体 `{ code, payload }`，写入该码的数据 |

同步码：大写字母与数字，8–64 位。单份载荷上限 2 MB（只同步文本、拼音、注释与复习进度；录音不参与）。

## 部署（两条命令，需要一次 Cloudflare 授权）

```bash
# 1. 授权（浏览器里点一次 Allow）
npx wrangler login

# 2. 建 KV 命名空间，把返回的 id 填进 wrangler.toml
npx wrangler kv namespace create GUOXUE_SYNC

# 3. 建项目并部署（首次会创建 guoxue-sync 项目）
npx wrangler pages project create guoxue-sync --production-branch main
npx wrangler pages deploy . --project-name guoxue-sync
```

部署完成后接口地址是：

```
https://guoxue-sync.pages.dev/api/sync
```

App 的「设置 → 云同步」里默认就填这个地址，你只需要输入同步码。

## 安全边界（如实说明）

- **没有账号体系**：同步码就是钥匙。知道码的人可以读写对应数据，所以用随机生成的 12 位码，不要用「11111111」这种。
- 数据是**明文**存在 KV 里（Cloudflare 侧可读）。目前同步的是文本、拼音、注释与复习进度，不含录音。
- 想更严格的话，下一步可以做「端到端加密」：用同步码派生密钥，在客户端加密后再上传，服务端只存密文。
